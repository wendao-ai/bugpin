import type { LocaleCode, LocalizedString } from '@shared/types';

export function resolveLauncherText(
  project: LocalizedString | null | undefined,
  global: LocalizedString | null,
  active: LocaleCode,
  builtinForActive: string | null
): string | null {
  if (project === null) return null;
  if (project) {
    const projectActive = project[active];
    if (projectActive) return projectActive;
    if (project.en) return project.en;
  }
  if (global) {
    const globalActive = global[active];
    if (globalActive) return globalActive;
    if (global.en) return global.en;
  }
  return builtinForActive;
}
