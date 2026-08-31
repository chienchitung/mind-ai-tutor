'use client';

import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useLanguage } from '@/app/contexts/LanguageContext';

export function DeleteConfirmation({ name, busy, onCancel, onConfirm, description }: {
  name: string | null;
  description?: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { language } = useLanguage();
  return (
    <AlertDialog open={name !== null} onOpenChange={(open) => { if (!open && !busy) onCancel(); }}>
      <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg" onEscapeKeyDown={(event) => { if (busy) event.preventDefault(); }}>
        <AlertDialogHeader>
          <AlertDialogTitle>{language === 'zh-TW' ? '確認刪除' : 'Confirm deletion'}</AlertDialogTitle>
          <AlertDialogDescription>
            {language === 'zh-TW' ? `確定要刪除「${name}」嗎？此操作無法復原。` : `Delete “${name}”? This action cannot be undone.`}
            {description && <span className="mt-3 block">{description}</span>}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{language === 'zh-TW' ? '取消' : 'Cancel'}</AlertDialogCancel>
          <Button type="button" variant="destructive" onClick={onConfirm} disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {language === 'zh-TW' ? (busy ? '刪除中…' : '刪除') : (busy ? 'Deleting…' : 'Delete')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
