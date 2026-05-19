# BugPin 项目常量参考

> 所有受项目代码结构影响的"硬编码"集中在这里。结构变动时只改这一份，SKILL.md 不动。

## 顶级常量（推荐在 shell 中先 export）

```bash
# === 路径 ===
PROJECT_ROOT=$(git rev-parse --show-toplevel)
SKILL_DIR="$PROJECT_ROOT/.claude/skills/auto-dev-workflow"
TEST_RESULTS="$PROJECT_ROOT/test-results"
SPECS_DIR="$PROJECT_ROOT/openspec/changes"
SPECS_ARCHIVE_DIR="$SPECS_DIR/archive"
SPECS_MAIN_DIR="$PROJECT_ROOT/openspec/specs"

# === 后端（Bun + Hono） ===
BACKEND_PORT_DEV=7301           # bun --watch 在 dev 下监听端口
BACKEND_PORT_PROD=7300          # 生产/容器端口（也是 docker-compose 暴露端口）
SERVER_WS="src/server"          # workspace 路径（用于 bun run --cwd）
API_PREFIX="/api"
API_BASE_DEV="http://localhost:${BACKEND_PORT_DEV}${API_PREFIX}"
API_BASE_PROD="http://localhost:${BACKEND_PORT_PROD}${API_PREFIX}"
DEFAULT_ADMIN_EMAIL="admin@example.com"
DEFAULT_ADMIN_PASS="changeme123"   # 容器首启默认；登录后立改

# === 前端（Admin Console + Widget） ===
FRONTEND_PORT=7300               # vite dev server，已配置代理到 :7301
FRONTEND_BASE="http://localhost:${FRONTEND_PORT}"
ADMIN_BASE_PATH="/admin"         # vite base
ADMIN_WS="src/admin"
ADMIN_ROUTER_FILE="$PROJECT_ROOT/src/admin/App.tsx"   # React Router 路由真相源
ADMIN_PAGES_DIR="$PROJECT_ROOT/src/admin/pages"
WIDGET_WS="src/widget"
WIDGET_ENTRY="$PROJECT_ROOT/src/widget/index.ts"
WIDGET_OUTPUT="/widget.js"       # 浏览器加载入口（生产由 server 直出，dev 由 vite 代理）

# === 数据库（SQLite via bun:sqlite） ===
DB_FILE="$PROJECT_ROOT/data/bugpin.db"
MIGRATIONS_DIR="$PROJECT_ROOT/src/server/database/migrations"
SQLITE_EXEC=(sqlite3 "$DB_FILE")
# 用法：${SQLITE_EXEC[@]} "SELECT ..."

# === 容器 ===
COMPOSE_FILE="$PROJECT_ROOT/docker-compose.yml"
CONTAINER_NAME="bugpin"           # 与 compose 中的 container_name 一致
CONTAINER_DATA_VOL="./data:/data"
```

## 主要目录约定（infer-test-urls.sh / 路由反查依赖）

| 类型 | 目录 | 命名约定 |
|---|---|---|
| 后端 Hono 路由 | `src/server/routes/api/` | `<domain>.ts`（如 `reports.ts`、`projects.ts`），在 `src/server/routes/index.ts` 通过 `api.route('/path', xxxRoutes)` 挂载 |
| 后端业务服务 | `src/server/services/` | `<domain>.service.ts` |
| 后端仓储层 | `src/server/database/repositories/` | `<domain>.repo.ts` |
| Admin 页面 | `src/admin/pages/` | `Dashboard.tsx`、`Reports.tsx`、`ReportDetail.tsx`、`Projects.tsx`、`globalsettings/*.tsx` 等 |
| Admin 路由表 | `src/admin/App.tsx` | `<Route path=... element={<Xxx />}/>` |
| Admin API 客户端 | `src/admin/api/` | 与 `/api/<domain>` 一一对应 |
| Widget 源码 | `src/widget/` | `index.ts` 总入口；annotate / capture / api 分模块 |
| Shared 类型 | `src/shared/` | 前后端共享 TS 类型 |
| SQL 迁移 | `src/server/database/migrations/` | `NNN_<desc>.sql` 严格递增（已合并不可改） |
| 业务表前缀 | — | 无统一前缀（reports / projects / users / settings 等直接命名） |

## bun script 子命令约定

| 子命令 | 用途 | SKILL.md 引用位置 |
|---|---|---|
| `bun install` | 安装 workspace 依赖 | 步骤 0 |
| `bun run dev` | 同时启 server + admin | 步骤 0 |
| `bun run dev:server` | 启 backend（:7301，热重载） | 3.A / 3.B |
| `bun run dev:admin` | 启 admin Vite（:7300） | 3.B |
| `bun run dev:widget` | widget 构建 watch（用于本地嵌入测试） | 3.B Widget 改动 |
| `bun run build` | 全量构建到 `dist/` | 3.D 容器前置 |
| `bun run start` | 用单个 Bun 进程跑 `src/server/index.ts`（含 admin 静态产物） | 3.D |
| `bun run typecheck` | 全 workspace tsc --noEmit | 3.A / 3.B 前置 |
| `bun run test` | 全 workspace 单测 | 3.A 主要、3.B 抽样 |
| `bun run --cwd src/server migrate` | 跑迁移脚本 | 3.C |
| `bun run knip` | 死代码 / 未引用检测 | 3.A 可选 |
| `bun run format` / `format:check` | prettier 全量 | 提交前可选 |

## 关键状态/语义（resolve-route-id.sh 选 ID 的过滤依据）

- **reports.status**：典型值 `'open'` / `'in_progress'` / `'resolved'` / `'closed'` → 详情页 ID 选 `status IN ('open','in_progress')` 的最近一条
- **projects**：默认软删字段 `archived_at IS NULL`（如存在）
- **users**：选 `role='admin'` 或最近登录的一条
- **invitations**：选 `accepted_at IS NULL AND expires_at > now`
- **api_tokens**：选 `revoked_at IS NULL`

> 实际字段以 `src/server/database/database.ts` 与 `migrations/*.sql` 为准；新增/重命名字段时更新 `scripts/resolve-route-id.sh`。

## 鉴权说明

| 接口域 | 鉴权方式 | 头/字段 |
|---|---|---|
| Admin Console API（`/api/*`） | JWT（登录返回，存 httpOnly cookie 或 Authorization 头） | `Authorization: Bearer <jwt>` 或同源 cookie |
| Widget 上报 API（`/api/widget/*` 等） | 项目级 API Key | 由 widget 配置传入，server 端校验 |
| GitHub Webhook（`/api/github-webhook`） | HMAC 签名 | `X-Hub-Signature-256` |
| 公开文件（`/api/public-files/*`） | 临时 token / 公开 | — |

## 排除清单（commit / git add 时屏蔽）

| 路径 | 原因 |
|---|---|
| `**/node_modules/**` | Bun 依赖（已 gitignore，双保险） |
| `dist/**` | 构建产物 |
| `data/**` | 运行时数据（含 SQLite 与上传文件） |
| `*.db`、`*.db-shm`、`*.db-wal` | SQLite 实时文件 |
| `test-results/**` | 截图/录屏，gitignored |
| `.env`、`.env.*` | 本地密钥文件 |
| `ee/dist/**` | EE 模块构建产物 |
| `logs/**` | 运行日志 |
| `**/.DS_Store` | macOS 元数据 |
| `**/.idea/**`、`**/.vscode/**` | IDE 工程文件 |
| `*.tsbuildinfo` | TS 增量构建缓存 |

---

## 当本文件需要更新

- 端口变更（7300/7301）
- workspace 拆分/重命名
- 数据库引擎替换（SQLite → PostgreSQL 等）
- 默认账号体系变更
- bun script 子命令重命名
- 鉴权头改名 / 新增鉴权域
- 容器名 / compose 文件结构变更
