-- 加 AI 分析字段（lula 2026-06-03）
-- 存 PM 触发 / 完成的分析 + PM 反馈。结构是 JSON，schema 见 shared/types.ts AiAnalysisRecord.
-- 同时支持 fresh init + 老库 ALTER 兜底（由 initSchema 加列，本 migration 仅做索引 + 兜底校验）

CREATE INDEX IF NOT EXISTS idx_reports_ai_status ON reports(
  json_extract(ai_analysis, '$.status')
) WHERE ai_analysis IS NOT NULL;
