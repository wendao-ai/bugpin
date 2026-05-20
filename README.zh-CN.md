<div align="center">
    <picture>
        <source media="(prefers-color-scheme: dark)" srcset="src/admin/public/branding/dark/logo-dark.svg" />
        <img src="src/admin/public/branding/light/logo-light.svg" width="400" alt="BugPin" />
    </picture><br /><br />
    <p><big><strong>自托管、开源的可视化 Bug 上报工具。</strong></big><br />
    在 Web 应用中截图、批注问题、跟踪 Bug。</p>
    <a target="_blank" href="https://github.com/aranticlabs/bugpin"><img src="https://img.shields.io/github/last-commit/aranticlabs/bugpin" /></a>
    <a target="_blank" href="https://github.com/aranticlabs/bugpin/blob/main/LICENSE"><img src="https://img.shields.io/badge/Admin%20Console%20license-AGPL--3.0-blue.svg" alt="Admin Console license: AGPL-3.0" /></a>
    <a target="_blank" href="https://github.com/aranticlabs/bugpin/blob/main/src/widget/LICENSE"><img src="https://img.shields.io/badge/Widget%20license-MIT-yellow.svg" alt="Widget license: MIT" /></a>
</div>
<br />

**语言**：[English](README.md) | **简体中文**

### 管理后台

管理项目、分流处理 Bug 报告。开箱支持深浅两种主题。

**浅色模式**

<img src="./src/admin/public/images/bugpin-dashboard.png" width="800" alt="BugPin Admin Console: Light Mode" />

**深色模式**

<img src="./src/admin/public/images/bugpin-dashboard-dark.png" width="800" alt="BugPin Admin Console: Dark Mode" />

### Widget 反馈组件

从你网站任意页面发起截图与批注。

<img src="./src/admin/public/images/bugpin-widget-dialog.png" width="800" alt="BugPin Widget" />

- 一个 `<script>` 标签即可嵌入，支持 React / Vue / Angular / Svelte / 原生 JS
- Shadow DOM 隔离：Widget 样式不会污染你的页面，你的 CSS 也不会影响 Widget
- 离线安全：网络断开时报告先缓存在本地，恢复后自动同步
- 批注工具齐全：画笔、形状、箭头、文字、隐私打码

## 功能特性

- **可视化 Bug 上报** — 一键截图
- **批注工具** — 在截图上画图、高亮、加文字
- **自动收集元数据** — 失败的网络请求（4xx / 5xx）、控制台错误、操作系统/浏览器/设备信息
- **离线支持** — 离线缓存，回线即同步
- **完全自托管** — 数据始终在你自己的服务器上
- **多项目隔离** — 多个项目分别管理，各自独立 API Key
- **强化的安全选项** — 域名白名单、可配置速率限制、HSTS、安全 HTTP 头
- **GitHub 集成** — 报告可转发到 GitHub Issues
- **深色模式** — 管理后台支持浅色与深色主题

## 快速开始

5 分钟跑起来。

### 安装（Docker Compose）

新建 `docker-compose.yml`：

```yaml
services:
  bugpin:
    image: registry.arantic.cloud/bugpin/bugpin:latest
    container_name: bugpin
    restart: unless-stopped
    ports:
      - '7300:7300'
    volumes:
      - ./data:/data
```

启动：

```bash
docker compose up -d
```

或直接 `docker run`：

```bash
docker run -d \
  --name bugpin \
  --restart unless-stopped \
  -p 7300:7300 \
  -v bugpin-data:/data \
  registry.arantic.cloud/bugpin/bugpin:latest
```

打开 `http://localhost:7300` 即可访问。

### 登录

默认账号：

- **邮箱**：`admin@example.com`
- **密码**：`changeme123`

> [!IMPORTANT]
> 首次登录后立即修改密码：点头像 → "Profile" → 修改密码。

### 创建项目

项目用于组织 Bug 报告，并为 Widget 提供 API Key。

1. 进入管理后台的 **Projects** 页面
2. 点击 **Create Project**，填写名称
3. 复制创建后显示的 **API Key**（下一步要用）

### 接入 Widget

按你的技术栈挑一种方式，把 `YOUR_API_KEY` 换成上一步拿到的 Key。

**方式 1：`<script>` 标签**

```html
<!-- BugPin Widget 开始 -->
<script src="http://localhost:7300/widget.js" data-api-key="YOUR_API_KEY"></script>
<!-- BugPin Widget 结束 -->
```

不需要传 `serverUrl`，Widget 会从 `<script>` 的 src 自动读取。

**方式 2：npm 包**

```bash
npm install @arantic/bugpin-widget
```

```javascript
import BugPin from '@arantic/bugpin-widget';

await BugPin.init({
  apiKey: 'YOUR_API_KEY',
  serverUrl: 'http://localhost:7300',
});
```

通过 npm 引入时必须显式传 `serverUrl`。

---

## 管理员命令行工具 `bugpin-cli`

仓库内置了一个 TypeScript CLI（位于 `src/cli/`），封装了管理后台所有 REST 端点（约 40 个），覆盖 auth / reports / projects / users / settings / branding 五大组以及本地配置管理。**自动化运维、CI 集成、批量操作的首选**。

### 安装

CLI 是仓库的一个 workspace，通过 `bun link` 全局安装：

```bash
cd src/cli
bun install
bun link        # 注册 bugpin-cli 到 ~/.bun/bin/
which bugpin-cli  # 验证：应输出 ~/.bun/bin/bugpin-cli
```

> ⚠️ 必须在 `src/cli/` 目录跑 `bun link`，不能在仓库根。仓库根的 `package.json` 名字是 `bugpin`，没有 `bin` 字段。

确保 `~/.bun/bin` 在 PATH（bun 安装时通常已配置好）。

### 5 分钟上手

```bash
# 1. 设置服务端 URL（一次性，写入 ~/.bugpin/config.json）
bugpin-cli config set-url https://bugpin.example.com

# 2. 登录（session cookie 持久化到本地配置，默认 7 天有效）
bugpin-cli auth login -e admin@example.com
# 提示输入密码（避免进 shell 历史）

# 3. 任意目录调用
bugpin-cli auth whoami                                    # 查看身份
bugpin-cli reports list --status open,in_progress         # 列待处理报告
bugpin-cli reports stats                                  # 数量分布概览
bugpin-cli --json projects list | jq '.projects[].name'   # JSON 模式 + jq 提取
```

### 命令速查

| 命令组 | 子命令 |
|---|---|
| `auth` | `login` / `logout` / `whoami` / `change-password` |
| `reports` | `list` / `get` / `stats` / `create`（含 multipart 多文件）/ `update` / `delete` / `bulk-update` / `forward` / `files` / `download` / `retry-sync` |
| `projects` | `list` / `get` / `create` / `update` / `delete` / `regenerate-key` / `reorder` |
| `users` | `list` / `assignable` / `get` / `create` / `invite` / `resend-invitation` / `update` / `delete` / `me {profile, upload-avatar, download-avatar, delete-avatar}` |
| `settings` | `get` / `update` / `test-email` / `cache-invalidate` |
| `branding` | `config` / `set-widget-colors` |
| `config` | `show` / `set-url <url>` / `reset [--keep-session]` |

详细参数与示例：[`src/cli/README.md`](src/cli/README.md)。

### 输出模式

- 默认人类可读：list 命令是表格，单项是键值对
- `--json` 切换为脚本可解析的原始响应；放在命令名**之前**：

```bash
bugpin-cli --json reports list --status open | jq -r '.data[].id'
```

### 仅支持 CE 版

CLI 只挂载社区版（CE）可用的端点。`/api/tokens/*`、`/api/branding/{logo,favicon,...}`、`/api/settings/email-templates/*` 等 Enterprise（EE）功能未提供入口；如果误调用了 EE 接口，CLI 会翻译 402 错误给出清晰提示。

---

## bugpin-cli Skill（给 Claude / Codex / Factory 等 Agent）

仓库附带一份完整的 **Skill 文档**（位于 `src/cli/skills/bugpin-cli/`），指导 AI Agent 高效使用 `bugpin-cli` 并规避常见陷阱（id 截断、字段名差异、jq 写法、EE 端点 402 等）。安装后，当你和 Agent 对话时只要提到"看一下还有哪些待处理的 bug"、"把这个报告改成 resolved"、"邀请一个新管理员"等管理意图，Agent 会自动调用 CLI 完成任务。

### 安装

**方式 A：使用 [skills CLI](https://github.com/anthropics/skills)** （推荐）

```bash
npx skills add wendao-ai/bugpin
```

工具会克隆仓库，从根目录的 `skills/` 软链（指向 `src/cli/skills/`）找到 `bugpin-cli` skill 并安装到 `~/.claude/skills/` 或对应 Agent 的 skills 目录。

**方式 B：手动复制**

```bash
# Claude Code
cp -r src/cli/skills/bugpin-cli ~/.claude/skills/

# Codex
cp -r src/cli/skills/bugpin-cli ~/.codex/skills/

# Factory
cp -r src/cli/skills/bugpin-cli ~/.factory/skills/
```

或建立软链以便随仓库更新而同步：

```bash
ln -s "$(pwd)/src/cli/skills/bugpin-cli" ~/.claude/skills/bugpin-cli
```

### 验证 Skill 生效

Skill 是否被加载、何时触发，取决于 Agent 的 skills 索引机制。Claude Code 中可在新会话开始时查看 system reminder 是否列出 `bugpin-cli`；或直接对 Agent 说一句"看一下 BugPin 还有哪些待处理的 bug"，看是否自动用 CLI 响应。

### Skill 内容概览

- `SKILL.md` — 触发条件、心智模型、12 个高频使用模式、字段对照表、错误码处理、3 个组合任务样例、5 条戒律
- `references/commands.md` — 完整命令字典：逐子命令列出 flags / 必填项 / 返回字段 / EE 状态

直接阅读：[`src/cli/skills/bugpin-cli/SKILL.md`](src/cli/skills/bugpin-cli/SKILL.md)

### Skill 解决了什么问题

Agent 第一次接触一个 CLI 时，常踩这几类坑：

- 把表格里被截断的 id（前 24 字符）当完整 id 用 → 404
- 不同端点的 list 字段名不一致（reports 返回 `.data`、projects 返回 `.projects`、users 返回 `.users`） → jq 表达式总写错
- 在仓库外随便跑 `bun run cli` → 找不到 script
- 假设有 API Token → CE 版根本未实现

`bugpin-cli` skill 把这些坑都明确写进 SKILL.md 的"不要做的事"和"常见错误"，让 Agent 一上手就稳。

---

## 完整文档

完整文档：[docs.bugpin.io](https://docs.bugpin.io)

- [Docker 安装](https://docs.bugpin.io/installation/docker)
- [Bun 安装](https://docs.bugpin.io/installation/bun)
- [反向代理](https://docs.bugpin.io/installation/reverse-proxy)
- [服务端配置](https://docs.bugpin.io/configuration/server)
- [Widget 接入](https://docs.bugpin.io/widget/installation)
- [GitHub 集成](https://docs.bugpin.io/integrations/github)
- [API 参考](https://docs.bugpin.io/api/overview)
- [安全设置](https://docs.bugpin.io/security/settings)

## 技术栈

- **服务端**：Bun + Hono + SQLite
- **管理后台**：React + TanStack Query + Tailwind CSS
- **Widget**：Preact + Fabric.js + Shadow DOM
- **CLI**：TypeScript + Bun + Commander

## 支持

- [GitHub Issues](https://github.com/aranticlabs/bugpin/issues) — Bug 反馈与功能建议
- [文档站](https://docs.bugpin.io) — 指南与参考

## 贡献

欢迎 PR。提交前请阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。所有 commit 必须带 `--signoff`（DCO 要求）。

## 许可

BugPin 采用多许可证策略：

- **服务端 + 管理后台**：[AGPL-3.0](LICENSE)
- **Widget**：[MIT](https://github.com/aranticlabs/bugpin/blob/main/src/widget/LICENSE)
