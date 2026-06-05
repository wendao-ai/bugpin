/**
 * AI 分析服务（lula 2026-06-05 v1.0.30 重写）
 *
 * 设计变化（vs v1.0.29）：
 * - 不再裸调 GLM /chat/completions，改用 @anthropic-ai/claude-agent-sdk
 *   该 SDK 是 Claude Code CLI 的核心库，自带 Read/Grep/Glob/Bash 工具集
 * - GLM 通过 Anthropic 兼容 endpoint（api.z.ai/api/anthropic）作为模型后端
 * - cwd 指向 /lims-source（容器内 volume mount 的 LIMS 源码 read-only 挂载点）
 * - GLM 主动用 Read/Grep 工具读 LIMS 代码 → 给出代码级实锤分析（不是浅 triage）
 * - settingSources: [] 关键，绕过本机/容器 OAuth 冲突
 *
 * 失败兜底：
 * - LIMS 源码目录不存在（如本地 dev 没 mount）→ 自动降级 cwd 到 /tmp，纯文本分析
 * - SDK 调用失败 → ai_analysis.status = 'failed' + error 写库
 *
 * 成本：每次分析约 ¥0.1-0.2（GLM-4.6 token 计费，跟 SDK 注入的 system prompt 一起算）
 */

import { promises as fs } from 'node:fs';
import { reportsRepo } from '../database/repositories/reports.repo.js';
import { settingsRepo } from '../database/repositories/settings.repo.js';
import { Result } from '../utils/result.js';
import { logger } from '../utils/logger.js';
import type {
  AiAnalysisRecord,
  AiAnalysisContent,
  AiAnalysisFeedback,
  Report,
} from '@shared/types';

const RESPONSE_SCHEMA_HINT = `
请严格按照以下 JSON schema 回复，**最后只输出一个合法 JSON 对象**（不要 markdown 包装）：
{
  "understanding": "用 1-2 句产品语言复述用户的诉求",
  "rootCause": {
    "summary": "实锤根因——用 Read/Grep 工具看了代码后定位的具体问题",
    "files": [
      { "path": "相对 cwd 的代码文件路径", "lineHint": "行号或行号范围（可选）", "why": "为什么这个文件相关" }
    ]
  },
  "fixPlan": {
    "approach": "修复方向概述",
    "changes": [
      { "file": "要改的文件路径", "change": "改什么" }
    ]
  },
  "recommendedMeta": {
    "priority": "lowest | low | medium | high | highest（可选）",
    "type": "bug | feature | ux | other（可选）",
    "module": "推荐的一级模块名（可选）"
  },
  "decisionsNeeded": [
    {
      "id": "kebab-case-唯一-id",
      "question": "**只问 PM 能决策的产品 / 体验问题**（如「保留旧行为兜底吗？」「给所有用户还是仅 admin？」），不要问技术细节",
      "options": [
        { "id": "选项id", "label": "选项描述", "recommended": true }
      ],
      "help": "可选的辅助说明"
    }
  ],
  "impact": {
    "affected": ["可能受影响的功能列表"],
    "testHints": ["建议 PM 验收时关注的场景"]
  },
  "notes": "其他备注（可选）"
}

**重要约束**：
- decisionsNeeded 最多 3 个，**只问产品决策**（PM 能拍板的）
- rootCause 必须有真实文件路径 + 行号（你已经用 Read/Grep 看过代码）
- 不要给开发任务清单——只描述要改什么，怎么改是下一步 Claude Code 的事
- 最终回复**必须是合法 JSON**（不要 markdown 代码块包装）
`;

export interface TriggerAnalysisOptions {
  reportId: string;
  triggeredBy: string;
}

export interface ApplyFeedbackOptions {
  reportId: string;
  decisionId: string;
  choice: string;
  note?: string;
  answeredBy: string;
}

// LIMS 源码 mount 路径（容器内）。若不存在则降级到无源码分析模式。
const LIMS_SOURCE_DIR = process.env.LIMS_SOURCE_DIR ?? '/lims-source';

function buildPrompt(report: Report, hasLimsSource: boolean): string {
  const metadata = report.metadata;
  const consoleErrors = (metadata.consoleErrors ?? []).slice(0, 10);
  const networkErrors = (metadata.networkErrors ?? []).slice(0, 5);
  const codeAccessHint = hasLimsSource
    ? `**你可以用 Read / Grep / Glob 工具查看 LIMS 源码**（cwd 是 ${LIMS_SOURCE_DIR}）。
请：
1. 根据 URL 和反馈描述定位涉及的代码文件（如 \`jeecgboot-vue3/src/views/...\`、\`jeecg-boot-module/.../controller/...\`）
2. 用 Read 读关键文件，给出**实锤的代码根因**（含文件路径 + 行号）
3. 提出修复方案`
    : `⚠️ 当前环境没有 LIMS 源码可访问（cwd 不是 LIMS 仓库）。只能基于反馈文本做方向性分析，不要编造文件路径。`;

  return [
    `# 反馈报告 ${report.seq ? `MIGE-${report.seq}` : report.id}`,
    `**类型** ${report.type}  |  **优先级** ${report.priority}  |  **状态** ${report.status}`,
    `**反馈人** ${report.reporterName ?? '未填'}（${report.reporterEmail ?? '无邮箱'}）`,
    ``,
    `## 问题描述`,
    report.title || '(无标题)',
    report.description ? `\n${report.description}` : '',
    ``,
    `## 页面上下文`,
    `- URL: ${metadata.url ?? '未提供'}`,
    `- 页面 title: ${metadata.title ?? '未提供'}`,
    `- 一级模块（自动推断）: ${report.module ?? '未分类'}`,
    `- 浏览器: ${metadata.browser?.name ?? '?'} ${metadata.browser?.version ?? ''}`,
    `- 设备: ${metadata.device?.type ?? '?'} / ${metadata.device?.os ?? '?'}`,
    ``,
    consoleErrors.length > 0
      ? `## Console 错误（最多 10 条）\n${consoleErrors
          .map((e) => `- [${e.type}] ${e.message}`)
          .join('\n')}`
      : '',
    networkErrors.length > 0
      ? `## 网络错误（最多 5 条）\n${networkErrors
          .map(
            (e) => `- ${e.method} ${e.url} → ${e.status} ${e.statusText}`,
          )
          .join('\n')}`
      : '',
    ``,
    `---`,
    `你是米格 LIMS 项目产品经理的 AI 分析助手。`,
    codeAccessHint,
    ``,
    `用中文输出。最终只输出一个合法 JSON 对象（schema 见下方）：`,
    ``,
    RESPONSE_SCHEMA_HINT,
  ].join('\n');
}

function parseAiJsonResponse(text: string): AiAnalysisContent | null {
  // 模型偶尔会用 ```json ... ``` 包装，或在 JSON 前后多输出说明文字
  const trimmed = text.trim();
  // 优先剥离 markdown 包装
  let candidate = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  // 兜底：如果还不是 JSON 开头，尝试从第一个 `{` 截到最后一个 `}`
  if (!candidate.startsWith('{')) {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start >= 0 && end > start) {
      candidate = candidate.slice(start, end + 1);
    }
  }
  try {
    const parsed = JSON.parse(candidate) as AiAnalysisContent;
    return parsed;
  } catch (error) {
    logger.warn('Failed to parse AI JSON response', {
      error: String(error),
      sample: candidate.slice(0, 200),
    });
    return null;
  }
}

/**
 * 调 Claude Agent SDK（后端走 GLM 兼容 endpoint）跑深度分析。
 * SDK 自带 Read/Grep/Glob/Bash 工具，GLM-4.6 会主动用工具读 LIMS 源码。
 */
async function callClaudeAgentSdk(
  baseUrl: string,
  authToken: string,
  model: string,
  prompt: string,
  cwd: string,
): Promise<Result<string>> {
  try {
    // 动态 import，让模块不在生产模式下被强引（dev 时若没装 SDK 不会启动失败）
    const { query } = await import('@anthropic-ai/claude-agent-sdk');

    // 干净 env：只保留必需变量 + 注入 GLM 凭证；不带 process.env 其他污染
    const cleanEnv: Record<string, string> = {
      PATH: process.env.PATH ?? '/usr/local/bin:/usr/bin:/bin',
      HOME: process.env.HOME ?? '/tmp',
      TMPDIR: process.env.TMPDIR ?? '/tmp',
      ANTHROPIC_BASE_URL: baseUrl,
      ANTHROPIC_AUTH_TOKEN: authToken,
    };

    const result = query({
      prompt,
      options: {
        model,
        cwd,
        permissionMode: 'bypassPermissions',
        allowedTools: ['Read', 'Grep', 'Glob', 'Bash'],
        // 关键：跳过本机 ~/.claude settings + OAuth，避免与 GLM 凭证冲突
        settingSources: [],
        env: cleanEnv,
        maxTurns: 20,
      },
    });

    let finalText = '';
    let toolCalls = 0;
    let inputTokens = 0;
    let outputTokens = 0;
    let durationMs = 0;
    let sdkError: string | null = null;

    for await (const message of result) {
      if (message.type === 'assistant') {
        // SDK 类型定义复杂，用 unknown 中转 + 运行时检查
        const content = (message as unknown as {
          message?: { content?: unknown[] };
        }).message?.content;
        for (const block of content ?? []) {
          const b = block as { type?: string; text?: string };
          if (b.type === 'text') {
            finalText += b.text ?? '';
          } else if (b.type === 'tool_use') {
            toolCalls += 1;
          }
        }
      } else if (message.type === 'result') {
        const r = message as {
          duration_ms?: number;
          is_error?: boolean;
          subtype?: string;
          usage?: { input_tokens?: number; output_tokens?: number };
        };
        durationMs = r.duration_ms ?? 0;
        inputTokens = r.usage?.input_tokens ?? 0;
        outputTokens = r.usage?.output_tokens ?? 0;
        if (r.is_error) {
          sdkError = `SDK error subtype: ${r.subtype ?? 'unknown'}`;
        }
      }
    }

    logger.info('Claude Agent SDK call finished', {
      durationMs,
      inputTokens,
      outputTokens,
      toolCalls,
      cwd,
    });

    if (sdkError) {
      return Result.fail(sdkError, 'AI_API_ERROR');
    }
    if (!finalText) {
      return Result.fail('SDK 返回为空', 'AI_EMPTY_RESPONSE');
    }
    return Result.ok(finalText);
  } catch (error) {
    return Result.fail(`SDK 调用失败: ${String(error)}`, 'AI_CALL_FAILED');
  }
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export const aiAnalysisService = {
  /**
   * 触发一次分析（同步等待 GLM 返回 → 写入 ai_analysis）。
   * 返回的 Report 已包含最新 ai_analysis。
   */
  async triggerAnalysis(options: TriggerAnalysisOptions): Promise<Result<AiAnalysisRecord>> {
    const { reportId, triggeredBy } = options;

    const report = await reportsRepo.findById(reportId);
    if (!report) return Result.fail('Report not found', 'NOT_FOUND');

    const settings = await settingsRepo.getAll();
    if (!settings.aiEnabled) {
      return Result.fail('AI 分析未在设置中启用', 'AI_DISABLED');
    }
    if (!settings.aiApiKey) {
      return Result.fail('AI API Key 未配置', 'AI_NO_KEY');
    }

    const existing = (report.aiAnalysis ?? null) as AiAnalysisRecord | null;
    const nextVersion = (existing?.version ?? 0) + 1;
    const now = new Date().toISOString();

    // 检查 LIMS 源码目录是否 mount 进来（决定 cwd + prompt 模式）
    const hasLimsSource = await pathExists(LIMS_SOURCE_DIR);
    const cwd = hasLimsSource ? LIMS_SOURCE_DIR : (process.env.TMPDIR ?? '/tmp');
    const model = settings.aiModel ?? 'glm-4.6';

    // 先写一个 analyzing 状态（让前端轮询能看到进度）
    const analyzingRecord: AiAnalysisRecord = {
      status: 'analyzing',
      version: nextVersion,
      requestedAt: now,
      triggeredBy,
      model,
      feedback: existing?.feedback ?? [],
    };
    await reportsRepo.updateAiAnalysis(reportId, analyzingRecord);

    // 调 Claude Agent SDK（GLM 后端）跑深度分析
    const prompt = buildPrompt(report, hasLimsSource);
    const sdkRes = await callClaudeAgentSdk(
      // 默认走 GLM 的 Anthropic 兼容 endpoint
      settings.aiBaseUrl ?? 'https://api.z.ai/api/anthropic',
      settings.aiApiKey,
      model,
      prompt,
      cwd,
    );

    if (!sdkRes.success) {
      const failedRecord: AiAnalysisRecord = {
        ...analyzingRecord,
        status: 'failed',
        error: sdkRes.error,
      };
      await reportsRepo.updateAiAnalysis(reportId, failedRecord);
      logger.error('AI analysis failed', { reportId, error: sdkRes.error });
      return Result.fail(sdkRes.error, sdkRes.code);
    }

    const content = parseAiJsonResponse(sdkRes.value);
    if (!content) {
      const failedRecord: AiAnalysisRecord = {
        ...analyzingRecord,
        status: 'failed',
        error: 'AI 返回不是合法 JSON',
      };
      await reportsRepo.updateAiAnalysis(reportId, failedRecord);
      return Result.fail('AI 返回不是合法 JSON', 'AI_PARSE_ERROR');
    }

    const doneRecord: AiAnalysisRecord = {
      ...analyzingRecord,
      status:
        content.decisionsNeeded && content.decisionsNeeded.length > 0
          ? 'awaiting_feedback'
          : 'confirmed',
      analyzedAt: new Date().toISOString(),
      content,
    };
    await reportsRepo.updateAiAnalysis(reportId, doneRecord);

    logger.info('AI analysis completed', {
      reportId,
      version: nextVersion,
      decisionsCount: content.decisionsNeeded?.length ?? 0,
    });

    return Result.ok(doneRecord);
  },

  /**
   * PM 对 decision 做了回答 —— 写入 feedback，若所有 decisions 都答完则进入 confirmed
   */
  async applyFeedback(options: ApplyFeedbackOptions): Promise<Result<AiAnalysisRecord>> {
    const { reportId, decisionId, choice, note, answeredBy } = options;

    const report = await reportsRepo.findById(reportId);
    if (!report) return Result.fail('Report not found', 'NOT_FOUND');
    const existing = (report.aiAnalysis ?? null) as AiAnalysisRecord | null;
    if (!existing?.content) {
      return Result.fail('该 report 没有分析记录', 'AI_NO_ANALYSIS');
    }

    const newFeedback: AiAnalysisFeedback = {
      decisionId,
      choice,
      note,
      answeredAt: new Date().toISOString(),
      answeredBy,
    };
    const otherFeedback = (existing.feedback ?? []).filter(
      (f) => f.decisionId !== decisionId,
    );
    const feedback = [...otherFeedback, newFeedback];

    // 所有 decisionsNeeded 都有答案 → confirmed
    const totalDecisions = existing.content.decisionsNeeded?.length ?? 0;
    const answeredIds = new Set(feedback.map((f) => f.decisionId));
    const allAnswered = (existing.content.decisionsNeeded ?? []).every((d) =>
      answeredIds.has(d.id),
    );

    const updated: AiAnalysisRecord = {
      ...existing,
      feedback,
      status: totalDecisions > 0 && allAnswered ? 'confirmed' : existing.status,
      confirmedAt:
        totalDecisions > 0 && allAnswered
          ? new Date().toISOString()
          : existing.confirmedAt,
    };
    await reportsRepo.updateAiAnalysis(reportId, updated);

    return Result.ok(updated);
  },

  /**
   * PM 主动确认分析（即使还有未答问题也强制 confirmed）
   */
  async confirm(reportId: string, _confirmedBy: string): Promise<Result<AiAnalysisRecord>> {
    const report = await reportsRepo.findById(reportId);
    if (!report) return Result.fail('Report not found', 'NOT_FOUND');
    const existing = (report.aiAnalysis ?? null) as AiAnalysisRecord | null;
    if (!existing?.content) {
      return Result.fail('该 report 没有分析记录', 'AI_NO_ANALYSIS');
    }
    const updated: AiAnalysisRecord = {
      ...existing,
      status: 'confirmed',
      confirmedAt: new Date().toISOString(),
    };
    await reportsRepo.updateAiAnalysis(reportId, updated);
    return Result.ok(updated);
  },
};
