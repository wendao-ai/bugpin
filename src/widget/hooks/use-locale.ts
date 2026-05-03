import { useEffect, useState } from 'preact/hooks';
import type { LocaleCode } from '@shared/types';
import { getLocale, subscribe } from '../i18n/index.js';

export function useLocale(): LocaleCode {
  const [locale, setLocale] = useState<LocaleCode>(getLocale());
  useEffect(() => subscribe(setLocale), []);
  return locale;
}
