import { Command } from 'commander';
import { getClient } from '../client.ts';
import { printResult } from '../utils/output.ts';
import { toCliError } from '../utils/errors.ts';

export function registerBranding(program: Command): void {
  const branding = program.command('branding').description('品牌设置（CE 版仅 widget 主色）');

  branding
    .command('config')
    .description('查看品牌配置（公开）')
    .action(async () => {
      try {
        const res = await getClient().get('/api/branding/config');
        printResult(res.data);
      } catch (err) {
        throw toCliError(err);
      }
    });

  branding
    .command('set-widget-colors')
    .description('更新 widget 主色（admin）')
    .requiredOption('--colors <json>', 'JSON 字符串，如 \'{"primary":"#FF0000"}\'')
    .action(async (opts: { colors: string }) => {
      try {
        const body = JSON.parse(opts.colors);
        const res = await getClient().put('/api/branding/widget-primary-colors', body);
        printResult(res.data);
      } catch (err) {
        throw toCliError(err);
      }
    });
}
