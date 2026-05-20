#!/usr/bin/env bun
import { Command } from 'commander';
import { registerAuth } from './commands/auth.ts';
import { registerReports } from './commands/reports.ts';
import { registerProjects } from './commands/projects.ts';
import { registerUsers } from './commands/users.ts';
import { registerSettings } from './commands/settings.ts';
import { registerBranding } from './commands/branding.ts';
import { registerConfig } from './commands/config.ts';
import { setJsonMode, printError } from './utils/output.ts';
import { startRepl } from './repl.ts';
import { toCliError } from './utils/errors.ts';

const VERSION = '1.0.14';

function buildProgram(): Command {
  const program = new Command();

  program
    .name('bugpin-cli')
    .description('BugPin 管理端 CLI（自托管 Bug 上报系统）')
    .version(VERSION)
    .option('--json', '以 JSON 输出结果（脚本友好）', false)
    .hook('preAction', (thisCommand) => {
      const opts = thisCommand.optsWithGlobals();
      setJsonMode(Boolean(opts.json));
    });

  registerAuth(program);
  registerReports(program);
  registerProjects(program);
  registerUsers(program);
  registerSettings(program);
  registerBranding(program);
  registerConfig(program);

  return program;
}

async function main(): Promise<void> {
  // 无参数时进入 REPL
  const argv = process.argv.slice(2);
  const onlyGlobal = argv.length === 0 || argv.every((a) => a === '--json');

  if (onlyGlobal) {
    setJsonMode(argv.includes('--json'));
    await startRepl(buildProgram);
    return;
  }

  const program = buildProgram();
  try {
    await program.parseAsync(process.argv);
  } catch (err) {
    printError(toCliError(err));
    process.exit(1);
  }
}

main();
