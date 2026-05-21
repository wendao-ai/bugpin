// bugpin list-reports — 列出反馈报告（支持 status/priority/search/projectId 过滤）
//
// 认证：通过环境变量 BUGPIN_SESSION 传入 session cookie 值。
// 获取方式：浏览器登录 bugpin.migelab.com/admin → F12 → Application → Cookies →
// 复制 `session` cookie 的 Value，存到 ~/.bugpin-session 后 `source` 一下：
//   echo 'export BUGPIN_SESSION=<value>' > ~/.bugpin-session && chmod 600 ~/.bugpin-session
//   source ~/.bugpin-session && opencli bugpin list-reports
//
// 未来扩展：browser: true + page.getCookies 自动读浏览器 jar（doctor connectivity 修好后）

import { cli, Strategy } from '@jackwener/opencli/registry';
import { AuthRequiredError, CliError } from '@jackwener/opencli/errors';

const BASE = 'https://bugpin.migelab.com';
const HOST = 'bugpin.migelab.com';

/**
 * 读 session cookie。两条来源，按优先级：
 * 1. 浏览器 cookie jar（page.getCookies）——零手动，登录 Chrome 即可
 * 2. 环境变量 BUGPIN_SESSION——CI / headless / 浏览器没开时的兜底
 * 全失败则抛 AuthRequiredError，OpenCLI 会提示用户去 Chrome 登录。
 */
async function readSession(page) {
  if (page) {
    try {
      const cookies = await page.getCookies({ domain: HOST });
      const s = (cookies || []).find((c) => c.name === 'session');
      if (s?.value) return `session=${s.value}`;
    } catch {
      /* extension 拿不到 cookie 时静默 fallback */
    }
  }
  const env = process.env.BUGPIN_SESSION;
  if (env) return `session=${env}`;
  throw new AuthRequiredError(HOST);
}

async function fetchJson(path, { cookie, method = 'GET', body } = {}) {
  const headers = {
    Accept: 'application/json',
    'User-Agent': 'opencli-bugpin/1.0',
    Cookie: cookie,
  };
  let payload;
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const resp = await fetch(`${BASE}${path}`, { method, headers, body: payload });
  if (resp.status === 401 || resp.status === 403) {
    throw new AuthRequiredError(HOST);
  }
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new CliError(
      'HTTP_ERROR',
      `${method} ${path} → HTTP ${resp.status}${text ? `: ${text.slice(0, 200)}` : ''}`,
    );
  }
  return resp.json();
}

cli({
  site: 'bugpin',
  name: 'list-reports',
  description: 'List bug reports with filters (status/priority/search/projectId)',
  domain: HOST,
  strategy: Strategy.COOKIE,
  browser: true,
  navigateBefore: false, // 不需要打开 bugpin admin 页，只借浏览器 cookie jar
  access: 'read',
  args: [
    { name: 'status', type: 'string', default: '', help: 'Status filter (comma-separated): open,in_progress,resolved,closed' },
    { name: 'priority', type: 'string', default: '', help: 'Priority filter (comma-separated): lowest,low,medium,high,highest' },
    { name: 'projectId', type: 'string', default: '', help: 'Filter by project id' },
    { name: 'source', type: 'string', default: '', help: 'Filter by source: widget | manual' },
    { name: 'assignedTo', type: 'string', default: '', help: 'Filter by assignee user id' },
    { name: 'search', type: 'string', default: '', help: 'Full-text search (title/description/metadata.url)' },
    { name: 'page', type: 'int', default: 1, help: 'Page number (1-based)' },
    { name: 'limit', type: 'int', default: 20, help: 'Page size (max 100)' },
    { name: 'sortBy', type: 'string', default: 'createdAt', help: 'Sort key: createdAt | updatedAt | priority' },
    { name: 'sortOrder', type: 'string', default: 'desc', help: 'Sort order: asc | desc' },
  ],
  columns: [
    'rank',
    'id',
    'title',
    'status',
    'priority',
    'pageUrl',
    'reporter',
    'projectId',
    'createdAt',
  ],
  func: async (page, args) => {
    const cookie = await readSession(page);

    const params = new URLSearchParams();
    const limit = Math.max(1, Math.min(Number(args.limit) || 20, 100));
    const pageNum = Math.max(1, Number(args.page) || 1);
    params.set('page', String(pageNum));
    params.set('limit', String(limit));
    params.set('sortBy', String(args.sortBy || 'createdAt'));
    params.set('sortOrder', String(args.sortOrder || 'desc'));
    if (args.status) params.set('status', String(args.status));
    if (args.priority) params.set('priority', String(args.priority));
    if (args.projectId) params.set('projectId', String(args.projectId));
    if (args.source) params.set('source', String(args.source));
    if (args.assignedTo) params.set('assignedTo', String(args.assignedTo));
    if (args.search) params.set('search', String(args.search));

    // 注意：URL 不带 trailing slash——BugPin v1.0.14 Hono 严格不接受 `/api/reports/`
    const data = await fetchJson(`/api/reports?${params.toString()}`, { cookie });
    const items = Array.isArray(data?.data) ? data.data : [];

    if (items.length === 0) {
      // 哨兵行而不是空数组，避免下游 agent 当作"接口挂了"重试
      return [{
        rank: 0,
        id: '',
        title: `(no reports match: status=${args.status || '*'} priority=${args.priority || '*'} search="${args.search || ''}")`,
        status: '',
        priority: '',
        pageUrl: '',
        reporter: '',
        projectId: '',
        createdAt: '',
      }];
    }

    const offset = (pageNum - 1) * limit;
    return items.map((r, i) => ({
      rank: offset + i + 1,
      id: String(r.id ?? ''),
      title: String(r.title ?? ''),
      status: String(r.status ?? ''),
      priority: String(r.priority ?? ''),
      pageUrl: String(r.metadata?.url ?? ''),
      reporter: String(r.reporterName || r.reporterEmail || ''),
      projectId: String(r.projectId ?? ''),
      createdAt: String(r.createdAt ?? ''),
    }));
  },
});
