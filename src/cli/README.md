# @bugpin/cli

BugPin 管理员命令行工具。封装 `/api/*` 中所有 CE 版可用的管理员接口，覆盖 reports / projects / users / settings / branding 五大组共 40 个端点。

## 设计

- **语言**：TypeScript（运行时 Bun，复用项目工具链）
- **CLI 框架**：commander
- **交互**：prompts（密码、REPL）
- **HTTP**：axios，复用 admin 前端同款
- **认证**：仅 cookie session（与浏览器后台一致）；不支持 API Token（CE 版后端未实现）
- **EE 端点**：刻意不挂入口，避免误导用户
- **REPL**：无参数启动时进入交互式 shell

## 安装

**推荐：全局安装**（一次安装，任何目录可用）：

```bash
cd src/cli       # ⚠️ 必须进 src/cli，不能在仓库根跑 bun link
bun install
bun link         # 注册 bugpin-cli 到 ~/.bun/bin/
which bugpin-cli # 验证：应输出 ~/.bun/bin/bugpin-cli
```

确保 `~/.bun/bin` 在 PATH 中（bun 默认会处理）。卸载：在 `src/cli/` 目录跑 `bun unlink`。

> 易踩坑：在仓库根目录跑 `bun link` 会注册整个 monorepo 包，不会产生 `bugpin-cli` 命令。误操作后先在根跑 `bun unlink` 撤销，再去 `src/cli` 重做。

**仅本地开发**（不全局安装）：

```bash
# 在项目根
bun install
bugpin-cli <command>   # 等价于 bun run --cwd src/cli start <command>
```

## 用法

全局安装后，任意目录直接调用 `bugpin-cli`：

```bash
# 登录（密码可省略，会交互式询问）
bugpin-cli auth login -e admin@example.com

# 列报告
bugpin-cli reports list --status open,in_progress --limit 50

# JSON 输出（脚本场景）
bugpin-cli --json projects list

# 创建带附件的手动报告
bugpin-cli reports create \
  --projectId proj_xxx \
  --title "登录页 500 错误" \
  --description "复现：访问 /login" \
  --priority high \
  --channel email \
  --file ./screenshot.png \
  --file ./logs.txt
```

### REPL 模式

不带参数启动：

```bash
bugpin-cli
# 进入：bugpin>
bugpin> auth login -e admin@example.com
bugpin> projects list
bugpin> reports list --projectId proj_xxx
bugpin> exit
```

### 设置 baseURL

优先级：`~/.bugpin/config.json` 中的 baseURL > `BUGPIN_URL` 环境变量 > 默认 `http://localhost:3000`。

```bash
# 推荐：一次性写入配置文件
bugpin-cli config set-url https://bugpin.your-domain.com

# 临时覆盖（不写入配置文件）
BUGPIN_URL=https://other.example.com bugpin-cli reports list

# 查看当前配置
bugpin-cli config show

# 重置（清 URL 和登录态；--keep-session 仅清 URL）
bugpin-cli config reset
```

`auth login` 成功后会自动把 baseURL 写入配置，所以多数场景**先 set-url 再 login**，之后命令都不用传 URL。

配置文件位置：`~/.bugpin/config.json`（权限 0600，包含 session cookie，请妥善保管）。

## 命令清单

### auth
- `login` — 登录并保存 session
- `logout` — 登出并清除本地 cookie
- `whoami` — 查看当前身份
- `change-password` — 修改密码
- `config` — 查看 CLI 当前配置

### reports
- `list` — 列报告（过滤 + 分页 + 排序）
- `get <id>` — 详情（含文件元数据）
- `stats` — 统计概览
- `create` — 创建手动报告（admin/editor，支持 `--file` 多次）
- `update <id>` — 更新字段
- `delete <id>` — 删除（admin）
- `bulk-update` — 批量更新
- `forward <reportId> <integrationId>` — 转发到第三方
- `files <id>` — 列出报告附件
- `download <reportId> <fileId>` — 下载附件
- `retry-sync <id>` — 重试 GitHub 同步

### projects
- `list` / `get <id>` / `create` / `update <id>` / `delete <id>`
- `regenerate-key <id>` — 重置项目 API Key
- `reorder --ids id1,id2,id3` — 重排序

### users
- `list` / `assignable` / `get <id>`
- `create` — 立即创建（无邀请）
- `invite` — 发送邀请邮件
- `resend-invitation <id>`
- `update <id>` / `delete <id>`
- `me profile` — 更新个人资料
- `me upload-avatar <file>` — 上传头像
- `me download-avatar <filename>` — 下载头像
- `me delete-avatar`

### settings
- `get` / `update --file patch.json | --kv key=value...`
- `test-email --host ... --port ... --from ... --to ...` — 测试 SMTP
- `cache-invalidate`

### branding
- `config` — 查看品牌配置（公开）
- `set-widget-colors --colors '{"primary":"#FF0000"}'`

## 错误处理

- HTTP 401 → 提示 `请运行 bugpin-cli login`
- HTTP 403 → 提示权限不足
- HTTP 402 → 提示该端点为 Enterprise 功能
- 连接失败 → 提示检查 baseURL

## 不支持的端点（明确说明）

以下为 EE 专属端点，CLI **未提供**入口：

- `/api/tokens/*` （API Tokens）
- `/api/settings/email-templates/*`
- `/api/branding/{logo,favicon,icon,primary-color,admin-theme-colors,reset}/*`
- `/api/white-label/*`
- `/api/templates/*`

如需访问，请订阅 Enterprise 版本。
