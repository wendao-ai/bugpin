import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { shouldSkipFontEmbedding } from '../../capture/screenshot';

const originalDocument = globalThis.document;
const originalCSSRule = (globalThis as { CSSRule?: unknown }).CSSRule;

const FONT_FACE_RULE = 5;
const STYLE_RULE = 1;

interface MockRule {
  type: number;
  cssText: string;
  style?: { fontFamily?: string | null } | null;
}

interface MockSheetSpec {
  href?: string | null;
  rules?: MockRule[];
  throwOnRules?: 'access' | 'iterate' | 'rule-access';
  onAccess?: () => void;
}

function makeSheet(spec: MockSheetSpec): CSSStyleSheet {
  const ruleArray = spec.rules ?? [];
  const sheet = {
    href: spec.href ?? null,
    get cssRules(): CSSRuleList {
      spec.onAccess?.();
      if (spec.throwOnRules === 'access') {
        throw new DOMException('Cross-origin', 'SecurityError');
      }
      if (spec.throwOnRules === 'iterate') {
        return new Proxy({} as CSSRuleList, {
          get(_target, prop) {
            if (prop === 'length') {
              throw new Error('forced iteration error');
            }
            return undefined;
          },
        });
      }
      if (spec.throwOnRules === 'rule-access') {
        return new Proxy(ruleArray as unknown as CSSRuleList, {
          get(_target, prop) {
            if (prop === 'length') return 1;
            throw new Error('forced rule access error');
          },
        });
      }
      return ruleArray as unknown as CSSRuleList;
    },
  } as unknown as CSSStyleSheet;
  return sheet;
}

function setStyleSheets(sheets: CSSStyleSheet[]) {
  globalThis.document = {
    styleSheets: sheets as unknown as StyleSheetList,
  } as unknown as Document;
}

beforeEach(() => {
  (globalThis as { CSSRule?: unknown }).CSSRule = { FONT_FACE_RULE, STYLE_RULE };
});

afterEach(() => {
  globalThis.document = originalDocument;
  (globalThis as { CSSRule?: unknown }).CSSRule = originalCSSRule;
});

describe('shouldSkipFontEmbedding', () => {
  it('returns skip=false for a same-origin sheet with normal style rules only', () => {
    setStyleSheets([
      makeSheet({
        href: null,
        rules: [{ type: STYLE_RULE, cssText: '.foo { color: red; }' }],
      }),
    ]);

    expect(shouldSkipFontEmbedding()).toEqual({ skip: false });
  });

  it('returns cross-origin reason when an href-bearing sheet throws on cssRules', () => {
    setStyleSheets([
      makeSheet({ href: 'https://cdn.example.com/styles.css', throwOnRules: 'access' }),
    ]);

    expect(shouldSkipFontEmbedding()).toEqual({
      skip: true,
      reason: 'cross-origin stylesheet',
    });
  });

  it('returns empty-fontFamily reason for a Firefox-style @font-face rule', () => {
    setStyleSheets([
      makeSheet({
        href: null,
        rules: [
          {
            type: FONT_FACE_RULE,
            cssText: '@font-face { font-family: "Poppins"; src: url(/poppins.woff2); }',
            style: { fontFamily: '' },
          },
        ],
      }),
    ]);

    expect(shouldSkipFontEmbedding()).toEqual({
      skip: true,
      reason: 'browser exposes empty fontFamily on @font-face rule',
    });
  });

  it('returns skip=false when a @font-face rule has populated fontFamily (Chromium-style)', () => {
    setStyleSheets([
      makeSheet({
        href: null,
        rules: [
          {
            type: FONT_FACE_RULE,
            cssText: '@font-face { font-family: "Poppins"; src: url(/poppins.woff2); }',
            style: { fontFamily: '"Poppins"' },
          },
        ],
      }),
    ]);

    expect(shouldSkipFontEmbedding()).toEqual({ skip: false });
  });

  it('returns skip=false when @font-face rule has empty fontFamily but no font-family in cssText', () => {
    // Conjunction matters: if cssText doesn't declare font-family, this rule
    // would be dropped by the browser and the upstream filter — over-skipping
    // here would penalise pages that aren't actually broken.
    setStyleSheets([
      makeSheet({
        href: null,
        rules: [
          {
            type: FONT_FACE_RULE,
            cssText: '@font-face { src: url(/missing.woff2); }',
            style: { fontFamily: '' },
          },
        ],
      }),
    ]);

    expect(shouldSkipFontEmbedding()).toEqual({ skip: false });
  });

  it('returns skip=false for sheets that contain only style rules', () => {
    setStyleSheets([
      makeSheet({
        href: null,
        rules: [
          { type: STYLE_RULE, cssText: '.a { color: blue; }' },
          { type: STYLE_RULE, cssText: '.b { color: green; }' },
        ],
      }),
    ]);

    expect(shouldSkipFontEmbedding()).toEqual({ skip: false });
  });

  it('returns unreadable-stylesheet reason when in-rule iteration throws', () => {
    setStyleSheets([makeSheet({ href: null, throwOnRules: 'iterate' })]);

    expect(shouldSkipFontEmbedding()).toEqual({
      skip: true,
      reason: 'unreadable stylesheet',
    });
  });

  it('returns unreadable-stylesheet reason when reading an individual rule throws', () => {
    setStyleSheets([
      makeSheet({
        href: null,
        rules: [{ type: FONT_FACE_RULE, cssText: '@font-face { font-family: x; }' }],
        throwOnRules: 'rule-access',
      }),
    ]);

    expect(shouldSkipFontEmbedding()).toEqual({
      skip: true,
      reason: 'unreadable stylesheet',
    });
  });

  it('short-circuits on first match and does not iterate later sheets', () => {
    let secondSheetAccessed = false;
    setStyleSheets([
      makeSheet({ href: 'https://cdn.example.com/a.css', throwOnRules: 'access' }),
      makeSheet({
        href: null,
        rules: [{ type: STYLE_RULE, cssText: '.x { color: red; }' }],
        onAccess: () => {
          secondSheetAccessed = true;
        },
      }),
    ]);

    expect(shouldSkipFontEmbedding()).toEqual({
      skip: true,
      reason: 'cross-origin stylesheet',
    });
    expect(secondSheetAccessed).toBe(false);
  });

  it('detects Trigger 2 on inline <style>-injected sheet (href === null)', () => {
    setStyleSheets([
      makeSheet({
        href: null,
        rules: [
          {
            type: FONT_FACE_RULE,
            cssText: '@font-face { font-family: "Work Sans"; src: url(/ws.woff2); }',
            style: { fontFamily: '' },
          },
        ],
      }),
    ]);

    expect(shouldSkipFontEmbedding()).toEqual({
      skip: true,
      reason: 'browser exposes empty fontFamily on @font-face rule',
    });
  });

  it('does not throw when document.styleSheets itself raises (outer catch)', () => {
    globalThis.document = {
      get styleSheets(): StyleSheetList {
        throw new Error('forced top-level error');
      },
    } as unknown as Document;

    expect(shouldSkipFontEmbedding()).toEqual({
      skip: true,
      reason: 'unreadable stylesheet',
    });
  });

  it('treats a null rule.style defensively as falsy fontFamily', () => {
    // Some legacy environments expose rule.style as null even though the spec
    // says it should be a CSSStyleDeclaration. Optional chaining covers this.
    setStyleSheets([
      makeSheet({
        href: null,
        rules: [
          {
            type: FONT_FACE_RULE,
            cssText: '@font-face { font-family: "Inter"; src: url(/i.woff2); }',
            style: null,
          },
        ],
      }),
    ]);

    expect(shouldSkipFontEmbedding()).toEqual({
      skip: true,
      reason: 'browser exposes empty fontFamily on @font-face rule',
    });
  });
});
