import { describe, it, expect } from 'bun:test';
import {
  getStatusLabel,
  getPriorityLabel,
  statusLabels,
  priorityLabels,
  formatReportDate,
} from '../../../src/server/i18n/labels';
import { SUPPORTED_LOCALES } from '../../../src/shared/types';
import type { LocaleCode, ReportStatus, ReportPriority } from '../../../src/shared/types';

const STATUSES: ReportStatus[] = ['open', 'in_progress', 'resolved', 'closed'];
const PRIORITIES: ReportPriority[] = ['lowest', 'low', 'medium', 'high', 'highest'];

describe('getStatusLabel', () => {
  it('returns a non-empty string for every locale and status', () => {
    for (const locale of SUPPORTED_LOCALES) {
      for (const status of STATUSES) {
        const label = getStatusLabel(status, locale);
        expect(label).toBeTypeOf('string');
        expect(label.length).toBeGreaterThan(0);
      }
    }
  });

  it('falls back to English for unsupported locales', () => {
    const fakeLocale = 'xx' as LocaleCode;
    expect(getStatusLabel('open', fakeLocale)).toBe('Open');
    expect(getStatusLabel('in_progress', fakeLocale)).toBe('In Progress');
    expect(getStatusLabel('resolved', fakeLocale)).toBe('Resolved');
    expect(getStatusLabel('closed', fakeLocale)).toBe('Closed');
  });

  it('returns localized strings for known locales', () => {
    expect(getStatusLabel('in_progress', 'de')).toBe('In Bearbeitung');
    expect(getStatusLabel('resolved', 'fr')).toBe('Résolu');
    expect(getStatusLabel('open', 'ja')).toBe('オープン');
    expect(getStatusLabel('closed', 'zh')).toBe('已关闭');
  });
});

describe('getPriorityLabel', () => {
  it('returns a non-empty string for every locale and priority', () => {
    for (const locale of SUPPORTED_LOCALES) {
      for (const priority of PRIORITIES) {
        const label = getPriorityLabel(priority, locale);
        expect(label).toBeTypeOf('string');
        expect(label.length).toBeGreaterThan(0);
      }
    }
  });

  it('falls back to English for unsupported locales', () => {
    const fakeLocale = 'xx' as LocaleCode;
    expect(getPriorityLabel('high', fakeLocale)).toBe('High');
    expect(getPriorityLabel('lowest', fakeLocale)).toBe('Lowest');
  });

  it('returns localized strings for known locales', () => {
    expect(getPriorityLabel('high', 'de')).toBe('Hoch');
    expect(getPriorityLabel('low', 'fr')).toBe('Basse');
    expect(getPriorityLabel('medium', 'es')).toBe('Media');
    expect(getPriorityLabel('highest', 'it')).toBe('Massima');
  });
});

describe('statusLabels / priorityLabels dictionaries', () => {
  it('cover every supported locale', () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(statusLabels[locale]).toBeDefined();
      expect(priorityLabels[locale]).toBeDefined();
    }
  });
});

describe('formatReportDate', () => {
  it('produces a non-empty string for each supported locale', () => {
    const iso = '2026-05-03T12:34:00.000Z';
    for (const locale of SUPPORTED_LOCALES) {
      const out = formatReportDate(iso, locale);
      expect(out).toBeTypeOf('string');
      expect(out.length).toBeGreaterThan(0);
    }
  });

  it('falls back to the raw value for unparseable dates', () => {
    expect(formatReportDate('not a date', 'en')).toBe('not a date');
  });
});
