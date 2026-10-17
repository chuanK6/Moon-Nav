# 1. 项目是什么

Moon Nav（包名 `moon-navigation`）是个人网址导航站：提供公开导航、私有收藏、搜索分类、置顶、网站与分类管理、批量操作、主题切换及 JSON 备份。前后端同仓，已有迁移、测试和 CI；部署目标为 Cloudflare Pages，身份认证交给 Access。实际工程在 `navigation-site/`，下文路径均相对该目录。

# 2. 技术栈

- TypeScript、React 19、React Router 7：页面与路由；Vite 8：开发构建。
- Tailwind CSS 4、自定义 CSS、Lucide React：样式和图标；TanStack Query 5：请求缓存与刷新。
- Hono：Pages Functions API；Cloudflare D1：SQL 数据库；Zod：共享校验；jose：Access JWT 验证。
- Vitest 与 `@cloudflare/vitest-plugin`：Workers 环境测试；Playwright：浏览器测试。

# 3. 核心目录

- `src/`：页面、组件、请求封装和样式。
- `server/`、`shared/`：后端业务；共享类型、校验及安全策略。
- `functions/`：Cloudflare 接口入口和私有页面保护。
- `migrations/`：建表迁移；`scripts/`：演示数据和安全头构建。
- `public/`：静态资源、响应头模板及 Functions 路由范围。
- `tests/`、`e2e/`：接口与浏览器测试。

# 4. 核心文件

| 文件 | 修改入口与作用 |
| --- | --- |
| `src/App.tsx` | 页面路由；增加页面先看这里。 |
| `src/pages/Home.tsx`、`src/pages/My.tsx` | 导航展示、搜索与分组；私有页复用首页。 |
| `src/pages/Admin.tsx` | 管理、批量操作、备份；分类表单与导入界面也在此文件。 |
| `src/components/SiteForm.tsx` | 网站编辑与前端校验；增改字段先看。 |
| `src/components/Layout.tsx`、`src/styles.css` | 公共布局、主题与响应式样式。 |
| `src/components/SiteIcon.tsx`、`src/lib/icon.ts` | 图标渲染、失败回退及 favicon 来源。 |
| `src/lib/api.ts` | 同源请求、JSON 包装与错误处理。 |
| `server/app.ts` | 全部 API、中间件和主要 SQL；改业务先看。 |
| `shared/schema.ts` | 网站、分类、备份类型及校验，前后端共同依赖。 |
| `server/import.ts` | 导入差异、合并与覆盖的批量 SQL。 |

# 5. 数据 / API

D1 通过 `DB` 绑定访问；`migrations/0001_init.sql` 定义 `sites` 和 `categories`。网站保存网址、分类、图标、排序、置顶、显示状态与公开性；分类保存名称、排序。两表通过分类 ID 关联，本地数据在 `.wrangler/state/`，主题偏好存于 localStorage。

`functions/api/[[route]].ts` 转交 Hono；`/api/public/*` 读取公开数据，`/api/admin/*` 提供受保护的管理及导入导出。前端同源 fetch，成功返回 `{data}`，失败返回 `{error}`；开发代理配置在 `vite.config.ts`。

环境变量定义见 `server/types.ts`：`ACCESS_TEAM_DOMAIN`、`ACCESS_AUD` 用于认证，`SITE_ORIGIN` 限制写入来源；本地配置参考 `.dev.vars.example`，`ENVIRONMENT`、`DEV_BYPASS_ACCESS` 控制本地认证绕过，`DEV_FRONTEND_ORIGIN` 允许开发前端写入。

# 6. 功能之间的关系

页面 → TanStack Query → 请求封装 → Pages Functions → Hono 校验与 SQL → D1 → 组件展示。搜索、分类筛选在浏览器完成。后台写入后刷新管理和公开查询，并清理公共接口缓存；私有导航读取管理接口的全部网站。在线图标由浏览器直接请求 Google favicon 或自定义图片地址。

# 7. 怎么运行

使用 Node.js 24（与 CI 一致），在项目根目录首次执行；已有本地环境文件时保留原配置：

```powershell
npm ci
Copy-Item .dev.vars.example .dev.vars
npm run db:local
npm run build
npm run preview
```

预览地址为 `http://127.0.0.1:8788`；可用 `npm run db:seed` 写入本地演示数据。热更新时，在两个终端分别运行 `npm run dev:api`、`npm run dev`，前端默认 5173，API 代理到 8788。

部署前按 `README.md` 核对远程迁移、D1、Access 与域名。Pages Git 构建命令为 `npm run build`，输出 `dist/`；也可在根目录执行 `npx wrangler pages deploy dist --project-name <项目名>`。必须包含 Functions；CI 只负责检查。

# 8. 修改时注意什么

- 改导航先看 Home；它同时影响 My。首页与后台各有搜索实现。样式文件后半段有覆盖规则，修改时注意最终生效值。
- 改字段联查共享 schema、表单、SQL、迁移和备份；标志位是数字 0/1，未分类为 null。网址规范化影响去重与合并；删除分类须保留网站。已执行迁移不要重写。
- 公开接口必须同时筛选公开且显示的网站；My 包括私有和隐藏项。`server/cache.ts` 的公共缓存最长 60 秒，写入仅清理当前数据中心；管理数据禁止缓存。
- 私有入口用完整页面跳转触发 Access；检查 `functions/_middleware.ts` 与 `server/middleware/access.ts`，写入还经过 `server/middleware/origin.ts`。本地绕过须同时满足 local 环境、绕过开关和回环主机。
- 导入按分类名称、规范化网址合并；保留预览 revision 检查、`DB.batch()` 事务和 `json_each` 批量实现。覆盖会重建 ID；预览校验不是并发锁。
- 主题脚本关联 `index.html`、`shared/security.ts`、`scripts/security-headers.mjs`；修改需同步，安全头由构建生成。不要随意改 `public/_routes.json` 的保护范围、`wrangler.toml` 的 `DB` 绑定及正式/预览库隔离。
- 常规检查用 `npm run check`；浏览器测试 `npm run test:e2e` 会覆盖本机 8788 对应数据库，应使用测试副本，并先安装 Chromium（`npx playwright install chromium`）。

# AI 快速上手

Moon Nav 是个人导航站，包含公开浏览、私有收藏、后台管理和备份。使用 React、TypeScript、Vite 与 Cloudflare，页面集中在 src/pages，接口集中在 server，共享校验在 shared。页面经请求封装调用 Hono，再读写 D1；私有页复用首页并读取管理数据，登录由 Access 负责。本地先安装依赖、复制环境示例、初始化数据库并构建，再启动预览；热更新需同时运行前端与接口。修改界面从对应页面、组件和样式入手，改字段和业务从接口及共享校验入手，并检查表单、数据库和备份的关联。尤其保留公开过滤、认证、缓存失效和导入事务；改主题要同步安全策略，运行浏览器测试会替换本地数据。

