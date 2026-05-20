# bugpin-cli 完整命令字典

每个命令以 `bugpin-cli` 开头（项目根目录）。`--json` 全局选项放在命令名之前。

## 目录

- [auth — 认证](#auth--认证)
- [reports — 报告](#reports--报告)
- [projects — 项目](#projects--项目)
- [users — 用户](#users--用户)
- [settings — 全局设置](#settings--全局设置)
- [branding — 品牌](#branding--品牌)
- [config — 本地配置](#config--本地配置)

---

## auth — 认证

### `auth login`
登录并把 session cookie 持久化到 `~/.bugpin/config.json`。

| 选项 | 必填 | 说明 |
|---|---|---|
| `-e, --email <email>` | 是 | 管理员邮箱 |
| `-p, --password <pwd>` | 否 | 不传则交互式输入（不进 shell 历史） |

返回：`{success, user}`。

### `auth logout`
登出，调用 `/api/auth/logout` 失败也会清本地。

### `auth whoami`
返回 `{success, authenticated, user}`。`authenticated=false` 即未登录。

### `auth change-password`
| 选项 | 必填 | 说明 |
|---|---|---|
| `-c, --current <pwd>` | 否 | 不传则交互 |
| `-n, --new <pwd>` | 否 | 不传则交互 |

成功后**当前 session 仍有效**。

### `auth config`
查看本地配置（不调网络）：`{baseURL, loggedIn, email}`。

---

## reports — 报告

### `reports list`
所有过滤器都是可选项，无参数则全列表。

| 选项 | 类型 | 说明 |
|---|---|---|
| `-p, --projectId <id>` | string | 项目过滤 |
| `--source <src>` | `widget\|manual` | 来源 |
| `--status <list>` | 逗号分隔 | `open,in_progress,resolved,closed` 任意组合 |
| `--priority <list>` | 逗号分隔 | `lowest,low,medium,high,highest` |
| `-a, --assignedTo <userId>` | string | 指派给某 userId |
| `-s, --search <q>` | string | 全文搜索（标题/描述/反馈人姓名/邮箱） |
| `--page <n>` | int | 默认 1 |
| `--limit <n>` | int | 默认 20，最大约 100 |
| `--sortBy <field>` | string | 默认 `createdAt` |
| `--sortOrder <dir>` | `asc\|desc` | 默认 desc |

返回：`{success, data: [...], total, page, limit, totalPages}`。

### `reports get <id>`
返回 `{success, report, files}`。`files` 含每个附件的 `id`、`type`、`mimeType`、`sizeBytes`、`width`、`height`。

### `reports stats`
| 选项 | 说明 |
|---|---|
| `-p, --projectId <id>` | 仅看某项目 |

返回 `{success, stats: {total, byStatus, byPriority}}`。

### `reports create`
**权限**：admin/editor。

| 选项 | 必填 | 说明 |
|---|---|---|
| `-p, --projectId <id>` | 是 | 目标项目 |
| `-t, --title <title>` | 是 | 标题 |
| `-d, --description <desc>` | 否 | 描述 |
| `--priority <p>` | 否 | `lowest..highest` |
| `--assignedTo <userId>` | 否 | 空字符串 `''` 表示取消指派 |
| `--reporterName <name>` | 否 | 反馈人姓名 |
| `--reporterEmail <email>` | 否 | 反馈人邮箱 |
| `--url <url>` | 否 | 相关页面 URL |
| `--channel <ch>` | 否 | `email\|chat\|phone\|qa\|other` |
| `-f, --file <path...>` | 否 | 附件路径，可多次指定。会自动走 multipart |

### `reports update <id>`
**权限**：admin/editor。

| 选项 | 说明 |
|---|---|
| `--status <s>` | `open\|in_progress\|resolved\|closed` |
| `--priority <p>` | `lowest..highest` |
| `--title <t>` | 新标题 |
| `--description <d>` | 新描述 |
| `--assignedTo <userId>` | 指派；`''` 取消指派 |

### `reports delete <id>`
**权限**：admin。

### `reports bulk-update`
**权限**：admin/editor。

| 选项 | 必填 | 说明 |
|---|---|---|
| `--ids <ids>` | 是 | 逗号分隔的 reportId |
| `--status <s>` | 否 | 同 update |
| `--priority <p>` | 否 | 同 update |
| `--assignedTo <userId>` | 否 | 同 update |

返回：`{success, updated: <count>}`。

### `reports forward <reportId> <integrationId>`
**权限**：admin。把报告转发到第三方集成。

| 选项 | 说明 |
|---|---|
| `--body <json>` | 附加 JSON 字符串 |

### `reports files <id>`
列出报告附件元数据。

### `reports download <reportId> <fileId>`
| 选项 | 默认 | 说明 |
|---|---|---|
| `-o, --output <path>` | `.` | 目录或具体文件名。目录会生成 `<fileId>.bin` |

### `reports retry-sync <id>`
**权限**：admin。重试 GitHub 同步。

---

## projects — 项目

**所有命令均需 admin。**

### `projects list`
返回 `{success, projects: [...]}`，每项含 `id`、`name`、`isActive`、`reportsCount`、`apiKey`、`createdAt`。

### `projects get <id>`
返回 `{success, project}`。

### `projects create`
| 选项 | 必填 | 说明 |
|---|---|---|
| `-n, --name <name>` | 是 | 项目名 |
| `-d, --description <desc>` | 否 | 描述 |
| `--allowedDomains <list>` | 否 | widget 允许加载的域名，逗号分隔 |
| `--inactive` | 否 | 创建为停用 |

### `projects update <id>`
| 选项 | 说明 |
|---|---|
| `-n, --name <name>` | 改名 |
| `-d, --description <desc>` | 改描述 |
| `--allowedDomains <list>` | 覆盖 widget 域名白名单 |
| `--active <bool>` | `true`/`false` |

### `projects delete <id>`
删除项目及其所有报告（不可逆，先备份）。

### `projects regenerate-key <id>`
重置 widget API Key。旧 key 立即失效。

### `projects reorder`
| 选项 | 必填 | 说明 |
|---|---|---|
| `--ids <list>` | 是 | 按目标顺序的 projectId 列表，逗号分隔 |

---

## users — 用户

### `users list` （admin）
返回 `{success, users: [...]}`，每项含 `id`、`email`、`name`、`role`、`isActive`、`lastLoginAt`。

### `users assignable` （admin/editor）
仅返回 `isActive=true` 的用户，用于 `reports update --assignedTo`。

### `users get <id>` （admin）

### `users create` （admin）
立即创建，**不发邀请邮件**。

| 选项 | 必填 | 说明 |
|---|---|---|
| `-e, --email <email>` | 是 | |
| `-n, --name <name>` | 是 | |
| `-p, --password <pwd>` | 是 | 初始密码 |
| `-r, --role <role>` | 否 | `admin\|editor\|viewer`，默认 viewer |

### `users invite` （admin）
发邀请邮件，**前提**：服务端 SMTP 已配置 + `appUrl` 设置（否则邀请链接无法点）。

| 选项 | 必填 | 说明 |
|---|---|---|
| `-e, --email <email>` | 是 | |
| `-n, --name <name>` | 是 | |
| `-r, --role <role>` | 否 | 默认 viewer |

响应中若 `warning` 非空，说明邀请已发但 `appUrl` 没设。

### `users resend-invitation <id>` （admin）

### `users update <id>` （admin）
| 选项 | 说明 |
|---|---|
| `-n, --name <name>` | |
| `-e, --email <email>` | |
| `-r, --role <role>` | |
| `--active <bool>` | `true`/`false` |

### `users delete <id>` （admin）
**不能删除当前登录用户**（服务端校验）。

### `users me profile`
更新当前用户：`-n/--name`、`-e/--email`。

### `users me upload-avatar <file>`
仅支持 jpeg/png/webp/gif，≤5MB。

### `users me download-avatar <filename>`
| 选项 | 默认 |
|---|---|
| `-o, --output <path>` | `.` |

### `users me delete-avatar`

---

## settings — 全局设置

**所有命令均需 admin。**

### `settings get`
返回所有设置，字段众多。常关心字段：
- `appName`、`appUrl`
- `smtpEnabled`、`smtpConfig`
- `s3Enabled`、`s3Config`
- `retentionDays`、`sessionMaxAgeDays`、`invitationExpirationDays`
- `branding.primaryColor`
- `notifications.*` / `reporterNotifications.*`
- `widgetLauncherButton.*` / `widgetDialog.*`
- `screenshot.*`

### `settings update`
| 选项 | 说明 |
|---|---|
| `-f, --file <path>` | 整段 JSON 补丁文件，键名同 `settings get` |
| `--kv <pair...>` | `key=value` 多次。value 会先尝试 `JSON.parse`，失败按字符串。例：`--kv smtpEnabled=true --kv appName='"BugPin"'` |

**EE 限制**：传 `emailTemplates`、`s3Enabled`、`s3Config` 会返回 402（CE 版不支持，CLI 会翻译错误）。

### `settings test-email`
不会落库，只验证 SMTP 配置能否发邮件。

| 选项 | 必填 | 说明 |
|---|---|---|
| `--host <host>` | 是 | SMTP 主机 |
| `--port <n>` | 是 | 端口（数字） |
| `--from <email>` | 是 | 发件人 |
| `--to <email>` | 是 | 测试收件人 |
| `--user <user>` | 否 | SMTP 用户名 |
| `--password <pwd>` | 否 | SMTP 密码 |
| `--app-name <name>` | 否 | 邮件中显示的应用名 |

### `settings cache-invalidate`
当外部进程改了 DB 中的设置（或想确保最新），调一下让服务器丢弃缓存。

---

## branding — 品牌

CE 版仅 `widget-primary-colors` 一项可改，logo/favicon/icon/主色/admin 主题色 等均是 EE 功能（未挂入口）。

### `branding config`
**公开端点**（不需要登录）。返回当前品牌配置：`primaryColor`、`logoLightUrl`、`logoDarkUrl`、`widgetPrimaryColors`、`adminThemeColors` 等。

### `branding set-widget-colors`
| 选项 | 必填 | 说明 |
|---|---|---|
| `--colors <json>` | 是 | JSON 字符串。可用字段示例： |

```json
{
  "lightButtonColor": "#FF0000",
  "lightTextColor": "#ffffff",
  "lightButtonHoverColor": "#CC0000",
  "lightTextHoverColor": "#ffffff",
  "lightBackgroundColor": "#ffffff",
  "lightSecondaryColor": "#f5f5f5",
  "lightInputColor": "#ffffff",
  "lightForegroundColor": "#0a0a0a",
  "darkButtonColor": "#FF0000",
  "darkTextColor": "#ffffff",
  "darkButtonHoverColor": "#CC0000",
  "darkTextHoverColor": "#ffffff",
  "darkBackgroundColor": "#0a0a0a",
  "darkSecondaryColor": "#262626",
  "darkInputColor": "#1a1a1a",
  "darkForegroundColor": "#fafafa"
}
```

只需要传你要改的字段，其他保持不变。

---

---

## config — 本地配置

不调用网络，纯操作 `~/.bugpin/config.json`（或 `BUGPIN_CONFIG_PATH` 指定的路径）。

### `config show`
返回 `{baseURL, loggedIn, email, configPath}`。`auth config` 是别名（已存在的兼容入口）。

### `config set-url <url>`
将 baseURL 写入配置文件，**优先级高于** `BUGPIN_URL` 环境变量。

校验：
- 必须是合法 URL（`new URL()` 能解析）
- 协议必须是 `http` 或 `https`
- 自动去除尾部斜杠（一个或多个）

适用场景：新机器开箱、CI 环境、在登录前预设 URL。`auth login` 成功后也会自动写入 baseURL，所以本命令只在"登录前要先设 URL"时才需要。

### `config reset`
重置 baseURL 回内置默认（`http://localhost:3000`）+ 清除 sessionCookie/email。

| 选项 | 说明 |
|---|---|
| `--keep-session` | 仅重置 baseURL，保留登录态 |

---

## 全局选项

| 选项 | 位置 | 说明 |
|---|---|---|
| `--json` | 必须放在命令名之前 | 切换为原始 JSON 输出 |
| `--help`、`-h` | 任意位置 | 查看当前层级的帮助 |
| `--version`、`-V` | 顶层 | 输出版本号 |

## 环境变量

| 变量 | 作用 |
|---|---|
| `BUGPIN_URL` | 覆盖默认的 `http://localhost:3000` |
| `BUGPIN_CONFIG_PATH` | 覆盖 `~/.bugpin/config.json`（测试隔离用，正常勿用） |
| `HOME` | 用于解析 `~/.bugpin/`（优先于 `os.homedir()`） |

## 退出码

- 成功：`0`
- 任何错误（含 4xx/5xx、网络错误、参数错误）：`1`

JSON 模式下错误也会写到 stderr 的结构化 JSON：`{success: false, error, message, hint}`。
