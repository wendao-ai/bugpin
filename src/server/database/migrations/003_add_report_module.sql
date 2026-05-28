-- 反馈模块字段（F1，2026-05-26）
-- module 由后端在 widget 提交时根据项目的 moduleRules 推导（page_url substring 匹配），
-- 历史数据 module 留空，admin 列表显示「未分类」。
-- nullable: 不阻断历史数据 + 不阻断没配规则的项目继续接反馈。
--
-- 注意：module 列由 initSchema() 通过 try-catch ALTER 兜底（既覆盖 fresh init 又覆盖老库），
-- 这里只做支持工作（建索引）。SQLite 不支持 ALTER ... ADD COLUMN IF NOT EXISTS，
-- 重复 ALTER 会抛 duplicate column name 错误，所以这条 migration 不能再 ALTER。

CREATE INDEX IF NOT EXISTS idx_reports_module ON reports(module);
