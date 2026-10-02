'use client';

import { useEffect, useMemo, useState } from 'react';
import { flushSync } from 'react-dom';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { loadAnalysisHistory, saveAnalysisReport, type SavedAnalysisReport } from '../lib/analysis-history';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Sparkles, Loader2, ChevronDown, Clock, Star, Target, Lightbulb,
  BarChart2, BookOpen, ListTree, RefreshCw, MessageSquareText, AlertCircle,
} from 'lucide-react';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useTranslation } from '@/lib/translations';
import { AiQuotaError, throwForAiQuotaError } from '@/lib/ai-quota-errors';
import MarkdownRenderer from '@/app/components/ui/MarkdownRenderer';
import { parseAnalysisReport, type AnalysisSection, type AnalysisSectionKind } from '../lib/analysis-sections';
import type { ConversationDigest } from '../lib/chat-insights';

interface AIAnalysisReportProps {
  learningRecords: object[];
  learningStats: object | null;
  selectedStudentName: string;
  studentId: string | null;
  // Describes the filters the analysis was run under (game, period), saved
  // with each report so history entries can be told apart.
  scopeLabel: string;
  // The student's recent questions to the AI tutor, analysed into the
  // "conversation" section. Absent when there's no chat in scope.
  conversation?: ConversationDigest | null;
}

// Tightens MarkdownRenderer's document-style spacing for report panels.
const MARKDOWN_TIGHT = '[&_.markdown-content>p]:mb-2.5 [&_.markdown-content>p:last-child]:mb-0 [&_.markdown-content>ul]:mb-0 [&_.markdown-content>ol]:mb-0 [&_.markdown-content_li]:mb-1';

function iconForSection(kind: AnalysisSectionKind, className = 'h-4 w-4') {
  switch (kind) {
    case 'summary': return <BookOpen className={className} aria-hidden="true" />;
    case 'time': return <Clock className={className} aria-hidden="true" />;
    case 'focus': return <Target className={className} aria-hidden="true" />;
    case 'patterns': return <BarChart2 className={className} aria-hidden="true" />;
    case 'conversation': return <MessageSquareText className={className} aria-hidden="true" />;
    case 'strengths': return <Star className={className} aria-hidden="true" />;
    case 'improvements': return <AlertCircle className={className} aria-hidden="true" />;
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

// The few sections a teacher acts on are always open, as plain panels; the
// colour of the small icon says what kind of panel it is (attention vs.
// action), the text itself stays full-contrast ink.
const PANEL_ICON_TONE: Partial<Record<AnalysisSectionKind, string>> = {
  improvements: 'text-amber-600',
  recommendations: 'text-[var(--chart-1)]',
  conversation: 'text-foreground/60',
};

function KeyPanel({ section }: { section: AnalysisSection }) {
  return (
    <section className="rounded-xl bg-muted/60 p-4 sm:p-5" aria-labelledby={`analysis-${section.id}`}>
      <h4 id={`analysis-${section.id}`} className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <span className={PANEL_ICON_TONE[section.kind] ?? 'text-foreground/60'}>{iconForSection(section.kind)}</span>
        {section.title}
      </h4>
      <div className={`mt-2 text-sm leading-7 text-foreground ${MARKDOWN_TIGHT}`}>
        <MarkdownRenderer content={section.content} />
      </div>
    </section>
  );
}

function EvidenceRow({
  section,
  expanded,
  onToggle,
}: {
  section: AnalysisSection;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={`analysis-section-${section.id}`}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <span className="text-muted-foreground">{iconForSection(section.kind)}</span>
        <span className="min-w-0 flex-1 sm:flex sm:items-baseline sm:gap-4">
          <span className="block shrink-0 text-sm font-medium text-foreground sm:w-32">{section.title}</span>
          {!expanded && (
            <span className="block truncate text-xs text-muted-foreground sm:text-sm">{sectionPreview(section.content)}</span>
          )}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {expanded && (
        <div id={`analysis-section-${section.id}`} className={`px-4 pb-4 text-sm leading-7 text-foreground sm:pl-11 ${MARKDOWN_TIGHT}`}>
          <MarkdownRenderer content={section.content} />
        </div>
      )}
    </div>
  );
}

export function AIAnalysisReport({ learningRecords, learningStats, selectedStudentName, studentId, scopeLabel, conversation }: AIAnalysisReportProps) {
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [history, setHistory] = useState<SavedAnalysisReport[]>([]);
  const [historyAvailable, setHistoryAvailable] = useState(true);
  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  const showReport = (analysis: string) => {
    setAnalysisResult(analysis);
    // Supporting sections start collapsed for every new report.
    setExpandedSections({});
  };

  // Open the most recent saved report automatically: revisiting a student
  // shouldn't require (and spend AI points on) generating it again.
  useEffect(() => {
    setHistory([]);
    setActiveReportId(null);
    setAnalysisResult(null);
    setAnalysisError(null);
    if (!studentId) return;

    let cancelled = false;
    void loadAnalysisHistory(studentId).then(result => {
      if (cancelled) return;
      if (result.status === 'unavailable') {
        setHistoryAvailable(false);
        return;
      }
      if (result.status !== 'ok' || result.reports.length === 0) return;
      setHistory(result.reports);
      setActiveReportId(result.reports[0].id);
      showReport(result.reports[0].analysis);
    });
    return () => { cancelled = true; };
    // showReport only depends on language, which re-parses via useMemo anyway.
  }, [studentId]);

  // Mount the fully expanded print copy only while printing, so the normal
  // page doesn't carry a second hidden copy of the whole report. flushSync
  // makes it render before the browser snapshots the page for printing.
  const [isPrinting, setIsPrinting] = useState(false);
  useEffect(() => {
    const before = () => flushSync(() => setIsPrinting(true));
    const after = () => setIsPrinting(false);
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => {
      window.removeEventListener('beforeprint', before);
      window.removeEventListener('afterprint', after);
    };
  }, []);

  const activeReport = history.find(report => report.id === activeReportId) ?? null;
  const formatReportTime = (iso: string) => new Date(iso).toLocaleString(language === 'zh-TW' ? 'zh-TW' : 'en-US', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });

  const labels = language === 'zh-TW' ? {
    records: `${learningRecords.length} 筆學習紀錄`, evidenceGroup: '分析依據',
    evidenceHint: '需要追查原因時再展開。', expandAll: '全部展開', collapseAll: '全部收合', regenerate: '重新分析',
    disclaimer: 'AI 分析提供教學參考，請搭配原始學習紀錄與課堂觀察判讀。',
    generatedAt: (time: string) => `產生於 ${time}`, history: '歷史報告', latest: '最新',
    viewingOlder: '你正在查看較早的報告，內容反映的是當時的學習紀錄。',
  } : {
    records: `${learningRecords.length} learning records`, evidenceGroup: 'Supporting analysis',
    evidenceHint: 'Open these when you need to investigate the cause.', expandAll: 'Expand all', collapseAll: 'Collapse all', regenerate: 'Run analysis again',
    disclaimer: 'AI analysis is a teaching aid. Review it alongside source records and classroom observations.',
    generatedAt: (time: string) => `Generated ${time}`, history: 'Report history', latest: 'latest',
    viewingOlder: "You're viewing an earlier report. It reflects the learning records at that time.",
  };

  const parsedReport = useMemo(
    () => parseAnalysisReport(analysisResult, language),
    [analysisResult, language],
  );

  // Reading order for a teacher: the summary, then what needs attention and
  // what to do next, then what the student asked the AI tutor. Everything
  // else is supporting evidence, collapsed until needed.
  const layout = useMemo(() => {
    const sections = parsedReport.sections;
    const first = (kind: AnalysisSectionKind) => sections.find(section => section.kind === kind) ?? null;
    const summary = first('summary');
    const improvements = first('improvements');
    const recommendations = first('recommendations');
    const conversationSection = first('conversation');
    const featured = new Set([summary, improvements, recommendations, conversationSection].filter(Boolean));
    return {
      summary,
      improvements,
      recommendations,
      conversation: conversationSection,
      evidence: sections.filter(section => !featured.has(section)),
    };
  }, [parsedReport.sections]);

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
          ...(conversation ? { conversation } : {}),
          language,
        }),
      });
      if (!response.ok) {
        await throwForAiQuotaError(response, language, 'Failed to generate learning analysis');
      }

      const { analysis } = await response.json();
      showReport(analysis);
      setActiveReportId(null);

      if (studentId && historyAvailable) {
        const saved = await saveAnalysisReport({
          studentId,
          analysis,
          language,
          scopeLabel,
          recordCount: learningRecords.length,
        });
        if (saved) {
          setHistory(previous => [saved, ...previous]);
          setActiveReportId(saved.id);
        }
      }
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

  const allEvidenceExpanded = layout.evidence.length > 0
    && layout.evidence.every(section => expandedSections[section.id]);

  const setAllEvidence = (expanded: boolean) => {
    setExpandedSections(Object.fromEntries(layout.evidence.map(section => [section.id, expanded])));
  };

  const reportMeta = activeReport
    ? [selectedStudentName, labels.generatedAt(formatReportTime(activeReport.created_at)), activeReport.scope_label]
    : [selectedStudentName, labels.records];
  const metaLine = reportMeta.filter(Boolean).join(' · ');

  const printOrder = [layout.summary, layout.improvements, layout.recommendations, layout.conversation, ...layout.evidence]
    .filter((section): section is AnalysisSection => Boolean(section));

  return (
    <Card className={`mt-6 overflow-hidden shadow-none print:mt-4 print:break-inside-auto ${analysisResult ? '' : 'print:hidden'}`}>
      <CardHeader className="border-b p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="rounded-xl border bg-background p-2.5 text-primary">
              <Sparkles className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-lg sm:text-xl">{t('ai_learning_analysis')}</CardTitle>
              <CardDescription className="mt-1 leading-5 sm:truncate">
                {analysisResult ? metaLine : t('ai_powered_insights')}
              </CardDescription>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center print:hidden">
            {analysisResult && history.length > 1 && (
              <Select
                value={activeReportId ?? undefined}
                onValueChange={(id) => {
                  const report = history.find(item => item.id === id);
                  if (!report) return;
                  setActiveReportId(id);
                  showReport(report.analysis);
                }}
              >
                <SelectTrigger className="w-full sm:w-[210px]" aria-label={labels.history}>
                  <SelectValue placeholder={labels.history} />
                </SelectTrigger>
                <SelectContent>
                  {history.map((report, index) => (
                    <SelectItem key={report.id} value={report.id}>
                      {formatReportTime(report.created_at)}{index === 0 ? ` (${labels.latest})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
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
        </div>
      </CardHeader>

      {/* md:p-6 restates the top padding: CardContent defaults to md:pt-0
          for cards whose header flows straight into the content, but this
          header has its own border. */}
      <CardContent className="p-5 sm:p-6 md:p-6">
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
          <div className="space-y-6 print:hidden">
            {activeReport && activeReport.id !== history[0]?.id && (
              <p className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-xs text-amber-900">
                {labels.viewingOlder}
              </p>
            )}

            {(layout.summary || parsedReport.preamble) && (
              <section aria-labelledby="analysis-lead">
                <h4 id="analysis-lead" className="app-kicker">
                  {layout.summary?.title ?? (language === 'zh-TW' ? '摘要' : 'Summary')}
                </h4>
                {parsedReport.preamble && (
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{parsedReport.preamble}</p>
                )}
                {layout.summary && (
                  <div className={`mt-2 text-[15px] leading-7 text-foreground ${MARKDOWN_TIGHT}`}>
                    <MarkdownRenderer content={layout.summary.content} />
                  </div>
                )}
              </section>
            )}

            {(layout.improvements || layout.recommendations) && (
              <div className={`grid gap-3 ${layout.improvements && layout.recommendations ? 'md:grid-cols-2' : ''}`}>
                {layout.improvements && <KeyPanel section={layout.improvements} />}
                {layout.recommendations && <KeyPanel section={layout.recommendations} />}
              </div>
            )}

            {layout.conversation && <KeyPanel section={layout.conversation} />}

            {layout.evidence.length > 0 && (
              <section aria-labelledby="analysis-evidence">
                <div className="mb-2 flex items-end justify-between gap-3">
                  <div>
                    <h4 id="analysis-evidence" className="text-sm font-semibold">{labels.evidenceGroup}</h4>
                    <p className="mt-0.5 text-xs text-muted-foreground">{labels.evidenceHint}</p>
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setAllEvidence(!allEvidenceExpanded)}>
                    {allEvidenceExpanded ? labels.collapseAll : labels.expandAll}
                  </Button>
                </div>
                <div className="divide-y rounded-xl border">
                  {layout.evidence.map(section => (
                    <EvidenceRow
                      key={section.id}
                      section={section}
                      expanded={Boolean(expandedSections[section.id])}
                      onToggle={() => toggleSection(section.id)}
                    />
                  ))}
                </div>
              </section>
            )}

            <p className="text-xs leading-5 text-muted-foreground">{labels.disclaimer}</p>
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

        {/* Printed reports can't expand an accordion, so print every section
            in full instead of whatever happened to be open on screen. */}
        {analysisResult && isPrinting && (
          <div className="hidden space-y-4 print:block">
            <p className="text-xs text-muted-foreground">{metaLine}</p>
            {parsedReport.preamble && <p className="text-sm leading-6">{parsedReport.preamble}</p>}
            {printOrder.map(section => (
              <section key={section.id} className="break-inside-avoid border-t pt-3">
                <h3 className="mb-1 text-sm font-semibold">{section.title}</h3>
                <div className="text-sm leading-6 [&_.markdown-content>p]:mb-2 [&_.markdown-content>ul]:mb-0">
                  <MarkdownRenderer content={section.content} />
                </div>
              </section>
            ))}
            <p className="text-xs text-muted-foreground">{labels.disclaimer}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
