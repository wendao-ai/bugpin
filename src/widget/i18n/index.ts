/**
 * Lightweight i18n for BugPin Widget (Preact).
 * No external dependencies — reads language from:
 *   1. localStorage key "bugpin-lang"
 *   2. navigator.language
 *   3. fallback "en"
 */

import en from './locales/en.json';
import zhCN from './locales/zh-cn.json';

type TranslationValue = string | { [key: string]: TranslationValue };

const locales: Record<string, TranslationValue> = {
  en: en as TranslationValue,
  'zh-cn': zhCN as TranslationValue,
};

const STORAGE_KEY = 'bugpin-lang';

function detectLanguage(): string {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && locales[stored]) return stored;

  const navLang = navigator.language.toLowerCase();
  if (locales[navLang]) return navLang;
  if (navLang.startsWith('zh')) return 'zh-cn';

  return 'en';
}

let currentLang = detectLanguage();

export function setLanguage(lang: string): void {
  if (locales[lang]) {
    currentLang = lang;
    localStorage.setItem(STORAGE_KEY, lang);
  }
}

export function getLanguage(): string {
  return currentLang;
}

function getNestedValue(obj: TranslationValue, path: string): string {
  const keys = path.split('.');
  let current: TranslationValue = obj;
  for (const key of keys) {
    if (typeof current === 'string') return path;
    current = (current as { [key: string]: TranslationValue })[key];
    if (current === undefined) return path;
  }
  return typeof current === 'string' ? current : path;
}

export function t(key: string): string {
  const translations = locales[currentLang] || locales['en'];
  const value = getNestedValue(translations, key);
  if (value === key && currentLang !== 'en') {
    return getNestedValue(locales['en'], key);
  }
  return value;
}
