import { describe, it, expect } from 'bun:test';
import {
  wrapLegacyLocalizedString,
  wrapLegacyTooltipText,
} from '../../../src/server/utils/wrap-legacy-localized-string';

describe('wrapLegacyLocalizedString', () => {
  it('returns undefined for undefined input', () => {
    expect(wrapLegacyLocalizedString(undefined)).toBeUndefined();
  });

  it('preserves null', () => {
    expect(wrapLegacyLocalizedString(null)).toBeNull();
  });

  it('wraps a plain string into { en }', () => {
    expect(wrapLegacyLocalizedString('Custom')).toEqual({ en: 'Custom' });
  });

  it('passes through valid LocalizedString objects', () => {
    expect(wrapLegacyLocalizedString({ en: 'EN', de: 'DE' })).toEqual({ en: 'EN', de: 'DE' });
  });

  it('returns undefined for malformed objects without en', () => {
    expect(wrapLegacyLocalizedString({ de: 'DE' })).toBeUndefined();
  });
});

describe('wrapLegacyTooltipText', () => {
  it('replaces historical default with null at the global layer', () => {
    expect(wrapLegacyTooltipText('Found a bug?', true)).toBeNull();
  });

  it('keeps operator-customized strings wrapped at the global layer', () => {
    expect(wrapLegacyTooltipText('Custom tooltip!', true)).toEqual({ en: 'Custom tooltip!' });
  });

  it('does not apply heuristic at the project layer', () => {
    expect(wrapLegacyTooltipText('Found a bug?', false)).toEqual({ en: 'Found a bug?' });
  });

  it('preserves null', () => {
    expect(wrapLegacyTooltipText(null, true)).toBeNull();
  });
});
