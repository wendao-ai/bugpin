---
name: bugpin-cli
description: 通过 `bugpin-cli` 命令行操作 BugPin（自托管 Bug 上报系统）管理员后台。当用户要求查看/筛选 bug 报告、管理项目或用户、修改全局设置、下载报告附件、回复反馈人、批量更新报告状态/优先级/指派、检查 SMTP 配置、查看品牌配置，或任何针对 BugPin（bugpin.* 域名、`/api/*` 路由）的运维操作时使用本 skill。即使用户没说"用 CLI"，只要意图是访问 BugPin 后台数据（"看一下还有哪些待处理的 bug"、"把这个报告改成 resolved"、"邀请一个新管理员"），都应优先用此 skill 而不是 curl 或浏览器截屏。
---

# bugpin-cli — BugPin 管理员命令行使用指南

本 skill 教 agent 如何用 `bugpin-cli` 高效完成 BugPin 后台运维。CLI 源码位于本仓库 `src/cli/`，封装了 5 大组共 40 个管理员 REST 端点，**仅支持 CE 版功能**（EE 端点未挂入口）。

## 核心心智模型

- **仅 cookie session 认证**：所有命令前必须先 `auth login`；session 存在 `~/.bugpin/config.json`（0600 权限）。这与浏览器后台同源，没有 API Token 概念。
- **两种输出模式**：默认人类可读（list 类命令是表格，其他是键值对）；加 `--json` 切换为脚本可解析的原始响应 JSON。
- **完整 ID**：list 命令的 `id` 列**显示完整 36 字符**（避免截断后再传给 `get/update/delete` 报 NOT_FOUND）。直接复制即可。
- **基础 URL**：默认 `http://localhost:3000`，通过 `BUGPIN_URL` 环境变量切换到生产实例。

## 安装与运行

`bugpin-cli` 通过 `bun link` 全局安装，**任何目录均可直接调用**。无需进入仓库目录。

**检查是否已安装**：
```bash
which bugpin-cli      # 应输出 ~/.bun/bin/bugpin-cli 或类似路径
bugpin-cli --version  # 输出版本号即可
```

**如果未安装**（一次性操作）：
```bash
cd /path/to/bugpin/src/cli   # ⚠️ 必须是 src/cli/，不是仓库根
bun install                  # 装依赖
bun link                     # 注册全局，自动把 bugpin-cli 加到 ~/.bun/bin/
```

确保 `~/.bun/bin` 在 PATH 中（bun 默认会装好）。

⚠️ **常见错误**：在仓库根目录跑 `bun link` 会注册整个 monorepo 包（无 bin），不会产生 `bugpin-cli` 命令。必须进 `src/cli/` 目录。如果误操作了，先在根目录跑 `bun unlink` 撤销，再去 `src/cli` 重做。

**正常用法**（任意目录）：
```bash
BUGPIN_URL=https://bugpin.example.com bugpin-cli <command>
```

**服务端 URL** 的优先级：`~/.bugpin/config.json` 里的 baseURL > `BUGPIN_URL` 环境变量 > 内置默认 `http://localhost:3000`。

推荐用 `config set-url` 一次性写入配置文件，之后免每次传：

```bash
bugpin-cli config set-url https://bugpin.example.com   # 一次性设置
bugpin-cli config show                                  # 查看当前 baseURL / 登录态 / 配置文件路径
bugpin-cli config reset --keep-session                  # 重置 URL 但保留登录态
bugpin-cli config reset                                 # 全清（URL + cookie）
```

`auth login` 成功后也会自动把 baseURL 写入配置文件。所以**只有要在登录前显式预设 URL** 时才需要 `config set-url`（新机器/CI 场景）。

## 必须先做的事：登录

```bash
# 命令行非交互：
bugpin-cli auth login -e admin@example.com -p '<密码>'

# 交互式（避免密码进 shell 历史）：
bugpin-cli auth login -e admin@example.com
# 然后输入密码

# 验证身份：
bugpin-cli auth whoami
# 默认输出里 user 是整行 JSON 字符串；要稳拿 role 用 --json：
bugpin-cli --json auth whoami | jq '.authenticated, .user.role'
```

如果任何后续命令报 `401 / UNAUTHORIZED`，**第一反应是重跑 login**，而不是查代码。Session 默认 7 天有效（`sessionMaxAgeDays`），过期后需重登。

## 五大命令组速查

详细参数见 `references/commands.md`。这里给最常见的 12 个模式。

### 1. 看报告（reports）

```bash
# 最常用：列待处理（open + in_progress）
bugpin-cli reports list --status open,in_progress --limit 50

# 按项目过滤
bugpin-cli reports list --projectId proj_xxx --priority highest

# 关键词搜索（标题 + 描述 + 反馈人姓名/邮箱）
bugpin-cli reports list --search "登录页"

# 统计概览（数量分布）
bugpin-cli reports stats
# 输出 { total, byStatus, byPriority }

# 看单个报告详情（含 metadata 截图等）
bugpin-cli reports get rpt_<完整id>

# 列出报告附件
bugpin-cli reports files rpt_<完整id>

# 下载附件
# 注意：-o 传目录时保存为 <fileId>.bin（不自动加扩展名）
# 想要正确扩展名，传完整文件名：
bugpin-cli reports download rpt_<id> file_<id> -o /tmp/shot.png

# 想批量下且保留服务端文件名，先查 mimeType + filename：
bugpin-cli --json reports files rpt_<id> | jq -r '.files[] | "\(.id) \(.filename)"'
```

### 2. 改报告状态/指派/批量

```bash
# 单条更新
bugpin-cli reports update rpt_<id> --status resolved --priority high
bugpin-cli reports update rpt_<id> --assignedTo usr_<id>
bugpin-cli reports update rpt_<id> --assignedTo ''   # 取消指派

# 批量（admin/editor）。注意 shell 命令行约 256KB 长度上限，每条 id 约 40 字符
# → 实践上一次最多 ~5000 id；超过请分批 chunked。
bugpin-cli reports bulk-update --ids rpt_a,rpt_b,rpt_c --status closed

# 删除（admin）
bugpin-cli reports delete rpt_<id>

# 创建手动报告（来自邮件/电话反馈），可带多个附件
bugpin-cli reports create \
  --projectId proj_xxx --title "登录失败" --priority high \
  --channel email --reporterEmail user@x.com \
  --file ./shot.png --file ./logs.txt
```

### 3. 项目（projects）

```bash
bugpin-cli projects list                                   # 含 reportsCount
bugpin-cli projects get proj_<id>                          # 含 apiKey
bugpin-cli projects create -n "新项目" -d "描述"
bugpin-cli projects update proj_<id> --active false        # 停用
bugpin-cli projects regenerate-key proj_<id>               # 重置 widget API key
bugpin-cli projects reorder --ids proj_a,proj_b,proj_c
```

### 4. 用户（users）

```bash
bugpin-cli users list                                      # 全部用户
bugpin-cli users assignable                                # 只看活跃可指派的
bugpin-cli users invite -e new@x.com -n "新人" -r editor   # 发邀请邮件
bugpin-cli users create -e u@x.com -n 直接 -p Pass123! -r viewer  # 不发邮件直接建
bugpin-cli users update usr_<id> --role admin --active true
bugpin-cli users delete usr_<id>                           # 不能删自己

# 当前用户的个人资料
bugpin-cli users me profile --name "新名字"
bugpin-cli users me upload-avatar ./me.png
```

### 5. 设置 + 品牌（settings / branding）

```bash
# 看全部设置（json 字段众多，建议加 --json 再 jq）
bugpin-cli --json settings get | jq '.settings | {appName, smtpEnabled, retentionDays}'

# 改设置：单字段或批量
bugpin-cli settings update --kv appName=BugPin --kv retentionDays=30
bugpin-cli settings update --file ./patch.json   # 大改用文件

# 测 SMTP 配置（不落库）
bugpin-cli settings test-email \
  --host smtp.gmail.com --port 587 \
  --from no-reply@x.com --to me@x.com \
  --user no-reply@x.com --password '<app password>'

# 清缓存（改了设置但页面没生效时用）
bugpin-cli settings cache-invalidate

# 品牌（CE 版只能改 widget 主色，其他色/logo 是 EE）
bugpin-cli branding config
bugpin-cli branding set-widget-colors --colors '{"lightButtonColor":"#FF0000"}'
```

## REPL 模式（agent 通常不该用）

`bugpin-cli`（不带任何子命令）会进入交互式 REPL，等待 stdin 输入。**agent 在非交互环境下不要这样跑** —— 会卡死等输入。始终带子命令调用。

## 输出模式选择

| 场景 | 用法 |
|---|---|
| 想给人看 / 大致浏览 | 默认（表格 + 键值对） |
| 要解析提取某字段 | `bugpin-cli --json <cmd> \| jq '...'` |
| 要拿 list 中所有 id 做下一步 | `bugpin-cli --json reports list --status open \| jq -r '.data[].id'` |

`--json` 必须放在命令名之前（commander 全局选项）。

## 服务端响应字段对照（容易踩坑）

不同端点的 list 字段名不一致，**写 jq 时容易写错**：

| 端点 | list 字段 | 单项字段 |
|---|---|---|
| `reports list` | `.data[]` | — |
| `reports get` | — | `.report` + `.files` |
| `projects list` | `.projects[]` | `.project` |
| `users list` | `.users[]` | `.user` |
| `auth whoami` | — | `.user` |
| `settings get` | — | `.settings` |
| `branding config` | — | `.config` |
| `reports stats` | — | `.stats` |

记不住时先 `bugpin-cli --json <cmd> | jq 'keys'` 查一下。

## 错误码 → 该做什么

| HTTP | error 字段 | 怎么办 |
|---|---|---|
| 401 | UNAUTHORIZED / SESSION_EXPIRED | 重跑 `auth login` |
| 402 | FEATURE_NOT_LICENSED | 这是 EE 功能（CLI 不该挂入口；若出现说明有疏漏），告诉用户当前 CE 版不支持 |
| 403 | FORBIDDEN | 当前账户角色不够，需 admin/editor。检查 `auth whoami` |
| 404 | NOT_FOUND | 多半是 **id 不完整**（被截断的 24 字符 id）。重新从 list 复制完整 36 字符 id |
| 网络错误 | — | 检查 `BUGPIN_URL` 是否正确：`bugpin-cli auth config` |

## 常见组合任务

**任务：找出某项目所有未指派的高优报告**
```bash
bugpin-cli --json reports list --projectId proj_xxx --status open,in_progress --priority high,highest \
  | jq -r '.data[] | select(.assignedTo == null) | [.id, .title] | @tsv'
```

**任务：把某反馈人的所有未处理报告批量改为 in_progress**
```bash
IDS=$(bugpin-cli --json reports list --search "yanglixia@labideas.cn" --status open \
  | jq -r '.data[].id' | paste -sd,)
bugpin-cli reports bulk-update --ids "$IDS" --status in_progress
```

**任务：把项目 X 最近 7 天的截图打包**
```bash
PROJ=proj_xxx
OUT=/tmp/bp
mkdir -p "$OUT"   # 关键：reports download 不会自动建目录

bugpin-cli --json reports list --projectId "$PROJ" --limit 100 \
  | jq -r '.data[].id' \
  | while read rid; do
      bugpin-cli --json reports files "$rid" \
        | jq -r --arg rid "$rid" '.files[] | select(.type=="screenshot") | "\($rid)\t\(.id)"'
    done \
  | while IFS=$'\t' read rid fid; do
      bugpin-cli reports download "$rid" "$fid" -o "$OUT/$rid-$fid.png"
    done
```

## 不要做的事

- **不要 curl `/api/*`** — CLI 已经处理 cookie、错误翻译、字段提取，重复造轮子且容易漏 cookie。
- **不要把 list 表格里的 id 截断后直接用** — 当前 list 已经显示完整 id，但 agent 自己别再 truncate。
- **不要假设 API Token 可用** — CE 版后端 `requireEEFeature('api-access')`，401 + cookie 是唯一路径。
- **不要在脚本里硬编码密码** — 至少用环境变量或 `.env` 文件，且 `~/.bugpin/config.json` 已含 session cookie，登录一次后再跑命令就不需要密码了。
- **不要忘了登出** — 操作完后 `bugpin-cli auth logout` 清除本地 session，尤其是共享主机。

## 完整命令字典

详细参数清单见 `references/commands.md`（每个子命令的 flags、必填项、返回字段）。当本文件没覆盖你需要的命令变体时去查那个文件。
