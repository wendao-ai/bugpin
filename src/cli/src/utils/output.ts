import { CliError } from './errors.ts';

// 全局 --json 开关，由顶层 commander preAction 设置
let jsonMode = false;

export function setJsonMode(on: boolean): void {
  jsonMode = on;
}

export function isJsonMode(): boolean {
  return jsonMode;
}

// 成功输出
export function printResult(data: unknown): void {
  if (jsonMode) {
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  // 表格友好输出
  if (Array.isArray(data)) {
    if (data.length === 0) {
      console.log('(空列表)');
      return;
    }
    if (typeof data[0] === 'object' && data[0] !== null) {
      console.table(data);
      return;
    }
    console.log(data.join('\n'));
    return;
  }

  if (typeof data === 'object' && data !== null) {
    // 单条对象：分行打印
    for (const [k, v] of Object.entries(data)) {
      const formatted = typeof v === 'object' ? JSON.stringify(v) : String(v);
      console.log(`${k.padEnd(20)} ${formatted}`);
    }
    return;
  }

  console.log(String(data));
}

// 列表渲染：JSON 模式输出原始响应，否则提取关键列以表格展示
export function printList<T>(
  raw: unknown,
  options: {
    items: (raw: unknown) => T[];
    columns: (item: T) => Record<string, unknown>;
    summary?: (raw: unknown, rows: T[]) => string;
  },
): void {
  if (jsonMode) {
    printResult(raw);
    return;
  }
  const items = options.items(raw);
  if (options.summary) console.log(options.summary(raw, items));
  if (items.length === 0) {
    console.log('(空列表)');
    return;
  }
  console.table(items.map(options.columns));
}

// 安全截取字符串前 N 字符
export function trunc(v: unknown, n: number): string {
  if (typeof v !== 'string') return v === undefined || v === null ? '-' : String(v);
  return v.length > n ? v.slice(0, n) : v;
}

// 错误输出，根据模式决定格式
export function printError(err: unknown): void {
  const cliErr =
    err instanceof CliError
      ? err
      : new CliError(err instanceof Error ? err.message : String(err));

  if (jsonMode) {
    console.error(
      JSON.stringify(
        {
          success: false,
          error: cliErr.code,
          message: cliErr.message,
          hint: cliErr.hint,
        },
        null,
        2,
      ),
    );
    return;
  }

  console.error(`错误 [${cliErr.code}]: ${cliErr.message}`);
  if (cliErr.hint) console.error(`提示: ${cliErr.hint}`);
}
