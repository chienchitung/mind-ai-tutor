export const studentSubjectOptions = [
  { value: 'Mathematics', zh: '數學', en: 'Mathematics' },
  { value: 'English', zh: '英文', en: 'English' },
  { value: 'Science', zh: '自然科學', en: 'Science' },
  { value: 'History', zh: '歷史', en: 'History' },
  { value: 'Geography', zh: '地理', en: 'Geography' },
  { value: 'Physics', zh: '物理', en: 'Physics' },
  { value: 'Chemistry', zh: '化學', en: 'Chemistry' },
  { value: 'Biology', zh: '生物', en: 'Biology' },
  { value: 'Computer Science', zh: '資訊科技', en: 'Computer Science' },
  { value: 'Art', zh: '藝術', en: 'Art' },
  { value: 'Music', zh: '音樂', en: 'Music' },
] as const;

const subjectByValue = new Map(studentSubjectOptions.map(subject => [subject.value, subject]));

export function studentSubjectLabel(subject: string, language: string) {
  const option = subjectByValue.get(subject as (typeof studentSubjectOptions)[number]['value']);
  if (!option) return subject;
  return language === 'zh-TW' ? option.zh : option.en;
}

