import { useState, useEffect } from 'preact/hooks';

type ResolvedTheme = 'light' | 'dark';

// Class names that indicate dark mode (checked on <html> and <body>)
const DARK_CLASS_NAMES = [
  'dark',
  'theme-dark',
  'dark-mode',
  'dark-theme',
  // WordPress dark mode plugins
  'wp-dark-mode-active',
  'flavor-dark',
  'is-dark',
  // Other common patterns
  'night',
  'night-mode',
];

// Class names that indicate light mode
const LIGHT_CLASS_NAMES = [
  'light',
  'theme-light',
  'light-mode',
  'light-theme',
  'wp-dark-mode-disabled',
  'is-light',
];

// Data attributes commonly used for theme switching
const THEME_ATTRIBUTES = [
  'data-theme',
  'data-bs-theme',
  'data-mode',
  'data-color-mode',
  'data-color-scheme',
  'data-wp-dark-mode-active',
  'data-dark-mode',
];

// All attributes the MutationObserver should watch
const OBSERVED_ATTRIBUTES = ['class', 'style', 'color-scheme', ...THEME_ATTRIBUTES];

function parseCssColor(color: string): { r: number; g: number; b: number } | null {
  const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgbMatch) {
    return { r: Number(rgbMatch[1]), g: Number(rgbMatch[2]), b: Number(rgbMatch[3]) };
  }
  return null;
}

function getRelativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r / 255, g / 255, b / 255].map((c) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4),
  );
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Check for an explicit override via data-bugpin-theme on the widget script tag.
 * Site owners can set <script data-bugpin-theme="dark"> to force a theme.
 */
function detectFromExplicitOverride(): ResolvedTheme | null {
  const scriptTag = document.querySelector('script[data-api-key][data-bugpin-theme]');
  if (scriptTag) {
    const value = scriptTag.getAttribute('data-bugpin-theme')?.toLowerCase();
    if (value === 'dark') return 'dark';
    if (value === 'light') return 'light';
  }
  return null;
}

/**
 * Detect theme from DOM class names and data attributes on <html> and <body>.
 */
function detectFromDomSignals(): ResolvedTheme | null {
  const html = document.documentElement;
  const body = document.body;

  // Check class-based indicators on <html> and <body>
  for (const el of [html, body]) {
    if (!el) continue;
    for (const cls of DARK_CLASS_NAMES) {
      if (el.classList.contains(cls)) return 'dark';
    }
    for (const cls of LIGHT_CLASS_NAMES) {
      if (el.classList.contains(cls)) return 'light';
    }
  }

  // Check data attributes (exact match and contains-dark heuristic)
  for (const attr of THEME_ATTRIBUTES) {
    for (const el of [html, body]) {
      if (!el) continue;
      const value = el.getAttribute(attr)?.toLowerCase();
      if (!value) continue;
      if (value === 'dark' || value === 'true') return 'dark';
      if (value === 'light' || value === 'false') return 'light';
    }
  }

  // Check color-scheme HTML attribute (not computed style)
  for (const el of [html, body]) {
    if (!el) continue;
    const colorScheme = el.getAttribute('color-scheme')?.toLowerCase();
    if (colorScheme?.includes('dark')) return 'dark';
    if (colorScheme?.includes('light')) return 'light';
  }

  // Check color-scheme computed CSS property
  if (typeof getComputedStyle !== 'undefined') {
    const htmlStyle = getComputedStyle(html);
    const scheme = htmlStyle.colorScheme?.toLowerCase();
    if (scheme) {
      // Can be "dark", "light", "dark light", "light dark", "normal", etc.
      // If it explicitly starts with "dark", treat as dark
      if (scheme === 'dark' || scheme.startsWith('dark ')) return 'dark';
      if (scheme === 'light' || scheme.startsWith('light ')) return 'light';
    }
  }

  return null;
}

/**
 * Detect theme by analyzing the background color luminance of <body>.
 * Uses a wider threshold than strict to catch medium-toned backgrounds.
 */
function detectFromBackgroundColor(): ResolvedTheme | null {
  if (typeof getComputedStyle === 'undefined') return null;

  const body = document.body;
  if (!body) return null;

  const bgColor = getComputedStyle(body).backgroundColor;
  if (!bgColor || bgColor === 'rgba(0, 0, 0, 0)' || bgColor === 'transparent') return null;

  const parsed = parseCssColor(bgColor);
  if (!parsed) return null;

  const luminance = getRelativeLuminance(parsed.r, parsed.g, parsed.b);
  // Wider thresholds: < 0.4 is dark, > 0.6 is light
  // This catches medium grays that are clearly dark or light to a user
  if (luminance < 0.4) return 'dark';
  if (luminance > 0.6) return 'light';

  return null;
}

/**
 * Fallback: use the OS-level prefers-color-scheme media query.
 */
function detectFromMediaQuery(): ResolvedTheme {
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

/**
 * Detect the effective theme by checking multiple signals in priority order:
 * 1. Explicit override via data-bugpin-theme attribute on the script tag
 * 2. DOM signals (classes, data attributes, color-scheme)
 * 3. Background color luminance of <body>
 * 4. OS prefers-color-scheme media query (fallback)
 */
function detectEffectiveTheme(): ResolvedTheme {
  return (
    detectFromExplicitOverride() ??
    detectFromDomSignals() ??
    detectFromBackgroundColor() ??
    detectFromMediaQuery()
  );
}

/**
 * Hook that returns the resolved theme ('light' | 'dark') based on config.
 * When theme is 'auto', it detects the host page's theme using DOM signals,
 * background luminance, and OS preference — and reactively updates.
 */
export function useEffectiveTheme(theme: 'auto' | 'light' | 'dark'): ResolvedTheme {
  const [resolved, setResolved] = useState<ResolvedTheme>(() => {
    if (theme !== 'auto') return theme;
    return detectEffectiveTheme();
  });

  useEffect(() => {
    if (theme !== 'auto') {
      setResolved(theme);
      return;
    }

    const update = () => setResolved(detectEffectiveTheme());
    update();

    // Watch for class/attribute changes on <html> and <body>
    let observer: MutationObserver | null = null;
    if (typeof MutationObserver !== 'undefined') {
      observer = new MutationObserver(update);

      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: OBSERVED_ATTRIBUTES,
      });

      // Observe <body> if it exists, and watch for it to appear if it doesn't
      if (document.body) {
        observer.observe(document.body, {
          attributes: true,
          attributeFilter: OBSERVED_ATTRIBUTES,
        });
      } else {
        // Body doesn't exist yet — watch for it to be added, then observe it
        const bodyObserver = new MutationObserver(() => {
          if (document.body) {
            bodyObserver.disconnect();
            observer?.observe(document.body, {
              attributes: true,
              attributeFilter: OBSERVED_ATTRIBUTES,
            });
            update();
          }
        });
        bodyObserver.observe(document.documentElement, { childList: true });
      }
    }

    // Also listen for OS-level preference changes
    let mediaQuery: MediaQueryList | null = null;
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.addEventListener('change', update);
    }

    return () => {
      observer?.disconnect();
      mediaQuery?.removeEventListener('change', update);
    };
  }, [theme]);

  return resolved;
}
