-- 反馈类型字段（F2，2026-05-26）
-- 用户提交反馈时必选：bug 报告 / 功能建议 / 体验优化 / 其他。
-- 历史数据 backfill 默认 'other'（其他）。
--
-- 注意：type 列由 initSchema() 通过 try-catch ALTER 兜底（既覆盖 fresh init 又覆盖老库），
-- 这里只做 backfill 和建索引。SQLite 不支持 ALTER ... ADD COLUMN IF NOT EXISTS。

UPDATE reports SET type = 'other' WHERE type IS NULL;

CREATE INDEX IF NOT EXISTS idx_reports_type ON reports(type);
