import en from './locales/en.js';

export type WidgetCatalogKey = keyof typeof en;
export type WidgetCatalog = Record<WidgetCatalogKey, string>;

export const TOOLTIP_LAUNCHER_KEY: WidgetCatalogKey = 'tooltip.launcher';
