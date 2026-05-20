import { Command } from 'commander';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getClient, buildFormData, downloadBinary } from '../client.ts';
import { printResult, printList, trunc } from '../utils/output.ts';
import { toCliError } from '../utils/errors.ts';

// 报告列表项的最小关心字段（其余字段按需扩展）
interface ReportListItem {
  id?: string;
  status?: string;
  priority?: string;
  projectName?: string;
  reporterName?: string;
  title?: string;
  createdAt?: string;
}
interface ReportListResponse {
  success?: boolean;
  data?: ReportListItem[];
  total?: number;
  page?: number;
  totalPages?: number;
}

interface ListOpts {
  projectId?: string;
  source?: string;
  status?: string;
  priority?: string;
  assignedTo?: string;
  search?: string;
  page?: string;
  limit?: string;
  sortBy?: string;
  sortOrder?: string;
}

export function registerReports(program: Command): void {
  const reports = program.command('reports').description('Bug 报告 CRUD / 文件 / 批量操作');

  reports
    .command('list')
    .description('列出报告（支持过滤、分页、排序）')
    .option('-p, --projectId <id>', '按项目过滤')
    .option('--source <widget|manual>', '来源')
    .option('--status <list>', '状态逗号分隔，如 open,in_progress')
    .option('--priority <list>', '优先级逗号分隔')
    .option('-a, --assignedTo <userId>', '指派人 userId')
    .option('-s, --search <q>', '关键词搜索')
    .option('--page <n>', '页码', '1')
    .option('--limit <n>', '每页数量', '20')
    .option('--sortBy <field>', '排序字段', 'createdAt')
    .option('--sortOrder <asc|desc>', '排序方向', 'desc')
    .action(async (opts: ListOpts) => {
      try {
        const params = Object.fromEntries(
          Object.entries(opts).filter(([, v]) => v !== undefined && v !== ''),
        );
        const res = await getClient().get('/api/reports', { params });
        printList<ReportListItem>(res.data, {
          items: (raw) => (raw as ReportListResponse).data ?? [],
          summary: (raw, rows) => {
            const r = raw as ReportListResponse;
            const total = r.total ?? rows.length;
            const page = r.page ?? 1;
            const totalPages = r.totalPages ?? 1;
            return `共 ${total} 条，第 ${page}/${totalPages} 页`;
          },
          // id 列保留完整长度（36 字符）以便复制后直接用于 get/update/delete
          columns: (r) => ({
            id: r.id ?? '-',
            status: r.status ?? '-',
            priority: r.priority ?? '-',
            project: r.projectName ?? '-',
            reporter: r.reporterName ?? '-',
            title: trunc(r.title, 40),
            createdAt: trunc(r.createdAt, 10),
          }),
        });
      } catch (err) {
        throw toCliError(err);
      }
    });

  reports
    .command('get <id>')
    .description('查看单个报告详情（含文件列表）')
    .action(async (id: string) => {
      try {
        const res = await getClient().get(`/api/reports/${id}`);
        printResult(res.data);
      } catch (err) {
        throw toCliError(err);
      }
    });

  reports
    .command('stats')
    .description('统计概览')
    .option('-p, --projectId <id>', '按项目过滤')
    .action(async (opts: { projectId?: string }) => {
      try {
        const res = await getClient().get('/api/reports/stats/overview', {
          params: opts.projectId ? { projectId: opts.projectId } : {},
        });
        printResult(res.data);
      } catch (err) {
        throw toCliError(err);
      }
    });

  reports
    .command('create')
    .description('创建手动报告（admin/editor），可携带附件')
    .requiredOption('-p, --projectId <id>', '项目 ID')
    .requiredOption('-t, --title <title>', '标题')
    .option('-d, --description <desc>', '描述')
    .option('--priority <p>', 'lowest|low|medium|high|highest')
    .option('--assignedTo <userId>', '指派人 userId（"" 表示取消指派）')
    .option('--reporterName <name>', '反馈人姓名')
    .option('--reporterEmail <email>', '反馈人邮箱')
    .option('--url <url>', '相关页面 URL')
    .option('--channel <ch>', 'email|chat|phone|qa|other')
    .option('-f, --file <path...>', '附件路径，可多次指定')
    .action(
      async (opts: {
        projectId: string;
        title: string;
        description?: string;
        priority?: string;
        assignedTo?: string;
        reporterName?: string;
        reporterEmail?: string;
        url?: string;
        channel?: string;
        file?: string[];
      }) => {
        try {
          const payload = {
            projectId: opts.projectId,
            title: opts.title,
            description: opts.description,
            priority: opts.priority,
            assignedTo: opts.assignedTo,
            reporterName: opts.reporterName,
            reporterEmail: opts.reporterEmail,
            url: opts.url,
            channel: opts.channel,
          };
          const files = opts.file ?? [];

          let res;
          if (files.length > 0) {
            const fd = await buildFormData(payload, files);
            res = await getClient().post('/api/reports', fd, {
              headers: { 'Content-Type': 'multipart/form-data' },
            });
          } else {
            res = await getClient().post('/api/reports', payload);
          }
          printResult(res.data);
        } catch (err) {
          throw toCliError(err);
        }
      },
    );

  reports
    .command('update <id>')
    .description('更新报告（status/priority/title/description/assignedTo）')
    .option('--status <s>', 'open|in_progress|resolved|closed')
    .option('--priority <p>', 'lowest|low|medium|high|highest')
    .option('--title <t>', '标题')
    .option('--description <d>', '描述')
    .option('--assignedTo <userId>', '指派人 userId（"" 取消指派）')
    .action(async (id: string, opts: Record<string, string | undefined>) => {
      try {
        const body = Object.fromEntries(Object.entries(opts).filter(([, v]) => v !== undefined));
        const res = await getClient().patch(`/api/reports/${id}`, body);
        printResult(res.data);
      } catch (err) {
        throw toCliError(err);
      }
    });

  reports
    .command('delete <id>')
    .description('删除报告（admin）')
    .action(async (id: string) => {
      try {
        const res = await getClient().delete(`/api/reports/${id}`);
        printResult(res.data);
      } catch (err) {
        throw toCliError(err);
      }
    });

  reports
    .command('bulk-update')
    .description('批量更新报告')
    .requiredOption('--ids <ids>', '报告 ID 逗号分隔')
    .option('--status <s>', '目标状态')
    .option('--priority <p>', '目标优先级')
    .option('--assignedTo <userId>', '批量指派')
    .action(
      async (opts: {
        ids: string;
        status?: string;
        priority?: string;
        assignedTo?: string;
      }) => {
        try {
          const ids = opts.ids.split(',').map((s) => s.trim()).filter(Boolean);
          const updates = Object.fromEntries(
            Object.entries({
              status: opts.status,
              priority: opts.priority,
              assignedTo: opts.assignedTo,
            }).filter(([, v]) => v !== undefined),
          );
          const res = await getClient().post('/api/reports/bulk-update', { ids, updates });
          printResult(res.data);
        } catch (err) {
          throw toCliError(err);
        }
      },
    );

  reports
    .command('forward <reportId> <integrationId>')
    .description('转发报告到第三方集成（admin）')
    .option('--body <json>', '附加 JSON 体')
    .action(async (reportId: string, integrationId: string, opts: { body?: string }) => {
      try {
        const body = opts.body ? JSON.parse(opts.body) : {};
        const res = await getClient().post(
          `/api/reports/${reportId}/forward/${integrationId}`,
          body,
        );
        printResult(res.data);
      } catch (err) {
        throw toCliError(err);
      }
    });

  reports
    .command('files <id>')
    .description('列出某报告的文件')
    .action(async (id: string) => {
      try {
        const res = await getClient().get(`/api/reports/${id}/files`);
        printResult(res.data);
      } catch (err) {
        throw toCliError(err);
      }
    });

  reports
    .command('download <reportId> <fileId>')
    .description('下载报告附件文件')
    .option('-o, --output <path>', '保存路径（目录或具体文件名）', '.')
    .action(async (reportId: string, fileId: string, opts: { output: string }) => {
      try {
        const { data, contentType } = await downloadBinary(
          `/api/reports/${reportId}/files/${fileId}`,
        );

        // output 是目录则用 fileId.bin，是文件名则直接用
        let outPath = opts.output;
        try {
          const stat = await Bun.file(outPath).exists();
          // 简化判断：以 / 结尾或为 . 则当目录
          if (outPath === '.' || outPath.endsWith('/') || !outPath.includes('.')) {
            outPath = join(outPath, `${fileId}.bin`);
          } else if (!stat) {
            // 路径不存在视为目标文件名
          }
        } catch {
          /* ignore */
        }
        writeFileSync(outPath, data);
        printResult({ saved: outPath, contentType, bytes: data.byteLength });
      } catch (err) {
        throw toCliError(err);
      }
    });

  reports
    .command('retry-sync <id>')
    .description('重试 GitHub 同步（admin）')
    .action(async (id: string) => {
      try {
        const res = await getClient().post(`/api/reports/${id}/retry-sync`);
        printResult(res.data);
      } catch (err) {
        throw toCliError(err);
      }
    });
}
