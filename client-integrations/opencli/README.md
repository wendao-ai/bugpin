# BugPin OpenCLI adapter

把 BugPin 后台从「打开浏览器点鼠标」变成「shell 一行命令 / agent 一次工具调用」的客户端集成。

```bash
opencli bugpin list-reports --status open --limit 20
opencli bugpin get-report rpt_xxx
opencli bugpin update-report rpt_xxx --status resolved
opencli bugpin stats
opencli bugpin download-file rpt_xxx file_yyy --out /tmp/screenshot.png
opencli bugpin list-files rpt_xxx
```

## 为什么需要

- **PM 视角**：批量过反馈、按页面归类、对接 Linear / 飞书时不用手点 admin
- **Agent 视角**：Claude Code 等 LLM 工具直接调命令拿结构化输出（table / json / yaml），免去 OAuth / API token 配置
- **DevOps 视角**：CI / 脚本一行 `update-report --status resolved` 把 PR 与反馈联动

## 安装（一次性）

前置：[OpenCLI](https://github.com/jackwener/opencli) 已装好且 `opencli doctor` 通过（包括 Chrome 扩展，详见 OpenCLI 文档）。

```bash
# 1. 复制 6 个 adapter 到 OpenCLI 私人 cli 目录
mkdir -p ~/.opencli/clis/bugpin
cp client-integrations/opencli/adapters/*.js ~/.opencli/clis/bugpin/

# 2. 复制站点记忆（供 opencli browser verify / 字段对比用）
mkdir -p ~/.opencli/sites/bugpin/verify ~/.opencli/sites/bugpin/fixtures
cp client-integrations/opencli/site-memory/endpoints.json ~/.opencli/sites/bugpin/
cp client-integrations/opencli/site-memory/notes.md      ~/.opencli/sites/bugpin/
cp client-integrations/opencli/site-memory/verify/*.json  ~/.opencli/sites/bugpin/verify/
cp client-integrations/opencli/site-memory/fixtures/*.json ~/.opencli/sites/bugpin/fixtures/

# 3. 验证命令注册
opencli bugpin --help
```

预期输出：

```
Usage: opencli bugpin <command> [args] [options]

download-file [reportId] [fileId]  [read]  Download a report attachment ...
get-report [id]                    [read]  Get full detail of a single report
list-files [reportId]              [read]  List attachments of a report
list-reports [options]             [read]  List bug reports with filters
stats [options]                    [read]  Overview stats: counts ...
update-report [id] [options]       [write] Update report status / priority ...
```

## 鉴权

adapter 默认 `browser: true + page.getCookies()`，**零手动配置**——只要 Chrome 里已经登录你的 BugPin 实例（默认假设 `bugpin.migelab.com`），opencli 自动读 session cookie。

CI / headless 兜底：环境变量 `BUGPIN_SESSION`（cookie value 整串）。

> **改 BugPin 部署域名**：默认硬编码 `https://bugpin.migelab.com`。其他部署需要在 6 个 adapter 文件里把 `BASE` / `HOST` 常量改成你的域名。后续可改为读环境变量 `BUGPIN_BASE_URL`。

## 命令速查

| 命令 | 作用 | 关键参数 |
|---|---|---|
| `list-reports` | 报告列表，支持过滤 | `--status open` / `--priority high,highest` / `--search /lims/order` / `--projectId proj_xxx` / `--limit 50` / `--sortBy createdAt` / `--sortOrder desc` |
| `get-report <id>` | 单条详情（含 metadata 全字段、console errors、network errors）| positional `<id>` |
| `update-report <id>` | 改 status / priority / assignee / title / description | `--status resolved` / `--priority high` / `--assignedTo usr_xxx` |
| `list-files <reportId>` | 列报告附件 | positional `<reportId>` |
| `download-file <reportId> <fileId>` | 下载附件二进制 | `--out /tmp/x.png` |
| `stats` | 全局/按 project 聚合 | `--projectId proj_xxx` |

输出格式（OpenCLI 通用）：`--format table` (默认) / `plain` / `json` / `yaml` / `md` / `csv`

## 真实使用案例

### 批量处理一周反馈（米格 LIMS）

```bash
# 1. 拉所有 open 反馈，按页面分布
opencli bugpin list-reports --status open --limit 50 --format json \
  | jq -r '.[] | "\(.pageUrl)\t\(.title)"' | sort | uniq -c | sort -rn

# 2. 把某条反馈批量标 in_progress（开始做的时候）
for id in rpt_xxx rpt_yyy rpt_zzz; do
  opencli bugpin update-report $id --status in_progress
done

# 3. 修复完一条后标 resolved（commit message 里留 rpt_id 方便追溯）
opencli bugpin update-report rpt_xxx --status resolved

# 4. 周末统计
opencli bugpin stats --format yaml
```

### Agent triage 流程

PM 让 Claude Code 跑：

```
你：拉一下今天的 BugPin 反馈，按页面分组给我清单
Claude：(调用 opencli bugpin list-reports --limit 50)
        → 按 metadata.url 聚类
        → 输出 markdown 表
```

详见 mige-lims 项目的 `requirement-intake` skill。

## 站点记忆 schema

`opencli browser verify <site>/<cmd>` 会自动读 `~/.opencli/sites/<site>/verify/<cmd>.json` 做结构期望校验。本目录下 `site-memory/verify/*.json` 是 mige-lims 部署（bugpin.migelab.com）跑通后的样本：

- `list-reports.json` — 期望 columns + types + patterns（如 `id` 格式 `^rpt_[a-f0-9]{32}$`）
- `get-report.json` — 字段最少 19 行
- `stats.json` — dimension/value/count 三列输出

`fixtures/` 下是真实响应样本（去 cookie / token 后），给字段对比和离线 replay 用。

## 加新命令

对应一个新 endpoint，参考 `adapters/list-reports.js`（COOKIE + 多过滤参数）或 `adapters/update-report.js`（write 命令）。骨架：

```js
import { cli, Strategy } from '@jackwener/opencli/registry';
import { AuthRequiredError, CliError } from '@jackwener/opencli/errors';

const BASE = 'https://bugpin.migelab.com';
const HOST = 'bugpin.migelab.com';

async function readSession(page) {
  if (page) {
    try {
      const cookies = await page.getCookies({ domain: HOST });
      const s = (cookies || []).find((c) => c.name === 'session');
      if (s?.value) return `session=${s.value}`;
    } catch { /* fallback */ }
  }
  const env = process.env.BUGPIN_SESSION;
  if (env) return `session=${env}`;
  throw new AuthRequiredError(HOST);
}

cli({
  site: 'bugpin',
  name: '<your-command>',
  description: '...',
  domain: HOST,
  strategy: Strategy.COOKIE,
  browser: true,
  navigateBefore: false,
  access: 'read', // or 'write'
  args: [/* ... */],
  columns: [/* ... */],
  func: async (page, args) => {
    const cookie = await readSession(page);
    // ... fetch + map
  },
});
```

## 已知 backlog

- [ ] `comment-report` 子命令：把 commit SHA / Linear issue 写回 BugPin，让反馈人闭环看到
- [ ] `BUGPIN_BASE_URL` 环境变量替代硬编码 `BASE` 常量，支持其他 BugPin 部署
- [ ] FTS5 special char 搜索 bug（已在 BugPin 后端独立修复，adapter 不受影响）
