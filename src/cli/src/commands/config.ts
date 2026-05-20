import { Command } from 'commander';
import {
  loadConfig,
  saveConfig,
  clearSession,
  getConfigPath,
  DEFAULT_BASE_URL,
} from '../config.ts';
import { printResult } from '../utils/output.ts';
import { toCliError, CliError } from '../utils/errors.ts';

export function registerConfig(program: Command): void {
  const cfg = program
    .command('config')
    .description('CLI 本地配置：服务端 URL、会话状态、配置文件路径');

  cfg
    .command('show')
    .description('显示当前 CLI 配置（不调用网络）')
    .action(() => {
      const c = loadConfig();
      printResult({
        baseURL: c.baseURL,
        loggedIn: !!c.sessionCookie,
        email: c.email,
        configPath: getConfigPath(),
      });
    });

  cfg
    .command('set-url <url>')
    .description('设置 BugPin 服务端 URL，写入 ~/.bugpin/config.json')
    .action((url: string) => {
      try {
        let parsed: URL;
        try {
          parsed = new URL(url);
        } catch {
          throw new CliError(`无效 URL：${url}`, 'INVALID_URL', '示例：https://bugpin.example.com');
        }
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          throw new CliError(`仅支持 http/https：${url}`, 'INVALID_URL');
        }
        // 去尾部斜杠，规整存储（client.ts 运行时也会去，这里冗余但更清晰）
        const normalized = url.replace(/\/+$/, '');
        const saved = saveConfig({ baseURL: normalized });
        printResult({ baseURL: saved.baseURL, configPath: getConfigPath() });
      } catch (err) {
        throw toCliError(err);
      }
    });

  cfg
    .command('reset')
    .description(`重置配置（baseURL 回 ${DEFAULT_BASE_URL}，同时清除登录态）`)
    .option('--keep-session', '保留登录态，仅重置 baseURL', false)
    .action((opts: { keepSession: boolean }) => {
      try {
        if (!opts.keepSession) {
          clearSession();
        }
        saveConfig({ baseURL: DEFAULT_BASE_URL });
        const c = loadConfig();
        printResult({
          baseURL: c.baseURL,
          loggedIn: !!c.sessionCookie,
          configPath: getConfigPath(),
        });
      } catch (err) {
        throw toCliError(err);
      }
    });
}
