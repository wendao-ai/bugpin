#!/usr/bin/env bash
# BugPin 工作流：根据路由 path 中的 :id 占位查询 SQLite 挑选可用真实 ID。
#
# 设计原则：
#   表名/过滤条件等"业务知识"集中在这里，避免散落在 SKILL.md 中。
#   新增详情页路由时只改本脚本的 case 分支，其他文件不动。
#
# 用法：
#   ./resolve-route-id.sh "/admin/reports/:id"     # → 输出真实 report id
#
# 依赖（可被 project-config.md 中常量覆盖）：
#   DB_FILE（默认 <repo>/data/bugpin.db）

set -euo pipefail

PROJECT_ROOT="${PROJECT_ROOT:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
DB_FILE="${DB_FILE:-$PROJECT_ROOT/data/bugpin.db}"

path="${1:-}"
if [ -z "$path" ]; then
  echo "用法: $0 <路由 path（含 :id）>" >&2
  exit 2
fi

if [ ! -f "$DB_FILE" ]; then
  echo "" >&2
  echo "⚠️ 数据库文件不存在：$DB_FILE（先启动 server 让其自动创建，或跑过迁移）" >&2
  exit 0
fi

q() {
  sqlite3 "$DB_FILE" "$1" | tr -d '[:space:]'
}

case "$path" in
  */reports/:id | */admin/reports/:id)
    q "SELECT id FROM reports WHERE status IN ('open','in_progress') ORDER BY created_at DESC LIMIT 1" ;;
  */projects/:id | */admin/projects/:id)
    q "SELECT id FROM projects ORDER BY created_at DESC LIMIT 1" ;;
  */users/:id | */admin/users/:id)
    q "SELECT id FROM users ORDER BY created_at DESC LIMIT 1" ;;
  */invitations/:id)
    q "SELECT id FROM invitations WHERE accepted_at IS NULL ORDER BY created_at DESC LIMIT 1" 2>/dev/null || echo "" ;;
  *)
    echo "" ;;
esac
