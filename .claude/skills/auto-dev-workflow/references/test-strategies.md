# 测试策略具体命令（3.A / 3.B / 3.C / 3.D）

> 步骤 3 的所有项目特定命令集中在这里。常量见 `project-config.md`。

## 0. 通用准备

```bash
PROJECT_ROOT=$(git rev-parse --show-toplevel)
BRANCH_NAME=$(git branch --show-current | sed 's/[^a-zA-Z0-9_-]/-/g')
DATE_PREFIX=$(date +%y%m%d%H)
SCREENSHOT_PREFIX="${BRANCH_NAME}_${DATE_PREFIX}"
TEST_RESULTS="$PROJECT_ROOT/test-results"
mkdir -p "$TEST_RESULTS"

# 在 shell 中复制 project-config.md 顶级常量块（端口、workspace、DB 文件等）

# 健康检查（任一选项）
curl -sf http://localhost:7301/health || echo "dev server 未运行"
curl -sf http://localhost:7300/health || echo "生产端口未运行"
```

> **路径锁定**：所有截图/日志/产物用 `$TEST_RESULTS` 绝对路径，禁止裸相对路径 `test-results/`。

---

## 3.A 后端冒烟测试（src/server 改动）

```bash
cd "$PROJECT_ROOT"

# 1) 类型检查 + 单测
bun run typecheck:server \
  > "$TEST_RESULTS/${SCREENSHOT_PREFIX}_typecheck-server.log" 2>&1 \
  || { echo "❌ server typecheck 失败"; exit 1; }

bun test tests/server \
  > "$TEST_RESULTS/${SCREENSHOT_PREFIX}_bun-test-server.log" 2>&1 \
  || { echo "❌ server 单测失败"; exit 1; }

# 2) 启动/重启后端（dev 模式 bun --watch 会热重载；若未启动则后台拉起）
if ! curl -sf http://localhost:7301/health >/dev/null; then
  ( cd "$PROJECT_ROOT" && nohup bun run dev:server \
      > "$TEST_RESULTS/${SCREENSHOT_PREFIX}_devserver.log" 2>&1 & )
  for i in {1..30}; do
    sleep 1
    curl -sf http://localhost:7301/health >/dev/null && break
  done
fi

# 3) 登录拿 JWT
LOGIN_RESP=$(curl -s -c /tmp/bugpin-cookies.txt -X POST http://localhost:7301/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"changeme123"}')
echo "$LOGIN_RESP" > "$TEST_RESULTS/${SCREENSHOT_PREFIX}_login.json"
TOKEN=$(echo "$LOGIN_RESP" | jq -r '.token // empty')

AUTH_ARGS=()
[ -n "$TOKEN" ] && AUTH_ARGS=(-H "Authorization: Bearer $TOKEN")

# 4) 抽样调用受影响 endpoint
curl -s "${AUTH_ARGS[@]}" -b /tmp/bugpin-cookies.txt \
  "http://localhost:7301/api/<your-endpoint>" \
  | tee "$TEST_RESULTS/${SCREENSHOT_PREFIX}_api-resp.json" \
  | jq .
```

### Widget 上报端点（不需要 JWT）

```bash
# widget 用项目 API Key 上报；先用 admin 端获取一个：
PROJECT_API_KEY=$(curl -s "${AUTH_ARGS[@]}" \
  "http://localhost:7301/api/projects" \
  | jq -r '.[0].apiKey // empty')

curl -s -X POST "http://localhost:7301/api/reports" \
  -H "X-API-Key: $PROJECT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"title":"smoke test","description":"...","metadata":{"url":"http://example.com"}}' \
  | tee "$TEST_RESULTS/${SCREENSHOT_PREFIX}_widget-report.json" | jq .
```

---

## 3.B 前端浏览器测试（src/admin 或 src/widget 改动）

### B1. 类型 + 构建校验

```bash
cd "$PROJECT_ROOT"

# Admin 改动
bun run typecheck:admin \
  > "$TEST_RESULTS/${SCREENSHOT_PREFIX}_typecheck-admin.log" 2>&1 \
  || { echo "❌ admin typecheck 失败"; exit 1; }

bun run build:admin \
  > "$TEST_RESULTS/${SCREENSHOT_PREFIX}_build-admin.log" 2>&1 \
  || { echo "❌ admin build 失败"; exit 1; }

# Widget 改动
bun run typecheck:widget \
  > "$TEST_RESULTS/${SCREENSHOT_PREFIX}_typecheck-widget.log" 2>&1 \
  || { echo "❌ widget typecheck 失败"; exit 1; }

bun run build:widget \
  > "$TEST_RESULTS/${SCREENSHOT_PREFIX}_build-widget.log" 2>&1 \
  || { echo "❌ widget build 失败"; exit 1; }

# 单测（可选但推荐）
bun run test:admin \
  > "$TEST_RESULTS/${SCREENSHOT_PREFIX}_test-admin.log" 2>&1 || true

# 启动 admin Vite（若未运行）。它会代理 /api、/widget.js 等到 :7301
if ! curl -sf http://localhost:7300/admin/ >/dev/null; then
  ( cd "$PROJECT_ROOT" && nohup bun run dev:admin \
      > "$TEST_RESULTS/${SCREENSHOT_PREFIX}_dev-admin.log" 2>&1 & )
  for i in {1..30}; do
    sleep 1
    curl -sf http://localhost:7300/admin/ >/dev/null && break
  done
fi
```

### B2. 浏览器选择优先级（auto-connect 优先）

```bash
if agent-browser --auto-connect get url >/dev/null 2>&1; then
  BROWSER_MODE="auto-connect"
  AGENT_BROWSER_FLAGS="--auto-connect"
  echo "✅ 已连接用户登录态 Chrome"
else
  BROWSER_MODE="clean"
  AGENT_BROWSER_FLAGS="--headed --session bugpin-test"
  echo "⚠️ 降级为纯净浏览器；登录用 admin@example.com / changeme123（首启默认）"
fi
echo "测试浏览器模式：$BROWSER_MODE" >> "$TEST_RESULTS/${SCREENSHOT_PREFIX}_meta.txt"
```

**auto-connect 优先的理由**：BugPin admin 是 SPA + Vite，PWA/SW 与浏览器缓存历史上会触发"明明改了但页面不刷新"类陷阱；auto-connect 能在用户真实环境复现。

**auto-connect 模式严禁破坏性操作**：不要点"删除项目"、"删除报告"、"撤销邀请"、"删除用户"等按钮在真实数据上执行。优先做：列表浏览、详情查看、新建测试 project/report、状态切换可逆动作（如 open→in_progress）。

### B3. 测试 URL 动态推断（脚本驱动）

路由表（`src/admin/App.tsx`）是 path↔component 映射的**唯一真相源**。规则封装在 `scripts/infer-test-urls.sh`。

```bash
CHANGED=$(git diff --name-only HEAD~1 HEAD 2>/dev/null \
  || git diff --name-only --cached)

TEST_URLS=$(echo "$CHANGED" | "$PROJECT_ROOT/.claude/skills/auto-dev-workflow/scripts/infer-test-urls.sh")

echo "推断测试 URL：" >> "$TEST_RESULTS/${SCREENSHOT_PREFIX}_meta.txt"
echo "$TEST_URLS" >> "$TEST_RESULTS/${SCREENSHOT_PREFIX}_meta.txt"
```

**降级策略**：
- 多条 URL → 全部依次截图（每条 1-2 张）
- 返回 0 条或只 `/admin/` 兜底 → meta.txt 标注"无法精确推断"，仍跑 `/admin/reports` 作活体证明
- 推断与改动语义明显不符 → PR body 注明"自动推断 + 人工补充"

**动态获取测试 ID**（路由含 `:id` 时）：

```bash
RESOLVE="$PROJECT_ROOT/.claude/skills/auto-dev-workflow/scripts/resolve-route-id.sh"

for u in $TEST_URLS; do
  if [[ "$u" == *":id"* ]]; then
    real_id=$("$RESOLVE" "$u")
    [ -n "$real_id" ] && u="${u/:id/$real_id}"
  fi
  echo "测试 URL: $u"
done
```

> 表名/过滤条件集中在 `scripts/resolve-route-id.sh`。新增详情页路由时只改这个脚本，不改 SKILL.md。

### B4. 截图与录屏

文件名格式：`${SCREENSHOT_PREFIX}_NN-描述.png`（NN 两位数）。

```bash
# 录屏仅在 clean 模式启用
if [ "$BROWSER_MODE" = "clean" ]; then
  agent-browser $AGENT_BROWSER_FLAGS record start \
    "$TEST_RESULTS/${SCREENSHOT_PREFIX}_recording.webm" \
    "http://localhost:7300/admin/"
fi

agent-browser $AGENT_BROWSER_FLAGS open "http://localhost:7300$TEST_URL"
agent-browser $AGENT_BROWSER_FLAGS screenshot "$TEST_RESULTS/${SCREENSHOT_PREFIX}_01-initial.png"

# 步骤 2~N：触发本次改动覆盖的交互（点击/填表/提交），每步截图

if [ "$BROWSER_MODE" = "clean" ]; then
  agent-browser $AGENT_BROWSER_FLAGS record stop
fi
```

### B5. Widget 改动专用入口

Widget 不直接对应 admin 路由。开发态用 `src/admin/pages/TestWidgetPage.tsx`，访问 `http://localhost:7300/test-widget`：

```bash
agent-browser $AGENT_BROWSER_FLAGS open "http://localhost:7300/test-widget"
agent-browser $AGENT_BROWSER_FLAGS screenshot "$TEST_RESULTS/${SCREENSHOT_PREFIX}_widget-01-mount.png"
# 触发 widget：点启动按钮→截图→标注→提交→截图
```

### B6. 调用 ce-test-browser skill

```
Skill("compound-engineering:ce-test-browser",
  args="测试 <change名称> 在页面 <test_url> 的功能。浏览器模式：$BROWSER_MODE。截图必须保存到绝对路径 $TEST_RESULTS。auto-connect 模式下严禁破坏性操作（删除报告/项目/用户/邀请等），优先用列表查询和创建测试数据验证。")
```

---

## 3.C 数据库迁移验证（仅 SQL 改动）

```bash
cd "$PROJECT_ROOT"

# 1) 备份当前库（防误删）
cp "$PROJECT_ROOT/data/bugpin.db" "$TEST_RESULTS/${SCREENSHOT_PREFIX}_bugpin.db.bak" 2>/dev/null || true

# 2) 跑迁移
bun run --cwd src/server migrate \
  > "$TEST_RESULTS/${SCREENSHOT_PREFIX}_migrate.log" 2>&1 \
  || { echo "❌ 迁移失败"; exit 1; }

# 3) 校验迁移已登记（项目维护的迁移表名以 migrations/index.ts 实现为准；下例兼容常见命名）
sqlite3 "$PROJECT_ROOT/data/bugpin.db" \
  "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%migration%';" \
  | tee "$TEST_RESULTS/${SCREENSHOT_PREFIX}_migration-table.log"

sqlite3 "$PROJECT_ROOT/data/bugpin.db" \
  "SELECT * FROM schema_migrations ORDER BY id DESC LIMIT 5;" 2>/dev/null \
  | tee -a "$TEST_RESULTS/${SCREENSHOT_PREFIX}_migration-table.log" || true

# 4) 幂等性：再跑一次不应炸
bun run --cwd src/server migrate \
  > "$TEST_RESULTS/${SCREENSHOT_PREFIX}_migrate-rerun.log" 2>&1

# 5) 业务断言：根据本次 SQL 内容写具体 SELECT 验证
sqlite3 "$PROJECT_ROOT/data/bugpin.db" "<your-verification-query>"
```

> 已发布的迁移文件**严禁修改内容**（破坏 schema 历史一致性）。如需修正只能新增 `NNN_fix_xxx.sql`。

---

## 3.D 脚本/服务冒烟（docker-compose / Dockerfile / systemd / CI）

```bash
cd "$PROJECT_ROOT"

# 1) docker-compose / Dockerfile 改动：本地构建镜像 + 起容器 + 健康检查
docker compose build \
  > "$TEST_RESULTS/${SCREENSHOT_PREFIX}_compose-build.log" 2>&1 \
  || { echo "❌ 镜像构建失败"; exit 1; }

docker compose up -d
sleep 5
docker compose ps | tee "$TEST_RESULTS/${SCREENSHOT_PREFIX}_compose-ps.log"

curl -sf http://localhost:7300/health \
  | tee "$TEST_RESULTS/${SCREENSHOT_PREFIX}_health.json" \
  || echo "⚠️ 健康检查失败"

# 2) 生产入口冒烟（不走容器）
bun run build \
  > "$TEST_RESULTS/${SCREENSHOT_PREFIX}_full-build.log" 2>&1
nohup bun run start > "$TEST_RESULTS/${SCREENSHOT_PREFIX}_start.log" 2>&1 &
sleep 3
curl -sf http://localhost:7300/health || echo "⚠️ start 失败"

# 3) systemd 单元改动
systemd-analyze verify "$PROJECT_ROOT/bugpin.service" \
  | tee "$TEST_RESULTS/${SCREENSHOT_PREFIX}_systemd-verify.log" || true

# 4) CI 工作流改动
# 直接 push 触发 actions，或本地用 `act` 跑（如装了）
ls .github/workflows/ | tee "$TEST_RESULTS/${SCREENSHOT_PREFIX}_workflows.log"
```

---

## 失败处理

任何分支测试失败：
1. 不要跳过、不要硬通过；优先回到步骤 2 修复，再回到本步骤重测
2. 若经历"发现问题 → 修复 → 重测通过"循环，**SKILL.md 步骤 3.5 必须执行**

## 收集证据清单

```bash
ls "$TEST_RESULTS"/${SCREENSHOT_PREFIX}_*.png 2>/dev/null
ls "$TEST_RESULTS/${SCREENSHOT_PREFIX}_recording.webm" 2>/dev/null
ls "$TEST_RESULTS"/${SCREENSHOT_PREFIX}_*.log 2>/dev/null
ls "$TEST_RESULTS"/${SCREENSHOT_PREFIX}_*.json 2>/dev/null
```

---

## 当本文件需要更新

- 改动鉴权方式（JWT / API Key / 签名）
- 端口/workspace 变更（先改 `project-config.md`，再同步本文件命令）
- 测试浏览器工具替换（agent-browser → playwright 等）
- 数据库引擎更换（SQLite → PostgreSQL）
- 迁移脚本机制变更（自写 → Drizzle / Prisma 等）
- 容器编排扩展（单容器 → 多容器 / k8s）
