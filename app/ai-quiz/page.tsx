'use client';

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Sparkles, Loader2, Lightbulb, Wand2, ArrowLeft, Download, Edit, ArrowRight, FileDown, Printer, Save, GripVertical, ArrowUp, ArrowDown, Plus, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/PageHeader";
import { 
  DragDropContext, 
  Draggable, 
  Droppable,
  DroppableProvided,
  DraggableProvided
} from 'react-beautiful-dnd';
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useLanguage } from "@/app/contexts/LanguageContext";
import { useTranslation } from "@/utils/translations";

// Import text extraction libraries
import { quizPayloadSchema, parseSavedQuiz, isCorrectQuizAnswer, isCorrectQuizOption, type Quiz, type QuizQuestion } from '@/lib/quiz';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';

// QuizCreator component
interface QuizCreatorProps {
  inputContent: string;
  setInputContent: React.Dispatch<React.SetStateAction<string>>;
  questionType: string;
  setQuestionType: React.Dispatch<React.SetStateAction<string>>;
  numQuestions: string;
  setNumQuestions: React.Dispatch<React.SetStateAction<string>>;
  additionalInstructions: string;
  setAdditionalInstructions: React.Dispatch<React.SetStateAction<string>>;
  outputLanguage: string;
  setOutputLanguage: React.Dispatch<React.SetStateAction<string>>;
  level: string;
  setLevel: React.Dispatch<React.SetStateAction<string>>;
  isGenerating: boolean;
  onGenerateQuiz: (files: File[]) => void; // Modified to accept files
  selectedFiles: File[]; // New prop
  setSelectedFiles: React.Dispatch<React.SetStateAction<File[]>>; // New prop
}

const QuizCreator: React.FC<QuizCreatorProps> = ({
  inputContent,
  setInputContent,
  questionType,
  setQuestionType,
  numQuestions,
  setNumQuestions,
  additionalInstructions,
  setAdditionalInstructions,
  outputLanguage,
  setOutputLanguage,
  level,
  setLevel,
  isGenerating,
  onGenerateQuiz,
  selectedFiles, // New prop
  setSelectedFiles // New prop
}) => {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setSelectedFiles(prevFiles => [...prevFiles, ...Array.from(event.target.files || [])]);
    }
  };

  const handleRemoveFile = (fileName: string) => {
    setSelectedFiles(prevFiles => prevFiles.filter(file => file.name !== fileName));
  };
  
  return (
    <div className="mx-auto max-w-3xl">
      <Card className="border-border/80 p-5 shadow-none sm:p-8">
        <div className="mb-7 flex items-center gap-4 border-b border-border/70 pb-5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Wand2 size={22} />
          </div>
          <div>
            <h2 className="text-lg font-semibold">{t('enter_quiz_topic')}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t('create_custom_quizzes')}</p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="w-full">
            <Label className="text-sm font-medium mb-2 block text-gray-700">{t('enter_quiz_topic')}</Label>
            <Textarea 
              value={inputContent}
              onChange={(e) => setInputContent(e.target.value)}
              placeholder={t('quiz_topic_placeholder')}
              rows={4}
              className="w-full resize-none border-indigo-100 focus:border-indigo-300 focus:ring-1 focus:ring-indigo-300 rounded-lg"
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <Label className="text-sm font-medium mb-2 block text-gray-700">{t('question_type')}</Label>
              <Select value={questionType} onValueChange={setQuestionType}>
                <SelectTrigger className="border-indigo-100 focus:border-indigo-300 focus:ring-1 focus:ring-indigo-300">
                  <SelectValue placeholder={t('multiple_choice')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="multiple-choice">{t('multiple_choice')}</SelectItem>
                  <SelectItem value="true-false">{t('true_false')}</SelectItem>
                  <SelectItem value="short-answer">{t('short_answer')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label className="text-sm font-medium mb-2 block text-gray-700">{t('number_of_questions')}</Label>
              <Select value={numQuestions} onValueChange={setNumQuestions}>
                <SelectTrigger className="border-indigo-100 focus:border-indigo-300 focus:ring-1 focus:ring-indigo-300">
                  <SelectValue placeholder="10" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5</SelectItem>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="15">15</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="w-full">
            <Label className="text-sm font-medium mb-2 block text-gray-700">{t('additional_instructions')}</Label>
            <Textarea 
              value={additionalInstructions}
              onChange={(e) => setAdditionalInstructions(e.target.value)}
              placeholder={t('additional_instructions_placeholder')}
              rows={3}
              className="w-full border-indigo-100 focus:border-indigo-300 focus:ring-1 focus:ring-indigo-300 rounded-lg"
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <Label className="text-sm font-medium mb-2 block text-gray-700">{t('difficulty_level')}</Label>
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger className="border-indigo-100 focus:border-indigo-300 focus:ring-1 focus:ring-indigo-300">
                  <SelectValue placeholder={t('quiz_select_level')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="beginner">{t('beginner')}</SelectItem>
                  <SelectItem value="intermediate">{t('intermediate')}</SelectItem>
                  <SelectItem value="advanced">{t('advanced')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label className="text-sm font-medium mb-2 block text-gray-700">{t('output_language')}</Label>
              <Select value={outputLanguage} onValueChange={setOutputLanguage}>
                <SelectTrigger className="border-indigo-100 focus:border-indigo-300 focus:ring-1 focus:ring-indigo-300">
                  <SelectValue placeholder="English" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="English">English</SelectItem>
                  <SelectItem value="繁體中文">繁體中文</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* File Upload Section */}
          <div className="w-full">
            <Label className="text-sm font-medium mb-2 block text-gray-700">{t('upload_files_label')}</Label>
            <div 
              className="relative border border-dashed border-slate-200 rounded-lg p-8 transition-all duration-300 ease-in-out hover:border-[#1e40af] group bg-slate-50/50 hover:bg-white"
              style={{ 
                borderWidth: '2px',
                boxShadow: '0 0 0 0 rgba(30, 64, 175, 0)',
              }}
              onMouseEnter={(e) => {
                const target = e.currentTarget;
                target.style.boxShadow = '0 0 0 4px rgba(30, 64, 175, 0.1)';
              }}
              onMouseLeave={(e) => {
                const target = e.currentTarget;
                target.style.boxShadow = '0 0 0 0 rgba(30, 64, 175, 0)';
              }}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                multiple
                accept="image/*,.doc,.docx,.pdf,.txt"
                aria-label={t('upload_files_label')}
              />
              <div className="flex flex-col items-center justify-center gap-4">
                <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center group-hover:bg-blue-50 transition-colors duration-300">
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    className="w-6 h-6 text-slate-400 group-hover:text-[#1e40af] transition-all duration-300 transform group-hover:scale-110" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" 
                    />
                  </svg>
                </div>
                <div className="text-center space-y-2">
                  <p className="text-base text-slate-600 group-hover:text-[#1e40af] transition-colors duration-300">
                    {t('upload_files_or_drag_and_drop')}
                  </p>
                  <p className="text-sm text-slate-500">
                    {t('accepted_file_types')}
                  </p>
                </div>
              </div>
            </div>
            {selectedFiles.length > 0 && (
              <div className="mt-4 space-y-3">
                <p className="text-sm font-medium text-slate-700">{t('selected_files')}:</p>
                <div className="space-y-2">
                  {selectedFiles.map((file) => (
                    <div 
                      key={file.name} 
                      className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200 hover:border-slate-300 transition-colors duration-200"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center">
                          <svg className="w-4 h-4 text-[#1e40af]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <span className="text-sm text-slate-600">{file.name}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(file.name)}
                        className="text-slate-400 hover:text-red-500 transition-colors duration-200"
                        aria-label={`${t('delete')}: ${file.name}`}
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <Button
            className="w-full py-6 text-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl shadow-md shadow-indigo-200 transition-all duration-300 transform hover:translate-y-[-2px]"
            onClick={() => onGenerateQuiz(selectedFiles)} // Pass selectedFiles to handler
            disabled={isGenerating || !inputContent.trim()}
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                {t('generating_quiz')}
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-5 w-5" />
                {t('generate_quiz')}
              </>
            )}
          </Button>
          
          <div className="flex items-center justify-center gap-2 p-3 bg-indigo-50 rounded-lg mt-4">
            <Lightbulb size={16} className="text-amber-500" />
            <p className="text-xs text-gray-600">
              {t('powered_by_gemini')}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};

// QuizResults component
interface QuizResultsProps {
  quiz: Quiz;
  onBack: () => void;
  onSave: (quiz: Quiz) => Promise<boolean>;
  isSaving: boolean;
}

const QuizResults: React.FC<QuizResultsProps> = ({ 
  quiz, 
  onBack, 
  onSave,
  isSaving 
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [showAnswers, setShowAnswers] = useState(false); // Changed initial state to false for student version by default
  const [exportFormat, setExportFormat] = useState<string>('pdf');
  const [showExportOptions, setShowExportOptions] = useState(false);
  const quizContentRef = useRef<HTMLDivElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const exportButtonRef = useRef<HTMLButtonElement>(null);
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editedQuestions, setEditedQuestions] = useState<QuizQuestion[]>(quiz.questions);
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const [showQuizInterface, setShowQuizInterface] = useState(false);
  const [userAnswers, setUserAnswers] = useState<Record<string, string | string[]>>({});
  const [quizScore, setQuizScore] = useState<number | null>(null);
  const [showUserReview, setShowUserReview] = useState(false); // New state for user's answer review

  const draftDirty = JSON.stringify(editedQuestions) !== JSON.stringify(quiz.questions);
  const confirmLeave = useUnsavedChanges(!quiz.persisted || draftDirty, isSaving);
  useEffect(() => { setEditedQuestions(quiz.questions); }, [quiz.questions]);
  const saveDraft = async () => {
    if (isSaving) return false;
    return onSave({ ...quiz, questions: editedQuestions });
  };

  // Handle clicks outside the export dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        showExportOptions && 
        exportMenuRef.current && 
        exportButtonRef.current && 
        !exportMenuRef.current.contains(event.target as Node) && 
        !exportButtonRef.current.contains(event.target as Node)
      ) {
        setShowExportOptions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showExportOptions]);

  const handleExport = async (format: string) => {
    if (!quizContentRef.current) {
      toast({
        title: t('export_failed'),
        description: t('quiz_content_not_available'),
        variant: "destructive"
      });
      return;
    }

    if (isExporting || isSaving || isEditing) return;
    setIsExporting(true);
    try {
      // Create a clone of the quiz content to modify for export
      const element = quizContentRef.current.cloneNode(true) as HTMLElement;
      
      // Remove any buttons or interactive elements
      const buttonsToRemove = element.querySelectorAll('button');
      buttonsToRemove.forEach(button => button.remove());
      
      // 使用測驗主題作為檔名，移除非法字符並轉換為小寫
      const safeTitle = quiz.title
        .trim()
        .replace(/[\\/:*?"<>|]/g, '') // 移除文件系統不允許的字符
        .replace(/\s+/g, '_'); // 將空格替換為下劃線
      
      switch (format) {
        case 'microsoft-word': {
          // 動態導入docx庫，避免SSR問題
          await import('docx').then(async (docx) => {
            try {
              // Create Document with explicit typing
              // Add questions directly to the first section we created above
              const questionParagraphs: any[] = [];
              
              // Create all question paragraphs first
              quiz.questions.forEach((question, index) => {                
                // Add question title
                questionParagraphs.push(
                  new docx.Paragraph({
                    text: `Question ${index + 1}: ${question.questionText}`,
                    heading: docx.HeadingLevel.HEADING_2
                  })
                );
                
                // Add options
                question.options.forEach(option => {
                  const isCorrect = isCorrectQuizOption(option.id, question.correctAnswer);
                  
                  questionParagraphs.push(
                    new docx.Paragraph({
                      children: [
                        new docx.TextRun({
                          text: `${option.id.toUpperCase()}. ${option.text}`,
                          bold: isCorrect && showAnswers,
                          color: isCorrect && showAnswers ? "2E7D32" : "000000"
                        }),
                        new docx.TextRun({
                          text: isCorrect && showAnswers ? " ✓" : "",
                          bold: true,
                          color: "2E7D32"
                        })
                      ],
                      indent: { left: 720 }
                    })
                  );
                });
                
                // Add explanation (if in teacher mode)
                if (showAnswers) {
                  questionParagraphs.push(
                    new docx.Paragraph({
                      children: [
                        new docx.TextRun({
                          text: t('explanation_colon'),
                          bold: true
                        })
                      ]
                    }),
                    new docx.Paragraph({
                      text: question.explanation,
                      indent: { left: 720 }
                    })
                  );
                }
                
                // Add separator
                questionParagraphs.push(new docx.Paragraph({}));
              });
              
              // Create a new document with all content in one section
              const doc = new docx.Document({
                sections: [{
                  properties: {},
                  children: [
                    // Title
                    new docx.Paragraph({
                      text: quiz.title,
                      heading: docx.HeadingLevel.HEADING_1,
                      alignment: docx.AlignmentType.CENTER
                    }),
                    
                    // Subtitle
                    new docx.Paragraph({
                      text: `${quiz.questions.length} Questions`,
                      alignment: docx.AlignmentType.CENTER
                    }),
                    
                    // All questions
                    ...questionParagraphs
                  ]
                }]
              });
              
              // Convert to Blob and download
              const buffer = await docx.Packer.toBuffer(doc);
              const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = `${safeTitle}.docx`;
              link.click();
              
              toast({
                title: t('word_file_downloaded'),
                description: t('word_file_generated_desc'),
                duration: 5000,
              });

              setTimeout(() => URL.revokeObjectURL(url), 100);
            } catch (error) {
              console.error("Word document generation error:", error);
              toast({
                title: t('export_failed'),
                description: t('word_doc_generation_failed'),
                variant: "destructive",
              });
            }
          }).catch(error => {
            console.error("Word document import error:", error);
            toast({
              title: t('export_failed'),
              description: t('word_doc_generation_failed'),
              variant: "destructive",
            });
          });
          break;
        }
        
        case 'google-docs': {
          // 為 Google Docs 準備適合的 HTML 格式
          const styles = `
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; }
              .quiz-title { font-size: 24px; font-weight: bold; text-align: center; margin-bottom: 20px; }
              .quiz-subtitle { font-size: 16px; text-align: center; margin-bottom: 30px; color: #666; }
              .question { margin-bottom: 30px; }
              .question-text { font-weight: bold; margin-bottom: 10px; }
              .options { margin-left: 20px; }
              .option { margin-bottom: 5px; }
              .correct { color: #34a853; font-weight: bold; }
              .explanation { background-color: #f8f9fa; padding: 10px; border-left: 4px solid #4285f4; margin-top: 10px; }
            </style>
          `;

          // 手動構建更適合 Google Docs 的內容
          let docContent = `
            <html>
            <head>
              <meta charset="UTF-8">
              <title>${quiz.title}</title>
              ${styles}
            </head>
            <body>
              <div class="quiz-title">${quiz.title}</div>
              <div class="quiz-subtitle">${quiz.questions.length} Questions - Generated on ${new Date().toLocaleDateString()}</div>
          `;

          // 添加每個問題
          quiz.questions.forEach((question, index) => {
            docContent += `
              <div class="question">
                <div class="question-text">Question ${index + 1}: ${question.questionText}</div>
                <div class="options">
            `;

            // 添加選項
            question.options.forEach(option => {
              const isCorrect = isCorrectQuizOption(option.id, question.correctAnswer);
              docContent += `
                <div class="option ${isCorrect && showAnswers ? 'correct' : ''}">
                  ${option.id.toUpperCase()}. ${option.text} ${isCorrect && showAnswers ? ' ✓' : ''}
                </div>
              `;
            });

            docContent += `</div>`;

            // 如果是教師模式，顯示解釋
            if (showAnswers) {
              docContent += `
                <div class="explanation">
                  <strong>${t('explanation_colon')}</strong> ${question.explanation}
                </div>
              `;
            }

            docContent += `</div>`;
          });

          docContent += `
            </body>
            </html>
          `;

          // Open Google Docs in a new tab
          window.open('https://docs.google.com/document/create', '_blank');
          
          // Copy HTML content to clipboard and notify user
          try {
            const type = "text/html";
            const blob = new Blob([docContent], { type });
            const data = [new ClipboardItem({ [type]: blob })];
            
            navigator.clipboard.write(data).then(() => {
              toast({
                title: t('html_content_copied_title'),
                description: t('paste_with_formatting_in', { app: 'Google Docs' }),
                duration: 8000,
              });
            }).catch(async (err) => {
              console.error("HTML clipboard operation failed:", err);

              // Fallback: Copy plain text
              const plainText = quiz.title + "\n\n" +
                quiz.questions.map((q, i) =>
                  `Question ${i+1}: ${q.questionText}\n` +
                  q.options.map(o => `${o.id.toUpperCase()}. ${o.text}${isCorrectQuizOption(o.id, q.correctAnswer) && showAnswers ? ' ✓' : ''}`).join('\n') +
                  (showAnswers ? `\n\n${t('explanation_colon')} ${q.explanation}` : '')
                ).join('\n\n');

              await navigator.clipboard.writeText(plainText);

              toast({
                title: t('text_content_copied_title'),
                description: t('html_copy_failed_fallback', { app: 'Google Docs' }),
                duration: 8000,
              });
            });
          } catch (err) {
            console.error("Clipboard operation failed:", err);

            // Final fallback
            const plainText = quiz.title + "\n\n" +
              quiz.questions.map((q, i) =>
                `Question ${i+1}: ${q.questionText}\n` +
                q.options.map(o => `${o.id.toUpperCase()}. ${o.text}${isCorrectQuizOption(o.id, q.correctAnswer) && showAnswers ? ' ✓' : ''}`).join('\n') +
                (showAnswers ? `\n\n${t('explanation_colon')} ${q.explanation}` : '')
              ).join('\n\n');

            try {
              navigator.clipboard.writeText(plainText);
              toast({
                title: t('text_content_copied_title'),
                description: t('paste_content_in', { app: 'Google Docs' }),
                duration: 5000,
              });
            } catch (finalErr) {
              toast({
                title: t('copy_failed_title'),
                description: t('copy_failed'),
                variant: "destructive",
                duration: 5000,
              });
            }
          }

          break;
        }
        
        case 'microsoft-powerpoint': {
          try {
            const { downloadQuizPowerPoint } = await import('@/lib/powerpoint');
            await downloadQuizPowerPoint(`${safeTitle}.pptx`, {
              title: quiz.title,
              questions: quiz.questions,
              showAnswers,
              explanationLabel: t('explanation_colon'),
              generatedOn: new Date().toLocaleDateString(),
            });
            toast({
              title: t('pptx_file_downloaded'),
              description: t('pptx_file_generated_desc'),
              duration: 5000,
            });
          } catch (error) {
            console.error("PowerPoint generation error:", error);
            toast({
              title: t('export_failed'),
              description: t('pptx_generation_failed'),
              variant: "destructive",
            });
          }
          break;
        }
        
        case 'google-slides': {
          // 為 Google Slides 準備適合的 HTML 格式
          const styles = `
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; }
              .quiz-title { font-size: 24px; font-weight: bold; text-align: center; margin-bottom: 20px; }
              .quiz-subtitle { font-size: 16px; text-align: center; margin-bottom: 30px; color: #666; }
              .question { margin-bottom: 30px; }
              .question-text { font-weight: bold; margin-bottom: 10px; }
              .options { margin-left: 20px; }
              .option { margin-bottom: 5px; }
              .correct { color: #34a853; font-weight: bold; }
              .explanation { background-color: #f8f9fa; padding: 10px; border-left: 4px solid #4285f4; margin-top: 10px; }
            </style>
          `;

          // 手動構建更適合 Google Slides 的內容
          let docContent = `
            <html>
            <head>
              <meta charset="UTF-8">
              <title>${quiz.title}</title>
              ${styles}
            </head>
            <body>
              <div class="quiz-title">${quiz.title}</div>
              <div class="quiz-subtitle">${quiz.questions.length} Questions - Generated on ${new Date().toLocaleDateString()}</div>
          `;

          // 添加每個問題
          quiz.questions.forEach((question, index) => {
            docContent += `
              <div class="question">
                <div class="question-text">Question ${index + 1}: ${question.questionText}</div>
                <div class="options">
            `;

            // 添加選項
            question.options.forEach(option => {
              const isCorrect = isCorrectQuizOption(option.id, question.correctAnswer);
              docContent += `
                <div class="option ${isCorrect && showAnswers ? 'correct' : ''}">
                  ${option.id.toUpperCase()}. ${option.text} ${isCorrect && showAnswers ? ' ✓' : ''}
                </div>
              `;
            });
            
            docContent += `</div>`;
            
            // 如果是教師模式，顯示解釋
            if (showAnswers) {
              docContent += `
                <div class="explanation">
                  <strong>${t('explanation_colon')}</strong> ${question.explanation}
                </div>
              `;
            }
            
            docContent += `</div>`;
          });

          docContent += `
              </body>
            </html>
          `;
          
          // Open Google Slides in a new tab
          window.open('https://docs.google.com/presentation/create', '_blank');
          
          // Copy HTML content to clipboard and notify user
          try {
            const type = "text/html";
            const blob = new Blob([docContent], { type });
            const data = [new ClipboardItem({ [type]: blob })];
            
            navigator.clipboard.write(data).then(() => {
              toast({
                title: t('content_copied_title'),
                description: t('paste_with_formatting_in', { app: 'Google Slides' }),
                duration: 8000,
              });
            }).catch(async (err) => {
              console.error("HTML clipboard operation failed:", err);

              // Fallback: Copy plain text
              const plainText = quiz.title + "\n\n" +
                quiz.questions.map((q, i) =>
                  `Question ${i+1}: ${q.questionText}\n` +
                  q.options.map(o => `${o.id.toUpperCase()}. ${o.text}${isCorrectQuizOption(o.id, q.correctAnswer) && showAnswers ? ' ✓' : ''}`).join('\n') +
                  (showAnswers ? `\n\n${t('explanation_colon')} ${q.explanation}` : '')
                ).join('\n\n');

              await navigator.clipboard.writeText(plainText);

          toast({
                title: t('text_content_copied_title'),
                description: t('html_copy_failed_fallback', { app: 'Google Slides' }),
                duration: 8000,
              });
            });
          } catch (err) {
            console.error("Clipboard operation failed:", err);

            // Final fallback
            const plainText = quiz.title + "\n\n" +
              quiz.questions.map((q, i) =>
                `Question ${i+1}: ${q.questionText}\n` +
                q.options.map(o => `${o.id.toUpperCase()}. ${o.text}${isCorrectQuizOption(o.id, q.correctAnswer) && showAnswers ? ' ✓' : ''}`).join('\n') +
                (showAnswers ? `\n\n${t('explanation_colon')} ${q.explanation}` : '')
              ).join('\n\n');

            try {
              navigator.clipboard.writeText(plainText);
            toast({
                title: t('text_content_copied_title'),
                description: t('paste_content_in', { app: 'Google Slides' }),
                duration: 5000,
              });
            } catch (finalErr) {
              toast({
                title: t('copy_failed_title'),
                description: t('copy_failed'),
                variant: "destructive",
                duration: 5000,
              });
            }
          }

          break;
        }

        case 'google-forms': {
          // 為 Google Forms 準備適合的 HTML 格式
          const styles = `
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; }
              .quiz-title { font-size: 24px; font-weight: bold; text-align: center; margin-bottom: 20px; }
              .quiz-subtitle { font-size: 16px; text-align: center; margin-bottom: 30px; color: #666; }
              .question { margin-bottom: 30px; }
              .question-text { font-weight: bold; margin-bottom: 10px; }
              .options { margin-left: 20px; }
              .option { margin-bottom: 5px; }
              .correct { color: #34a853; font-weight: bold; }
              .explanation { background-color: #f8f9fa; padding: 10px; border-left: 4px solid #4285f4; margin-top: 10px; }
            </style>
          `;

          // 手動構建更適合 Google Forms 的內容
          let docContent = `
            <html>
            <head>
              <meta charset="UTF-8">
              <title>${quiz.title}</title>
              ${styles}
            </head>
            <body>
              <div class="quiz-title">${quiz.title}</div>
              <div class="quiz-subtitle">${quiz.questions.length} Questions - Generated on ${new Date().toLocaleDateString()}</div>
          `;

          // 添加每個問題
          quiz.questions.forEach((question, index) => {
            docContent += `
              <div class="question">
                <div class="question-text">Question ${index + 1}: ${question.questionText}</div>
                <div class="options">
            `;

            // 添加選項
            question.options.forEach(option => {
              const isCorrect = isCorrectQuizOption(option.id, question.correctAnswer);
              docContent += `
                <div class="option ${isCorrect && showAnswers ? 'correct' : ''}">
                  ${option.id.toUpperCase()}. ${option.text} ${isCorrect && showAnswers ? ' ✓' : ''}
                </div>
              `;
            });

            docContent += `</div>`;

            // 如果是教師模式，顯示解釋
            if (showAnswers) {
              docContent += `
                <div class="explanation">
                  <strong>${t('explanation_colon')}</strong> ${question.explanation}
                </div>
              `;
            }

            docContent += `</div>`;
          });

          docContent += `
            </body>
            </html>
          `;

          // Open Google Forms in a new tab
          window.open('https://docs.google.com/forms/create', '_blank');
          
          // Copy HTML content to clipboard and notify user
          try {
            const type = "text/html";
            const blob = new Blob([docContent], { type });
            const data = [new ClipboardItem({ [type]: blob })];
            
            navigator.clipboard.write(data).then(() => {
            toast({
              title: t('content_copied_title'),
                description: t('paste_with_formatting_in', { app: 'Google Forms' }),
                duration: 8000,
              });
            }).catch(async (err) => {
              console.error("HTML clipboard operation failed:", err);

              // Fallback: Copy plain text
              const plainText = quiz.title + "\n\n" +
                quiz.questions.map((q, i) =>
                  `Question ${i+1}: ${q.questionText}\n` +
                  q.options.map(o => `${o.id.toUpperCase()}. ${o.text}${isCorrectQuizOption(o.id, q.correctAnswer) && showAnswers ? ' ✓' : ''}`).join('\n') +
                  (showAnswers ? `\n\n${t('explanation_colon')} ${q.explanation}` : '')
                ).join('\n\n');

              await navigator.clipboard.writeText(plainText);

              toast({
                title: t('text_content_copied_title'),
                description: t('html_copy_failed_fallback', { app: 'Google Forms' }),
                duration: 8000,
              });
            });
          } catch (err) {
            console.error("Clipboard operation failed:", err);

            // Final fallback
            const plainText = quiz.title + "\n\n" +
              quiz.questions.map((q, i) =>
                `Question ${i+1}: ${q.questionText}\n` +
                q.options.map(o => `${o.id.toUpperCase()}. ${o.text}${isCorrectQuizOption(o.id, q.correctAnswer) && showAnswers ? ' ✓' : ''}`).join('\n') +
                (showAnswers ? `\n\n${t('explanation_colon')} ${q.explanation}` : '')
              ).join('\n\n');

            try {
              navigator.clipboard.writeText(plainText);
              toast({
                title: t('text_content_copied_title'),
                description: t('paste_content_in', { app: 'Google Forms' }),
                duration: 5000,
              });
            } catch (finalErr) {
              toast({
                title: t('copy_failed_title'),
                description: t('copy_failed'),
                variant: "destructive",
                duration: 5000,
              });
            }
          }

          break;
        }

        case 'pdf': {
          const pdfModule = await import('html2pdf.js');
          const html2pdfLib = pdfModule.default;
          // PDF export options
          const exportOptions = {
            margin: [10, 10, 10, 10] as [number, number, number, number],
            filename: `${safeTitle}.pdf`,
            image: { type: 'jpeg' as const, quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm' as const, format: 'a4', orientation: 'portrait' as const }
          };
          
          // Apply special PDF fixes for number alignment
          const styleFixForPDF = document.createElement('style');
          styleFixForPDF.textContent = `
            /* Number circle alignment fixes for PDF */
            .rounded-full {
              position: relative !important;
              display: inline-flex !important;
              align-items: center !important;
              justify-content: center !important;
            }
            .rounded-full > span {
              position: absolute !important;
              left: 50% !important;
              top: 50% !important;
              transform: translate(-50%, -50%) !important;
              display: inline-block !important;
              line-height: 1 !important;
              width: auto !important;
              height: auto !important;
            }
          `;
          element.appendChild(styleFixForPDF);
          
          // Generate and download the PDF
          try {
          await html2pdfLib().from(element).set(exportOptions).save();
      
      toast({
              title: t('pdf_file_downloaded'),
              description: t('pdf_file_generated_desc'),
              duration: 5000,
            });
          } catch (pdfError) {
            console.error("PDF generation error:", pdfError);
            toast({
              title: t('export_failed'),
              description: t('pdf_generation_failed'),
              variant: "destructive",
            });
          }
          break;
        }
      }
    } catch (error) {
      console.error("Export error:", error);
      toast({
        title: t('export_failed'),
        description: t('export_failed_generic'),
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
      setShowExportOptions(false);
    }
  };

  const handleGenerateStudentVersion = () => {
    setShowAnswers(!showAnswers);
    toast({
      title: showAnswers 
        ? t('student_version_activated')
        : t('teacher_version_activated'),
      description: showAnswers 
        ? t('answers_now_hidden')
        : `${t('answers_now_visible')} ${t('teacher_mode_activated')}`,
      duration: 3000,
    });
  };

  const handlePrintQuiz = () => {
    if (!quizContentRef.current) return;
    
    setIsPrinting(true);
    
    try {
      // Create a print-friendly version
      const printContent = document.createElement('div');
      printContent.innerHTML = quizContentRef.current.innerHTML;
      
      // Adjust styles for printing
      const style = document.createElement('style');
      style.textContent = `
        @media print {
          body { font-family: Arial, sans-serif; }
          .quiz-header { background: #f0f0f0 !important; color: #333 !important; padding: 15px !important; }
          .quiz-question { page-break-inside: avoid; margin-bottom: 20px; }
          .option-item { border: 1px solid #ddd; padding: 8px; margin: 4px 0; border-radius: 4px; }
          .student-answer-box { 
            border: 1px solid #aaa; 
            height: 30px; 
            margin-top: 15px;
            border-radius: 4px;
          }
          .print-hidden { display: none !important; }
        }
      `;
      
      printContent.appendChild(style);
      
      // Remove any buttons and UI elements not needed for printing
      const buttonsToRemove = printContent.querySelectorAll('button');
      buttonsToRemove.forEach(button => button.parentNode?.removeChild(button));
      
      // If in student mode, hide answers and explanations
      if (!showAnswers) {
        const correctAnswers = printContent.querySelectorAll('.correct-answer-indicator');
        correctAnswers.forEach(el => el.parentNode?.removeChild(el));
        
        const explanations = printContent.querySelectorAll('.explanation-box');
        explanations.forEach(el => el.parentNode?.removeChild(el));
        
        // Add student answer boxes
        const questionContainers = printContent.querySelectorAll('.question-container');
        questionContainers.forEach(container => {
          const answerBox = document.createElement('div');
          answerBox.className = 'student-answer-box';
          answerBox.innerHTML = '<p class="text-gray-400 text-sm ml-2 mt-1">Student answer:</p>';
          container.appendChild(answerBox);
        });
      }
      
      // Create an iframe to handle printing separately
      const printFrame = document.createElement('iframe');
      printFrame.style.position = 'fixed';
      printFrame.style.right = '0';
      printFrame.style.bottom = '0';
      printFrame.style.width = '0';
      printFrame.style.height = '0';
      printFrame.style.border = '0';
      
      document.body.appendChild(printFrame);
      
      printFrame.contentDocument?.open();
      printFrame.contentDocument?.write(`
        <html>
          <head>
            <title>${quiz.title}</title>
          </head>
          <body>
            ${printContent.innerHTML}
          </body>
        </html>
      `);
      printFrame.contentDocument?.close();
      
      // Print the iframe content
      printFrame.contentWindow?.focus();
      printFrame.contentWindow?.print();
      
      // Remove the iframe after printing
      setTimeout(() => {
        document.body.removeChild(printFrame);
        setIsPrinting(false);
      }, 500);
      
    } catch (error) {
      console.error('Printing error:', error);
      toast({
        title: t('error'),
        description: t('error_printing_quiz'),
        variant: "destructive",
      });
      setIsPrinting(false);
    }
  };

  const handleAddQuestion = () => {
    if (isSaving) return;
    const newQuestion: QuizQuestion = {
      id: crypto.randomUUID(),
      questionText: t('new_question'),
      options: [
        { id: "a", text: t('option_a') },
        { id: "b", text: t('option_b') },
        { id: "c", text: t('option_c') },
        { id: "d", text: t('option_d') }
      ],
      correctAnswer: "a",
      explanation: t('add_explanation')
    };

    setEditedQuestions([...editedQuestions, newQuestion]);
    toast({
      title: t('question_added_title'),
      description: t('question_added_to_quiz'),
    });
  };

  const moveQuestion = (index: number, direction: 'up' | 'down') => {
    if (isSaving) return;
    const newQuestions = [...editedQuestions];
    if (direction === 'up' && index > 0) {
      [newQuestions[index], newQuestions[index - 1]] = [newQuestions[index - 1], newQuestions[index]];
    } else if (direction === 'down' && index < newQuestions.length - 1) {
      [newQuestions[index], newQuestions[index + 1]] = [newQuestions[index + 1], newQuestions[index]];
    }
    setEditedQuestions(newQuestions);
  };

  const handleEditToggle = async () => {
    if (isSaving) return;
    if (isEditing && !(await saveDraft())) return;
    setIsEditing(!isEditing);
  };

  const handleQuestionEdit = (index: number, field: string, value: any) => {
    if (isSaving) return;
    const newQuestions = editedQuestions.map(question => ({ ...question, options: question.options.map(option => ({ ...option })) }));
    if (field === 'questionText') {
      newQuestions[index].questionText = value;
    } else if (field.startsWith('option-')) {
      const optionIndex = parseInt(field.split('-')[1]);
      newQuestions[index].options[optionIndex].text = value;
    } else if (field === 'correctAnswer') {
      newQuestions[index].correctAnswer = value;
    } else if (field === 'questionType') {
      newQuestions[index].questionType = value;
      // 切換題型時，重設正確答案
      newQuestions[index].correctAnswer = value === 'multiple' ? [] : '';
    } else if (field === 'explanation') {
      newQuestions[index].explanation = value;
    }
    setEditedQuestions(newQuestions);
  };

  const handleDragEnd = (result: any) => {
    if (isSaving || !result.destination) return;
    
    const items = Array.from(editedQuestions);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    setEditedQuestions(items);
  };

  // 增加一個新的函數，用於在指定索引處插入新問題
  const handleAddQuestionAtIndex = (index: number) => {
    if (isSaving) return;
    const newQuestion: QuizQuestion = {
      id: crypto.randomUUID(),
      questionText: t('new_question'),
      options: [
        { id: "a", text: t('option_a') },
        { id: "b", text: t('option_b') },
        { id: "c", text: t('option_c') },
        { id: "d", text: t('option_d') }
      ],
      correctAnswer: "a",
      explanation: t('add_explanation')
    };
    
    const newQuestions = [...editedQuestions];
    // 在指定索引後插入新問題
    newQuestions.splice(index + 1, 0, newQuestion);
    setEditedQuestions(newQuestions);
    
    toast({
      title: t('success'),
      description: t('question_added'),
    });
  };

  const handleStartQuiz = () => {
    setShowQuizInterface(true);
    setUserAnswers({});
    setQuizScore(null);
  };

  const handleAnswerChange = (questionId: string, answer: string | string[]) => {
    setUserAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  const handleSubmitQuiz = () => {
    let score = 0;
    quiz.questions.forEach(question => {
      if (isCorrectQuizAnswer(userAnswers[question.id], question.correctAnswer)) {
        score++;
      }
    });
    setQuizScore(score);
    setShowQuizInterface(false);
    // setShowUserReview(true); // We will show score first, then user can click to review
  };

  // Return statement for QuizResults component
  if (quizScore !== null && !showUserReview) { // Check !showUserReview here
    return (
      <div className="container py-8 max-w-4xl mx-auto text-center">
        <Card className="border-0 shadow-lg overflow-hidden p-8">
          <h2 className="text-3xl font-bold mb-4">{t('quiz_completed_title')}</h2>
          <p className="text-xl mb-2">{t('your_score_label')}</p>
          <p className="text-5xl font-bold text-indigo-600 mb-6">
            {quizScore} / {quiz.questions.length}
          </p>
          <Button onClick={() => {
            setShowUserReview(true);
            setQuizScore(null); // Explicitly set quizScore to null here
          }}>{t('review_my_answers_button')}</Button>
        </Card>
      </div>
    );
  }

  // New: User Review Interface
  if (showUserReview) {
    return (
      <div className="container py-8 max-w-4xl mx-auto">
        <Card className="border-0 shadow-lg overflow-hidden">
          <CardHeader className="quiz-header bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6">
            <h1 className="text-2xl md:text-3xl font-bold text-center">Review Your Answers: {quiz.title}</h1>
          </CardHeader>
          <CardContent className="p-6">
            {quiz.questions.map((question, index) => {
              const userAnswer = userAnswers[question.id];
              const correctAnswer = question.correctAnswer;
              const isMultiple = question.questionType === 'multiple';
              const isCorrect = isCorrectQuizAnswer(userAnswer, correctAnswer);

              return (
                <div key={question.id} className={`mb-6 pb-6 border-b ${isCorrect ? 'border-green-200' : 'border-red-200'}`}> 
                  <h3 className="text-lg font-medium text-gray-900 mb-3">
                    {index + 1}. {question.questionText}
                  </h3>
                  <div className="mb-2">
                    {question.options.map(option => {
                      const isOptionCorrect = isMultiple
                        ? Array.isArray(correctAnswer) && correctAnswer.includes(option.id)
                        : option.id === correctAnswer;
                      const isOptionSelected = isMultiple
                        ? Array.isArray(userAnswer) && userAnswer.includes(option.id)
                        : userAnswer === option.id;
                      const isBoth = isOptionCorrect && isOptionSelected;
                      return (
                        <div
                          key={option.id}
                          className={`flex items-center gap-2 p-2 rounded-md mb-1 border ${
                            isBoth
                              ? 'bg-green-50 border-green-400'
                              : isOptionCorrect
                                ? 'bg-green-50 border-green-200'
                                : isOptionSelected
                                  ? 'bg-red-50 border-red-300'
                                  : 'border-gray-200'
                          }`}
                        >
                          <span className="font-bold">{option.id.toUpperCase()}.</span>
                          <span>{option.text}</span>
                          {isOptionCorrect && (
                            <span className="ml-2 px-2 py-0.5 text-xs rounded bg-green-600 text-white">{t('correct_answer')}</span>
                          )}
                          {isOptionSelected && !isOptionCorrect && (
                            <span className="ml-2 px-2 py-0.5 text-xs rounded bg-red-500 text-white">{t('your_choice')}</span>
                          )}
                          {isBoth && (
                            <span className="ml-2 px-2 py-0.5 text-xs rounded bg-green-700 text-white">{t('correct_and_selected')}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {/* Added explanation display below */}
                  <div className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded text-sm text-gray-700">
                    <strong>{t('explanation_colon')}</strong> {question.explanation}
                  </div>
                </div>
              );
            })}
            <Button onClick={() => {
              setShowUserReview(false);
              setQuizScore(null); // Ensure score is reset to show main quiz view
            }} className="w-full py-3 text-lg mt-4">
              {t('back_to_quiz_overview_button')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (showQuizInterface) {
    return (
      <div className="container py-8 max-w-4xl mx-auto">
        <Card className="border-0 shadow-lg overflow-hidden">
          <CardHeader className="quiz-header bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6">
            <h1 className="text-2xl md:text-3xl font-bold text-center">{quiz.title}</h1>
          </CardHeader>
          <CardContent className="p-6">
            {quiz.questions.map((question, index) => (
              <div key={question.id} className="mb-6 pb-6 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900 mb-3">
                  {index + 1}. {question.questionText}
                </h3>
                {question.questionType === 'multiple' ? (
                  // 複選題
                  <div className="flex flex-col gap-2">
                    {question.options.map(option => {
                      const checked = Array.isArray(userAnswers[question.id]) ? userAnswers[question.id].includes(option.id) : false;
                      return (
                        <label key={option.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded-md cursor-pointer">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={e => {
                              const prevArr = userAnswers[question.id];
                              let prev: string[] = Array.isArray(prevArr) ? [...prevArr] : [];
                              if (e.target.checked) {
                                prev.push(option.id);
                              } else {
                                prev = prev.filter(id => id !== option.id);
                              }
                              handleAnswerChange(question.id, prev);
                            }}
                          />
                          <span>{option.text}</span>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  // 單選題
                  <RadioGroup 
                    value={typeof userAnswers[question.id] === 'string' ? userAnswers[question.id] as string : ""} 
                    onValueChange={(value) => handleAnswerChange(question.id, value)}
                  >
                    {question.options.map(option => (
                      <div key={option.id} className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded-md">
                        <RadioGroupItem value={option.id} id={`${question.id}-${option.id}`} />
                        <Label htmlFor={`${question.id}-${option.id}`} className="cursor-pointer w-full">
                          {option.text}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                )}
              </div>
            ))}
            <Button onClick={handleSubmitQuiz} className="w-full py-3 text-lg mt-4">{t('submit_quiz_button')}</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <Button 
          variant="ghost" 
          onClick={() => { if (confirmLeave()) onBack(); }}
          className="text-indigo-700 hover:text-indigo-900 hover:bg-indigo-50"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> {t('back_to_generator')}
        </Button>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleGenerateStudentVersion}
            className={cn(
              "transition-all duration-300 transform hover:scale-105",
              !showAnswers 
                ? "bg-indigo-600 text-white hover:bg-indigo-700 hover:text-white"
                : "border-indigo-300 text-indigo-700 hover:bg-indigo-50"
            )}
          >
            {t('student_version')}
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleGenerateStudentVersion}
            className={cn(
              "transition-all duration-300 transform hover:scale-105",
              showAnswers 
                ? "bg-indigo-600 text-white hover:bg-indigo-700 hover:text-white"
                : "border-indigo-300 text-indigo-700 hover:bg-indigo-50"
            )}
          >
            {t('teacher_version')}
          </Button>
        </div>
      </div>
      
      <div ref={quizContentRef}>
        <Card className="border-0 shadow-lg overflow-hidden">
          <CardHeader className="quiz-header bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6">
            <h1 className="text-2xl md:text-3xl font-bold text-center">{quiz.title}</h1>
            <p className="text-center text-white/80">{t('questions_count', { count: quiz.questions.length })}</p>
          </CardHeader>
          
          <CardContent className="p-6">
            <div className="mb-8 flex flex-col gap-4 print-hidden">
              <p className="text-indigo-900">
                {t('quiz_created_on', { date: new Date().toLocaleDateString() })}
              </p>
              <div className="flex flex-wrap gap-3">
                <Button 
                  variant="outline" 
                  className="border-indigo-300 text-indigo-700"
                  onClick={() => void saveDraft()}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t('saving_quiz')}
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" /> {t('save_quiz')}
                    </>
                  )}
                </Button>
                
                <div className="relative">
                  <Button 
                    variant="outline"
                    className="border-indigo-300 text-indigo-700"
                    onClick={() => setShowExportOptions(!showExportOptions)}
                    disabled={isExporting || isSaving || isEditing}
                    aria-expanded={showExportOptions}
                    ref={exportButtonRef}
                  >
                    {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />} {t('export_quiz')}
                  </Button>
                  
                  {showExportOptions && (
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg z-50 border border-gray-200" ref={exportMenuRef}>
                      <div className="py-1">
                        <button
                          onClick={() => handleExport('microsoft-word')}
                          className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="-0.12979372698077785 0 32.12979372698078 32" className="mr-2 size-4">
                            <path d="M30.667 2H9.333A1.333 1.333 0 0 0 8 3.333V9l12 3.5L32 9V3.333A1.333 1.333 0 0 0 30.667 2z" fill="#41a5ee"/>
                            <path d="M32 9H8v7l12 3.5L32 16z" fill="#2b7cd3"/>
                            <path d="M32 16H8v7l12 3.5L32 23z" fill="#185abd"/>
                            <path d="M32 23H8v5.667A1.333 1.333 0 0 0 9.333 30h21.334A1.333 1.333 0 0 0 32 28.667z" fill="#103f91"/>
                            <path d="M16.667 7H8v19h8.667A1.337 1.337 0 0 0 18 24.667V8.333A1.337 1.337 0 0 0 16.667 7z" opacity=".1"/>
                            <path d="M15.667 8H8v19h7.667A1.337 1.337 0 0 0 17 25.667V9.333A1.337 1.337 0 0 0 15.667 8z" opacity=".2"/>
                            <path d="M15.667 8H8v17h7.667A1.337 1.337 0 0 0 17 23.667V9.333A1.337 1.337 0 0 0 15.667 8z" opacity=".2"/>
                            <path d="M14.667 8H8v17h6.667A1.337 1.337 0 0 0 16 23.667V9.333A1.337 1.337 0 0 0 14.667 8z" opacity=".2"/>
                            <path d="M1.333 8h13.334A1.333 1.333 0 0 1 16 9.333v13.334A1.333 1.333 0 0 1 14.667 24H1.333A1.333 1.333 0 0 1 0 22.667V9.333A1.333 1.333 0 0 1 1.333 8z" fill="#185abd"/>
                            <path d="M11.95 21h-1.8l-2.1-6.9-2.2 6.9h-1.8l-2-10h1.8l1.4 7 2.1-6.8h1.5l2 6.8 1.4-7h1.7z" fill="#fff"/>
                            <path d="M0 0h32v32H0z" fill="none"/>
                          </svg>
                          Microsoft Word
                        </button>
                        <button
                          onClick={() => handleExport('google-docs')}
                          className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1818.2 2500" className="mr-2 size-4">
                            <g>
                              <path fill="#4285F4" d="M1136.4 0H170.4C79.6 0 0 79.5 0 170.5v2159.1c0 90.9 79.5 170.5 170.5 170.5h1477.3c90.9 0 170.5-79.5 170.5-170.5V681.8l-397.7-284.1L1136.4 0z"/>
                              <path fill="#F1F1F1" d="M454.5 1818.2h909.1v-113.6H454.6v113.6zm0 227.3h681.8v-113.6H454.5v113.6zm0-795.5v113.6h909.1V1250H454.5zm0 340.9h909.1v-113.6H454.6v113.6z"/>
                              <path fill="#A1C2FA" d="M1136.4 0v511.4c0 90.9 79.5 170.4 170.4 170.4h511.4L1136.4 0z"/>
                            </g>
                          </svg>
                          Google Docs
                        </button>
                        <button
                          onClick={() => handleExport('microsoft-powerpoint')}
                          className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="-0.12979372698077785 0 32.152389301176754 32" className="mr-2 size-4">
                            <path d="M18 2A14.041 14.041 0 0 0 4 16l17.737 3.737z" fill="#ed6c47"/>
                            <path d="M18 2a14.041 14.041 0 0 1 14 14l-7 4.758L18 16z" fill="#ff8f6b"/>
                            <path d="M18 30a14.041 14.041 0 0 0 14-14H4a14.041 14.041 0 0 0 14 14z" fill="#d35230"/>
                            <path d="M16.666 7h-9.36a13.914 13.914 0 0 0 .93 19h8.43A1.337 1.337 0 0 0 18 24.667V8.333A1.337 1.337 0 0 0 16.666 7z" opacity=".1"/>
                            <path d="M15.666 8H6.54a13.906 13.906 0 0 0 2.845 19h6.282A1.337 1.337 0 0 0 17 25.667V9.333A1.337 1.337 0 0 0 15.666 8z" opacity=".2"/>
                            <path d="M15.666 8H6.54a13.89 13.89 0 0 0 .766 17h8.361A1.337 1.337 0 0 0 17 23.667V9.333A1.337 1.337 0 0 0 15.666 8z" opacity=".2"/>
                            <path d="M14.666 8H6.54a13.89 13.89 0 0 0 .766 17h7.361A1.337 1.337 0 0 0 16 23.667V9.333A1.337 1.337 0 0 0 14.666 8z" opacity=".2"/>
                            <path d="M1.333 8h13.334A1.333 1.333 0 0 1 16 9.333v13.334A1.333 1.333 0 0 1 14.667 24H1.333A1.333 1.333 0 0 1 0 22.667V9.333A1.333 1.333 0 0 1 1.333 8z" fill="#c43e1c"/>
                            <path d="M7.997 11a4.168 4.168 0 0 1 2.755.805 2.878 2.878 0 0 1 .956 2.331 2.726 2.726 0 0 1-.473 1.588 3.164 3.164 0 0 1-1.344 1.186 4.57 4.57 0 0 1-2.02.424h-1.91V21H4V11zM5.96 15.683h1.687a2.194 2.194 0 0 0 1.492-.444 1.107 1.107 0 0 0 .504-1.026q0-1.659-1.933-1.659H5.96z" fill="#f9f7f7"/>
                            <path d="M0 0h32v32H0z" fill="none"/>
                          </svg>
                          Microsoft PowerPoint
                        </button>
                        <button
                          onClick={() => handleExport('google-slides')}
                          className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 66" className="mr-2 size-4">
                            <path fill="#F4B400" d="M29.583 0H4.438A4.45 4.45 0 0 0 0 4.438v56.208a4.45 4.45 0 0 0 4.438 4.437h38.458a4.45 4.45 0 0 0 4.437-4.437V17.75L36.98 10.354z"/>
                            <path fill="#F1F1F1" d="M33.281 29.583H14.052c-1.22 0-2.219.999-2.219 2.22V51.03c0 1.22.999 2.219 2.22 2.219H33.28c1.22 0 2.219-.998 2.219-2.219V31.802c0-1.22-.998-2.219-2.219-2.219m-.74 17.01h-17.75V36.24h17.75z"/>
                            <path fill="#FADA80" d="M29.583 0v13.313a4.436 4.436 0 0 0 4.438 4.437h13.312z"/>
                          </svg>
                          Google Slides
                        </button>
                        <button
                          onClick={() => handleExport('google-forms')}
                          className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1904.8 2500" className="mr-2 size-4">
                            <g>
                              <path fill="#673AB7" d="M1190.5 0H178.6C83.3 0 0 83.3 0 178.6v2142.9c0 95.2 83.3 178.6 178.6 178.6h1547.6c95.2 0 178.6-83.3 178.6-178.6V714.3l-416.7-297.6L1190.5 0z"/>
                              <path fill="#F1F1F1" d="M714.3 1845.2h714.3v-119H714.3v119zm0-773.8v119h714.3v-119H714.3zm-107.2 59.6c0 47.6-35.7 95.2-95.2 95.2s-95.2-35.7-95.2-95.2c0-59.5 35.7-95.2 95.2-95.2s95.2 35.7 95.2 95.2zm0 333.3c0 47.6-35.7 95.2-95.2 95.2s-95.2-35.7-95.2-95.2c0-59.5 35.7-95.2 95.2-95.2s95.2 35.7 95.2 95.2zm0 321.4c0 47.6-35.7 95.2-95.2 95.2s-95.2-35.7-95.2-95.2c0-59.5 35.7-95.2 95.2-95.2s95.2 35.7 95.2 95.2zm107.2-238.1h714.3v-119.1H714.3v119.1z"/>
                              <path fill="#B39DDB" d="M1190.5 0v535.7c0 95.2 83.3 178.6 178.6 178.6h535.7L1190.5 0z"/>
                              <path fill="#FFFFFF" fillOpacity=".2" d="M178.6 0C83.3 0 0 83.3 0 178.6v11.9C0 95.2 83.3 11.9 178.6 11.9h1011.9V0H178.6z"/>
                              <path fill="#311B92" fillOpacity=".2" d="M1726.2 2488.1H178.6C83.3 2488.1 0 2404.8 0 2309.5v11.9c0 95.2 83.3 178.6 178.6 178.6h1547.6c95.2 0 178.6-83.3 178.6-178.6v-11.9c0 95.2-83.4 178.6-178.6 178.6z"/>
                              <path fill="#311B92" fillOpacity=".1" d="M1369 714.3c-95.2 0-178.6-83.3-178.6-178.6v11.9c0 95.2 83.3 178.6 178.6 178.6h535.7v-11.9H1369z"/>
                            </g>
                          </svg>
                          Google Forms
                        </button>
                        <button
                          onClick={() => handleExport('pdf')}
                          className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 75.320129 92.604164" className="mr-2 size-4">
                            <g transform="translate(53.548057 -183.975276) scale(1.4843)">
                              <path fill="#ff2116" d="M-29.632812 123.94727c-3.551967 0-6.44336 2.89347-6.44336 6.44531v49.49804c0 3.55185 2.891393 6.44532 6.44336 6.44532H8.2167969c3.5519661 0 6.4433591-2.89335 6.4433591-6.44532v-40.70117s.101353-1.19181-.416015-2.35156c-.484969-1.08711-1.275391-1.84375-1.275391-1.84375a1.0584391 1.0584391 0 0 0-.0059-.008l-9.3906254-9.21094a1.0584391 1.0584391 0 0 0-.015625-.0156s-.8017392-.76344-1.9902344-1.27344c-1.39939552-.6005-2.8417968-.53711-2.8417968-.53711l.021484-.002z"/>
                              <path fill="#f5f5f5" d="M-29.632812 126.06445h28.3789058a1.0584391 1.0584391 0 0 0 .021484 0s1.13480448.011 1.96484378.36719c.79889772.34282 1.36536982.86176 1.36914062.86524.0000125.00001.00391.004.00391.004l9.3671868 9.18945s.564354.59582.837891 1.20899c.220779.49491.234375 1.40039.234375 1.40039a1.0584391 1.0584391 0 0 0-.002.0449v40.74609c0 2.41592-1.910258 4.32813-4.3261717 4.32813H-29.632812c-2.415914 0-4.326172-1.91209-4.326172-4.32813v-49.49804c0-2.41603 1.910258-4.32813 4.326172-4.32813z"/>
                              <path fill="#ff2116" d="M-23.40766 161.09299c-1.45669-1.45669.11934-3.45839 4.39648-5.58397l2.69124-1.33743 1.04845-2.29399c.57665-1.26169 1.43729-3.32036 1.91254-4.5748l.8641-2.28082-.59546-1.68793c-.73217-2.07547-.99326-5.19438-.52872-6.31588.62923-1.51909 2.69029-1.36323 3.50626.26515.63727 1.27176.57212 3.57488-.18329 6.47946l-.6193 2.38125.5455.92604c.30003.50932 1.1764 1.71867 1.9475 2.68743l1.44924 1.80272 1.8033728-.23533c5.72900399-.74758 7.6912472.523 7.6912472 2.34476 0 2.29921-4.4984914 2.48899-8.2760865-.16423-.8499666-.59698-1.4336605-1.19001-1.4336605-1.19001s-2.3665326.48178-3.531704.79583c-1.202707.32417-1.80274.52719-3.564509 1.12186 0 0-.61814.89767-1.02094 1.55026-1.49858 2.4279-3.24833 4.43998-4.49793 5.1723-1.3991.81993-2.86584.87582-3.60433.13733zm2.28605-.81668c.81883-.50607 2.47616-2.46625 3.62341-4.28553l.46449-.73658-2.11497 1.06339c-3.26655 1.64239-4.76093 3.19033-3.98386 4.12664.43653.52598.95874.48237 2.01093-.16792zm21.21809-5.95578c.80089-.56097.68463-1.69142-.22082-2.1472-.70466-.35471-1.2726074-.42759-3.1031574-.40057-1.1249.0767-2.9337647.3034-3.2403347.37237 0 0 .993716.68678 1.434896.93922.58731.33544 2.0145161.95811 3.0565161 1.27706 1.02785.31461 1.6224.28144 2.0729-.0409zm-8.53152-3.54594c-.4847-.50952-1.30889-1.57296-1.83152-2.3632-.68353-.89643-1.02629-1.52887-1.02629-1.52887s-.4996 1.60694-.90948 2.57394l-1.27876 3.16076-.37075.71695s1.971043-.64627 2.97389-.90822c1.0621668-.27744 3.21787-.70134 3.21787-.70134zm-2.74938-11.02573c.12363-1.0375.1761-2.07346-.15724-2.59587-.9246-1.01077-2.04057-.16787-1.85154 2.23517.0636.8084.26443 2.19033.53292 3.04209l.48817 1.54863.34358-1.16638c.18897-.64151.47882-2.02015.64411-3.06364z"/>
                              <path fill="#2c2c2c" d="M-20.930423 167.83862h2.364986q1.133514 0 1.840213.2169.706698.20991 1.189489.9446.482795.72769.482795 1.75625 0 .94459-.391832 1.6233-.391833.67871-1.056548.97958-.65772.30087-2.02913.30087h-.818651v3.72941h-1.581322zm1.581322 1.22447v3.33058h.783664q1.049552 0 1.44838-.39184.405826-.39183.405826-1.27345 0-.65772-.265887-1.06355-.265884-.41282-.587747-.50378-.314866-.098-1.000572-.098zm5.50664-1.22447h2.148082q1.560333 0 2.4909318.55276.9375993.55276 1.4133973 1.6443.482791 1.09153.482791 2.42096 0 1.3994-.4338151 2.49793-.4268149 1.09153-1.3154348 1.76324-.8816233.67172-2.5189212.67172h-2.267031zm1.581326 1.26645v7.018h.657715q1.378411 0 2.001144-.9516.6227329-.95858.6227329-2.5539 0-3.5125-2.6238769-3.5125zm6.4722254-1.26645h5.30372941v1.26645H-4.2075842v2.85478h2.9807225v1.26646h-2.9807225v4.16322h-1.5813254z"/>
                            </g>
                          </svg>
                          PDF
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <Button
                  variant="outline"
                  className="border-indigo-300 text-indigo-700"
                  onClick={handleStartQuiz}
                  disabled={isEditing || isSaving}
                  // disabled={isPrinting} // Removed disabled state related to printing
                >
                    <>
                    <PlayCircle className="mr-2 h-4 w-4" /> {t('start_quiz')}
                    </>
                </Button>
                <Button 
                  variant="outline"
                  className="border-indigo-300 text-indigo-700 hover:bg-indigo-50"
                  onClick={handleEditToggle}
                  disabled={isSaving}
                >
                  {isEditing ? (
                    <>
                      <Save className="mr-2 h-4 w-4" /> {t('save_quiz_changes')}
                    </>
                  ) : (
                    <>
                      <Edit className="mr-2 h-4 w-4" /> {t('edit_quiz')}
                    </>
                  )}
                </Button>
              </div>
            </div>
            
            <fieldset disabled={isSaving} className="min-w-0">
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable 
                droppableId="questions" 
                isDropDisabled={!isEditing || isSaving}
                isCombineEnabled={false}
                ignoreContainerClipping={false}
                type="DEFAULT"
              >
                {(provided: DroppableProvided) => (
                  <div 
                    {...provided.droppableProps} 
                    ref={provided.innerRef} 
                    className="space-y-6"
                  >
                    {editedQuestions.map((question, index) => (
                      <Draggable 
                        key={question.id} 
                        draggableId={question.id} 
                        index={index}
                        isDragDisabled={!isEditing || isSaving}
                      >
                        {(provided: DraggableProvided) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className="mb-4"
                          >
                            <div className="question-container bg-white border border-purple-100 rounded-lg p-5 shadow-sm quiz-question">
                              <div className="flex gap-4">
                                {isEditing && (
                                  <div className="flex flex-col gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => moveQuestion(index, 'up')}
                                      disabled={index === 0}
                                      className="h-8 w-8"
                                    >
                                      <ArrowUp className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => moveQuestion(index, 'down')}
                                      disabled={index === editedQuestions.length - 1}
                                      className="h-8 w-8"
                                    >
                                      <ArrowDown className="h-4 w-4" />
                                    </Button>
                                  </div>
                                )}
                                <div className="bg-indigo-100 text-indigo-800 h-8 w-8 rounded-full flex items-center justify-center font-bold flex-shrink-0 relative">
                                  <span className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center leading-none">
                                    {index + 1}
                                  </span>
                                </div>
                                <div className="w-full">
                                  {isEditing ? (
                                    <Input
                                      value={question.questionText}
                                      onChange={(e) => handleQuestionEdit(index, 'questionText', e.target.value)}
                                      className="mb-4 text-lg"
                                      placeholder={t('enter_question')}
                                    />
                                  ) : (
                                    <h3 className="text-lg font-medium text-gray-900 mb-3">
                                      {question.questionText}
                                    </h3>
                                  )}
                                  
                                  {question.options && question.options.length > 0 && (
                                    <div className="grid gap-2 mb-4">
                                      {isEditing ? (
                                        <>
                                          {/* 題型選擇 */}
                                          <div className="mb-2">
                                            <Label className="text-xs text-gray-500 mr-2">{t('question_type')}</Label>
                                            <select
                                              value={question.questionType || 'single'}
                                              onChange={e => handleQuestionEdit(index, 'questionType', e.target.value)}
                                              className="border rounded px-2 py-1 text-xs"
                                            >
                                              <option value="single">{t('answer_single_select')}</option>
                                              <option value="multiple">{t('answer_multi_select')}</option>
                                            </select>
                                          </div>
                                          {/* 單選/複選正確答案選擇 */}
                                          {question.questionType === 'multiple' ? (
                                            question.options.map((option, optionIndex) => (
                                              <div key={option.id} className="flex items-center gap-3 p-3 border rounded-md">
                                                <input
                                                  type="checkbox"
                                                  checked={Array.isArray(question.correctAnswer) ? question.correctAnswer.includes(option.id) : false}
                                                  onChange={e => {
                                                    let newCorrect: string[] = Array.isArray(question.correctAnswer) ? [...question.correctAnswer] : [];
                                                    if (e.target.checked) {
                                                      newCorrect.push(option.id);
                                                    } else {
                                                      newCorrect = newCorrect.filter(id => id !== option.id);
                                                    }
                                                    handleQuestionEdit(index, 'correctAnswer', newCorrect);
                                                  }}
                                                />
                                                <Input
                                                  value={option.text}
                                                  onChange={e => handleQuestionEdit(index, `option-${optionIndex}`, e.target.value)}
                                                  className="flex-1"
                                                  placeholder={`Option ${option.id.toUpperCase()}`}
                                                />
                                              </div>
                                            ))
                                          ) : (
                                            <RadioGroup
                                              value={typeof question.correctAnswer === 'string' ? question.correctAnswer : ''}
                                              onValueChange={value => handleQuestionEdit(index, 'correctAnswer', value)}
                                        >
                                          {question.options.map((option, optionIndex) => (
                                            <div key={option.id} className="flex items-center gap-3 p-3 border rounded-md">
                                              <RadioGroupItem value={option.id} id={`${question.id}-${option.id}`} />
                                              <Input
                                                value={option.text}
                                                    onChange={e => handleQuestionEdit(index, `option-${optionIndex}`, e.target.value)}
                                                className="flex-1"
                                                placeholder={`Option ${option.id.toUpperCase()}`}
                                              />
                                            </div>
                                          ))}
                                        </RadioGroup>
                                          )}
                                        </>
                                      ) : (
                                        question.options.map((option) => (
                                          <div 
                                            key={option.id}
                                            className={`option-item p-3 border rounded-md flex items-center gap-3 ${
                                              showAnswers && (
                                                (Array.isArray(question.correctAnswer) 
                                                  ? question.correctAnswer.includes(option.id)
                                                  : isCorrectQuizOption(option.id, question.correctAnswer))
                                              ) 
                                                ? "bg-green-50 border-green-300" 
                                                : "bg-white border-gray-200"
                                            }`}
                                          >
                                            <div className={`h-6 w-6 rounded-full flex items-center justify-center text-sm font-medium relative ${
                                              showAnswers && (
                                                (Array.isArray(question.correctAnswer) 
                                                  ? question.correctAnswer.includes(option.id)
                                                  : isCorrectQuizOption(option.id, question.correctAnswer))
                                              )
                                                ? "bg-green-600 text-white" 
                                                : "bg-gray-100 text-gray-700"
                                            }`}>
                                              <span className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center leading-none">
                                                {option.id.toUpperCase()}
                                              </span>
                                            </div>
                                            <span className={showAnswers && (
                                              Array.isArray(question.correctAnswer)
                                                ? question.correctAnswer.includes(option.id)
                                                : isCorrectQuizOption(option.id, question.correctAnswer)
                                            ) ? "text-green-800 font-medium" : ""}>
                                              {option.text}
                                            </span>
                                            {showAnswers && (
                                              Array.isArray(question.correctAnswer)
                                                ? question.correctAnswer.includes(option.id)
                                                : isCorrectQuizOption(option.id, question.correctAnswer)
                                            ) && (
                                              <span className="ml-auto text-green-600 text-sm font-medium correct-answer-indicator">
                                                {t('correct_answer')}
                                              </span>
                                            )}
                                          </div>
                                        ))
                                      )}
                                    </div>
                                  )}
                                  
                                  {(showAnswers || isEditing) && (
                                    <div className="explanation-box bg-indigo-50 border border-indigo-100 rounded p-3 text-indigo-800 text-sm">
                                      <strong>{t('explanation_colon')}</strong>
                                      {isEditing ? (
                                        <Input
                                          value={question.explanation}
                                          onChange={(e) => handleQuestionEdit(index, 'explanation', e.target.value)}
                                          className="mt-2"
                                          placeholder={t('enter_explanation')}
                                        />
                                      ) : (
                                        <span className="ml-2">{question.explanation}</span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                            {isEditing && (
                              <div className="mt-3 flex justify-center">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleAddQuestionAtIndex(index)}
                                  className="border-dashed border-gray-300 text-gray-500 hover:text-indigo-600 hover:border-indigo-300"
                                >
                                  <Plus className="mr-1 h-3 w-3" /> {t('add_question')}
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
            </fieldset>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

// Main AIQuizPage component
export default function AIQuizPage() {
  const [currentQuiz, setCurrentQuiz] = useState<Quiz | null>(null);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [inputContent, setInputContent] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]); // New state for files in parent
  const [questionType, setQuestionType] = useState("multiple-choice");
  const [numQuestions, setNumQuestions] = useState("10");
  const [additionalInstructions, setAdditionalInstructions] = useState("");
  const [outputLanguage, setOutputLanguage] = useState("English");
  const [level, setLevel] = useState("intermediate");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  const [isLibraryLoading, setIsLibraryLoading] = useState(true);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const saveInFlight = useRef(false);
  useUnsavedChanges(!currentQuiz && quizzes.some(quiz => !quiz.persisted), isGenerating);

  const storageError = useCallback((code: string) => {
    if (code === 'QUIZ_STORAGE_NOT_READY') return language === 'zh-TW' ? '測驗儲存尚未啟用，請先在 Supabase 執行 add_ai_quizzes.sql。' : 'Quiz storage is not ready. Run add_ai_quizzes.sql in Supabase first.';
    if (code === 'UNAUTHORIZED') return language === 'zh-TW' ? '登入已失效，請重新登入。' : 'Your session has expired. Please sign in again.';
    if (code === 'INVALID_QUIZ') return language === 'zh-TW' ? '請確認每題都有題目、選項內容及正確答案，再重新儲存。' : 'Check every question, option and correct answer before saving.';
    return language === 'zh-TW' ? '無法連線至測驗儲存服務，請稍後重試。' : 'Unable to reach quiz storage. Please try again.';
  }, [language]);

  const loadSavedQuizzes = useCallback(async () => {
    setIsLibraryLoading(true);
    setLibraryError(null);
    try {
      const response = await fetch('/api/quizzes', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'QUIZ_STORAGE_ERROR');
      const saved = data.map(parseSavedQuiz) as Quiz[];
      setQuizzes(previous => [...previous, ...saved.filter(quiz => !previous.some(existing => existing.id === quiz.id))]);
    } catch (error) {
      setLibraryError(storageError(error instanceof Error ? error.message : 'QUIZ_STORAGE_ERROR'));
    } finally { setIsLibraryLoading(false); }
  }, [storageError]);

  useEffect(() => { void loadSavedQuizzes(); }, [loadSavedQuizzes]);

  const MAX_FILE_SIZE_MB = 25; // Changed from 5 to 25
  const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => resolve(event.target?.result as string);
      reader.onerror = (error) => reject(error);
      reader.readAsText(file);
    });
  };

  const extractTextFromDocx = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  };

  const extractTextFromPdf = async (file: File): Promise<string> => {
    if (typeof window === 'undefined') {
      throw new Error('PDF extraction only supported in browser');
    }
    const pdfjsLib = await import('pdfjs-dist/build/pdf');
    // Set workerSrc if not already set
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs';
    }
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let textContent = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const text = await page.getTextContent();
      textContent += text.items.map((s: any) => s.str).join(" \n");
    }
    return textContent;
  };

  // 圖片 OCR 文字擷取
  const extractTextFromImage = async (file: File): Promise<string> => {
    if (typeof window === 'undefined') {
      throw new Error('Image OCR only supported in browser');
    }
    const Tesseract = await import('tesseract.js');
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const { data: { text } } = await Tesseract.recognize(event.target?.result as string, 'eng+chi_tra');
          resolve(text);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
  };

  const processFiles = async (files: File[]): Promise<string> => {
    let allExtractedText = "";
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE_BYTES) {
      toast({
          title: t('error'),
          description: t('file_too_large', { fileName: file.name, maxSize: MAX_FILE_SIZE_MB.toString() }),
          variant: "destructive",
        });
        continue; // Skip this file
      }

      try {
        if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
          allExtractedText += `\n\n--- Content from ${file.name} ---\n${await extractTextFromDocx(file)}`;
        } else if (file.type === "application/pdf") {
          allExtractedText += `\n\n--- Content from ${file.name} ---\n${await extractTextFromPdf(file)}`;
        } else if (file.type.startsWith("text/")) {
          allExtractedText += `\n\n--- Content from ${file.name} ---\n${await readFileAsText(file)}`;
        } else if (file.type.startsWith("image/")) {
          // OCR 圖片內容
          const ocrText = await extractTextFromImage(file);
          allExtractedText += `\n\n--- OCR from ${file.name} ---\n${ocrText}`;
        } else {
          toast({
            title: t('error'),
            description: t('file_type_not_supported', { fileName: file.name }),
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error(`Error processing file ${file.name}:`, error);
        toast({
          title: t('error'),
          description: t('file_processing_error', { fileName: file.name }),
          variant: "destructive",
        });
      }
    }
    return allExtractedText;
  };

  const handleGenerateQuiz = async (files: File[]) => { // Updated to accept files
    let combinedContent = inputContent.trim();

    if (!combinedContent && files.length === 0) {
      toast({
        title: t("error"),
        description: t("please_enter_topic_or_file"),
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);

    if (files.length > 0) {
      toast({ title: t('info'), description: t('processing_uploaded_content'), duration: 2000 });
      const fileTexts = await processFiles(files);
      combinedContent += fileTexts; 
    }

    if (!combinedContent.trim()) {
       toast({
        title: t("error"),
        description: t("no_text_content_found"),
        variant: "destructive",
      });
      setIsGenerating(false);
      return;
    }

    try {
      // Call the server-side Gemini quiz generation endpoint
      const quizResponse = await fetch('/api/gemini/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: combinedContent, // Use combined content
          questionType,
          numQuestions,
          additionalInstructions,
          outputLanguage,
          level,
        }),
      });

      if (!quizResponse.ok) {
        throw new Error('Failed to generate quiz');
      }

      const generatedQuiz = await quizResponse.json();

      // Create a new quiz with the response data
      const newQuiz: Quiz = {
        id: crypto.randomUUID(),
        title: generatedQuiz.title || `Quiz on ${inputContent}`,
        questions: generatedQuiz.questions,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      setQuizzes(previous => [newQuiz, ...previous]);
      setCurrentQuiz(newQuiz);
      toast({
        title: t('success'),
        description: t('quiz_generated'),
      });
    } catch (error) {
      console.error("Quiz generation error:", error);
      toast({
        title: t('error'),
        description: t('error_generating_quiz'),
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveQuiz = async (draft: Quiz): Promise<boolean> => {
    if (saveInFlight.current) return false;
    const parsed = quizPayloadSchema.safeParse(draft);
    if (!parsed.success) {
      toast({ title: t('error'), description: storageError('INVALID_QUIZ'), variant: 'destructive' });
      return false;
    }
    saveInFlight.current = true;
    setIsSaving(true);
    try {
      const response = await fetch('/api/quizzes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(parsed.data) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'QUIZ_STORAGE_ERROR');
      const saved = parseSavedQuiz(data);
      setQuizzes(previous => [saved, ...previous.filter(quiz => quiz.id !== saved.id)]);
      setCurrentQuiz(saved);
      toast({ title: t('success'), description: t('quiz_saved') });
      return true;
    } catch (error) {
      toast({ title: t('error'), description: storageError(error instanceof Error ? error.message : 'QUIZ_STORAGE_ERROR'), variant: 'destructive' });
      return false;
    } finally {
      saveInFlight.current = false;
      setIsSaving(false);
    }
  };

  // If we're viewing a specific quiz
  if (currentQuiz) {
    return (
      <QuizResults
        key={currentQuiz.id}
        quiz={currentQuiz}
        onBack={() => setCurrentQuiz(null)}
        onSave={handleSaveQuiz}
        isSaving={isSaving}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader heading={t('ai_quiz_generator')} text={t('create_custom_quizzes')} />
      {libraryError && <div role="alert" className="app-panel mx-auto flex max-w-3xl flex-wrap items-center gap-3 border-destructive/30 p-4 text-sm">
        <p className="flex-1">{libraryError}</p>
        <Button variant="outline" size="sm" onClick={() => void loadSavedQuizzes()}>{language === 'zh-TW' ? '重試' : 'Retry'}</Button>
      </div>}
      {isLibraryLoading && <p role="status" className="text-center text-sm text-muted-foreground">{language === 'zh-TW' ? '正在載入已儲存測驗…' : 'Loading saved quizzes…'}</p>}
          {isGenerating && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="status" aria-live="polite">
              <div className="flex w-full max-w-md flex-col items-center rounded-2xl bg-card p-8 shadow-xl">
                <Loader2 className="h-12 w-12 text-indigo-600 animate-spin mb-4" />
                <h3 className="text-xl font-semibold mb-2">{t('generating')}</h3>
                <p className="text-gray-500 text-center mb-4">
                  {t('generating_description')}
                </p>
                <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                  <div className="bg-indigo-600 h-2 rounded-full animate-pulse" style={{ width: '90%' }}></div>
                </div>
                <p className="text-xs text-gray-400">{t('powered_by')}</p>
              </div>
            </div>
          )}
          
          <QuizCreator
            inputContent={inputContent}
            setInputContent={setInputContent}
            questionType={questionType}
            setQuestionType={setQuestionType}
            numQuestions={numQuestions}
            setNumQuestions={setNumQuestions}
            additionalInstructions={additionalInstructions}
            setAdditionalInstructions={setAdditionalInstructions}
            outputLanguage={outputLanguage}
            setOutputLanguage={setOutputLanguage}
            level={level}
            setLevel={setLevel}
            isGenerating={isGenerating}
            onGenerateQuiz={handleGenerateQuiz}
            selectedFiles={selectedFiles} // Pass state down
            setSelectedFiles={setSelectedFiles} // Pass setter down
          />
          
          {quizzes.length > 0 && !currentQuiz && (
            <section className="mx-auto mt-8 max-w-3xl space-y-4" aria-labelledby="recent-quizzes-title">
              <h2 id="recent-quizzes-title" className="text-xl font-semibold">{t('recent_quizzes')}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {quizzes.map((quiz) => (
                  <button
                    type="button"
                    key={quiz.id} 
                    className="group overflow-hidden rounded-xl border border-border bg-card text-left transition-colors hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => setCurrentQuiz(quiz)}
                  >
                    <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-4">
                      <h3 className="font-semibold text-lg">{quiz.title}</h3>
                      <p className="text-sm text-white/80">{t('questions_count', { count: quiz.questions.length })} · {quiz.persisted ? (language === 'zh-TW' ? '已儲存' : 'Saved') : (language === 'zh-TW' ? '未儲存' : 'Unsaved')}</p>
                    </div>
                    <div className="p-4 flex justify-between items-center">
                      <p className="text-gray-600">
                        {t('created_on', { date: quiz.createdAt?.toLocaleDateString() || '-' })}
                      </p>
                      <span className="flex items-center font-medium text-primary transition-transform group-hover:translate-x-1">
                        {t('view_quiz')} <ArrowRight className="ml-1 h-4 w-4" />
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}
    </div>
  );
}
