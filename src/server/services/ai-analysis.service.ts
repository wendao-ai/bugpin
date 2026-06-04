/**
 * AI 分析服务（lula 2026-06-03）
 *
 * 设计：
 * - 调 GLM-4-plus 的 OpenAI-compatible chat completions 接口
 *   POST {aiBaseUrl}/chat/completions
 *   Authorization: Bearer {aiApiKey}
 * - 把 report 文本 + 截图 URL（注：GLM-4V 才支持多模态，glm-4-plus 是纯文本）
 *   拼成中文 prompt，让模型按固定 JSON schema 返回
 * - 解析 JSON → 写入 reports.ai_analysis 字段
 *
 * 浅分析（无 code-access）：GLM 看不到代码，所以只能给：
 *   - 问题理解（复述）
 *   - 推荐 priority / type / module
 *   - 0-3 个产品决策问题给 PM 拍板
 *   - 影响面 / 测试要点的概念性建议
 * 不给「实锤代码根因」——那需要 Claude Code session 跑深度分析。
 */

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
请严格按照以下 JSON schema 回复，不要任何 markdown 包装：
{
  "understanding": "用一两句产品语言复述用户的诉求",
  "rootCause": {
    "summary": "你对问题可能根因的概念性判断（注意：你无法看代码，只能基于现有信息给方向性判断）"
  },
  "recommendedMeta": {
    "priority": "lowest | low | medium | high | highest（可选）",
    "type": "bug | feature | ux | other（可选）",
    "module": "推荐的一级模块名（可选）"
  },
  "decisionsNeeded": [
    {
      "id": "kebab-case-唯一-id",
      "question": "需要 PM 拍板的产品决策问题（不要问技术细节）",
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
- decisionsNeeded 最多 3 个，且只问 PM 能决策的产品 / 体验问题
- 不要列「可能根因 1 / 2 / 3」这种推测——给方向就好
- 不要给开发任务清单——那是 Claude Code session 的工作
- 回复必须是合法 JSON
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

interface GlmChoice {
  message?: { content?: string };
}
interface GlmResponse {
  choices?: GlmChoice[];
  error?: { message: string };
}

function buildPrompt(report: Report): string {
  const metadata = report.metadata;
  const consoleErrors = (metadata.consoleErrors ?? []).slice(0, 10);
  const networkErrors = (metadata.networkErrors ?? []).slice(0, 5);
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
    `你是产品经理的 AI 助手。请基于以上信息做**浅层 triage 分析**，注意：`,
    `- 你**没有访问代码**的能力，所以不要给具体代码层根因。`,
    `- 你的输出会展示给 PM，再由 PM 拍板，再交给 Claude Code 做深度实现。`,
    `- 用中文回答。`,
    ``,
    RESPONSE_SCHEMA_HINT,
  ].join('\n');
}

function parseGlmJsonResponse(text: string): AiAnalysisContent | null {
  // GLM 偶尔会 ```json ... ``` 包装
  const trimmed = text.trim();
  const stripped = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  try {
    const parsed = JSON.parse(stripped) as AiAnalysisContent;
    return parsed;
  } catch (error) {
    logger.warn('Failed to parse GLM JSON response', {
      error: String(error),
      sample: stripped.slice(0, 200),
    });
    return null;
  }
}

async function callGlm(
  baseUrl: string,
  apiKey: string,
  model: string,
  prompt: string,
): Promise<Result<string>> {
  const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
  const body = {
    model,
    messages: [
      { role: 'system', content: '你是产品经理的 AI 助手，严格按要求的 JSON schema 返回。' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.3,
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as GlmResponse;
    if (!res.ok) {
      const msg = json.error?.message ?? `HTTP ${res.status}`;
      return Result.fail(msg, 'AI_API_ERROR');
    }
    const text = json.choices?.[0]?.message?.content;
    if (!text) {
      return Result.fail('GLM 返回为空', 'AI_EMPTY_RESPONSE');
    }
    return Result.ok(text);
  } catch (error) {
    return Result.fail(`调用 GLM 失败: ${String(error)}`, 'AI_CALL_FAILED');
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

    // 先写一个 analyzing 状态（让前端轮询能看到进度）
    const analyzingRecord: AiAnalysisRecord = {
      status: 'analyzing',
      version: nextVersion,
      requestedAt: now,
      triggeredBy,
      model: settings.aiModel ?? 'glm-4-plus',
      feedback: existing?.feedback ?? [],
    };
    await reportsRepo.updateAiAnalysis(reportId, analyzingRecord);

    // 同步调 GLM（最差也就 30s，可接受）
    const prompt = buildPrompt(report);
    const glmRes = await callGlm(
      settings.aiBaseUrl ?? 'https://open.bigmodel.cn/api/paas/v4',
      settings.aiApiKey,
      settings.aiModel ?? 'glm-4-plus',
      prompt,
    );

    if (!glmRes.success) {
      const failedRecord: AiAnalysisRecord = {
        ...analyzingRecord,
        status: 'failed',
        error: glmRes.error,
      };
      await reportsRepo.updateAiAnalysis(reportId, failedRecord);
      logger.error('AI analysis failed', { reportId, error: glmRes.error });
      return Result.fail(glmRes.error, glmRes.code);
    }

    const content = parseGlmJsonResponse(glmRes.value);
    if (!content) {
      const failedRecord: AiAnalysisRecord = {
        ...analyzingRecord,
        status: 'failed',
        error: 'GLM 返回不是合法 JSON',
      };
      await reportsRepo.updateAiAnalysis(reportId, failedRecord);
      return Result.fail('GLM 返回不是合法 JSON', 'AI_PARSE_ERROR');
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
