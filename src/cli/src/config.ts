import { homedir } from 'node:os';
import { join } from 'node:path';
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';

// 路径懒求值：
// - BUGPIN_CONFIG_PATH 环境变量直接指定配置文件路径（测试隔离专用）
// - 否则使用 ~/.bugpin/config.json
function resolveHome(): string {
  return process.env.HOME || homedir();
}

function configFile(): string {
  if (process.env.BUGPIN_CONFIG_PATH) return process.env.BUGPIN_CONFIG_PATH;
  return join(resolveHome(), '.bugpin', 'config.json');
}

function configDir(): string {
  return join(configFile(), '..');
}

export interface CliConfig {
  baseURL: string;
  sessionCookie?: string;
  email?: string;
}

// 内置默认服务端 URL（开发本机）；config set-url / BUGPIN_URL / 配置文件 均可覆盖
export const DEFAULT_BASE_URL = 'http://localhost:3000';

function defaultConfig(): CliConfig {
  return {
    baseURL: process.env.BUGPIN_URL || DEFAULT_BASE_URL,
  };
}

// 缓存按文件路径区分，避免测试中 HOME 切换导致脏数据
let cachedPath: string | null = null;
let cache: CliConfig | null = null;

export function loadConfig(): CliConfig {
  const file = configFile();
  if (cache && cachedPath === file) return cache;

  if (!existsSync(file)) {
    cache = defaultConfig();
    cachedPath = file;
    return cache;
  }

  try {
    const raw = readFileSync(file, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<CliConfig>;
    cache = { ...defaultConfig(), ...parsed };
  } catch {
    cache = defaultConfig();
  }
  cachedPath = file;
  return cache;
}

export function saveConfig(patch: Partial<CliConfig>): CliConfig {
  const current = loadConfig();
  const next: CliConfig = { ...current, ...patch };

  const dir = configDir();
  const file = configFile();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
  }

  writeFileSync(file, JSON.stringify(next, null, 2), 'utf-8');
  // 敏感文件，仅当前用户可读写
  chmodSync(file, 0o600);

  cache = next;
  cachedPath = file;
  return next;
}

export function clearSession(): void {
  saveConfig({ sessionCookie: undefined, email: undefined });
}

export function getConfigPath(): string {
  return configFile();
}
