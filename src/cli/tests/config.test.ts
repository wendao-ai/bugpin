import { describe, expect, test, beforeAll, afterAll } from 'bun:test';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// 通过 BUGPIN_CONFIG_PATH 绝对路径覆盖，避免污染真实 HOME
let tmpDir: string;
let tmpPath: string;
let originalConfigPath: string | undefined;

beforeAll(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'bugpin-cli-test-'));
  tmpPath = join(tmpDir, 'config.json');
  originalConfigPath = process.env.BUGPIN_CONFIG_PATH;
  process.env.BUGPIN_CONFIG_PATH = tmpPath;
});

afterAll(() => {
  if (originalConfigPath === undefined) {
    delete process.env.BUGPIN_CONFIG_PATH;
  } else {
    process.env.BUGPIN_CONFIG_PATH = originalConfigPath;
  }
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('config persistence', () => {
  test('saveConfig writes to BUGPIN_CONFIG_PATH with 0600', async () => {
    const { saveConfig, getConfigPath, loadConfig } = await import('../src/config.ts');

    saveConfig({ baseURL: 'https://example.com', sessionCookie: 'tok_a', email: 'a@b.com' });

    const path = getConfigPath();
    expect(path).toBe(tmpPath);
    expect(existsSync(path)).toBe(true);

    const raw = JSON.parse(readFileSync(path, 'utf-8'));
    expect(raw.baseURL).toBe('https://example.com');
    expect(raw.sessionCookie).toBe('tok_a');
    expect(raw.email).toBe('a@b.com');

    const loaded = loadConfig();
    expect(loaded.email).toBe('a@b.com');
  });

  test('clearSession removes credentials but keeps baseURL', async () => {
    const { saveConfig, clearSession, loadConfig } = await import('../src/config.ts');

    saveConfig({ baseURL: 'https://example.com', sessionCookie: 'tok_b', email: 'x@y.com' });
    clearSession();

    const cfg = loadConfig();
    expect(cfg.baseURL).toBe('https://example.com');
    expect(cfg.sessionCookie).toBeUndefined();
    expect(cfg.email).toBeUndefined();
  });
});
