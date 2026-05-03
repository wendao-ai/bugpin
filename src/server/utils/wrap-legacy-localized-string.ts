import type { LocalizedString } from '@shared/types';

const HISTORICAL_TOOLTIP_DEFAULT = 'Found a bug?';

function isLocalizedStringObject(value: unknown): value is LocalizedString {
  if (typeof value !== 'object' || value === null) return false;
  const en = (value as Record<string, unknown>).en;
  return typeof en === 'string';
}

export function wrapLegacyLocalizedString(value: unknown): LocalizedString | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === 'string') {
    return { en: value };
  }
  if (isLocalizedStringObject(value)) {
    return value;
  }
  return undefined;
}

export function wrapLegacyTooltipText(
  value: unknown,
  isGlobal: boolean
): LocalizedString | null | undefined {
  if (typeof value === 'string' && isGlobal && value === HISTORICAL_TOOLTIP_DEFAULT) {
    return null;
  }
  return wrapLegacyLocalizedString(value);
}
