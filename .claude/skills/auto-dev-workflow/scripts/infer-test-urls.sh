#!/usr/bin/env bash
# BugPin 工作流：根据改动文件列表反查路由表（React Router @ src/admin/App.tsx），
# 推断浏览器测试 URL。
#
# 设计原则：
#   admin 路由真相源是 src/admin/App.tsx；pages/<X>.tsx 文件名约定大写驼峰，
#   通过文件名→Route element 名→Route path 反查。
#   widget 改动统一指向 /test-widget。
#   后端 routes/api/<x>.ts 模糊匹配同名 admin 页面。
#
# 输入：改动文件路径列表（换行分隔），从 stdin 或第一个参数。
# 输出：去重后的候选 URL 列表（每行一个）。
#       未命中时回退 /admin/ 兜底。
#
# 用法：
#   git diff --name-only HEAD~1 HEAD | infer-test-urls.sh

set -euo pipefail

PROJECT_ROOT="${PROJECT_ROOT:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
ROUTER="$PROJECT_ROOT/src/admin/App.tsx"
PAGES_DIR="$PROJECT_ROOT/src/admin/pages"

if [ ! -f "$ROUTER" ]; then
  echo "❌ 找不到路由文件：$ROUTER" >&2
  exit 2
fi

# ---------- 反查：给定 Element 组件名（如 Reports / ReportDetail），找它在 App.tsx 中的 path ----------
lookup_path_for_element() {
  local elem="$1"
  awk -v e="$elem" '
    /path: *['\''"][^'\''"]*['\''"]/ { match($0, /['\''"][^'\''"]+['\''"]/); last_q = substr($0, RSTART+1, RLENGTH-2); has_kv=1; next }
    /path=['\''"][^'\''"]*['\''"]/  { match($0, /path=['\''"][^'\''"]+['\''"]/); s=substr($0, RSTART+6, RLENGTH-7); last_q=s; has_kv=1; next }
    {
      if (has_kv && $0 ~ ("<"e"[ />]")) { print last_q; exit }
      if ($0 ~ ("element=\\{<"e" ?/?>}")) { print last_q; exit }
    }
  ' "$ROUTER"
}

# 把 element 反查结果拼成 /admin/<path>（如果是 index 路由就是 /admin/）
to_full_url() {
  local raw="$1"
  [ -z "$raw" ] && return
  if [ "$raw" = "/" ] || [ "$raw" = "" ]; then
    echo "/admin/"
  elif [[ "$raw" == /* ]]; then
    # 已经是绝对路径（如 /login、/test-widget、/accept-invitation）→ 不挂 /admin
    echo "$raw"
  else
    echo "/admin/$raw"
  fi
}

# 从 admin pages 文件名提炼 Element 名
elem_from_page_file() {
  local f="$1"
  # src/admin/pages/Reports.tsx → Reports
  # src/admin/pages/globalsettings/index.tsx → GlobalSettings（特例：父路由 path="globalsettings"）
  local base
  base=$(basename "$f" .tsx)
  if [[ "$f" == *"/globalsettings/"* ]]; then
    echo "GlobalSettings"  # App.tsx 实际 element 名以源码为准；脚本只在反查失败时使用兜底路径
    return
  fi
  echo "$base"
}

# Hono routes/api/<x>.ts → admin 页面候选
admin_url_from_api_file() {
  local f="$1"
  local base
  base=$(basename "$f" .ts)   # reports / projects / settings / users / ...
  case "$base" in
    reports|reports-extras)         echo "/admin/reports" ;;
    projects)                       echo "/admin/projects" ;;
    users|invitations|api-tokens)   echo "/admin/globalsettings" ;;
    settings|branding|white-label|webhooks|integrations|storage|license|version|reporter-messages|notification-preferences|custom-templates|public-files|github-webhook|auth)
                                    echo "/admin/globalsettings" ;;
    *)                              echo "" ;;
  esac
}

# ---------- 主循环 ----------
declare -a urls=()

input="${1:-}"
[ -z "$input" ] && input=$(cat)

while IFS= read -r f; do
  [ -z "$f" ] && continue

  # 1) Admin 页面命中
  if [[ "$f" == src/admin/pages/* && "$f" == *.tsx ]]; then
    elem=$(elem_from_page_file "$f")
    p=$(lookup_path_for_element "$elem" || true)
    full=$(to_full_url "$p")
    if [ -n "$full" ]; then
      urls+=("$full")
    else
      # 反查失败的硬兜底
      case "$elem" in
        Dashboard)         urls+=("/admin/") ;;
        Reports)           urls+=("/admin/reports") ;;
        ReportDetail)      urls+=("/admin/reports/:id") ;;
        Projects)          urls+=("/admin/projects") ;;
        GlobalSettings)    urls+=("/admin/globalsettings") ;;
        Login)             urls+=("/login") ;;
        AcceptInvitation)  urls+=("/accept-invitation") ;;
        TestWidgetPage)    urls+=("/test-widget") ;;
      esac
    fi
    continue
  fi

  # 2) Admin 组件 / 公共目录改动 → 进 dashboard + reports 抽样
  if [[ "$f" == src/admin/components/* || "$f" == src/admin/hooks/* || "$f" == src/admin/lib/* || "$f" == src/admin/api/* || "$f" == src/admin/contexts/* ]]; then
    urls+=("/admin/")
    urls+=("/admin/reports")
    continue
  fi

  # 3) 后端 routes/api/<x>.ts → 映射候选 admin URL
  if [[ "$f" == src/server/routes/api/*.ts ]]; then
    u=$(admin_url_from_api_file "$f")
    [ -n "$u" ] && urls+=("$u")
    continue
  fi

  # 4) Widget 改动 → 统一指向 /test-widget（开发态嵌入预览页）
  if [[ "$f" == src/widget/* ]]; then
    urls+=("/test-widget")
    continue
  fi

  # 5) 共享类型变动 → 全栈抽样
  if [[ "$f" == src/shared/* ]]; then
    urls+=("/admin/")
    urls+=("/admin/reports")
  fi
done <<< "$input"

# 去重
if [ ${#urls[@]} -eq 0 ]; then
  echo "⚠️ 无法从改动文件精确推断测试 URL，回退 /admin/" >&2
  echo "/admin/"
else
  printf '%s\n' "${urls[@]}" | awk '!seen[$0]++'
fi
