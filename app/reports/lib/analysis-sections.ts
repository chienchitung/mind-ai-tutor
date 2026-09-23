export type AnalysisSectionKind =
  | 'summary'
  | 'time'
  | 'focus'
  | 'patterns'
  | 'strengths'
  | 'improvements'
  | 'recommendations'
  | 'general';

export interface AnalysisSection {
  id: string;
  title: string;
  content: string;
  kind: AnalysisSectionKind;
}

export interface ParsedAnalysisReport {
  preamble: string;
  sections: AnalysisSection[];
}

type ReportLanguage = 'en' | 'zh-TW';

const TITLES: Record<ReportLanguage, Record<AnalysisSectionKind, string>> = {
  en: {
    summary: 'Overall learning summary',
    time: 'Learning time and pace',
    focus: 'Learning focus and engagement',
    patterns: 'Learning behavior observations',
    strengths: 'Strengths',
    improvements: 'Priority improvement areas',
    recommendations: 'Recommended next steps',
    general: 'Additional insight',
  },
  'zh-TW': {
    summary: '整體學習摘要',
    time: '學習時間與節奏',
    focus: '學習重點與投入',
    patterns: '學習行為觀察',
    strengths: '學習優勢',
    improvements: '優先改善項目',
    recommendations: '教師下一步建議',
    general: '其他學習洞察',
  },
};

function cleanHeading(value: string) {
  return value
    .replace(/^\s*(?:[-*>]+|#{1,6})\s*/, '')
    .replace(/^\s*\d+[.)、]\s*/, '')
    .replace(/[\s*_`#]+/g, ' ')
    .replace(/^[\s:：\-—–]+|[\s:：\-—–]+$/g, '')
    .trim();
}

function sectionKind(title: string): AnalysisSectionKind {
  const normalized = cleanHeading(title).toLowerCase();

  if (/建議|下一步|recommend|next step/.test(normalized)) return 'recommendations';
  if (/改進|改善|待加強|improvement|area to improve/.test(normalized)) return 'improvements';
  if (/優勢|優點|strength|doing well/.test(normalized)) return 'strengths';
  if (/時間|節奏|time management|learning time|pace/.test(normalized)) return 'time';
  if (/科目|類別|重點|投入|subject|category|focus|engagement/.test(normalized)) return 'focus';
  if (/模式|行為|觀察|洞察|策略|pattern|behavior|behaviour|insight/.test(normalized)) return 'patterns';
  if (/整體|總結|摘要|overall|summary|overview/.test(normalized)) return 'summary';
  return 'general';
}

function looksLikeKnownHeading(value: string) {
  return sectionKind(value) !== 'general';
}

function looksLikeStandaloneHeading(value: string) {
  const cleaned = cleanHeading(value);
  return cleaned.length <= 50
    && !/[。！？；，,.!?;]/.test(cleaned)
    && looksLikeKnownHeading(cleaned);
}

function headingFromLine(line: string): { title: string; inlineContent: string } | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  // Markdown headings: ## Strengths / ## **學習優勢**
  const atx = trimmed.match(/^#{1,6}\s+(.+?)\s*#*$/);
  if (atx) return { title: cleanHeading(atx[1]), inlineContent: '' };

  // Bold heading on its own, or a common model variation where the first
  // paragraph starts on the same line: **策略轉變能力**：內容。
  const bold = trimmed.match(/^\*\*(.+?)\*\*\s*(?:[:：]\s*(.*))?$/);
  if (bold) {
    return {
      title: cleanHeading(bold[1]),
      inlineContent: bold[2]?.trim() ?? '',
    };
  }

  // Numbered headings are accepted only when they name a known report
  // section. This avoids turning an ordinary numbered recommendation into a
  // new accordion section.
  const numbered = trimmed.match(/^\d+[.)、]\s+(.+)$/);
  if (numbered && looksLikeStandaloneHeading(numbered[1])) {
    return { title: cleanHeading(numbered[1]), inlineContent: '' };
  }

  // Plain section labels such as "Strengths:" are also supported, but only
  // for known report sections so normal prose containing a colon stays prose.
  const label = trimmed.match(/^([^:：]{1,80})[:：]\s*(.*)$/);
  if (label && looksLikeKnownHeading(label[1])) {
    return {
      title: cleanHeading(label[1]),
      inlineContent: label[2]?.trim() ?? '',
    };
  }

  if (looksLikeStandaloneHeading(trimmed)) {
    return { title: cleanHeading(trimmed), inlineContent: '' };
  }

  return null;
}

function cleanContent(lines: string[]) {
  return lines
    .join('\n')
    .replace(/^(?:\*\*|__)(.+?)(?:\*\*|__)$/gm, '$1')
    .trim();
}

export function parseAnalysisReport(
  text: string | null | undefined,
  language: ReportLanguage,
): ParsedAnalysisReport {
  if (!text?.trim()) return { preamble: '', sections: [] };

  const preamble: string[] = [];
  const rawSections: Array<{ title: string; content: string[]; kind: AnalysisSectionKind }> = [];
  let current: { title: string; content: string[]; kind: AnalysisSectionKind } | null = null;

  for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
    const heading = headingFromLine(line);
    if (heading?.title) {
      if (current) rawSections.push(current);
      const kind = sectionKind(heading.title);
      current = {
        title: kind === 'general' ? heading.title : TITLES[language][kind],
        content: heading.inlineContent ? [heading.inlineContent] : [],
        kind,
      };
      continue;
    }

    if (current) {
      current.content.push(line);
    } else if (line.trim()) {
      preamble.push(line);
    }
  }

  if (current) rawSections.push(current);

  // Responses without headings are still useful. Present them as a compact
  // summary rather than leaving the report blank.
  if (rawSections.length === 0) {
    return {
      preamble: '',
      sections: [{
        id: 'summary-0',
        title: TITLES[language].summary,
        content: cleanContent(preamble),
        kind: 'summary',
      }],
    };
  }

  return {
    preamble: cleanContent(preamble),
    sections: rawSections
      .map((section, index) => ({
        id: `${section.kind}-${index}`,
        title: section.title,
        content: cleanContent(section.content),
        kind: section.kind,
      }))
      .filter(section => section.content.length > 0),
  };
}
