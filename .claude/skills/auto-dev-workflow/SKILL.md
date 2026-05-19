---
# === 项目身份字段（移植到新项目时必改这三项；其他字段保持中性）===
name: auto-dev-workflow
description: |
  全自动研发工作流编排器。当用户描述任何业务相关开发需求时，按
  规划 → 实现 → 按改动类型选择测试 → 归档 → 提交并建 PR
  的五步流程不中断地连续执行。

  触发条件（凡满足其一即触发）：
  - 用户描述新功能："开发X"、"实现Y"、"新增Z"、"做一个..."
  - 用户提出优化："优化..."、"改进..."、"重构..."
  - 用户报告 Bug："修复..."、"fix..."、"有个问题..."
  - 用户说"新需求："或给出 PRD/需求描述/brainstorm 文档

  适用场景：BugPin 全栈项目（Bun/Hono 后端 + React/Vite 管理后台 + 嵌入式 Widget + SQLite，
  使用 OpenSpec 规格驱动工作流 + GitHub PR 协作模式 + DCO sign-off）。
  当前项目身份与技术栈关键词见 references/portability.md。

  重要：用户描述需求后立即触发，不等待用户逐步调用每个子命令。如果无法判断改动类型，默认按"全栈"路径走。
---

# 全自动研发工作流（流程骨架）

用户描述需求后，**不中断地按下列五步执行**直到 PR 创建完成。每步通过 Skill 工具调用对应**语义角色**所绑定的子 skill；上一步的产物作为下一步的上下文。

> **设计原则**：本文件是**项目无关的流程骨架**——不写具体技术栈名、不写具体 skill 实例名、不写具体路径。所有项目化内容都在 `references/`。
>
> **首次执行前**：读 `references/portability.md` 第 2-4 节，把"语义角色 → 具体调用"、"通用名 → 具体工具"、"变量 → 实际路径"加载到工作上下文。

> **提交授权**：用户全局 CLAUDE.md 限定"未经主动要求不得提交/建分支"。**用户调用本 skill 即视为对最终 commit/PR 的明确授权**；同时所有 commit 必须带 `--signoff`（DCO 要求）。详见 `references/portability.md` 第 1 节。

---

## 引用资源（按需加载）

| 文件 | 何时读 | 内容 |
|---|---|---|
| `references/portability.md` | 任何步骤前先读 | **角色映射**、项目身份、技术栈实例、路径常量、移植清单 |
| `references/project-config.md` | 步骤 3 前 | 端口、workspace 坐标、DB 文件位置、账号、API 前缀、排除清单 |
| `references/change-routing.md` | 步骤 2.5 | 改动主目录 → 测试策略路由表 |
| `references/test-strategies.md` | 步骤 3 | 3.A/3.B/3.C/3.D 各自具体命令、URL 推断、失败处理 |
| `references/commit-pr.md` | 步骤 5 | PR 检测、Release 截图上传、PR body 模板、DCO sign-off |
| `scripts/infer-test-urls.sh` | 步骤 3.B | admin 路由反查 |
| `scripts/resolve-route-id.sh` | 步骤 3.B | 表名映射到真实 ID |

---

## 步骤 1：规划（生成规格文档）

**调用语义角色**：`spec-propose`，参数为用户原始需求描述（或 brainstorm 文档路径）。

期望产物：`$SPECS_DIR/<change-name>/` 下的完整 artifact 集（`proposal.md` + `design.md` + `specs/*.md` + `tasks.md`），change 名称为 kebab-case。

**衔接**：从 `$SPECS_DIR` 确认 change 名称，记录到上下文供后续步骤复用。

---

## 步骤 2：实现代码

**调用语义角色**：`spec-apply`（参数为步骤 1 的 change 名称；省略时由角色绑定的工具自行从 `$SPECS_DIR` 推断）。

按 `tasks.md` 列表逐条实现，每条完成后在 tasks 文件打 `[x]`。

**衔接**：实现完成后必须**显式列出本次涉及的文件路径列表**，用于步骤 2.5 改动分类与步骤 3 测试路径选择。

---

## 步骤 2.5：按改动类型路由测试策略

**读 `references/change-routing.md`**，按其中"路由表 + 跨模块归属"决定步骤 3 走哪条分支（3.A / 3.B / 3.C / 3.D），把判定结果写入 `$TEST_RESULTS/${SCREENSHOT_PREFIX}_meta.txt`。

**判定规则**（不变）：
- 扫描步骤 2 文件列表，按"最高级别命中"决定主路径
- 多类命中时取并集（如后端 + 前端同改 → 跑 3.B 为主、3.A 抽样兜底）
- 无法判断时默认全栈路径

---

## 步骤 3：测试

**读 `references/test-strategies.md`**，按步骤 2.5 选定的分支执行：

- **3.A 后端冒烟**（src/server 改动）— TypeScript 类型检查 + 单元测试 + 服务热重载 + API 调用 + 响应断言
- **3.B 前端浏览器测试**（src/admin 或 src/widget 改动）— 类型检查 + 构建 + 浏览器自动化访问 + 截图录屏
- **3.C 数据迁移验证**（仅 src/server/database/migrations 改动）— 应用迁移 + 幂等性校验 + SQLite 业务断言
- **3.D 脚本/容器冒烟**（项目脚本 / 容器编排 / systemd 改动）— 执行受影响子命令 + 日志/状态校验

**通用要点**（与具体工具无关）：
- 截图/日志统一命名：`${SCREENSHOT_PREFIX}_NN-描述.{png|webm|log}`，全部用 `$TEST_RESULTS` 绝对路径
- 浏览器优先用 auto-connect 模式以复现真实环境的 SW/缓存陷阱；auto-connect 模式**严禁破坏性操作**
- 任何分支测试失败：先回到步骤 2 修复再重测，不要跳过、不要硬通过

---

## 步骤 3.5（条件触发）：记录经验教训

**触发条件**：步骤 3 中发生过"测试失败 → 修复 → 重测通过"循环。一次通过则跳过。

**调用语义角色**：`record-learnings`。

会把根因 + 修复方案归档到 `$SOLUTIONS_DIR`，供后续遇到相同坑时检索。

---

## 步骤 4：归档变更

**调用语义角色**：`spec-archive`（参数为 change 名称）。

期望行为：检查 `tasks.md` 完成度 → 同步 delta specs 到主 `openspec/specs/` → 把 change 目录移动到 `$SPECS_ARCHIVE_DIR`。

无需用户干预，所有提示均按推荐项推进（默认选"同步后归档"）。

---

## 步骤 5：提交 & PR

**读 `references/commit-pr.md`** 执行：

1. **5.1 PR 检测** — 判断当前分支是否已有 open PR，避免重复创建
2. **5.2 提交** — 已有 PR 走手动 `git add/commit --signoff/push`；否则调用 `commit-pr` 角色（必须传递 DCO sign-off 要求）
3. **5.3 截图上传** — 通过仓库托管平台的临时机制（如 GitHub Release）托管 `$TEST_RESULTS/*.png`
4. **5.4 PR body** — 按模板填入截图 + 验收要点 + 改动概述

排除清单（构建产物、依赖目录、数据卷、密钥文件、测试证据等）的完整列表见 `references/project-config.md`。

---

## 执行规范（与项目无关）

- **不中断**：五步全自动执行，不在中间停下来征求"是否继续"。
- **就地修复**：任何步骤失败先排根因修复再继续，不放弃流程。
- **进度播报**：每步开始时一句话："▶ 步骤 N/5：xxx"。
- **路径锁定**：步骤 3 起所有截图/日志/产物用 `$TEST_RESULTS` 绝对路径，禁止裸相对路径。
- **change 名称传递**：步骤 1 产出的 kebab-case 名称要在所有后续步骤复用。
- **改动类型路由必走**：步骤 2.5 不可省略；不同类型的改动用不同测试方式，不要无脑跑浏览器测试。
- **auto-connect 优先 + 破坏性操作禁令**：用户登录态浏览器能复现真实环境 bug；但严禁在真实数据上做删除/取消等不可逆操作。
- **DCO sign-off 必需**：所有 commit 必须带 `--signoff`；缺失会被 GitHub DCO CI 拦截。
- **CLAUDE.md 一致性**：本 skill 视为用户对最终 commit/PR 的明确授权；其它脱离本流程的提交仍需另行确认。

---

## 维护说明

| 变动类型 | 改哪里 | 是否改本文件 |
|---|---|---|
| 当前项目改名/换技术栈/换 spec 工具 | `references/portability.md` | ❌ |
| 端口/workspace 名/容器名/账号变更 | `references/project-config.md` | ❌ |
| 改动类型分类规则演进 | `references/change-routing.md` | ❌ |
| 3.A/3.B/3.C/3.D 具体命令调整 | `references/test-strategies.md` | ❌ |
| 新增详情页 ID 占位映射 | `scripts/resolve-route-id.sh` | ❌ |
| 路由文件路径/格式变更 | `scripts/infer-test-urls.sh` | ❌ |
| PR 上传策略调整 | `references/commit-pr.md` | ❌ |
| **流程骨架本身变更**（新增/删除步骤、调整次序、改 5 步骨架的语义） | **本文件** | ✅ |
| 移植到新项目（必改 frontmatter `name`/`description`） | **本文件 frontmatter** + 全部 references | ⚠️ 仅 frontmatter |

判断标准：
- "做什么"和"次序" → 本文件
- "具体怎么做" → references/ 或 scripts/
- "项目是什么" → references/portability.md

只要新增/修改的内容会随项目代码结构演进而过时，就放到 `references/` 或 `scripts/`。
