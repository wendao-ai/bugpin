// bugpin update-report — 改 status / priority / assignedTo / title / description
//
// Positional 主语：<id>。其余通过 --field 形式。
// 例：opencli bugpin update-report bp_abc123 --status in_progress --priority high

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
  name: 'update-report',
  description: 'Update report status / priority / assignee / title / description',
  domain: HOST,
  strategy: Strategy.COOKIE,
  browser: true,
  navigateBefore: false,
  access: 'write',
  args: [
    { name: 'id', type: 'string', default: '', positional: true, help: 'Report id' },
    { name: 'status', type: 'string', default: '', help: 'New status: open | in_progress | resolved | closed' },
    { name: 'priority', type: 'string', default: '', help: 'New priority: lowest | low | medium | high | highest' },
    { name: 'assignedTo', type: 'string', default: '', help: 'Assignee user id (empty string to unassign)' },
    { name: 'title', type: 'string', default: '', help: 'Rewrite title (only updates if non-empty)' },
    { name: 'description', type: 'string', default: '', help: 'Rewrite description (only updates if non-empty)' },
  ],
  columns: ['field', 'value'],
  func: async (page, args) => {
    const id = String(args.id || '').trim();
    if (!id) throw new CliError('INVALID_ARGUMENT', 'Missing required positional arg <id>');

    const patch = {};
    if (args.status) patch.status = String(args.status);
    if (args.priority) patch.priority = String(args.priority);
    if (args.assignedTo !== '') patch.assignedTo = String(args.assignedTo) || null;
    if (args.title) patch.title = String(args.title);
    if (args.description) patch.description = String(args.description);

    if (Object.keys(patch).length === 0) {
      throw new CliError('INVALID_ARGUMENT', 'No fields to update. Pass at least one of --status / --priority / --assignedTo / --title / --description');
    }

    const cookie = await readSession(page);
    const resp = await fetch(`${BASE}/api/reports/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'opencli-bugpin/1.0',
        Cookie: cookie,
      },
      body: JSON.stringify(patch),
    });

    if (resp.status === 401 || resp.status === 403) throw new AuthRequiredError(HOST);
    if (resp.status === 404) throw new CliError('NOT_FOUND', `Report ${id} not found`);
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new CliError('HTTP_ERROR', `PATCH /api/reports/${id} → HTTP ${resp.status}: ${text.slice(0, 200)}`);
    }

    const data = await resp.json();
    const r = data?.report || data;

    return [
      { field: 'id', value: String(r.id ?? id) },
      { field: 'status', value: String(r.status ?? patch.status ?? '') },
      { field: 'priority', value: String(r.priority ?? patch.priority ?? '') },
      { field: 'assignedTo', value: String(r.assignedTo ?? patch.assignedTo ?? '') },
      { field: 'title', value: String(r.title ?? patch.title ?? '') },
      { field: 'updatedAt', value: String(r.updatedAt ?? new Date().toISOString()) },
      { field: 'patchedFields', value: Object.keys(patch).join(',') },
    ];
  },
});
