import { Command } from 'commander';
import { writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { getClient, downloadBinary } from '../client.ts';
import { printResult, printList, trunc } from '../utils/output.ts';
import { toCliError } from '../utils/errors.ts';

interface UserListItem {
  id?: string;
  email?: string;
  name?: string;
  role?: string;
  isActive?: boolean;
  lastLoginAt?: string;
}
interface UserListResponse {
  success?: boolean;
  users?: UserListItem[];
}

function renderUserList(raw: unknown): void {
  printList<UserListItem>(raw, {
    items: (r) => (r as UserListResponse).users ?? [],
    summary: (_r, rows) => `共 ${rows.length} 个用户`,
    // id 列保留完整长度（便于复制使用）
    columns: (u) => ({
      id: u.id ?? '-',
      email: u.email ?? '-',
      name: u.name ?? '-',
      role: u.role ?? '-',
      active: u.isActive ?? '-',
      lastLogin: trunc(u.lastLoginAt, 10),
    }),
  });
}

export function registerUsers(program: Command): void {
  const users = program.command('users').description('用户管理与个人资料');

  users
    .command('list')
    .description('列出所有用户（admin）')
    .action(async () => {
      try {
        const res = await getClient().get('/api/users');
        renderUserList(res.data);
      } catch (err) {
        throw toCliError(err);
      }
    });

  users
    .command('assignable')
    .description('列出可被指派的用户（admin/editor）')
    .action(async () => {
      try {
        const res = await getClient().get('/api/users/assignable');
        renderUserList(res.data);
      } catch (err) {
        throw toCliError(err);
      }
    });

  users
    .command('get <id>')
    .description('查看用户详情（admin）')
    .action(async (id: string) => {
      try {
        const res = await getClient().get(`/api/users/${id}`);
        printResult(res.data);
      } catch (err) {
        throw toCliError(err);
      }
    });

  users
    .command('create')
    .description('创建用户（admin，立即生效，无邀请）')
    .requiredOption('-e, --email <email>', '邮箱')
    .requiredOption('-n, --name <name>', '姓名')
    .requiredOption('-p, --password <pwd>', '初始密码')
    .option('-r, --role <role>', 'admin|editor|viewer', 'viewer')
    .action(async (opts: { email: string; name: string; password: string; role: string }) => {
      try {
        const res = await getClient().post('/api/users', opts);
        printResult(res.data);
      } catch (err) {
        throw toCliError(err);
      }
    });

  users
    .command('invite')
    .description('邀请用户（admin，发邀请邮件）')
    .requiredOption('-e, --email <email>', '邮箱')
    .requiredOption('-n, --name <name>', '姓名')
    .option('-r, --role <role>', 'admin|editor|viewer', 'viewer')
    .action(async (opts: { email: string; name: string; role: string }) => {
      try {
        const res = await getClient().post('/api/users/invite', opts);
        printResult(res.data);
      } catch (err) {
        throw toCliError(err);
      }
    });

  users
    .command('resend-invitation <id>')
    .description('重新发送邀请邮件')
    .action(async (id: string) => {
      try {
        const res = await getClient().post(`/api/users/${id}/resend-invitation`);
        printResult(res.data);
      } catch (err) {
        throw toCliError(err);
      }
    });

  users
    .command('update <id>')
    .description('更新用户（admin）')
    .option('-n, --name <name>', '姓名')
    .option('-e, --email <email>', '邮箱')
    .option('-r, --role <role>', 'admin|editor|viewer')
    .option('--active <bool>', 'true/false')
    .action(
      async (
        id: string,
        opts: { name?: string; email?: string; role?: string; active?: string },
      ) => {
        try {
          const body: Record<string, unknown> = {};
          if (opts.name !== undefined) body.name = opts.name;
          if (opts.email !== undefined) body.email = opts.email;
          if (opts.role !== undefined) body.role = opts.role;
          if (opts.active !== undefined) body.active = opts.active === 'true';
          const res = await getClient().patch(`/api/users/${id}`, body);
          printResult(res.data);
        } catch (err) {
          throw toCliError(err);
        }
      },
    );

  users
    .command('delete <id>')
    .description('删除用户（admin，不能删自己）')
    .action(async (id: string) => {
      try {
        const res = await getClient().delete(`/api/users/${id}`);
        printResult(res.data);
      } catch (err) {
        throw toCliError(err);
      }
    });

  // 个人资料

  const profile = users.command('me').description('当前用户的资料与头像');

  profile
    .command('profile')
    .description('更新个人资料（name/email）')
    .option('-n, --name <name>', '姓名')
    .option('-e, --email <email>', '邮箱')
    .action(async (opts: { name?: string; email?: string }) => {
      try {
        const body = Object.fromEntries(Object.entries(opts).filter(([, v]) => v !== undefined));
        const res = await getClient().patch('/api/users/me/profile', body);
        printResult(res.data);
      } catch (err) {
        throw toCliError(err);
      }
    });

  profile
    .command('upload-avatar <file>')
    .description('上传头像（jpeg/png/webp/gif，<=5MB）')
    .action(async (file: string) => {
      try {
        const bunFile = Bun.file(file);
        if (!(await bunFile.exists())) {
          throw new Error(`文件不存在: ${file}`);
        }
        const fd = new FormData();
        const blob = new Blob([await bunFile.arrayBuffer()], {
          type: bunFile.type || 'application/octet-stream',
        });
        fd.append('file', blob, basename(file));
        const res = await getClient().post('/api/users/me/avatar', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        printResult(res.data);
      } catch (err) {
        throw toCliError(err);
      }
    });

  profile
    .command('download-avatar <filename>')
    .description('下载当前用户的头像文件')
    .option('-o, --output <path>', '保存路径', '.')
    .action(async (filename: string, opts: { output: string }) => {
      try {
        const { data, contentType } = await downloadBinary(`/api/users/me/avatar/${filename}`);
        let outPath = opts.output;
        if (outPath === '.' || outPath.endsWith('/') || !outPath.includes('.')) {
          outPath = join(outPath, filename);
        }
        writeFileSync(outPath, data);
        printResult({ saved: outPath, contentType, bytes: data.byteLength });
      } catch (err) {
        throw toCliError(err);
      }
    });

  profile
    .command('delete-avatar')
    .description('删除当前用户头像')
    .action(async () => {
      try {
        const res = await getClient().delete('/api/users/me/avatar');
        printResult(res.data);
      } catch (err) {
        throw toCliError(err);
      }
    });
}
