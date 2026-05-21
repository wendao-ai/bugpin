# bugpin — OpenCLI adapter 站点笔记

> site name: `bugpin`（目录命名按 site 名而非 domain）
> domain: bugpin.migelab.com

## 2026-05-18 (晚) by Claude/lula —— adapter 跑通

opencli v1.7.22 升级后浏览器联通 OK，所有 adapter 改为 `browser: true + page.getCookies()`
自动读 Chrome 已登录的 session cookie，**零手动配置**。env var `BUGPIN_SESSION` 保留作 CI 兜底。

3 个 read 命令 `opencli browser verify` 全绿：list-reports / get-report / stats。
update-report / download-file 因副作用未实测但代码路径同 read。

**踩到的坑**：

1. **trailing slash 必须去**：`/api/reports/?limit=1` 返 404，`/api/reports?limit=1` 才 200。
   Hono v1.0.14 部署对子路由器挂载点严格不接受尾斜杠。`/api/reports/<id>` 这种带 path
   param 的不受影响（因为 trailing 在 path 中间）。
2. **site memory 目录用 site name 不是 domain**：`~/.opencli/sites/bugpin/` 才对。
3. **stats 响应嵌套一层**：`{ success, stats: { total, byStatus, byPriority, bySource } }`，
   不是 `{ success, byStatus, ... }` 平铺。

**BugPin 后端遗留问题**（独立 PR 处理，不是 adapter 的事）：

1. `search` 含特殊字符 `/` 时整个 SQL 崩，返 500——FTS5 MATCH 把 `/lims/sample` 当
   malformed expression。修法：search 词包装成 FTS5 phrase `"..."` 或 escape 特殊字符。
2. FTS5 默认 tokenizer 不分词中文——"工作台" 搜不出标题含"工作台"的报告。修法：
   FTS5 改 unicode61 + tokenchars 或上 jieba（较重）；或后端 search 路径用 LIKE 兜底。

---

## 2026-05-18 (早) by Claude/lula —— 首次创建

BugPin 是 lula 在 wendao-ai/bugpin（重定向自 wuzhiguocarter）维护的自托管 bug 上报系统 fork，
部署在 bugpin.migelab.com。当前版本 v1.0.14。

### 鉴权

**仅支持 session cookie**：

- BugPin CE 版没有 API token——`/api/api-tokens` 被 `requireEEFeature('api-access')` gate 卡住返回 402
- 长期想自动登录刷新 session 需要：(a) 让 adapter 支持 email+password 自动 POST /api/auth/login，
  或 (b) 给 fork 加 CE 版 API token 实现

### 获取 session cookie 步骤

1. 浏览器打开 https://bugpin.migelab.com/admin/ 登录
2. F12 → Application → Cookies → https://bugpin.migelab.com
3. 找到名为 `session` 的 cookie，复制 Value 整串
4. 在终端：
   ```bash
   echo 'export BUGPIN_SESSION=<paste here>' > ~/.bugpin-session
   chmod 600 ~/.bugpin-session
   source ~/.bugpin-session
   ```
5. 验证：`opencli bugpin list-reports --limit 3`

Cookie 默认 30 天过期。过期后 list-reports 会抛 AuthRequiredError，按上面流程重设即可。

为方便起见，可以把 `source ~/.bugpin-session` 加到 `~/.zshrc` / `~/.bashrc`，
每个新 shell 自动加载。

### 已知坑

- adapter 当前是 `browser: false` + env cookie 模式。doctor 报 connectivity 失败时也能用
- 浏览器 jar 自动读 cookie 留给未来：等 lula 把 Chrome opencli extension 装好且 doctor 通过后，
  改 adapter 为 `browser: true` + page.getCookies fallback
- `/api/reports/?status=open,in_progress` 用逗号分隔多 status——adapter 直接透传 args.status 字符串，
  服务端 split(',') 处理
- `/api/reports/stats/overview` 响应字段名（byStatus / statusCounts 还是别的）未在源码里确认，
  adapter stats.js 做了多 key 容错；首次跑通时确认实际形态后可以收紧

### 字段约定

- 报告 id 形态：BugPin 后端用 uuid 或自定义 id 生成器（看 v1.0.14 源码 reports.repo.ts）
- metadata 是 JSON 序列化存进 SQLite，常见字段：url / title / userAgent / consoleErrors / networkErrors / browser / device / viewport
- status 枚举：open / in_progress / resolved / closed（见 ReportStatus 类型）
- priority 枚举：lowest / low / medium / high / highest
- source 枚举：widget / manual
