# 改动类型 → 测试路径路由表

> 步骤 2.5 用本表选择 3.A / 3.B / 3.C / 3.D 测试策略。

## 路由表

| 改动主目录 | 测试路径 | 工具 |
|---|---|---|
| 仅 `src/server/**/*.ts`（无 admin/widget 改动） | 3.A 后端冒烟（bun test + curl/HTTPie） | `bun run typecheck:server` + `bun test tests/server` + `bun run dev:server` + `curl` |
| 仅 `src/admin/**/*.{ts,tsx}` | 3.B 前端浏览器测试 | `bun run typecheck:admin` + `bun run build:admin` + `agent-browser` |
| 仅 `src/widget/**/*.ts`（widget 嵌入端） | 3.B 前端浏览器测试（用 `/test-widget` 页面） | `bun run typecheck:widget` + `bun run build:widget` + `agent-browser` 进 `http://localhost:7300/test-widget` |
| `src/shared/**` 改动（共享类型） | 3.A + 3.B 全栈 | 上游 typecheck 全跑 + 浏览器抽样 + curl 抽样 |
| 同时改 server + admin/widget | 3.B 为主，3.A 抽样兜底 | 浏览器为主，关键 API 用 curl 兜底 |
| 仅 `src/server/database/migrations/*.sql` | 3.C 数据库迁移验证 | `bun run --cwd src/server migrate` + `sqlite3` 校验 |
| 仅 `docker-compose.yml` / `Dockerfile` / `bugpin.service` / `.github/workflows/**` | 3.D 脚本/服务冒烟 | 直接执行 `docker compose ...` / `bun run build` + `bun run start` + 健康检查 |
| 仅 `client-integrations/**` | 3.D（按集成示例文档自测）+ 跳过浏览器 | 参考该目录 README 跑示例 |
| 仅文档（`docs/`、`CLAUDE.md`、`README*`、`Changelog/**`、`openspec/specs/**`、`openspec/changes/archive/**`、`.claude/**`） | 跳过测试 | 直接进入步骤 4 |

## 跨模块归属说明

### Admin 路由 ↔ 后端路由

| 改动落点 | 归属 |
|---|---|
| `src/server/routes/api/<domain>.ts` 新增/修改 endpoint | **3.A**（用 curl 跑），如同时改前端调用方则附加 3.B |
| `src/admin/pages/<X>.tsx` | **3.B**（浏览器访问对应路由，见 `src/admin/App.tsx`） |
| `src/admin/api/<X>.ts`（API 客户端封装） | **3.A + 3.B** 双跑（后端契约 + 前端调用） |
| `src/admin/components/**`（通用组件） | **3.B**，进入使用该组件的页面验证 |
| `src/admin/pages/globalsettings/*` | **3.B**，路径 `/admin/globalsettings` 下分 tab |

### Widget 嵌入流

| 改动落点 | 归属 |
|---|---|
| `src/widget/capture/**` / `annotate/**` | **3.B**，进入 `/test-widget`（开发态）或宿主页打开 widget |
| `src/widget/api/**` | **3.B + 3.A**（widget 上报路径 + 后端接收契约） |
| `src/widget/storage/**` | **3.B**，验证离线缓存与重连后同步 |

### 共享类型变动

`src/shared/**` 改动会同时影响 server / admin / widget 三端 TS 编译，**typecheck 必须全跑**：
```bash
bun run typecheck
```

## 判定规则

1. 扫描步骤 2 输出的文件路径列表
2. 按"最高级别命中"决定主路径；多类命中取并集
3. 把判定结果（含主路径 + 命中列表）写入 `$TEST_RESULTS/${SCREENSHOT_PREFIX}_meta.txt`

## 当本文件需要更新

- 顶级目录新增/重命名（如新增 `src/cli/` 或拆出 `src/api-sdk/`）
- 增加新的子产品/workspace
- 集成示例（`client-integrations/`）形态变化
- CI/CD pipeline 变更影响测试策略
