'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { studentSubjectLabel, studentSubjectOptions } from '@/lib/student-subjects';

interface SubjectPickerProps {
  language: string;
  value: string[];
  onChange: (subjects: string[]) => void;
}

export function SubjectPicker({ language, value, onChange }: SubjectPickerProps) {
  const [customSubject, setCustomSubject] = useState('');
  const zh = language === 'zh-TW';
  const defaultValues = new Set<string>(studentSubjectOptions.map(subject => subject.value));
  const customSubjects = value.filter(subject => !defaultValues.has(subject));

  function toggleSubject(subject: string) {
    onChange(value.includes(subject)
      ? value.filter(item => item !== subject)
      : [...value, subject]);
  }

  function addCustomSubject() {
    const nextSubject = customSubject.trim();
    if (!nextSubject) return;
    const exists = value.some(subject => subject.localeCompare(nextSubject, undefined, { sensitivity: 'accent' }) === 0);
    if (!exists) onChange([...value, nextSubject]);
    setCustomSubject('');
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {studentSubjectOptions.map(subject => {
          const selected = value.includes(subject.value);
          return (
            <Button
              key={subject.value}
              type="button"
              variant={selected ? 'default' : 'outline'}
              className="h-auto min-h-10 justify-start whitespace-normal text-left"
              aria-pressed={selected}
              onClick={() => toggleSubject(subject.value)}
            >
              {studentSubjectLabel(subject.value, language)}
            </Button>
          );
        })}
      </div>

      {customSubjects.length > 0 && (
        <div className="flex flex-wrap gap-2" aria-label={zh ? '自訂科目' : 'Custom subjects'}>
          {customSubjects.map(subject => (
            <Button
              key={subject}
              type="button"
              variant="secondary"
              size="sm"
              className="gap-1.5"
              onClick={() => toggleSubject(subject)}
              aria-label={zh ? `移除自訂科目 ${subject}` : `Remove custom subject ${subject}`}
            >
              {subject}<X className="h-3.5 w-3.5" />
            </Button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={customSubject}
          onChange={event => setCustomSubject(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter') {
              event.preventDefault();
              addCustomSubject();
            }
          }}
          maxLength={50}
          placeholder={zh ? '輸入其他科目，例如：機器人學' : 'Add another subject, e.g. Robotics'}
          aria-label={zh ? '自訂科目名稱' : 'Custom subject name'}
        />
        <Button type="button" variant="outline" onClick={addCustomSubject} disabled={!customSubject.trim()}>
          <Plus className="mr-2 h-4 w-4" />{zh ? '新增科目' : 'Add subject'}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {zh ? '常用科目會依介面語言顯示；自訂科目會保留你輸入的名稱。' : 'Standard subjects follow the interface language; custom names stay as entered.'}
      </p>
    </div>
  );
}
