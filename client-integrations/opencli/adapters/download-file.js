// bugpin download-file — 下载 report 关联的截图/视频附件
//
// Positional：<reportId> <fileId>
// 默认保存到 /tmp/bugpin-<reportId>-<fileId>.<ext>，可用 --out 改路径。
// 输出包括：path（落盘位置）、size、contentType，方便后续用 Read 工具看。

import { cli, Strategy } from '@jackwener/opencli/registry';
import { AuthRequiredError, CliError } from '@jackwener/opencli/errors';
import { writeFile } from 'node:fs/promises';
import { resolve as resolvePath } from 'node:path';

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

function extFromContentType(ct) {
  if (!ct) return 'bin';
  const map = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/quicktime': 'mov',
  };
  const base = ct.split(';')[0].trim();
  return map[base] || base.split('/')[1] || 'bin';
}

cli({
  site: 'bugpin',
  name: 'download-file',
  description: 'Download a report attachment (screenshot/video) to local disk',
  domain: HOST,
  strategy: Strategy.COOKIE,
  browser: true,
  navigateBefore: false,
  access: 'read',
  args: [
    { name: 'reportId', type: 'string', default: '', positional: true, help: 'Report id' },
    { name: 'fileId', type: 'string', default: '', positional: true, help: 'File id' },
    { name: 'out', type: 'string', default: '', help: 'Output path (default /tmp/bugpin-<rid>-<fid>.<ext>)' },
  ],
  columns: ['field', 'value'],
  func: async (page, args) => {
    const reportId = String(args.reportId || '').trim();
    const fileId = String(args.fileId || '').trim();
    if (!reportId || !fileId) {
      throw new CliError('INVALID_ARGUMENT', 'Required: <reportId> <fileId>');
    }

    const cookie = await readSession(page);
    const url = `${BASE}/api/reports/${encodeURIComponent(reportId)}/files/${encodeURIComponent(fileId)}`;
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'opencli-bugpin/1.0',
        Cookie: cookie,
      },
    });

    if (resp.status === 401 || resp.status === 403) throw new AuthRequiredError(HOST);
    if (resp.status === 404) throw new CliError('NOT_FOUND', `File not found (report=${reportId} file=${fileId})`);
    if (!resp.ok) throw new CliError('HTTP_ERROR', `Download → HTTP ${resp.status}`);

    const contentType = resp.headers.get('content-type') || '';
    const buf = Buffer.from(await resp.arrayBuffer());
    const ext = extFromContentType(contentType);
    const outPath = args.out
      ? resolvePath(String(args.out))
      : `/tmp/bugpin-${reportId}-${fileId}.${ext}`;

    await writeFile(outPath, buf);

    return [
      { field: 'path', value: outPath },
      { field: 'size', value: String(buf.length) },
      { field: 'contentType', value: contentType },
      { field: 'reportId', value: reportId },
      { field: 'fileId', value: fileId },
    ];
  },
});
