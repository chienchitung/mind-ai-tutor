'use client';

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, Star, Download, Calendar, Loader2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import ExcelJS from 'exceljs';
import { useToast } from '@/hooks/use-toast';
import { cn } from "@/lib/utils";
import { badgeVariants } from "@/components/ui/badge";
import { useLanguage } from "@/app/contexts/LanguageContext";
import { useTranslation } from "@/utils/translations";

// Define feedback data type
interface FeedbackItem {
  id: string;
  student: {
    name: string;
    avatar: string;
    initials: string;
  };
  course: string;
  content: string;
  date: string;
  fullDate: string;
  status: string;
  rawStatus: string;
  rating: number;
}

const FeedbackPage = () => {
  const router = useRouter();
  const [excelJS, setExcelJS] = useState<typeof ExcelJS | null>(null);
  const [feedbackData, setFeedbackData] = useState<FeedbackItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  // Fetch feedback data from Supabase
  useEffect(() => {
    const fetchFeedback = async () => {
      try {
        setIsLoading(true);
        
        // 動態導入 supabase 函數
        const { supabase } = await import('@/lib/supabase');
        const supabaseClient = supabase();
        
        // 使用 supabaseClient 而不是直接使用 supabase
        const { data: supabaseData, error } = await supabaseClient
          .from('feedback')
          .select(`
            id,
            student_name,
            student_initials,
            course,
            content,
            rating,
            created_at,
            status
          `)
          .order('created_at', { ascending: false });
          
        if (error) {
          console.error('Supabase error:', error);
          throw error;
        }

        // Process the data - either from Supabase or use mock data as fallback
        let dataToProcess = supabaseData;
        
        if (!supabaseData || supabaseData.length === 0) {
          console.warn('No data returned from Supabase');
          dataToProcess = [];
        }
        
        // Transform the data to match our FeedbackItem interface
        const formattedData: FeedbackItem[] = dataToProcess.map(item => {
          // Cast to any to avoid TypeScript errors
          const itemAny = item as any;
          const createdAt = new Date(itemAny.created_at);
          
          // Format relative time
          const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
          const now = new Date();
          const diffInDays = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
          const diffInHours = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60));
          
          let relativeTime;
          if (diffInHours < 24) {
            relativeTime = rtf.format(-diffInHours, 'hour');
          } else {
            relativeTime = rtf.format(-diffInDays, 'day');
          }
          
          return {
            id: itemAny.id,
            student: {
              name: itemAny.student_name || `Student ${itemAny.id}`,
              avatar: '/avatars/default.png',
              initials: itemAny.student_initials || (itemAny.student_name ? itemAny.student_name.charAt(0) : 'S')
            },
            course: itemAny.course || 'Course',
            content: itemAny.content,
            date: relativeTime,
            fullDate: createdAt.toISOString().split('T')[0],
            status: itemAny.status === 'not_responded' ? t('unresponded') : t('responded'),
            rawStatus: itemAny.status,
            rating: itemAny.rating
          };
        });
        
        setFeedbackData(formattedData);
      } catch (err) {
        console.error('Error fetching feedback:', err);
        setError('Failed to load feedback data');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchFeedback();
  }, []);

  useEffect(() => {
    setExcelJS(ExcelJS);
  }, []);

  const downloadExcelData = async () => {
    if (!excelJS) return;

    try {
      const workbook = new excelJS.Workbook();
      const worksheet = workbook.addWorksheet('Feedback');

      // Add headers
      worksheet.addRow(['Student', 'Course', 'Content', 'Date', 'Status', 'Rating']);

      // Add data
      feedbackData.forEach((item: FeedbackItem) => {
        worksheet.addRow([
          item.student.name,
          item.course,
          item.content,
          item.date,
          item.status,
          item.rating
        ]);
      });

      // Style the header row
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };

      // Auto-fit columns
      worksheet.columns.forEach((column) => {
        if (column) {
          column.width = 15;
        }
      });

      // Generate buffer
      const buffer = await workbook.xlsx.writeBuffer();

      // Create blob and download
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'feedback.xlsx';
      a.click();
      window.URL.revokeObjectURL(url);

      toast({
        title: t('success'),
        description: t('feedback_exported'),
      });
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      toast({
        title: t('error'),
        description: t('failed_export_feedback'),
        variant: "destructive",
      });
    }
  };
  
  // Render stars based on rating
  const renderStars = (rating: number) => {
    return Array(5).fill(0).map((_, index) => (
      <Star 
        key={index} 
        className={`h-4 w-4 ${index < rating ? "text-yellow-400 fill-yellow-400" : "text-gray-300"}`} 
      />
    ));
  };
  
  // Display status badge
  const renderStatusBadge = (status: string, rawStatus: string) => {
    const isNotResponded = rawStatus === 'not_responded';
    return (
      <div className={cn(
        badgeVariants({ 
          variant: isNotResponded ? "destructive" : "outline",
          className: "text-xs"
        })
      )}>
        {status}
      </div>
    );
  };

  // Handle respond to feedback
  const handleRespondToFeedback = async (feedbackId: string) => {
    try {
      router.push(`/feedback/${feedbackId}`);
    } catch (error) {
      console.error('Error navigating to feedback response:', error);
    }
  };
  
  // Render loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">{t('loading_feedback_data')}</p>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh]">
        <p className="text-destructive mb-4">{error}</p>
        <Button onClick={() => window.location.reload()}>
          {t('try_again')}
        </Button>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">{t('student_feedback')}</h1>
        </div>
        <Button onClick={downloadExcelData} className="flex items-center gap-2">
          <Download className="h-4 w-4" />
          {t('export_to_excel')}
        </Button>
      </div>
      
      <Tabs defaultValue="all">
        <TabsList className="mb-6">
          <TabsTrigger value="all">{t('all_feedback')}</TabsTrigger>
          <TabsTrigger value="unresponded">{t('unresponded')}</TabsTrigger>
          <TabsTrigger value="responded">{t('responded')}</TabsTrigger>
        </TabsList>
        
        <TabsContent value="all" className="space-y-4">
          {feedbackData.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-muted-foreground">{t('no_feedback_data')}</p>
            </div>
          ) : (
            feedbackData.map((feedback: FeedbackItem) => (
              <Card key={feedback.id} className="hover:bg-muted/10 transition-colors">
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                  <div className="flex items-center space-x-4">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={feedback.student.avatar} alt={feedback.student.name} />
                      <AvatarFallback>{feedback.student.initials}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">{feedback.student.name}</div>
                      <div className="text-sm text-muted-foreground">{feedback.course}</div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    {renderStatusBadge(feedback.status, feedback.rawStatus)}
                    <div className="flex items-center text-xs text-muted-foreground mt-1">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-1 cursor-help">
                              <Calendar className="h-3 w-3" />
                              <span>{feedback.date}</span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{t('feedback_date')} {feedback.fullDate}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-start">
                    <p className="text-sm leading-relaxed flex-1">{feedback.content}</p>
                    <div className="flex items-center gap-1 mt-1 ml-4 flex-shrink-0">
                      {renderStars(feedback.rating)}
                    </div>
                  </div>
                  
                  <div className="flex justify-end mt-4">
                    <Button 
                      variant={feedback.rawStatus === 'not_responded' ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleRespondToFeedback(feedback.id)}
                      className="flex items-center gap-2 px-4 py-2"
                    >
                      <MessageSquare className="h-4 w-4" />
                      <span className="whitespace-nowrap">{feedback.rawStatus === 'not_responded' ? t('respond') : t('view_conversation')}</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
        
        <TabsContent value="unresponded" className="space-y-4">
          {feedbackData.filter((f: FeedbackItem) => f.rawStatus === 'not_responded').length === 0 ? (
            <div className="text-center py-10">
              <p className="text-muted-foreground">{t('no_unresponded_feedback')}</p>
            </div>
          ) : (
            feedbackData.filter((f: FeedbackItem) => f.rawStatus === 'not_responded').map((feedback: FeedbackItem) => (
              <Card key={feedback.id} className="hover:bg-muted/10 transition-colors">
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                  <div className="flex items-center space-x-4">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={feedback.student.avatar} alt={feedback.student.name} />
                      <AvatarFallback>{feedback.student.initials}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">{feedback.student.name}</div>
                      <div className="text-sm text-muted-foreground">{feedback.course}</div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    {renderStatusBadge(feedback.status, feedback.rawStatus)}
                    <div className="flex items-center text-xs text-muted-foreground mt-1">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-1 cursor-help">
                              <Calendar className="h-3 w-3" />
                              <span>{feedback.date}</span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{t('feedback_date')} {feedback.fullDate}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-start">
                    <p className="text-sm leading-relaxed flex-1">{feedback.content}</p>
                    <div className="flex items-center gap-1 mt-1 ml-4 flex-shrink-0">
                      {renderStars(feedback.rating)}
                    </div>
                  </div>
                  
                  <div className="flex justify-end mt-4">
                    <Button 
                      variant="default"
                      size="sm"
                      onClick={() => handleRespondToFeedback(feedback.id)}
                      className="flex items-center gap-2 px-4 py-2"
                    >
                      <MessageSquare className="h-4 w-4" />
                      <span className="whitespace-nowrap">{t('respond')}</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
        
        <TabsContent value="responded" className="space-y-4">
          {feedbackData.filter((f: FeedbackItem) => f.rawStatus === 'responded').length === 0 ? (
            <div className="text-center py-10">
              <p className="text-muted-foreground">{t('no_responded_feedback')}</p>
            </div>
          ) : (
            feedbackData.filter((f: FeedbackItem) => f.rawStatus === 'responded').map((feedback: FeedbackItem) => (
              <Card key={feedback.id} className="hover:bg-muted/10 transition-colors">
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                  <div className="flex items-center space-x-4">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={feedback.student.avatar} alt={feedback.student.name} />
                      <AvatarFallback>{feedback.student.initials}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">{feedback.student.name}</div>
                      <div className="text-sm text-muted-foreground">{feedback.course}</div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    {renderStatusBadge(feedback.status, feedback.rawStatus)}
                    <div className="flex items-center text-xs text-muted-foreground mt-1">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-1 cursor-help">
                              <Calendar className="h-3 w-3" />
                              <span>{feedback.date}</span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{t('feedback_date')} {feedback.fullDate}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-start">
                    <p className="text-sm leading-relaxed flex-1">{feedback.content}</p>
                    <div className="flex items-center gap-1 mt-1 ml-4 flex-shrink-0">
                      {renderStars(feedback.rating)}
                    </div>
                  </div>
                  
                  <div className="flex justify-end mt-4">
                    <Button 
                      variant="outline"
                      size="sm"
                      onClick={() => handleRespondToFeedback(feedback.id)}
                      className="flex items-center gap-2 px-4 py-2"
                    >
                      <MessageSquare className="h-4 w-4" />
                      <span className="whitespace-nowrap">{t('view_conversation')}</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default FeedbackPage; 