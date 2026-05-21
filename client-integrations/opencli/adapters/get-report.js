// bugpin get-report — 单条报告详情（含 metadata 完整字段）
//
// Positional 主语：<id>。例：opencli bugpin get-report bp_abc123
// 见 list-reports.js 头部注释获取 BUGPIN_SESSION 配置说明。

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

async function fetchJson(path, { cookie, method = 'GET' } = {}) {
  const resp = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      'User-Agent': 'opencli-bugpin/1.0',
      Cookie: cookie,
    },
  });
  if (resp.status === 401 || resp.status === 403) throw new AuthRequiredError(HOST);
  if (resp.status === 404) throw new CliError('NOT_FOUND', `Report not found`);
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new CliError('HTTP_ERROR', `${method} ${path} → HTTP ${resp.status}: ${text.slice(0, 200)}`);
  }
  return resp.json();
}

cli({
  site: 'bugpin',
  name: 'get-report',
  description: 'Get full detail of a single report by id',
  domain: HOST,
  strategy: Strategy.COOKIE,
  browser: true,
  navigateBefore: false,
  access: 'read',
  args: [
    { name: 'id', type: 'string', default: '', positional: true, help: 'Report id' },
  ],
  // 单条详情按 key:value 二列展开，agent 读起来跟 list-reports 一致
  columns: ['field', 'value'],
  func: async (page, args) => {
    const id = String(args.id || '').trim();
    if (!id) throw new CliError('INVALID_ARGUMENT', 'Missing required positional arg <id>');

    const cookie = await readSession(page);
    const data = await fetchJson(`/api/reports/${encodeURIComponent(id)}`, { cookie });

    // BugPin 响应：{ success: true, ...Report } 平铺
    const r = data?.report || data; // 兼容两种形态
    if (!r || !r.id) throw new CliError('NO_DATA', `Report ${id} returned empty payload`);

    const m = r.metadata || {};
    const consoleErr = Array.isArray(m.consoleErrors) ? m.consoleErrors : [];
    const networkErr = Array.isArray(m.networkErrors) ? m.networkErrors : [];

    const rows = [
      { field: 'id', value: String(r.id) },
      { field: 'title', value: String(r.title ?? '') },
      { field: 'description', value: String(r.description ?? '') },
      { field: 'status', value: String(r.status ?? '') },
      { field: 'priority', value: String(r.priority ?? '') },
      { field: 'source', value: String(r.source ?? '') },
      { field: 'projectId', value: String(r.projectId ?? '') },
      { field: 'assignedTo', value: String(r.assignedTo ?? '') },
      { field: 'reporterName', value: String(r.reporterName ?? '') },
      { field: 'reporterEmail', value: String(r.reporterEmail ?? '') },
      { field: 'pageUrl', value: String(m.url ?? '') },
      { field: 'pageTitle', value: String(m.title ?? '') },
      { field: 'userAgent', value: String(m.browser?.userAgent ?? m.userAgent ?? '') },
      { field: 'viewport', value: m.viewport ? `${m.viewport.width}x${m.viewport.height}` : '' },
      { field: 'os', value: String(m.device?.os ?? '') },
      { field: 'consoleErrorCount', value: String(consoleErr.length) },
      { field: 'networkErrorCount', value: String(networkErr.length) },
      { field: 'createdAt', value: String(r.createdAt ?? '') },
      { field: 'updatedAt', value: String(r.updatedAt ?? '') },
    ];

    // 把前 3 条 console error 摘要拼进来（agent 通常关心)
    consoleErr.slice(0, 3).forEach((e, i) => {
      rows.push({
        field: `consoleError[${i}]`,
        value: `${e.type || 'error'}: ${String(e.message || '').slice(0, 200)}`,
      });
    });
    networkErr.slice(0, 3).forEach((e, i) => {
      rows.push({
        field: `networkError[${i}]`,
        value: `${e.method || 'GET'} ${e.url || ''} → ${e.status || '?'}`,
      });
    });

    return rows;
  },
});
