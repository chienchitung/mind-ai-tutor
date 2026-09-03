'use client';

import dynamic from 'next/dynamic';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useTranslation } from '@/utils/translations';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

// 編輯器載入中的顯示元件（獨立元件，以便可以使用 hooks 取得翻譯）
function EditorLoading() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  return (
    <div className="h-[300px] border rounded-md flex items-center justify-center">{t('loading_editor')}</div>
  );
}

// Tiptap pulls in ProseMirror's editor/table/markdown machinery, which is
// only needed once a teacher actually opens the lesson-content editor -
// keep it out of the /lessons route's initial bundle until then.
const MarkdownEditorInner = dynamic(() => import('./MarkdownEditorInner'), {
  ssr: false,
  loading: () => <EditorLoading />,
});

export default function MarkdownEditor(props: MarkdownEditorProps) {
  return <MarkdownEditorInner {...props} />;
}
