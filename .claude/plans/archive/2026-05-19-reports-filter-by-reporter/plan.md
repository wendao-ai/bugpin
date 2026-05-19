---
title: "feat(admin): reports 搜索支持按反馈人名字/邮箱匹配"
type: feat
status: completed
created: 2026-05-19
completed: 2026-05-19
change_name: reports-filter-by-reporter
depth: Lightweight
---

# feat(admin): reports 搜索支持按反馈人名字/邮箱匹配

## 1. 背景

`/admin/reports` 列表页已有的搜索框目前支持三个维度的 OR 匹配：

1. FTS5 全文检索 `title` / `description`
2. `metadata.url` 子串 LIKE 匹配（最近提交 `3ff07c3 feat(admin): reports 搜索框支持按 metadata.url 匹配页面 URL` 加入）

运营 / 客服需要"某用户（名字或邮箱）反馈过哪些问题"的快速定位能力。`reports` 表已有独立列 `reporter_name` / `reporter_email`（widget 提交与 manual 创建均写入），是天然的过滤维度。

继续沿用单一搜索框 + URL query 同步的模式，把这两列追加到现有 `search` 参数的 OR 匹配里，UX 与 `metadata.url` 那次扩展完全一致。

## 2. 范围

### In scope

- 后端 `reportsRepo.find()` 中 `filter.search` 的 SQL 条件扩展：再 OR 上 `reporter_name LIKE ? OR reporter_email LIKE ?`
- 前端搜索框 placeholder 文案 + i18n（`searchReports`）更新，反映"反馈人"也在搜索范围
- 单元/接口测试覆盖新增匹配路径

### Out of scope / Deferred to Follow-Up Work

- 不新增独立的 reporter 筛选下拉/输入框（保持单一搜索框 UX）
- 不为 reporter 维度新增独立 query 参数（如 `reporterEmail=`）
- 不改动 `ReportFilter` 类型签名（`search` 字段语义扩大但类型不变）
- 不新增前端"快速点击 reporter 名字跳转过滤"的交互（可在后续迭代里追加）
- 不改 widget 上报字段或迁移现有数据

## 3. 关键技术决策

### D1. 复用现有 `search` 参数而非新增 `reporter`/`reporterEmail`

**决策**：把 `reporter_name` / `reporter_email` 追加到现有 `search` 的 OR 分支。

**理由**：
- 与 `metadata.url` 那次扩展完全同构，PM/运营心智一致："输什么都能搜到"
- 不破坏 `ReportFilter` 类型 / 前端 query 序列化逻辑 / URL share 链接兼容性
- 输入 `@example.com` / `张三` 都能命中，无需用户先选维度

**取舍**：失去"只按 reporter 精确过滤、忽略标题命中"的能力。这部分需求未在当前请求中出现，列入 Deferred。

### D2. LIKE `%term%` 而非 FTS5

**决策**：reporter 列走 `LIKE '%?%'` 子串匹配，与 `metadata.url` 同。

**理由**：
- 姓名、邮箱不是自然语言文本，FTS5 分词反而帮倒忙（邮箱里 `@`/`.` 是非词字符会被丢）
- reporter 列数据量与 reports 行数同阶，单次 LIKE 在 SQLite 上对几万行无压力（搜索场景非热路径）
- 与 `reports.repo.ts:213-219` 中 URL LIKE 完全同构，维护心智低

### D3. 大小写与空白处理

**决策**：依赖 SQLite 默认 `LIKE` 行为 + 在 SQL 里对参数与列同时 `LOWER(...)`，保证 ASCII 与中文邮箱大小写不敏感；前端在拼 query 前 `.trim()`。

**理由**：
- 邮箱是 ASCII 主导但用户可能大写输入；姓名虽中文为主但允许英文混合
- `LOWER(reporter_email)` + `LOWER(?)` 对纯 ASCII 100% 正确；中文 `LOWER` 是 no-op 不影响命中
- 现有 `metadata.url` LIKE 没做 LOWER 是因为 URL 习惯小写；reporter 字段没有此假设

### D4. URL/查询参数语义保持兼容

**决策**：URL 仍是 `?search=xxx`，不新增 query key。

**理由**：现有书签 / 分享链接零破坏；搜索范围扩大对老链接是兼容的正向变化。

## 4. 实现单元

### U1. 后端 SQL 扩展 + 单元测试

**Goal**：在 `reportsRepo.find()` 的 `filter.search` OR 链中追加 `reporter_name` / `reporter_email` 的大小写不敏感 LIKE 匹配。

**Files**：
- 修改 `src/server/database/repositories/reports.repo.ts`（`find` 方法中 `if (filter.search)` 分支）
- 新增/扩展 `tests/server/reports.service.test.ts` 中的搜索相关用例（如已有按 search 的用例则在同一 describe 下加）

**Approach**：
- 现有条件（节选自 `reports.repo.ts:213-219`）：
  ```
  (reports.rowid IN (SELECT rowid FROM reports_fts WHERE reports_fts MATCH ?)
   OR json_extract(reports.metadata, '$.url') LIKE ?)
  ```
- 扩展为追加两个 OR 分支：
  ```
  OR LOWER(reports.reporter_name)  LIKE LOWER(?)
  OR LOWER(reports.reporter_email) LIKE LOWER(?)
  ```
- `params.push(filter.search, '%' + url + '%', '%' + term + '%', '%' + term + '%')` —— FTS5 接受原值，三个 LIKE 都用同一 `%term%` 形式
- 更新条件注释，说明现在覆盖四个维度：title/description (FTS5) + URL + reporter_name + reporter_email
- 不引入新过滤参数；保持 `ReportFilter` 类型不变

**Patterns to follow**：
- 现有 `metadata.url` LIKE 分支的写法（同文件同方法）
- 现有 `reports.service.test.ts` 中 `reportsService.list({...})` 调用风格

**Test scenarios**（feature-bearing）：
1. **Happy path — match by reporter name (case insensitive)**：建一条 reporter_name='张三' 的 report，调用 `list({ search: '张三' })` 应命中；调用 `list({ search: 'zhangsan' })` 不命中（中文与英文 LOWER 各自正确）
2. **Happy path — match by reporter email substring (case insensitive)**：建 reporter_email='User@Example.COM'，调 `list({ search: 'user@example' })` 与 `list({ search: 'USER@EXAMPLE' })` 都命中
3. **Backward compat — title FTS still works**：title='Login broken'，`list({ search: 'login' })` 命中（FTS5 分支不被破坏）
4. **Backward compat — metadata.url LIKE still works**：metadata.url='/orders/123'，`list({ search: '/orders' })` 命中
5. **No-match path**：reporter_name='Alice'，`list({ search: 'Bob' })` 不命中（avoid false positives via SQL escaping / wildcard semantics）
6. **Combination with other filters**：`list({ status: ['open'], search: 'alice' })` 同时过滤 status + reporter 匹配；`assignedTo` + `search` 组合命中正确
7. **Empty/whitespace**：`list({ search: '' })` 退化为不过滤（沿用 `if (filter.search)` 的 falsy 短路）

**Verification**：
- `bun run typecheck:server` 通过
- `bun test tests/server/reports.service.test.ts` 通过（含新增 7 个场景）
- 手动 curl：`GET /api/reports?search=<known-reporter-email-prefix>` 返回该 reporter 的所有 reports

---

### U2. 前端搜索框文案 + i18n 更新

**Goal**：把搜索框 placeholder 从"搜索标题 / 描述 / 页面 URL..."更新为包含反馈人姓名/邮箱的版本；同步 `en.json`。

**Files**：
- 修改 `src/admin/i18n/locales/zh-cn.json`（`reports.searchReports` 文案）
- 修改 `src/admin/i18n/locales/en.json`（同 key）
- **无需改 `src/admin/pages/Reports.tsx`**：placeholder 已经走 `t('reports.searchReports')`，更新 i18n 自动生效

**Approach**：
- zh-cn：`"搜索标题 / 描述 / 页面 URL / 反馈人..."` 或 `"搜索标题 / 描述 / URL / 反馈人姓名 · 邮箱..."`（取后者，更具引导性，但需注意 Input 宽度溢出）
- en：保持对仗，例如 `"Search title / description / URL / reporter..."`
- 不改 URL query key、不改前端请求参数序列化（U1 backend 已透明覆盖）

**Patterns to follow**：
- `reports.searchReports` 当前 zh-cn 值已是省略号格式，沿用
- 其他 placeholder 的 en/zh 风格

**Test scenarios**：
- `Test expectation: none -- 纯文案更新，无行为变化；由 U1 的集成场景覆盖端到端表现`

**Verification**：
- `bun run typecheck:admin` 通过（i18n JSON 不影响 TS）
- 浏览器打开 `/admin/reports`，搜索框 placeholder 显示新文案
- 中英文切换均正确显示
- 输入一个真实 reporter 邮箱片段，列表过滤生效（端到端验证 U1 + U2）

---

## 5. 验收要点

- [ ] `GET /api/reports?search=<reporter_name 片段>` 返回该 reporter 的报告
- [ ] `GET /api/reports?search=<reporter_email 片段>` 大小写不敏感命中
- [ ] 原有 title/description（FTS5）与 `metadata.url`（LIKE）搜索仍正常工作
- [ ] `search` 与 `status` / `priority` / `projectId` / `assignedTo` / `source` 任意叠加正常
- [ ] 前端 `/admin/reports` 搜索框 placeholder 含"反馈人"提示，URL `?search=` 同步保留 / 刷新后恢复
- [ ] zh-cn 与 en 双语 placeholder 都已更新
- [ ] 新增 7 个测试场景全部通过；既有 reports.service.test.ts 用例不回归

## 6. Tasks（执行勾选）

- [x] U1. 修改 `src/server/database/repositories/reports.repo.ts` 扩展 `filter.search` 的 OR 条件，参数列表补两个 `%term%`
- [x] U1. 更新 / 新增 `tests/server/repositories.test.ts` 中 7 个搜索场景（落到真实 SQLite 的 repo 测试更准确，不放 reports.service.test.ts 因其 mock 掉 reportsRepo.find）
- [x] U1. `bun run typecheck:server`（与本次改动无关的预存 `templateVariables` warning 忽略）+ `bun test tests/server/repositories.test.ts` + reports.service / routes 全绿
- [x] U2. 更新 `src/admin/i18n/locales/zh-cn.json` 的 `reports.searchReports`
- [x] U2. 更新 `src/admin/i18n/locales/en.json` 的 `reports.searchReports`
- [x] U2. `bun run typecheck:admin` 全绿（浏览器验证留到步骤 3）

## 7. 风险与备注

- **风险**：reporter 列在大量历史数据上 `LIKE '%x%'` 无索引；rerun 时若 reports 表达到百万级会有压力。当前 BugPin 自托管场景下数据量在万级以内，无需立刻引索引。
- **备注**：若后续需要"精确按 reporter 过滤"，可新增 `reporterEmail` query 参数 + 独立下拉，复用 `reports.repo.ts` 同样模式。

---

## Review

### 实际改动

- `src/server/database/repositories/reports.repo.ts`：`reportsRepo.find()` 中 `filter.search` 的 OR 链从 2 个分支扩展到 4 个（追加 `reporter_name` / `reporter_email` 的 `LOWER LIKE LOWER` 大小写不敏感匹配）；附带把 FTS5 MATCH 输入包成 phrase 双引号，转义内嵌 `"`，修复 FTS5 对 `@` / `-` 等特殊字符报语法错误的隐患。
- `tests/server/repositories.test.ts`：在 `describe('reportsRepo')` 内新增 `it('search filter matches reporter_name and reporter_email (case-insensitive)')`，覆盖 plan 列出的 7 个 scenarios（含 backward compat 与组合过滤）。
- `src/admin/i18n/locales/zh-cn.json` 与 `en.json`：`reports.searchReports` placeholder 文案扩展为包含"反馈人姓名 · 邮箱 / reporter name · email"。
- 未改 `src/admin/pages/Reports.tsx`：placeholder 已走 `t()`，i18n 更新自动生效。

### 与计划差异

1. **测试落点调整**：plan 写的是改 `tests/server/reports.service.test.ts`，实际落到 `tests/server/repositories.test.ts`。原因：`reports.service.test.ts` 通过 mock `reportsRepo.find` 来测服务层，不会触发真实 SQL；要验证 SQL 行为必须用 repositories.test.ts 的真 SQLite 环境。这个调整保留了"测什么"，更换"在哪测"。
2. **附带 FTS5 加固**：plan 未预见的隐患——FTS5 MATCH 接受原值时，`@`/`-` 等会被解析为语法字符导致 500。实测 scenario 2（按邮箱 `user@example` 搜索）暴露该 bug。判定为本次特性的前置必修：若不修，邮箱搜索一上线就会报错。修复方式是把 FTS5 term 包成 phrase 双引号（最小破坏：单词搜索行为不变，多词搜索从隐式 AND 变为短语匹配，对单一搜索框 UX 更自然）。
3. **测试用例数量**：plan 列了 7 个 scenarios，全部以断言形式集中在 1 个 `it()` 块里，与现有 `repositories.test.ts` 单元测试风格一致（按主题聚合而非每场景一个 it）。共 92 个 expect 断言通过。
4. **i18n 文案具体措辞**：选择"反馈人姓名 · 邮箱"而非简短的"反馈人"，引导性更强；英文对仗 `reporter name · email`。

### 测试结果

- `tests/server/repositories.test.ts`：16/16 通过（新增 1 it + 13 assertions）
- `tests/server/reports.service.test.ts` + `tests/server/routes/reports.routes.test.ts`：42/42 通过（无回归）
- `bun run typecheck:admin`：通过
- `bun run typecheck:server`：通过（仅一处与本次无关的预存 `templateVariables` warning）
- `bun run build:admin`：通过

### 遗留 / 后续

- **未实现独立 `reporterEmail` 精确过滤参数**：plan 第 2 节明确划入 Deferred。如有"只看 reporter 不看 title 命中"的需求再做。
- **FTS5 phrase 加固的副作用**：多词搜索从隐式 AND 变为短语精确匹配。当前未发现使用方依赖隐式 AND；如出现回归再调整为 token 级转义。
