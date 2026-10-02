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

// Order the model is asked to fill, and the order structured output is
// rendered back in.
export const REPORT_SECTION_KINDS = [
  'summary', 'time', 'focus', 'patterns', 'strengths', 'improvements', 'recommendations',
] as const satisfies readonly AnalysisSectionKind[];

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

function atxHeading(line: string): { title: string; inlineContent: string } | null {
  const atx = line.trim().match(/^#{1,6}\s+(.+?)\s*#*$/);
  return atx ? { title: cleanHeading(atx[1]), inlineContent: '' } : null;
}

function cleanContent(lines: string[]) {
  return lines
    .join('\n')
    .replace(/^(?:\*\*|__)(.+?)(?:\*\*|__)$/gm, '$1')
    .trim();
}

// Prefixed to reports built from structured model output. Their "## " lines
// are the only real section boundaries, so the heuristic heading detection
// (bold lines, "Label：" prefixes...) must not run on their bodies - it would
// split body text like "觀察內容：..." into a bogus section.
const STRUCTURED_MARKER = '<!-- report:structured -->';

export const STRUCTURED_REPORT_JSON_SCHEMA = {
  type: 'object',
  properties: {
    sections: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: [...REPORT_SECTION_KINDS] },
          content: { type: 'string', description: 'Markdown body: one short paragraph or up to 3 bullets. No headings.' },
        },
        required: ['kind', 'content'],
      },
    },
  },
  required: ['sections'],
} as const;

// Turns the model's JSON into the "## Title" markdown parseAnalysisReport
// reads. Headings come from our own title table, so section boundaries no
// longer depend on how the model chose to format them. Returns null when the
// payload isn't usable so the caller can fall back to the raw text.
export function structuredReportToMarkdown(raw: string, language: ReportLanguage): string | null {
  let parsed: unknown;
  try {
    // Unconstrained responses often wrap JSON in a ```json fence.
    parsed = JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''));
  } catch {
    return null;
  }

  const sections = (parsed as { sections?: unknown })?.sections;
  if (!Array.isArray(sections)) return null;

  const byKind = new Map<AnalysisSectionKind, string>();
  for (const section of sections) {
    const kind = (section as { kind?: unknown })?.kind;
    const content = (section as { content?: unknown })?.content;
    if (typeof kind !== 'string' || typeof content !== 'string') continue;
    if (!(REPORT_SECTION_KINDS as readonly string[]).includes(kind)) continue;
    // Strip any heading lines the model put inside a body anyway - they would
    // otherwise be read as a new section boundary.
    const body = content.replace(/^\s*#{1,6}\s+.*$/gm, '').trim();
    if (!body) continue;
    const existing = byKind.get(kind as AnalysisSectionKind);
    byKind.set(kind as AnalysisSectionKind, existing ? `${existing}\n\n${body}` : body);
  }

  if (byKind.size === 0) return null;

  return `${STRUCTURED_MARKER}\n` + REPORT_SECTION_KINDS
    .filter(kind => byKind.has(kind))
    .map(kind => `## ${TITLES[language][kind]}\n${byKind.get(kind)}`)
    .join('\n\n');
}

export function parseAnalysisReport(
  text: string | null | undefined,
  language: ReportLanguage,
): ParsedAnalysisReport {
  if (!text?.trim()) return { preamble: '', sections: [] };

  const structured = text.trimStart().startsWith(STRUCTURED_MARKER);
  if (structured) text = text.trimStart().slice(STRUCTURED_MARKER.length);

  const preamble: string[] = [];
  const rawSections: Array<{ title: string; content: string[]; kind: AnalysisSectionKind }> = [];
  let current: { title: string; content: string[]; kind: AnalysisSectionKind } | null = null;

  for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
    const heading = structured ? atxHeading(line) : headingFromLine(line);
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
