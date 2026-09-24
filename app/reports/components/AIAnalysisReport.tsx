'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Sparkles, Loader2, ChevronDown, Clock, Star, Target, Lightbulb,
  BarChart2, BookOpen, Award, ListTree, RefreshCw,
} from 'lucide-react';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useTranslation } from '@/utils/translations';
import { AiQuotaError, throwForAiQuotaError } from '@/lib/ai-quota-errors';
import MarkdownRenderer from '@/app/components/ui/MarkdownRenderer';
import { parseAnalysisReport, type AnalysisSection, type AnalysisSectionKind } from '../lib/analysis-sections';

interface AIAnalysisReportProps {
  learningRecords: object[];
  learningStats: object | null;
  selectedStudentName: string;
}

const OPEN_BY_DEFAULT = new Set<AnalysisSectionKind>(['summary', 'improvements', 'recommendations']);

function iconForSection(kind: AnalysisSectionKind) {
  const className = 'h-5 w-5';
  switch (kind) {
    case 'summary': return <BookOpen className={className} aria-hidden="true" />;
    case 'time': return <Clock className={className} aria-hidden="true" />;
    case 'focus': return <Target className={className} aria-hidden="true" />;
    case 'patterns': return <BarChart2 className={className} aria-hidden="true" />;
    case 'strengths': return <Star className={className} aria-hidden="true" />;
    case 'improvements': return <Target className={className} aria-hidden="true" />;
    case 'recommendations': return <Lightbulb className={className} aria-hidden="true" />;
    default: return <ListTree className={className} aria-hidden="true" />;
  }
}

function sectionPreview(content: string) {
  const plainText = content
    .replace(/```[\s\S]*?```/g, '')
    .replace(/[#*_`>\[\]]/g, '')
    .replace(/^\s*[-+\d.)]+\s*/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
  return plainText.length > 72 ? `${plainText.slice(0, 72)}…` : plainText;
}

function AnalysisSectionCard({
  section,
  expanded,
  onToggle,
  evidenceLabel,
  actionLabel,
}: {
  section: AnalysisSection;
  expanded: boolean;
  onToggle: () => void;
  evidenceLabel: string;
  actionLabel: string;
}) {
  const actionSection = section.kind === 'recommendations' || section.kind === 'improvements';

  return (
    <section className={`overflow-hidden rounded-xl border transition-colors ${actionSection ? 'border-amber-200/80 bg-amber-50/30' : 'bg-card'}`}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={`analysis-section-${section.id}`}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset sm:px-5"
      >
        <span className={`rounded-lg p-2 ${actionSection ? 'bg-amber-100 text-amber-800' : 'bg-muted text-foreground/75'}`}>
          {iconForSection(section.kind)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-foreground sm:text-base">{section.title}</span>
          <span className={`mt-0.5 block text-xs ${expanded ? 'text-muted-foreground' : 'truncate text-foreground/60'}`}>
            {expanded ? (actionSection ? actionLabel : evidenceLabel) : sectionPreview(section.content)}
          </span>
        </span>
        <ChevronDown className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {expanded && (
        <div id={`analysis-section-${section.id}`} className="border-t bg-background/75 px-4 py-4 text-sm leading-7 text-foreground/80 sm:px-5">
          <div className="[&_.markdown-content>p]:mb-3 [&_.markdown-content>p:last-child]:mb-0 [&_.markdown-content>ul]:mb-0 [&_.markdown-content>ol]:mb-0 [&_.markdown-content_li]:mb-1.5">
            <MarkdownRenderer content={section.content} />
          </div>
        </div>
      )}
    </section>
  );
}

export function AIAnalysisReport({ learningRecords, learningStats, selectedStudentName }: AIAnalysisReportProps) {
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  const labels = language === 'zh-TW' ? {
    brief: '教師重點摘要', records: `${learningRecords.length} 筆學習紀錄`, evidence: '數據解讀',
    action: '建議行動', keyTakeaways: '核心結論與教學行動', evidenceGroup: '分析依據',
    evidenceHint: '需要追查原因時再展開，避免核心建議被大量細節淹沒。',
    viewEvidence: (count: number) => `查看 ${count} 項分析依據`, collapseEvidence: '收合分析依據', regenerate: '重新分析',
    disclaimer: 'AI 分析提供教學參考，請搭配原始學習紀錄與課堂觀察判讀。',
  } : {
    brief: 'Teacher brief', records: `${learningRecords.length} learning records`, evidence: 'Evidence and interpretation',
    action: 'Suggested action', keyTakeaways: 'Key takeaways and teaching actions', evidenceGroup: 'Supporting analysis',
    evidenceHint: 'Open supporting evidence only when you need to investigate the cause.',
    viewEvidence: (count: number) => `View ${count} supporting analyses`, collapseEvidence: 'Collapse supporting analysis', regenerate: 'Run analysis again',
    disclaimer: 'AI analysis is a teaching aid. Review it alongside source records and classroom observations.',
  };

  const parsedReport = useMemo(
    () => parseAnalysisReport(analysisResult, language),
    [analysisResult, language],
  );

  const prioritySections = useMemo(() => {
    const rank: Partial<Record<AnalysisSectionKind, number>> = {
      summary: 0,
      improvements: 1,
      recommendations: 2,
    };
    return parsedReport.sections
      .filter(section => section.kind in rank)
      .toSorted((a, b) => (rank[a.kind] ?? 99) - (rank[b.kind] ?? 99));
  }, [parsedReport.sections]);

  const evidenceSections = useMemo(
    () => parsedReport.sections.filter(section => !prioritySections.some(priority => priority.id === section.id)),
    [parsedReport.sections, prioritySections],
  );

  const generateAnalysis = async () => {
    if (!learningRecords.length || !learningStats) return;
    setIsLoading(true);
    setAnalysisError(null);

    try {
      const response = await fetch('/api/gemini/learning-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentName: selectedStudentName,
          stats: learningStats,
          recentLearning: learningRecords.slice(0, 8),
          language,
        }),
      });
      if (!response.ok) {
        await throwForAiQuotaError(response, language, 'Failed to generate learning analysis');
      }

      const { analysis } = await response.json();
      const nextReport = parseAnalysisReport(analysis, language);
      setAnalysisResult(analysis);
      setExpandedSections(Object.fromEntries(
        nextReport.sections.map(section => [section.id, OPEN_BY_DEFAULT.has(section.kind)]),
      ));
    } catch (error) {
      console.error('Error generating analysis:', error);
      setAnalysisError(error instanceof AiQuotaError ? error.message : t('analysis_generation_error'));
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSection = (sectionId: string) => {
    setExpandedSections(previous => ({ ...previous, [sectionId]: !previous[sectionId] }));
  };

  const setEvidenceSections = (expanded: boolean) => {
    setExpandedSections(previous => ({
      ...previous,
      ...Object.fromEntries(evidenceSections.map(section => [section.id, expanded])),
    }));
  };

  const allEvidenceExpanded = evidenceSections.length > 0
    && evidenceSections.every(section => expandedSections[section.id]);

  return (
    <Card className="mt-6 overflow-hidden shadow-none">
      <CardHeader className="border-b bg-muted/20 p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="rounded-xl border bg-background p-2.5 text-primary shadow-sm">
              <Sparkles className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-lg sm:text-xl">{t('ai_learning_analysis')}</CardTitle>
              <CardDescription className="mt-1 leading-5">{t('ai_powered_insights')}</CardDescription>
            </div>
          </div>

          {!analysisResult ? (
            <Button onClick={generateAnalysis} disabled={!learningRecords.length || isLoading} size="sm" className="w-full gap-2 sm:w-auto">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {isLoading ? t('processing') : t('generate_analysis')}
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={generateAnalysis} disabled={isLoading} className="w-full gap-2 sm:w-auto">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {labels.regenerate}
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-6">
        {analysisError && (
          <div role="alert" className="mb-4 rounded-xl border border-destructive/25 bg-destructive/5 p-4 text-sm text-destructive">
            {analysisError}
          </div>
        )}

        {isLoading && !analysisResult ? (
          <div className="flex min-h-48 flex-col items-center justify-center gap-3 text-center">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">{t('processing')}</p>
          </div>
        ) : analysisResult ? (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 rounded-xl border bg-muted/25 p-4 sm:flex-row sm:items-center">
              <div className="mr-auto flex min-w-0 items-center gap-3">
                <div className="rounded-lg bg-background p-2 text-primary ring-1 ring-border">
                  <Award className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{labels.brief}</p>
                  <p className="truncate text-xs text-muted-foreground">{selectedStudentName} · {labels.records}</p>
                </div>
              </div>
            </div>

            {parsedReport.preamble && (
              <p className="rounded-xl border-l-4 border-primary/50 bg-primary/[0.04] px-4 py-3 text-sm leading-6 text-foreground/80">
                {parsedReport.preamble}
              </p>
            )}

            {prioritySections.length > 0 && (
              <div className="space-y-3">
                <p className="app-kicker px-1">{labels.keyTakeaways}</p>
                {prioritySections.map(section => (
                  <AnalysisSectionCard
                    key={section.id}
                    section={section}
                    expanded={Boolean(expandedSections[section.id])}
                    onToggle={() => toggleSection(section.id)}
                    evidenceLabel={labels.evidence}
                    actionLabel={labels.action}
                  />
                ))}
              </div>
            )}

            {evidenceSections.length > 0 && (
              <div className="space-y-3 border-t pt-5">
                <div className="flex flex-col gap-3 px-1 sm:flex-row sm:items-center">
                  <div className="mr-auto">
                    <p className="text-sm font-semibold">{labels.evidenceGroup}</p>
                    <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">{labels.evidenceHint}</p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => setEvidenceSections(!allEvidenceExpanded)} className="w-full sm:w-auto">
                    {allEvidenceExpanded ? labels.collapseEvidence : labels.viewEvidence(evidenceSections.length)}
                  </Button>
                </div>
                <div className="grid gap-3">
                  {evidenceSections.map(section => (
                    <AnalysisSectionCard
                      key={section.id}
                      section={section}
                      expanded={Boolean(expandedSections[section.id])}
                      onToggle={() => toggleSection(section.id)}
                      evidenceLabel={labels.evidence}
                      actionLabel={labels.action}
                    />
                  ))}
                </div>
              </div>
            )}

            <p className="pt-1 text-xs leading-5 text-muted-foreground">{labels.disclaimer}</p>
          </div>
        ) : (
          <div className="flex min-h-52 flex-col items-center justify-center px-4 py-8 text-center">
            <div className="mb-4 rounded-2xl border bg-muted/30 p-4">
              <Sparkles className="h-8 w-8 text-primary" aria-hidden="true" />
            </div>
            <h3 className="text-base font-semibold sm:text-lg">{t('ai_analysis_available')}</h3>
            <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">{t('click_generate_for_insights')}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
