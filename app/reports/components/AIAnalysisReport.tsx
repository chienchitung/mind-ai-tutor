'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2, ChevronDown, ChevronUp, Clock, Star, Target, Lightbulb, BarChart2, BookOpen, Award } from 'lucide-react';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useTranslation } from '@/utils/translations';
import { AiQuotaError, throwForAiQuotaError } from '@/lib/ai-quota-errors';
import MarkdownRenderer from '@/app/components/ui/MarkdownRenderer';

interface AIAnalysisReportProps {
  learningRecords: any[];
  learningStats: any;
  selectedStudentName: string;
}

export function AIAnalysisReport({ 
  learningRecords, 
  learningStats,
  selectedStudentName 
}: AIAnalysisReportProps) {
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  const generateAnalysis = async () => {
    if (!learningRecords.length || !learningStats) return;
    
    setIsLoading(true);
    setAnalysisResult(null);
    
    try {
      // Prepare data for the AI analysis
      const analysisData = {
        studentName: selectedStudentName,
        stats: learningStats,
        recentLearning: learningRecords.slice(0, 5),
        // Pass the current UI language to generate analysis in the same language
        language: language
      };
      
      // Generate the analysis via the server-side Gemini endpoint
      const response = await fetch('/api/gemini/learning-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(analysisData),
      });
      if (!response.ok) {
        await throwForAiQuotaError(response, language, 'Failed to generate learning analysis');
      }
      const { analysis } = await response.json();
      setAnalysisResult(analysis);
      
      // Initialize all sections as expanded
      const initialExpandedState: Record<string, boolean> = {};
      const sections = parseSections(analysis);
      sections.forEach(section => {
        initialExpandedState[section.title] = true;
      });
      setExpandedSections(initialExpandedState);
    } catch (error) {
      console.error('Error generating analysis:', error);
      setAnalysisResult(error instanceof AiQuotaError ? error.message : t('analysis_generation_error'));
    } finally {
      setIsLoading(false);
    }
  };
  
  const toggleSection = (sectionTitle: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionTitle]: !prev[sectionTitle]
    }));
  };

  // Parse the analysis result into sections
  const parseSections = (text: string | null) => {
    if (!text) return [];
    
    const sections: { title: string; content: string; icon: React.ReactNode }[] = [];
    const lines = text.split('\n');
    
    let currentTitle = '';
    let currentContent: string[] = [];
    let currentIcon = <BookOpen className="h-5 w-5" />;
    
    const getIconForSection = (title: string) => {
      const lowerTitle = title.toLowerCase();
      if (lowerTitle.includes('摘要') || lowerTitle.includes('summary')) {
        return <BookOpen className="h-5 w-5" />;
      } else if (lowerTitle.includes('時間') || lowerTitle.includes('time')) {
        return <Clock className="h-5 w-5" />;
      } else if (lowerTitle.includes('科目') || lowerTitle.includes('category') || lowerTitle.includes('focus')) {
        return <Target className="h-5 w-5" />;
      } else if (lowerTitle.includes('模式') || lowerTitle.includes('pattern')) {
        return <BarChart2 className="h-5 w-5" />;
      } else if (lowerTitle.includes('優勢') || lowerTitle.includes('strength') || lowerTitle.includes('優勢') || lowerTitle.includes('優點')) {
        return <Star className="h-5 w-5" />;
      } else if (lowerTitle.includes('改進') || lowerTitle.includes('improvement') || lowerTitle.includes('改善')) {
        return <Target className="h-5 w-5" />;
      } else if (lowerTitle.includes('建議') || lowerTitle.includes('recommendation')) {
        return <Lightbulb className="h-5 w-5" />;
      }
      return <BookOpen className="h-5 w-5" />;
    };

    for (const line of lines) {
      // Check if line is a section header (expanded pattern matching)
      const headerMatch = line.match(/^\s*\**\s*\d+\.\s*(.*?)\s*\**\s*$/) || 
                         line.match(/^\s*\**\s*(.*?)\s*:\s*\**\s*$/) ||
                         line.match(/^\s*\**\s*(.*?)：\s*\**\s*$/) ||
                         line.match(/^\s*\*\s*\*\*(.*?)\*\*\s*$/) ||
                         line.match(/^\s*\*\s*\*\*(.*?)\*\*\s*:\s*\**\s*$/);
      
      if (headerMatch && headerMatch[1]) {
        // If we were processing a section, save it
        if (currentTitle && currentContent.length > 0) {
          sections.push({
            title: currentTitle,
            content: currentContent.join('\n'),
            icon: currentIcon
          });
        }
        
        // Start a new section
        currentTitle = headerMatch[1].trim();
        currentContent = [];
        currentIcon = getIconForSection(currentTitle);
      } else if (line.trim() && currentTitle) {
        // If it's not a header but we have a current section, add content
        currentContent.push(line);
      }
    }
    
    // Don't forget to add the last section
    if (currentTitle && currentContent.length > 0) {
      sections.push({
        title: currentTitle,
        content: currentContent.join('\n'),
        icon: currentIcon
      });
    }
    
    return sections;
  };

  return (
    <Card className="mt-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{t('ai_learning_analysis')}</CardTitle>
            <CardDescription>
              {t('ai_powered_insights')}
            </CardDescription>
          </div>
          {!analysisResult && !isLoading && (
            <Button 
              onClick={generateAnalysis} 
              disabled={!learningRecords.length || isLoading}
              size="sm"
              className="gap-1"
            >
              <Sparkles className="h-4 w-4" />
              {t('generate_analysis')}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : analysisResult ? (
          <div className="space-y-4">
            {/* Student greeting */}
            {analysisResult.includes(selectedStudentName) && (
              <div className="bg-primary/5 p-4 rounded-lg mb-6">
                <p className="text-sm">
                  {analysisResult.split('\n')[0]}
                </p>
              </div>
            )}
            
            {/* Sections */}
            <div className="divide-y">
              {parseSections(analysisResult).map((section, idx) => (
                <div key={idx} className="py-3">
                  <button 
                    onClick={() => toggleSection(section.title)}
                    className="flex items-center justify-between w-full text-left py-2"
                  >
                    <div className="flex items-center gap-2">
                      <div className="bg-primary/10 p-2 rounded-full">
                        {section.icon}
                      </div>
                      <h3 className="font-medium text-lg">{section.title}</h3>
                    </div>
                    {expandedSections[section.title] ? 
                      <ChevronUp className="h-5 w-5 text-muted-foreground" /> : 
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    }
                  </button>
                  
                  {expandedSections[section.title] && (
                    <div className="mt-3 pl-10 pr-4 pb-2 text-sm text-muted-foreground">
                      <MarkdownRenderer content={section.content} />
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            <div className="flex justify-end pt-4">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setAnalysisResult(null)}
              >
                {t('regenerate')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="bg-primary/10 p-4 rounded-full mb-4">
              <Sparkles className="h-10 w-10 text-primary" />
            </div>
            <h3 className="text-xl font-medium mb-2">{t('ai_analysis_available')}</h3>
            <p className="text-muted-foreground max-w-md mb-8">
              {t('click_generate_for_insights')}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 