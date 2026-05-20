import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { getClient } from '../client.ts';
import { printResult } from '../utils/output.ts';
import { toCliError } from '../utils/errors.ts';

export function registerSettings(program: Command): void {
  const settings = program.command('settings').description('全局设置（admin）');

  settings
    .command('get')
    .description('查看全部设置')
    .action(async () => {
      try {
        const res = await getClient().get('/api/settings');
        printResult(res.data);
      } catch (err) {
        throw toCliError(err);
      }
    });

  settings
    .command('update')
    .description('更新设置：通过 --file <patch.json> 或 --kv key=value 多次传入')
    .option('-f, --file <path>', '完整 JSON 补丁文件')
    .option('--kv <pair...>', '键值对，如 --kv appName=BugPin --kv smtpEnabled=true')
    .action(async (opts: { file?: string; kv?: string[] }) => {
      try {
        let body: Record<string, unknown> = {};

        if (opts.file) {
          body = JSON.parse(readFileSync(opts.file, 'utf-8'));
        }
        if (opts.kv) {
          for (const pair of opts.kv) {
            const idx = pair.indexOf('=');
            if (idx < 0) throw new Error(`无效 kv 格式: ${pair}`);
            const k = pair.slice(0, idx);
            const v = pair.slice(idx + 1);
            // 尝试 JSON 解析，否则按字符串
            try {
              body[k] = JSON.parse(v);
            } catch {
              body[k] = v;
            }
          }
        }

        if (Object.keys(body).length === 0) {
          throw new Error('请通过 --file 或 --kv 至少传入一个变更');
        }

        const res = await getClient().put('/api/settings', body);
        printResult(res.data);
      } catch (err) {
        throw toCliError(err);
      }
    });

  settings
    .command('test-email')
    .description('测试 SMTP 配置：发送一封测试邮件')
    .requiredOption('--host <host>', 'SMTP 主机')
    .requiredOption('--port <port>', 'SMTP 端口', (v) => parseInt(v, 10))
    .requiredOption('--from <email>', '发件人邮箱')
    .requiredOption('--to <email>', '测试收件邮箱')
    .option('--user <user>', 'SMTP 用户名')
    .option('--password <pwd>', 'SMTP 密码')
    .option('--app-name <name>', '应用名（用于邮件模板）')
    .action(
      async (opts: {
        host: string;
        port: number;
        from: string;
        to: string;
        user?: string;
        password?: string;
        appName?: string;
      }) => {
        try {
          const body = {
            smtpConfig: {
              host: opts.host,
              port: opts.port,
              from: opts.from,
              user: opts.user,
              password: opts.password,
            },
            testEmail: opts.to,
            appName: opts.appName,
          };
          const res = await getClient().post('/api/settings/test-email', body);
          printResult(res.data);
        } catch (err) {
          throw toCliError(err);
        }
      },
    );

  settings
    .command('cache-invalidate')
    .description('清空设置缓存')
    .action(async () => {
      try {
        const res = await getClient().post('/api/settings/cache/invalidate');
        printResult(res.data);
      } catch (err) {
        throw toCliError(err);
      }
    });
}
