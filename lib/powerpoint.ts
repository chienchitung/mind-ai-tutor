import JSZip from 'jszip';

const EMU_PER_INCH = 914400;
const SLIDE_WIDTH = 13.333;
const SLIDE_HEIGHT = 7.5;
const PPTX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

interface QuizOption {
  id: string;
  text: string;
}

interface QuizQuestion {
  questionText: string;
  options: QuizOption[];
  correctAnswer: string | string[];
  explanation: string;
}

interface QuizPowerPointOptions {
  title: string;
  questions: QuizQuestion[];
  showAnswers: boolean;
  explanationLabel: string;
  generatedOn: string;
}

interface TextBoxOptions {
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  color?: string;
  bold?: boolean;
  align?: 'left' | 'center' | 'right';
}

function escapeXml(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toEmu(inches: number): number {
  return Math.round(inches * EMU_PER_INCH);
}

function textBox(id: number, name: string, text: string, options: TextBoxOptions): string {
  const color = options.color ?? '000000';
  const bold = options.bold ? ' b="1"' : '';
  const alignment = options.align === 'center' ? 'ctr' : options.align === 'right' ? 'r' : 'l';
  const paragraphs = text.split(/\r?\n/).map((line) => `
    <a:p>
      <a:pPr algn="${alignment}"/>
      <a:r>
        <a:rPr lang="zh-TW" sz="${Math.round(options.fontSize * 100)}"${bold} dirty="0">
          <a:solidFill><a:srgbClr val="${color}"/></a:solidFill>
          <a:latin typeface="Calibri"/>
          <a:ea typeface="Microsoft JhengHei"/>
        </a:rPr>
        <a:t>${escapeXml(line)}</a:t>
      </a:r>
      <a:endParaRPr lang="zh-TW" sz="${Math.round(options.fontSize * 100)}"/>
    </a:p>`).join('');

  return `
  <p:sp>
    <p:nvSpPr>
      <p:cNvPr id="${id}" name="${escapeXml(name)}"/>
      <p:cNvSpPr txBox="1"/>
      <p:nvPr/>
    </p:nvSpPr>
    <p:spPr>
      <a:xfrm>
        <a:off x="${toEmu(options.x)}" y="${toEmu(options.y)}"/>
        <a:ext cx="${toEmu(options.width)}" cy="${toEmu(options.height)}"/>
      </a:xfrm>
      <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
      <a:noFill/>
      <a:ln><a:noFill/></a:ln>
    </p:spPr>
    <p:txBody>
      <a:bodyPr wrap="square" rtlCol="0" anchor="t"/>
      <a:lstStyle/>${paragraphs}
    </p:txBody>
  </p:sp>`;
}

function rectangle(id: number, name: string, x: number, y: number, width: number, height: number, color: string): string {
  return `
  <p:sp>
    <p:nvSpPr>
      <p:cNvPr id="${id}" name="${escapeXml(name)}"/>
      <p:cNvSpPr/>
      <p:nvPr/>
    </p:nvSpPr>
    <p:spPr>
      <a:xfrm>
        <a:off x="${toEmu(x)}" y="${toEmu(y)}"/>
        <a:ext cx="${toEmu(width)}" cy="${toEmu(height)}"/>
      </a:xfrm>
      <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
      <a:solidFill><a:srgbClr val="${color}"/></a:solidFill>
      <a:ln><a:noFill/></a:ln>
    </p:spPr>
  </p:sp>`;
}

function slideXml(shapes: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr>
        <p:cNvPr id="1" name=""/>
        <p:cNvGrpSpPr/>
        <p:nvPr/>
      </p:nvGrpSpPr>
      <p:grpSpPr>
        <a:xfrm>
          <a:off x="0" y="0"/><a:ext cx="0" cy="0"/>
          <a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/>
        </a:xfrm>
      </p:grpSpPr>${shapes}
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>`;
}

function titleSlide(options: QuizPowerPointOptions): string {
  return slideXml([
    textBox(2, 'Title', options.title, {
      x: 0.65, y: 1.5, width: 12.03, height: 1.5, fontSize: 44,
      color: '2B579A', bold: true, align: 'center',
    }),
    textBox(3, 'Question count', `${options.questions.length} Questions`, {
      x: 0.65, y: 3.5, width: 12.03, height: 0.5, fontSize: 28,
      color: '666666', align: 'center',
    }),
    textBox(4, 'Generated date', `Generated on ${options.generatedOn}`, {
      x: 0.65, y: 4.5, width: 12.03, height: 0.5, fontSize: 16,
      color: '666666', align: 'center',
    }),
  ].join(''));
}

function isCorrectAnswer(correctAnswer: string | string[], optionId: string): boolean {
  return Array.isArray(correctAnswer)
    ? correctAnswer.includes(optionId)
    : correctAnswer === optionId;
}

function questionSlide(question: QuizQuestion, index: number, options: QuizPowerPointOptions): string {
  let shapeId = 2;
  const shapes = [
    textBox(shapeId++, `Question ${index + 1} heading`, `Question ${index + 1}`, {
      x: 0.5, y: 0.45, width: 12, height: 0.5, fontSize: 24,
      color: '2B579A', bold: true,
    }),
    textBox(shapeId++, `Question ${index + 1} text`, question.questionText, {
      x: 0.5, y: 1.15, width: 12, height: 1.05, fontSize: 20,
    }),
  ];

  question.options.forEach((option, optionIndex) => {
    const isCorrect = options.showAnswers && isCorrectAnswer(question.correctAnswer, option.id);
    shapes.push(textBox(shapeId++, `Option ${option.id}`, `${option.id.toUpperCase()}. ${option.text}${isCorrect ? ' ✓' : ''}`, {
      x: 1, y: 2.35 + optionIndex * 0.6, width: 11.35, height: 0.5, fontSize: 18,
      color: isCorrect ? '2E7D32' : '000000', bold: isCorrect,
    }));
  });

  if (options.showAnswers) {
    shapes.push(
      textBox(shapeId++, 'Explanation heading', options.explanationLabel, {
        x: 0.5, y: 5, width: 12, height: 0.4, fontSize: 18, bold: true,
      }),
      rectangle(shapeId++, 'Explanation accent', 0.2, 5.5, 0.1, 1.2, '4472C4'),
      textBox(shapeId++, 'Explanation', question.explanation, {
        x: 0.5, y: 5.45, width: 12, height: 1.25, fontSize: 16,
      }),
    );
  }

  return slideXml(shapes.join(''));
}

function contentTypesXml(slideCount: number): string {
  const slideOverrides = Array.from({ length: slideCount }, (_, index) =>
    `<Override PartName="/ppt/slides/slide${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`,
  ).join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
  <Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
  <Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
  ${slideOverrides}
</Types>`;
}

function presentationXml(slideCount: number): string {
  const slideIds = Array.from({ length: slideCount }, (_, index) =>
    `<p:sldId id="${256 + index}" r:id="rId${index + 2}"/>`,
  ).join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>
  <p:sldIdLst>${slideIds}</p:sldIdLst>
  <p:sldSz cx="${toEmu(SLIDE_WIDTH)}" cy="${toEmu(SLIDE_HEIGHT)}" type="screen16x9"/>
  <p:notesSz cx="6858000" cy="9144000"/>
  <p:defaultTextStyle/>
</p:presentation>`;
}

function presentationRelationshipsXml(slideCount: number): string {
  const slideRelationships = Array.from({ length: slideCount }, (_, index) =>
    `<Relationship Id="rId${index + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${index + 1}.xml"/>`,
  ).join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>
  ${slideRelationships}
</Relationships>`;
}

const ROOT_RELATIONSHIPS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;

const SLIDE_RELATIONSHIPS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>`;

const SLIDE_MASTER_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld>
  <p:clrMap accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" bg1="lt1" bg2="lt2" folHlink="folHlink" hlink="hlink" tx1="dk1" tx2="dk2"/>
  <p:sldLayoutIdLst><p:sldLayoutId id="1" r:id="rId1"/></p:sldLayoutIdLst>
  <p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles>
</p:sldMaster>`;

const SLIDE_MASTER_RELATIONSHIPS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>
</Relationships>`;

const SLIDE_LAYOUT_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1">
  <p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sldLayout>`;

const SLIDE_LAYOUT_RELATIONSHIPS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>`;

const THEME_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Mind AI Tutor">
  <a:themeElements>
    <a:clrScheme name="Mind AI Tutor">
      <a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1><a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>
      <a:dk2><a:srgbClr val="1F497D"/></a:dk2><a:lt2><a:srgbClr val="EEECE1"/></a:lt2>
      <a:accent1><a:srgbClr val="4472C4"/></a:accent1><a:accent2><a:srgbClr val="ED7D31"/></a:accent2><a:accent3><a:srgbClr val="A5A5A5"/></a:accent3>
      <a:accent4><a:srgbClr val="FFC000"/></a:accent4><a:accent5><a:srgbClr val="5B9BD5"/></a:accent5><a:accent6><a:srgbClr val="70AD47"/></a:accent6>
      <a:hlink><a:srgbClr val="0563C1"/></a:hlink><a:folHlink><a:srgbClr val="954F72"/></a:folHlink>
    </a:clrScheme>
    <a:fontScheme name="Mind AI Tutor"><a:majorFont><a:latin typeface="Calibri Light"/><a:ea typeface="Microsoft JhengHei"/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Calibri"/><a:ea typeface="Microsoft JhengHei"/><a:cs typeface=""/></a:minorFont></a:fontScheme>
    <a:fmtScheme name="Mind AI Tutor">
      <a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst>
      <a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst>
      <a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>
      <a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst>
    </a:fmtScheme>
  </a:themeElements>
</a:theme>`;

export async function createQuizPowerPoint(options: QuizPowerPointOptions): Promise<Blob> {
  const zip = new JSZip();
  const slides = [titleSlide(options), ...options.questions.map((question, index) => questionSlide(question, index, options))];
  const now = new Date().toISOString();

  zip.file('[Content_Types].xml', contentTypesXml(slides.length));
  zip.file('_rels/.rels', ROOT_RELATIONSHIPS_XML);
  zip.file('ppt/presentation.xml', presentationXml(slides.length));
  zip.file('ppt/_rels/presentation.xml.rels', presentationRelationshipsXml(slides.length));
  zip.file('ppt/slideMasters/slideMaster1.xml', SLIDE_MASTER_XML);
  zip.file('ppt/slideMasters/_rels/slideMaster1.xml.rels', SLIDE_MASTER_RELATIONSHIPS_XML);
  zip.file('ppt/slideLayouts/slideLayout1.xml', SLIDE_LAYOUT_XML);
  zip.file('ppt/slideLayouts/_rels/slideLayout1.xml.rels', SLIDE_LAYOUT_RELATIONSHIPS_XML);
  zip.file('ppt/theme/theme1.xml', THEME_XML);

  slides.forEach((slide, index) => {
    zip.file(`ppt/slides/slide${index + 1}.xml`, slide);
    zip.file(`ppt/slides/_rels/slide${index + 1}.xml.rels`, SLIDE_RELATIONSHIPS_XML);
  });

  zip.file('docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${escapeXml(options.title)}</dc:title><dc:creator>Mind AI Tutor</dc:creator><cp:lastModifiedBy>Mind AI Tutor</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>
</cp:coreProperties>`);
  zip.file('docProps/app.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Mind AI Tutor</Application><PresentationFormat>On-screen Show (16:9)</PresentationFormat><Slides>${slides.length}</Slides><Notes>0</Notes><HiddenSlides>0</HiddenSlides><MMClips>0</MMClips><ScaleCrop>false</ScaleCrop>
</Properties>`);

  return zip.generateAsync({
    type: 'blob',
    mimeType: PPTX_MIME_TYPE,
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
}

export async function downloadQuizPowerPoint(fileName: string, options: QuizPowerPointOptions): Promise<void> {
  const blob = await createQuizPowerPoint(options);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 100);
}
