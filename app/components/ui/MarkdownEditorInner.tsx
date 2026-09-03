'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import type { MarkdownStorage } from 'tiptap-markdown';
import { markdownEditorExtensions } from './markdown-editor-extensions';
import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  LinkIcon,
  Unlink,
  Table as TableIcon,
  Image as ImageIcon,
  Undo2,
  Redo2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { v4 as uuidv4 } from 'uuid';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useTranslation } from '@/utils/translations';
import './markdown-editor.css';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

function ToolbarButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant={active ? 'secondary' : 'ghost'}
          size="icon"
          className="h-8 w-8"
          disabled={disabled}
          aria-label={label}
          aria-pressed={active}
          onMouseDown={(e) => e.preventDefault()}
          onClick={onClick}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function LinkButton({ editor, label }: { editor: any; label: string }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const active = editor.isActive('link');

  return (
    <Popover
      open={open}
      onOpenChange={(next: boolean) => {
        setOpen(next);
        if (next) setUrl(editor.getAttributes('link').href || '');
      }}
    >
      <PopoverTrigger asChild>
        <span>
          <ToolbarButton label={label} active={active} onClick={() => setOpen(true)}>
            <LinkIcon className="h-4 w-4" />
          </ToolbarButton>
        </span>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="start">
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (url.trim()) {
              editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run();
            }
            setOpen(false);
          }}
        >
          <Input
            autoFocus
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
          />
          <Button type="submit" size="sm">OK</Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}

const MarkdownEditorInner: React.FC<MarkdownEditorProps> = ({
  value,
  onChange,
  placeholder,
}) => {
  const { toast } = useToast();
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const resolvedPlaceholder = placeholder ?? t('markdown_placeholder');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Tracks the markdown string we last pushed out via onChange, so the
  // sync effect below can tell "the form gave us a different lesson's
  // content" (needs setContent) apart from "our own edit echoed back
  // through the parent" (would otherwise reset the cursor mid-keystroke).
  const lastEmittedRef = useRef(value);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: markdownEditorExtensions(resolvedPlaceholder),
    content: value,
    editorProps: {
      attributes: {
        class: 'markdown-editor-surface focus:outline-none',
      },
    },
    onUpdate: ({ editor: e }) => {
      const markdownStorage = (e.storage as unknown as { markdown: MarkdownStorage }).markdown;
      const markdown = markdownStorage.getMarkdown();
      lastEmittedRef.current = markdown;
      onChange(markdown);
    },
  });

  // Re-sync when the form hands us a different lesson's content (e.g.
  // switching which lesson is being edited, or a reset after save) -
  // but skip it when `value` is just our own last edit echoing back
  // through react-hook-form, which would otherwise fight the cursor.
  useEffect(() => {
    if (!editor) return;
    if (value !== lastEmittedRef.current) {
      editor.commands.setContent(value, { emitUpdate: false });
      lastEmittedRef.current = value;
    }
  }, [value, editor]);

  const handleImageButtonClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleImageUpload = useCallback(async (file: File) => {
    if (!file || !editor) return;
    try {
      setIsUploading(true);
      toast({ title: t('uploading_image'), description: t('please_wait') });

      const { supabase } = await import('@/lib/supabase');
      const supabaseClient = supabase();

      if (!file.type.includes('image/')) {
        toast({
          title: t('upload_failed'),
          description: t('please_select_valid_image'),
          variant: 'destructive',
        });
        return;
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${uuidv4()}.${fileExt}`;
      const filePath = `lesson-images/${fileName}`;

      const { error } = await supabaseClient.storage
        .from('course-content')
        .upload(filePath, file, { cacheControl: '3600', upsert: false });

      if (error) throw error;

      const { data: { publicUrl } } = supabaseClient.storage
        .from('course-content')
        .getPublicUrl(filePath);

      editor.chain().focus().setImage({ src: publicUrl, alt: file.name }).run();

      toast({
        title: t('image_upload_success'),
        description: t('image_inserted_success'),
      });
    } catch (error: any) {
      toast({
        title: t('image_upload_failed'),
        description: error.message || t('editor_try_again_later'),
        variant: 'destructive',
      });
      console.error('圖片上傳錯誤:', error);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [editor, toast, t]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) handleImageUpload(e.target.files[0]);
  }, [handleImageUpload]);

  if (!editor) {
    return <div className="h-[300px] border rounded-md flex items-center justify-center">{t('loading_editor')}</div>;
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="markdown-editor w-full rounded-md border">
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          accept="image/*"
          onChange={handleFileSelect}
          disabled={isUploading}
        />
        {isUploading && (
          <div className="fixed top-0 left-0 right-0 z-50 bg-green-500 text-white text-center py-1 text-sm">
            {t('uploading_image')}...
          </div>
        )}
        <div className="flex flex-wrap items-center gap-0.5 border-b bg-muted/30 p-1.5">
          <ToolbarButton label={t('editor_bold')} active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
            <Bold className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton label={t('editor_italic')} active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
            <Italic className="h-4 w-4" />
          </ToolbarButton>
          <span className="mx-1 h-5 w-px bg-border" />
          <ToolbarButton label={t('editor_heading_1')} active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
            <Heading1 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton label={t('editor_heading_2')} active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
            <Heading2 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton label={t('editor_heading_3')} active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
            <Heading3 className="h-4 w-4" />
          </ToolbarButton>
          <span className="mx-1 h-5 w-px bg-border" />
          <ToolbarButton label={t('editor_bullet_list')} active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
            <List className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton label={t('editor_ordered_list')} active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
            <ListOrdered className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton label={t('editor_blockquote')} active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
            <Quote className="h-4 w-4" />
          </ToolbarButton>
          <span className="mx-1 h-5 w-px bg-border" />
          <LinkButton editor={editor} label={t('editor_link')} />
          {editor.isActive('link') && (
            <ToolbarButton label={t('editor_unlink')} onClick={() => editor.chain().focus().unsetLink().run()}>
              <Unlink className="h-4 w-4" />
            </ToolbarButton>
          )}
          <ToolbarButton label={t('insert_image')} disabled={isUploading} onClick={handleImageButtonClick}>
            <ImageIcon className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            label={t('editor_table')}
            onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
          >
            <TableIcon className="h-4 w-4" />
          </ToolbarButton>
          <span className="mx-1 h-5 w-px bg-border" />
          <ToolbarButton label={t('editor_undo')} disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>
            <Undo2 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton label={t('editor_redo')} disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>
            <Redo2 className="h-4 w-4" />
          </ToolbarButton>
        </div>
        <EditorContent editor={editor} className="min-h-[300px] max-h-[500px] overflow-y-auto px-4 py-3" />
      </div>
    </TooltipProvider>
  );
};

export default MarkdownEditorInner;
