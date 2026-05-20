import { Command } from 'commander';
import prompts from 'prompts';
import { getClient, extractSessionCookie, persistSession } from '../client.ts';
import { clearSession, loadConfig } from '../config.ts';
import { printResult } from '../utils/output.ts';
import { toCliError } from '../utils/errors.ts';

// 直接 fetch 走 axios 但跳过单例（登录前还没 cookie，单例已经 OK，这里只是显式）
async function doLogin(email: string, password: string): Promise<unknown> {
  const client = getClient();
  const res = await client.post('/api/auth/login', { email, password });
  const cookie = extractSessionCookie(res);
  if (!cookie) {
    throw new Error('登录成功但服务端未返回 session cookie');
  }
  persistSession(cookie, email);
  return res.data;
}

export function registerAuth(program: Command): void {
  const auth = program.command('auth').description('认证相关：登录/登出/查看身份');

  auth
    .command('login')
    .description('登录并把 session cookie 持久化到 ~/.bugpin/config.json')
    .option('-e, --email <email>', '管理员邮箱')
    .option('-p, --password <password>', '密码（不传则交互式输入）')
    .action(async (opts: { email?: string; password?: string }) => {
      try {
        let { email, password } = opts;

        if (!email || !password) {
          const answers = await prompts([
            {
              type: email ? null : 'text',
              name: 'email',
              message: '邮箱',
              validate: (v: string) => (v.includes('@') ? true : '请输入合法邮箱'),
            },
            {
              type: password ? null : 'password',
              name: 'password',
              message: '密码',
            },
          ]);
          email = email || answers.email;
          password = password || answers.password;
        }

        if (!email || !password) throw new Error('邮箱或密码为空');

        const data = await doLogin(email, password);
        printResult(data);
      } catch (err) {
        throw toCliError(err);
      }
    });

  auth
    .command('logout')
    .description('登出并清除本地 session')
    .action(async () => {
      try {
        const client = getClient();
        await client.post('/api/auth/logout').catch(() => {
          // 即使服务端 401 也清除本地
        });
        clearSession();
        printResult({ success: true, message: '本地 session 已清除' });
      } catch (err) {
        throw toCliError(err);
      }
    });

  auth
    .command('whoami')
    .description('查看当前登录身份')
    .action(async () => {
      try {
        const client = getClient();
        const res = await client.get('/api/auth/me');
        printResult(res.data);
      } catch (err) {
        throw toCliError(err);
      }
    });

  auth
    .command('change-password')
    .description('修改密码')
    .option('-c, --current <pwd>', '当前密码')
    .option('-n, --new <pwd>', '新密码')
    .action(async (opts: { current?: string; new?: string }) => {
      try {
        let currentPassword = opts.current;
        let newPassword = opts.new;
        if (!currentPassword || !newPassword) {
          const answers = await prompts([
            { type: currentPassword ? null : 'password', name: 'current', message: '当前密码' },
            { type: newPassword ? null : 'password', name: 'new', message: '新密码' },
          ]);
          currentPassword = currentPassword || answers.current;
          newPassword = newPassword || answers.new;
        }
        const client = getClient();
        const res = await client.post('/api/auth/change-password', { currentPassword, newPassword });
        printResult(res.data);
      } catch (err) {
        throw toCliError(err);
      }
    });

  auth
    .command('config')
    .description('查看当前配置（baseURL / 登录态）')
    .action(() => {
      const cfg = loadConfig();
      printResult({
        baseURL: cfg.baseURL,
        loggedIn: !!cfg.sessionCookie,
        email: cfg.email,
      });
    });
}
