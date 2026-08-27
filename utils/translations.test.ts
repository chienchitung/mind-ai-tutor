import { describe, expect, it } from 'vitest';
import { translations } from './translations';

describe('translations', () => {
  const languages = Object.keys(translations) as Array<keyof typeof translations>;

  it('defines at least English and Traditional Chinese', () => {
    expect(languages).toContain('en');
    expect(languages).toContain('zh-TW');
  });

  it('has the exact same set of keys across every language', () => {
    const [firstLanguage, ...restLanguages] = languages;
    const referenceKeys = Object.keys(translations[firstLanguage]).sort();

    for (const language of restLanguages) {
      const keys = Object.keys(translations[language]).sort();
      const missing = referenceKeys.filter(key => !keys.includes(key));
      const extra = keys.filter(key => !referenceKeys.includes(key));

      expect(
        missing,
        `"${language}" is missing keys present in "${firstLanguage}": ${missing.join(', ')}`
      ).toEqual([]);
      expect(
        extra,
        `"${language}" has keys not present in "${firstLanguage}": ${extra.join(', ')}`
      ).toEqual([]);
    }
  });

  it('has no empty translation strings', () => {
    for (const language of languages) {
      for (const [key, value] of Object.entries(translations[language])) {
        expect(typeof value === 'string' ? value.trim().length > 0 : true, `${language}.${key} is empty`).toBe(true);
      }
    }
  });
});
