-- 状态扩展「已开发」（developed，开发完成未部署），lula 2026-05-28
--
-- SQLite 的 CHECK 约束无法 ALTER，必须重建表。流程：
--   1. 新建 reports_new（CHECK 含 'developed'）
--   2. 复制全部历史数据
--   3. 删除旧表（其上的索引/触发器自动级联删除）
--   4. 重命名 reports_new → reports
--   5. 索引由 initSchema 的 CREATE INDEX IF NOT EXISTS 兜底重建
--   6. FTS5 reports_fts 触发器同样由 initSchema 兜底重建
--   7. 重建 FTS 数据（rowid mismatch 修复）
--
-- 影响面：状态合法值新增 'developed'，原有四个 (open/in_progress/resolved/closed) 不变；
-- 后端 validate.ts 同步扩展 zod enum；前端 StatusBadge / 过滤下拉同步加 SelectItem。

PRAGMA foreign_keys = OFF;

BEGIN TRANSACTION;

CREATE TABLE reports_new (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source TEXT DEFAULT 'widget' NOT NULL CHECK(source IN ('widget', 'manual')),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'open' NOT NULL CHECK(status IN ('open', 'in_progress', 'developed', 'resolved', 'closed')),
  priority TEXT DEFAULT 'medium' NOT NULL CHECK(priority IN ('lowest', 'low', 'medium', 'high', 'highest')),
  annotations JSON,
  metadata JSON NOT NULL,
  reporter_email TEXT,
  reporter_name TEXT,
  assigned_to TEXT REFERENCES users(id) ON DELETE SET NULL,
  custom_fields JSON DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now')) NOT NULL,
  updated_at TEXT DEFAULT (datetime('now')) NOT NULL,
  resolved_at TEXT,
  resolved_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  closed_at TEXT,
  forwarded_to JSON DEFAULT '[]',
  github_sync_status TEXT NULL CHECK(github_sync_status IN ('pending', 'synced', 'error')),
  github_sync_error TEXT NULL,
  github_issue_number INTEGER NULL,
  github_issue_url TEXT NULL,
  github_synced_at TEXT NULL,
  module TEXT,
  type TEXT DEFAULT 'other' NOT NULL CHECK(type IN ('bug', 'feature', 'ux', 'other'))
);

INSERT INTO reports_new (
  id, project_id, source, title, description, status, priority,
  annotations, metadata, reporter_email, reporter_name, assigned_to,
  custom_fields, created_at, updated_at, resolved_at, resolved_by,
  closed_at, forwarded_to, github_sync_status, github_sync_error,
  github_issue_number, github_issue_url, github_synced_at, module, type
)
SELECT
  id, project_id, source, title, description, status, priority,
  annotations, metadata, reporter_email, reporter_name, assigned_to,
  custom_fields, created_at, updated_at, resolved_at, resolved_by,
  closed_at, forwarded_to, github_sync_status, github_sync_error,
  github_issue_number, github_issue_url, github_synced_at, module, type
FROM reports;

DROP TABLE reports;

ALTER TABLE reports_new RENAME TO reports;

COMMIT;

PRAGMA foreign_keys = ON;

-- 索引 / FTS 触发器：由 initSchema() 的 CREATE INDEX IF NOT EXISTS / CREATE TRIGGER IF NOT EXISTS 兜底重建。
-- FTS 数据失效（rowid 变了），rebuild 一次：
INSERT INTO reports_fts(reports_fts) VALUES('rebuild');
