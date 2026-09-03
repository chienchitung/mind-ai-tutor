import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { Markdown } from 'tiptap-markdown';
import type { AnyExtension } from '@tiptap/core';

// Shared between MarkdownEditor.tsx and its round-trip test, so the test
// exercises the exact extension config production uses rather than a copy
// that can silently drift.
export function markdownEditorExtensions(placeholder?: string): AnyExtension[] {
  return [
    StarterKit.configure({ link: false }),
    Link.configure({ openOnClick: false, autolink: false }),
    Table.configure({ resizable: false }),
    TableRow,
    TableHeader,
    TableCell,
    // Images default to a block-level node in @tiptap/extension-image v3;
    // markdown serialization needs them inline so a standalone image
    // followed by another block (e.g. a link paragraph) doesn't collapse
    // onto the same line on round trip.
    Image.configure({ inline: true }),
    ...(placeholder ? [Placeholder.configure({ placeholder })] : []),
    Markdown.configure({ html: false, tightLists: true, linkify: false }),
  ];
}
