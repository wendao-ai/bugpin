// bugpin list-files — 列出报告的所有附件（截图/视频/标注后图）
//
// Positional：<reportId>
// 输出每行一个文件：fileId / mimeType / size / annotated / originalUrl

import { cli, Strategy } from '@jackwener/opencli/registry';
import { AuthRequiredError, CliError } from '@jackwener/opencli/errors';

const BASE = 'https://bugpin.migelab.com';
const HOST = 'bugpin.migelab.com';

async function readSession(page) {
  if (page) {
    try {
      const cookies = await page.getCookies({ domain: HOST });
      const s = (cookies || []).find((c) => c.name === 'session');
      if (s?.value) return `session=${s.value}`;
    } catch {
      /* fallback */
    }
  }
  const env = process.env.BUGPIN_SESSION;
  if (env) return `session=${env}`;
  throw new AuthRequiredError(HOST);
}

cli({
  site: 'bugpin',
  name: 'list-files',
  description: 'List attachments (screenshots/videos) of a report',
  domain: HOST,
  strategy: Strategy.COOKIE,
  browser: true,
  navigateBefore: false,
  access: 'read',
  args: [
    { name: 'reportId', type: 'string', default: '', positional: true, help: 'Report id' },
  ],
  columns: ['index', 'fileId', 'mimeType', 'size', 'annotated', 'originalName'],
  func: async (page, args) => {
    const reportId = String(args.reportId || '').trim();
    if (!reportId) throw new CliError('INVALID_ARGUMENT', 'Missing required positional arg <reportId>');

    const cookie = await readSession(page);
    const resp = await fetch(`${BASE}/api/reports/${encodeURIComponent(reportId)}/files`, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'opencli-bugpin/1.0',
        Cookie: cookie,
      },
    });
    if (resp.status === 401 || resp.status === 403) throw new AuthRequiredError(HOST);
    if (resp.status === 404) throw new CliError('NOT_FOUND', `Report ${reportId} not found`);
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new CliError('HTTP_ERROR', `list-files → HTTP ${resp.status}: ${text.slice(0, 200)}`);
    }
    const data = await resp.json();
    // 响应形状探测：试 data.files / data.data / data 数组
    const files = Array.isArray(data?.files)
      ? data.files
      : Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data)
          ? data
          : [];

    if (files.length === 0) {
      return [{
        index: 0,
        fileId: '',
        mimeType: '',
        size: '',
        annotated: '',
        originalName: '(no files attached)',
      }];
    }

    return files.map((f, i) => ({
      index: i + 1,
      fileId: String(f.id ?? f.fileId ?? ''),
      mimeType: String(f.mimeType ?? f.contentType ?? f.type ?? ''),
      size: String(f.size ?? f.sizeBytes ?? ''),
      annotated: f.annotated || f.hasAnnotations ? 'yes' : '',
      originalName: String(f.originalName ?? f.filename ?? f.name ?? ''),
    }));
  },
});
