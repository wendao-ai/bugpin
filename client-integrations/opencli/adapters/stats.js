// bugpin stats — 全局/按 project 反馈聚合统计
//
// 例：opencli bugpin stats
// 例：opencli bugpin stats --projectId proj_abc

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
  name: 'stats',
  description: 'Overview stats: counts by status / priority / source',
  domain: HOST,
  strategy: Strategy.COOKIE,
  browser: true,
  navigateBefore: false,
  access: 'read',
  args: [
    { name: 'projectId', type: 'string', default: '', help: 'Scope to a single project' },
  ],
  columns: ['dimension', 'value', 'count'],
  func: async (page, args) => {
    const cookie = await readSession(page);
    const params = new URLSearchParams();
    if (args.projectId) params.set('projectId', String(args.projectId));
    const qs = params.toString() ? `?${params.toString()}` : '';

    const resp = await fetch(`${BASE}/api/reports/stats/overview${qs}`, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'opencli-bugpin/1.0',
        Cookie: cookie,
      },
    });
    if (resp.status === 401 || resp.status === 403) throw new AuthRequiredError(HOST);
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new CliError('HTTP_ERROR', `stats → HTTP ${resp.status}: ${text.slice(0, 200)}`);
    }
    const data = await resp.json();
    // 真实响应（v1.0.14）：{ success: true, stats: { total, byStatus: {...}, byPriority: {...}, bySource: {...} } }
    const stats = data?.stats || data;

    const rows = [];
    if (stats?.total !== undefined) rows.push({ dimension: 'total', value: '', count: String(stats.total) });
    for (const [dim, obj] of [
      ['status', stats?.byStatus],
      ['priority', stats?.byPriority],
      ['source', stats?.bySource],
    ]) {
      if (obj && typeof obj === 'object') {
        for (const [k, v] of Object.entries(obj)) {
          rows.push({ dimension: dim, value: k, count: String(v) });
        }
      }
    }
    if (rows.length === 0) {
      // 兜底：未知响应形态时打印 raw
      rows.push({ dimension: 'raw', value: JSON.stringify(data).slice(0, 500), count: '' });
    }
    return rows;
  },
});
