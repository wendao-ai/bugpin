import { Command } from 'commander';
import prompts from 'prompts';
import { printError } from './utils/output.ts';

// 简易 REPL：循环读取命令行，调用 commander 解析
export async function startRepl(buildProgram: () => Command): Promise<void> {
  console.log('BugPin CLI · REPL 模式（输入 help 查看命令，exit 退出）');
  console.log('—————————————————————————————————————————————————————');

  while (true) {
    const { line } = await prompts({
      type: 'text',
      name: 'line',
      message: 'bugpin>',
    });

    if (line === undefined) break; // Ctrl+C
    const trimmed = String(line).trim();
    if (!trimmed) continue;
    if (trimmed === 'exit' || trimmed === 'quit') break;
    if (trimmed === 'help') {
      buildProgram().outputHelp();
      continue;
    }

    // 简易 shell-like 分词（按空白，支持双引号包裹）
    const argv = tokenize(trimmed);

    // 每次新建 program 避免 commander 状态污染
    const program = buildProgram();
    program.exitOverride(); // 防止 commander 调 process.exit 终止 REPL

    try {
      await program.parseAsync(['node', 'bugpin-cli', ...argv]);
    } catch (err) {
      // commander 的 CommanderError 也会进这里
      printError(err);
    }
  }

  console.log('再见。');
}

function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let buf = '';
  let inQuote: '"' | "'" | null = null;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i] ?? '';
    if (inQuote) {
      if (ch === inQuote) {
        inQuote = null;
      } else {
        buf += ch;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      inQuote = ch;
      continue;
    }
    if (ch === ' ' || ch === '\t') {
      if (buf) {
        tokens.push(buf);
        buf = '';
      }
      continue;
    }
    buf += ch;
  }
  if (buf) tokens.push(buf);
  return tokens;
}
