import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { basename } from 'node:path';
import { loadConfig, saveConfig } from './config.ts';

let instance: AxiosInstance | null = null;

// 单例 axios 客户端，统一注入 baseURL 与 cookie
export function getClient(): AxiosInstance {
  if (instance) return instance;

  const cfg = loadConfig();
  const client = axios.create({
    baseURL: cfg.baseURL.replace(/\/$/, ''),
    timeout: 30_000,
    headers: { 'Content-Type': 'application/json' },
    // 不抛 4xx/5xx，由调用方根据 success 字段判断；这里仍交给 axios 默认行为以触发 catch
    validateStatus: (s) => s >= 200 && s < 300,
  });

  // 请求拦截：注入 cookie
  client.interceptors.request.use((req) => {
    const { sessionCookie } = loadConfig();
    if (sessionCookie) {
      req.headers.Cookie = `session=${sessionCookie}`;
    }
    return req;
  });

  instance = client;
  return client;
}

// 从 Set-Cookie 解析 session=xxx
export function extractSessionCookie(res: AxiosResponse): string | null {
  const headers = res.headers['set-cookie'];
  if (!headers) return null;
  const list = Array.isArray(headers) ? headers : [headers];
  for (const raw of list) {
    const match = /^session=([^;]+)/.exec(raw);
    if (match) return match[1] ?? null;
  }
  return null;
}

// 登录后存 cookie
export function persistSession(cookie: string, email: string): void {
  saveConfig({ sessionCookie: cookie, email });
}

// 构造 multipart FormData（用于 reports create / avatar 上传）
// files: 文件路径数组
export async function buildFormData(
  jsonData: unknown,
  files: string[] = [],
): Promise<FormData> {
  const fd = new FormData();
  fd.append('data', JSON.stringify(jsonData));

  for (const filePath of files) {
    // Bun.file 返回 BunFile，符合 Blob 接口
    const file = Bun.file(filePath);
    if (!(await file.exists())) {
      throw new Error(`文件不存在: ${filePath}`);
    }
    const blob = new Blob([await file.arrayBuffer()], { type: file.type || 'application/octet-stream' });
    fd.append('files', blob, basename(filePath));
  }
  return fd;
}

// 简单的二进制下载
export async function downloadBinary(url: string): Promise<{ data: Buffer; contentType: string }> {
  const client = getClient();
  const res = await client.get(url, { responseType: 'arraybuffer' });
  return {
    data: Buffer.from(res.data),
    contentType: (res.headers['content-type'] as string) || 'application/octet-stream',
  };
}
