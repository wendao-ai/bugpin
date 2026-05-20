import { describe, expect, test } from 'bun:test';
import { extractSessionCookie } from '../src/client.ts';
import { toCliError, CliError } from '../src/utils/errors.ts';
import type { AxiosResponse } from 'axios';

// 模拟最小 AxiosResponse 用于 cookie 提取测试
function mockResponse(headers: Record<string, string | string[]>): AxiosResponse {
  return {
    data: null,
    status: 200,
    statusText: 'OK',
    headers,
    config: {} as never,
  };
}

describe('extractSessionCookie', () => {
  test('returns null when set-cookie missing', () => {
    expect(extractSessionCookie(mockResponse({}))).toBeNull();
  });

  test('parses session= from single string', () => {
    const res = mockResponse({
      'set-cookie': 'session=abc123; Path=/; HttpOnly',
    });
    expect(extractSessionCookie(res)).toBe('abc123');
  });

  test('parses session= from array of cookies', () => {
    const res = mockResponse({
      'set-cookie': [
        'other=value; Path=/',
        'session=tok_xyz; Path=/; Secure',
      ],
    });
    expect(extractSessionCookie(res)).toBe('tok_xyz');
  });

  test('returns null when no session cookie present', () => {
    const res = mockResponse({
      'set-cookie': ['theme=dark; Path=/'],
    });
    expect(extractSessionCookie(res)).toBeNull();
  });
});

describe('toCliError', () => {
  test('passes CliError through unchanged', () => {
    const original = new CliError('boom', 'CUSTOM', '看日志');
    expect(toCliError(original)).toBe(original);
  });

  test('wraps generic Error', () => {
    const err = toCliError(new Error('foo'));
    expect(err).toBeInstanceOf(CliError);
    expect(err.message).toBe('foo');
    expect(err.code).toBe('CLI_ERROR');
  });

  test('wraps string', () => {
    const err = toCliError('plain string');
    expect(err.message).toBe('plain string');
  });

  test('translates 401 to login hint', () => {
    const axErr = {
      isAxiosError: true,
      response: { status: 401, data: { error: 'UNAUTHORIZED', message: '未登录' } },
      message: 'Request failed',
      config: {},
      toJSON: () => ({}),
      name: 'AxiosError',
    };
    // 让 axios.isAxiosError 识别为 axios 错误
    Object.setPrototypeOf(axErr, Error.prototype);
    (axErr as { isAxiosError: boolean }).isAxiosError = true;

    const err = toCliError(axErr);
    expect(err.code).toBe('UNAUTHORIZED');
    expect(err.hint).toMatch(/bugpin-cli login/);
  });

  test('translates 402 to EE hint', () => {
    const axErr = {
      isAxiosError: true,
      response: { status: 402, data: { error: 'FEATURE_NOT_LICENSED', message: 'EE only' } },
      message: 'Payment Required',
      config: {},
      toJSON: () => ({}),
      name: 'AxiosError',
    };
    Object.setPrototypeOf(axErr, Error.prototype);

    const err = toCliError(axErr);
    expect(err.hint).toMatch(/Enterprise/);
  });

  test('translates network error (no response)', () => {
    const axErr = {
      isAxiosError: true,
      response: undefined,
      message: 'connect ECONNREFUSED',
      code: 'ECONNREFUSED',
      config: {},
      toJSON: () => ({}),
      name: 'AxiosError',
    };
    Object.setPrototypeOf(axErr, Error.prototype);

    const err = toCliError(axErr);
    expect(err.hint).toMatch(/baseURL/);
  });
});
