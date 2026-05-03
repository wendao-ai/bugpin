import type { LocaleCode } from '@shared/types';
import { normalizeLocale } from './normalize.js';

export interface DetectLocaleOptions {
  initLanguage?: string;
  scriptLanguage?: string | null;
  projectDefault: LocaleCode;
  mode: 'auto' | 'manual';
  documentLang?: string | null;
  navigatorLanguages?: readonly string[];
}

function readDocumentLang(): string | null {
  if (typeof document === 'undefined') return null;
  const root = document.documentElement;
  if (!root) return null;
  const lang = root.getAttribute('lang');
  return lang && lang.length > 0 ? lang : null;
}

function readNavigatorLanguages(): readonly string[] {
  if (typeof navigator === 'undefined') return [];
  const list = navigator.languages;
  if (Array.isArray(list) && list.length > 0) return list;
  if (typeof navigator.language === 'string' && navigator.language.length > 0) {
    return [navigator.language];
  }
  return [];
}

export function detectLocale(opts: DetectLocaleOptions): LocaleCode {
  if (opts.mode === 'manual') {
    return opts.projectDefault;
  }

  const initMatch = normalizeLocale(opts.initLanguage);
  if (initMatch) return initMatch;

  const scriptMatch = normalizeLocale(opts.scriptLanguage ?? null);
  if (scriptMatch) return scriptMatch;

  const documentLang = opts.documentLang !== undefined ? opts.documentLang : readDocumentLang();
  const documentMatch = normalizeLocale(documentLang);
  if (documentMatch) return documentMatch;

  const navigatorLanguages =
    opts.navigatorLanguages !== undefined ? opts.navigatorLanguages : readNavigatorLanguages();
  for (const candidate of navigatorLanguages) {
    const match = normalizeLocale(candidate);
    if (match) return match;
  }

  const projectMatch = normalizeLocale(opts.projectDefault);
  if (projectMatch) return projectMatch;

  return 'en';
}

export function resolveLiveSwitch(
  source: string | null,
  scriptLanguage: string | null,
  projectDefault: LocaleCode
): LocaleCode | null {
  const sourceMatch = normalizeLocale(source);
  if (sourceMatch) return sourceMatch;

  const scriptMatch = normalizeLocale(scriptLanguage);
  if (scriptMatch) return scriptMatch;

  const projectMatch = normalizeLocale(projectDefault);
  if (projectMatch) return projectMatch;

  return null;
}
