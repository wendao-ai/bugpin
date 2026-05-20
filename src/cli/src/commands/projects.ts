import { Command } from 'commander';
import { getClient } from '../client.ts';
import { printResult, printList, trunc } from '../utils/output.ts';
import { toCliError } from '../utils/errors.ts';

interface ProjectListItem {
  id?: string;
  name?: string;
  isActive?: boolean;
  reportsCount?: number;
  createdAt?: string;
}
interface ProjectListResponse {
  success?: boolean;
  projects?: ProjectListItem[];
}

export function registerProjects(program: Command): void {
  const projects = program.command('projects').description('项目管理（admin）');

  projects
    .command('list')
    .description('列出所有项目')
    .action(async () => {
      try {
        const res = await getClient().get('/api/projects');
        printList<ProjectListItem>(res.data, {
          items: (raw) => (raw as ProjectListResponse).projects ?? [],
          summary: (_raw, rows) => `共 ${rows.length} 个项目`,
          // id 列保留完整长度（便于复制使用）
          columns: (p) => ({
            id: p.id ?? '-',
            name: p.name ?? '-',
            active: p.isActive ?? '-',
            reports: p.reportsCount ?? 0,
            createdAt: trunc(p.createdAt, 10),
          }),
        });
      } catch (err) {
        throw toCliError(err);
      }
    });

  projects
    .command('get <id>')
    .description('查看项目详情')
    .action(async (id: string) => {
      try {
        const res = await getClient().get(`/api/projects/${id}`);
        printResult(res.data);
      } catch (err) {
        throw toCliError(err);
      }
    });

  projects
    .command('create')
    .description('新建项目')
    .requiredOption('-n, --name <name>', '项目名称')
    .option('-d, --description <desc>', '描述')
    .option('--allowedDomains <list>', 'allowed widget domains, 逗号分隔')
    .option('--inactive', '创建为停用状态', false)
    .action(
      async (opts: {
        name: string;
        description?: string;
        allowedDomains?: string;
        inactive?: boolean;
      }) => {
        try {
          const body: Record<string, unknown> = { name: opts.name };
          if (opts.description) body.description = opts.description;
          if (opts.allowedDomains) {
            body.allowedDomains = opts.allowedDomains.split(',').map((s) => s.trim());
          }
          if (opts.inactive) body.active = false;
          const res = await getClient().post('/api/projects', body);
          printResult(res.data);
        } catch (err) {
          throw toCliError(err);
        }
      },
    );

  projects
    .command('update <id>')
    .description('更新项目')
    .option('-n, --name <name>', '名称')
    .option('-d, --description <desc>', '描述')
    .option('--allowedDomains <list>', '逗号分隔')
    .option('--active <bool>', 'true/false')
    .action(
      async (
        id: string,
        opts: { name?: string; description?: string; allowedDomains?: string; active?: string },
      ) => {
        try {
          const body: Record<string, unknown> = {};
          if (opts.name !== undefined) body.name = opts.name;
          if (opts.description !== undefined) body.description = opts.description;
          if (opts.allowedDomains !== undefined) {
            body.allowedDomains = opts.allowedDomains
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean);
          }
          if (opts.active !== undefined) body.active = opts.active === 'true';
          const res = await getClient().patch(`/api/projects/${id}`, body);
          printResult(res.data);
        } catch (err) {
          throw toCliError(err);
        }
      },
    );

  projects
    .command('delete <id>')
    .description('删除项目')
    .action(async (id: string) => {
      try {
        const res = await getClient().delete(`/api/projects/${id}`);
        printResult(res.data);
      } catch (err) {
        throw toCliError(err);
      }
    });

  projects
    .command('regenerate-key <id>')
    .description('重置项目 API Key（widget 用）')
    .action(async (id: string) => {
      try {
        const res = await getClient().post(`/api/projects/${id}/regenerate-key`);
        printResult(res.data);
      } catch (err) {
        throw toCliError(err);
      }
    });

  projects
    .command('reorder')
    .description('重排项目顺序')
    .requiredOption('--ids <list>', '按目标顺序排列的项目 ID 列表，逗号分隔')
    .action(async (opts: { ids: string }) => {
      try {
        const projectIds = opts.ids.split(',').map((s) => s.trim()).filter(Boolean);
        const res = await getClient().put('/api/projects/reorder', { projectIds });
        printResult(res.data);
      } catch (err) {
        throw toCliError(err);
      }
    });
}
