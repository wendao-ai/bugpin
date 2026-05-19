# 移植与项目身份配置

> 本 skill 设计为可跨项目复用。SKILL.md 文档体只用**语义角色**（spec-propose、commit-pr 等）描述步骤；本文件把角色映射到当前项目的具体 skill / 工具 / 路径。
>
> 移植到新项目时：复制整个 `auto-dev-workflow/` 目录 → 改 SKILL.md frontmatter 的 `name`/`description` → 重写本文件 + `project-config.md` + `change-routing.md` + `test-strategies.md` + `commit-pr.md` → 完成。

---

## 1. 项目身份字段

| 字段 | 当前值 |
|---|---|
| 项目名 | BugPin |
| 仓库 | `aranticlabs/bugpin` |
| 一句话定位 | 自托管的可视化 Bug 上报工具（截图标注 + 报告管理） |
| 主要技术栈关键词 | Bun / Hono / TypeScript / React 19 / Vite / Tailwind v4 / Radix UI / SQLite (bun:sqlite) / Zod |
| 触发本 skill 的领域词 | "report"、"项目/project"、"widget"、"截图/screenshot"、"标注/annotation"、"邮件通知"、"GitHub 集成"、"webhook"、"admin/管理后台" |
| 项目根 CLAUDE.md 关键约束 | 用户全局 CLAUDE.md 规定"未经主动要求不得提交"——本 skill 调用即视为对最终 commit/PR 的明确授权；所有 commit 必须 `--signoff`（DCO） |

---

## 2. Skill 角色 → 具体调用映射

SKILL.md 引用语义角色；本表把角色绑定到当前项目实际使用的 skill 实例。BugPin 不使用 openspec/opsx 等 spec-driven 工作流，因此规划/实现/归档全部走 ce-* 系列与项目本地 plan 目录。

| 语义角色 | 用途 | 当前绑定 |
|---|---|---|
| **spec-propose** | 步骤 1：从需求生成计划文档到 `.claude/plans/<change>/plan.md` | `Skill("compound-engineering:ce-plan", args="<需求> ; 计划写到 .claude/plans/<kebab-name>/plan.md")` |
| **spec-apply** | 步骤 2：按 plan tasks 列表实现代码 | `Skill("compound-engineering:ce-work", args="按 .claude/plans/<kebab-name>/plan.md 实现，每完成一个 task 在 plan 中打 [x]")` |
| **spec-archive** | 步骤 4：检查 tasks 完成度 + 追加 review 段 + 移动 plan 到 archive | 直接由本流程编排（不调外部 skill）：写 review 段 → `mv .claude/plans/<name>/ .claude/plans/archive/$(date +%Y-%m-%d)-<name>/` |
| **record-learnings** | 步骤 3.5：把"失败→修复"循环根因归档 | `Skill("compound-engineering:ce-compound")` |
| **browser-test** | 步骤 3.B：前端浏览器自动化测试 | `Skill("compound-engineering:ce-test-browser")`（底层为 `agent-browser` CLI） |
| **commit-pr** | 步骤 5.2：暂存 + commit（DCO sign-off）+ push + 建 PR | `Skill("commit-commands:commit-push-pr")`（必须在提示中显式要求 `git commit --signoff`） |
| **feature-video**（可选） | 步骤 5.3：把录屏嵌入 PR description | `Skill("compound-engineering:feature-video")` |

> **可替换性**：本表是 skill 角色的"接线图"。其他项目可换 `spec-propose` → `opsx:propose` / `spec-kit` / `BMAD`；只改本表，不改 SKILL.md 文档体。

---

## 3. 技术栈关键词 → 通用名映射

SKILL.md 步骤 3 子分支用通用名描述；本表说明在本项目它们是什么。

| 通用名 | 当前项目实例 |
|---|---|
| 包管理器 | `bun`（含 workspaces：src/server / src/admin / src/widget） |
| 后端类型检查 | `bun run typecheck:server`（= `tsc --noEmit` in src/server） |
| 后端构建命令 | `bun run build:server` |
| 后端热重载 | `bun run dev:server`（= `bun --watch` 启动 Hono on :7301） |
| 后端单测命令 | `bun test tests/server`（或 `bun run test:server`） |
| 前端类型检查 | `bun run typecheck:admin` / `bun run typecheck:widget` |
| 前端构建命令 | `bun run build:admin` / `bun run build:widget` |
| 前端热重载 | `bun run dev:admin`（Vite on :7300，代理 `/api`、`/branding`、`/widget.js` 等到 :7301） |
| 前端单测命令 | `bun run test:admin`（vitest）/ `bun run test:widget` |
| 数据库迁移工具 | bun 自写脚本：`bun run --cwd src/server migrate`（读 `database/migrations/*.sql`） |
| 浏览器自动化工具 | `agent-browser`（auto-connect 优先） |
| 容器编排 | `docker-compose.yml`（单容器，端口 7300） |
| systemd 单元 | `bugpin.service` |

具体命令落到 `test-strategies.md`，本表只做映射索引。

---

## 4. 路径常量

SKILL.md 用变量引用；本表给出当前项目实际值。

| 变量 | 含义 | 当前值 |
|---|---|---|
| `$PLANS_DIR` | 计划目录（本项目 spec 替代） | `.claude/plans/` |
| `$PLANS_ARCHIVE_DIR` | 归档后的 plan 目录 | `.claude/plans/archive/YYYY-MM-DD-<name>/` |
| `$SOLUTIONS_DIR` | 经验教训归档目录 | `docs/solutions/<问题域>/` |
| `$TEST_RESULTS` | 测试证据目录（截图/日志/录屏） | `<repo>/test-results/`（gitignored） |
| `$SCREENSHOT_PREFIX` | 测试证据文件名前缀约定 | `{branch}_{YYMMDDHH}` |
| `$ROUTER_FILE` | admin SPA 路由真相源 | `src/admin/App.tsx`（React Router） |
| `$ADMIN_PAGES_DIR` | admin 页面目录 | `src/admin/pages/` |
| `$API_ROUTES_DIR` | 后端 Hono 路由目录 | `src/server/routes/api/` |
| `$MIGRATIONS_DIR` | SQL 迁移目录 | `src/server/database/migrations/` |
| `$DB_FILE` | SQLite 数据文件 | `data/bugpin.db` |

---

## 5. 移植到新项目检查清单

按顺序做：

- [ ] 1. 复制整个 `.claude/skills/auto-dev-workflow/` 目录到新项目
- [ ] 2. 改 SKILL.md frontmatter：`name: <new-project>-dev-workflow`、`description` 中项目名/领域词
- [ ] 3. 重写本文件第 1-4 节（项目身份、Skill 角色映射、技术栈实例、路径常量）
- [ ] 4. 重写 `references/project-config.md`：端口、workspace、容器名、账号、API 前缀、排除清单
- [ ] 5. 重写 `references/change-routing.md`：改动主目录的判定路径表
- [ ] 6. 重写 `references/test-strategies.md`：3.A/3.B/3.C/3.D 各自具体命令
- [ ] 7. 重写 `references/commit-pr.md`：仓库托管平台特定的 PR 上传流程（含 DCO 或 CLA 要求）
- [ ] 8. 改 `scripts/infer-test-urls.sh`：路由表路径与反查规则
- [ ] 9. 改 `scripts/resolve-route-id.sh`：表名/状态过滤映射
- [ ] 10. 把项目根 CLAUDE.md 中的提交授权约束（如有）同步到本文件第 1 节"项目根 CLAUDE.md 关键约束"

**不需要改的**：SKILL.md 文档体、流程骨架、5 步顺序、判定规则、执行规范。

---

## 6. 哪些场景"骨架本身"也要改

如果新项目满足以下任一条件，需要修改 SKILL.md 文档体（而非仅改本文件）：

- 不需要规划阶段（直接动手） → 删步骤 1，让 spec-apply 直接接需求
- 不需要测试证据归档到 PR → 删步骤 5.3/5.4
- 完全不打算自动建 PR（如本地分支推送即可） → 删步骤 5
- 改动类型分类完全不适用（如纯 CLI 工具、纯 SDK 库）→ 步骤 2.5 + 3 重新分类

判断标准：**只要五步流程的"次序与存在性"还成立，就只改 references/，不改 SKILL.md。**
