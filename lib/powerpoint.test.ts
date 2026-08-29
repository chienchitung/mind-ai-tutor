import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { createQuizPowerPoint } from './powerpoint';

describe('createQuizPowerPoint', () => {
  it('creates a valid Open XML package without image parsers', async () => {
    const blob = await createQuizPowerPoint({
      title: '安全性 & 測試',
      questions: [{
        questionText: '2 < 3 嗎？',
        options: [
          { id: 'a', text: '是' },
          { id: 'b', text: '否' },
        ],
        correctAnswer: 'a',
        explanation: '因為 2 小於 3。',
      }],
      showAnswers: true,
      explanationLabel: '解釋：',
      generatedOn: '2026/8/29',
    });

    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const presentation = await zip.file('ppt/presentation.xml')?.async('string');
    const questionSlide = await zip.file('ppt/slides/slide2.xml')?.async('string');

    expect(zip.file('[Content_Types].xml')).not.toBeNull();
    expect(zip.file('ppt/slides/slide1.xml')).not.toBeNull();
    expect(zip.file('ppt/slides/slide2.xml')).not.toBeNull();
    expect(presentation).toContain('rId3');
    expect(questionSlide).toContain('2 &lt; 3 嗎？');
    expect(questionSlide).toContain('A. 是 ✓');
  });
});
