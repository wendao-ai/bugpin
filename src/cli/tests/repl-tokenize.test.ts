import { describe, expect, test } from 'bun:test';

// repl.ts 中 tokenize 是模块内私有函数；这里复制实现，与 repl.ts 保持一致
// 若 repl.ts 改动，请同步更新此处
function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let buf = '';
  let inQuote: '"' | "'" | null = null;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i] ?? '';
    if (inQuote) {
      if (ch === inQuote) inQuote = null;
      else buf += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inQuote = ch;
      continue;
    }
    if (ch === ' ' || ch === '\t') {
      if (buf) {
        tokens.push(buf);
        buf = '';
      }
      continue;
    }
    buf += ch;
  }
  if (buf) tokens.push(buf);
  return tokens;
}

describe('tokenize', () => {
  test('basic split by space', () => {
    expect(tokenize('reports list --limit 10')).toEqual([
      'reports',
      'list',
      '--limit',
      '10',
    ]);
  });

  test('respects double quotes', () => {
    expect(tokenize('reports create --title "登录页 500 错误"')).toEqual([
      'reports',
      'create',
      '--title',
      '登录页 500 错误',
    ]);
  });

  test('respects single quotes', () => {
    expect(tokenize("branding set-widget-colors --colors '{\"primary\":\"#FF0000\"}'")).toEqual([
      'branding',
      'set-widget-colors',
      '--colors',
      '{"primary":"#FF0000"}',
    ]);
  });

  test('handles consecutive spaces', () => {
    expect(tokenize('a    b')).toEqual(['a', 'b']);
  });

  test('handles empty string', () => {
    expect(tokenize('')).toEqual([]);
  });

  test('handles tabs', () => {
    expect(tokenize('a\tb')).toEqual(['a', 'b']);
  });
});
