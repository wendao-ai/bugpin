import axios, { AxiosError } from 'axios';

// CLI 层的统一错误类型
export class CliError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'CLI_ERROR',
    public readonly hint?: string,
  ) {
    super(message);
    this.name = 'CliError';
  }
}

interface ApiErrorBody {
  success?: boolean;
  error?: string;
  message?: string;
  details?: unknown;
}

// 把 axios 错误统一翻译为 CliError，附带可操作提示
export function toCliError(err: unknown): CliError {
  if (err instanceof CliError) return err;

  if (axios.isAxiosError(err)) {
    const axErr = err as AxiosError<ApiErrorBody>;
    const status = axErr.response?.status;
    const body = axErr.response?.data;
    const code = body?.error || axErr.code || 'HTTP_ERROR';
    const message = body?.message || axErr.message || '请求失败';

    let hint: string | undefined;
    if (status === 401) {
      hint = '会话已过期或未登录。请运行：bugpin-cli login';
    } else if (status === 403) {
      hint = '权限不足。该端点需要管理员或编辑者角色。';
    } else if (status === 402) {
      hint = '该功能需要 Enterprise 许可证（EE），当前 CE 版本不支持。';
    } else if (!axErr.response) {
      hint = `无法连接到服务端。检查 baseURL 是否正确（运行 bugpin-cli config show）。`;
    }

    return new CliError(message, code, hint);
  }

  if (err instanceof Error) {
    return new CliError(err.message);
  }

  return new CliError(String(err));
}
