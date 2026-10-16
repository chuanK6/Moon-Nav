# Moon Nav 个人导航网站

依据《个人导航网站建设方案（修订版）》实现，部署目标为 **Cloudflare Pages + Pages Functions + D1 + Access**。个人使用，无自建密码、用户表或会话系统。

## 已实现

- `/`：公开导航，名称／描述／网址搜索、分类筛选、置顶、骨架屏和深浅主题。
- `/my`：Access 保护的个人导航，展示全部网站，包含私有和隐藏项。
- `/admin`：网站与分类 CRUD、分类排序、删除确认、批量显示／隐藏／删除／移动。
- 五种图标：在线 favicon、自定义 HTTPS 图片或站内图片、首字母、纯色、emoji；失败自动回退。
- JSON 导出，合并／覆盖导入、差异预览、覆盖确认、D1 原子事务与失效预览检查。
- Hono API、共享 zod schema、JWT 签名与声明校验、Origin 校验、输入和体积限制。
- 公共接口边缘缓存；写入后清除当前数据中心的缓存；管理数据禁止缓存。
- TypeScript、Vitest Workers 运行时测试、Playwright 浏览器测试、GitHub Actions。

## 本地运行

需要 Node.js 24 和 npm。Windows PowerShell 若限制脚本执行，请将下方 `npm` 换为 `npm.cmd`，`npx` 换为 `npx.cmd`。

在项目目录执行：

```sh
npm ci
```

将 `.dev.vars.example` 复制为 `.dev.vars`。PowerShell：

```powershell
Copy-Item .dev.vars.example .dev.vars
```

初始化本地数据库，构建并启动：

```sh
npm run db:local
npm run db:seed
npm run build
npm run preview
```

访问：

- 首页：<http://127.0.0.1:8788/>
- 私有导航：<http://127.0.0.1:8788/my>
- 管理后台：<http://127.0.0.1:8788/admin>

`db:seed` 只写入本地演示数据，正式部署不自动添加示例网站。`db:local` 与 `preview` 使用同一个 `.wrangler/state` 本地数据库。

需要前端热更新时，在第一个终端保持 `npm run dev:api` 运行，在第二个终端执行 `npm run dev`，访问 `http://127.0.0.1:5173`。API 通过 Vite 代理到 8788；`.dev.vars` 的 `DEV_FRONTEND_ORIGIN` 应与前端地址一致。

本地 Access 跳过需要**同时**满足：`ENVIRONMENT=local`、`DEV_BYPASS_ACCESS=1`、请求主机为回环地址。生产和预览域名不允许此绕过。不要在 Cloudflare 中设置这些开发变量。

## Cloudflare 部署

### 1. 创建两个 D1 数据库

先登录 Cloudflare：

```sh
npx wrangler login
npx wrangler d1 create moon-navigation
npx wrangler d1 create moon-navigation-preview
```

将正式库 ID 填入 `wrangler.toml` 顶层 `[[d1_databases]]` 的 `database_id`，将预览库 ID 填入 `[[env.preview.d1_databases]]`，保留绑定名 `DB`。预览库与正式库必须分开；两个全零示例 ID 都要替换。

分别迁移两个远程库。将占位符换为真实 UUID：

```sh
npx wrangler d1 migrations apply <正式数据库UUID> --remote
npx wrangler d1 migrations apply <预览数据库UUID> --remote
```

也可在填写正式 ID 后运行 `npx wrangler d1 migrations apply DB --remote`。后续迁移先应用预览库，通过验证后再应用正式库。迁移只新增文件，不改已执行的迁移。

### 2. 创建 Pages 项目

将本项目目录作为 GitHub 仓库根目录（包含 `package.json`、`functions/`、`.github/`）。若上传当前工作目录作为仓库，则在 Pages 将根目录设为 `navigation-site`，并相应调整 GitHub Actions 的执行目录。

在 Cloudflare Workers & Pages 中创建 **Pages → Connect to Git**：

| 配置项 | 值 |
| --- | --- |
| Framework preset | Vite 或 None |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node.js | 设置 `NODE_VERSION=24` |
| D1 绑定变量名 | `DB` |

本项目通过 `wrangler.toml` 管理 D1 绑定，该文件会成为绑定配置来源。顶层 `[[d1_databases]]` 用于本地与正式环境，`[[env.preview.d1_databases]]` 明确覆盖预览库。部署后在 Pages 设置中核对 **Production** 与 **Preview** 的 `DB` 分别指向不同数据库。这里不使用 `preview_database_id`，它不能替代 Pages 的预览环境覆盖配置。

Git 集成会在构建后自动编译 `functions/`。也支持 `npx wrangler pages deploy dist --project-name <项目名>`，命令必须在项目根目录运行。**不要只把 `dist` 文件夹拖到控制台上传**，否则无法按此方案部署 Pages Functions。

### 3. 设置环境变量与域名

正式和预览环境分别设置：

| 变量 | 示例 | 说明 |
| --- | --- | --- |
| `ACCESS_TEAM_DOMAIN` | `your-team.cloudflareaccess.com` | 只填域名，不带协议或路径 |
| `ACCESS_AUD` | Access 应用的 AUD | 与保护此环境的 Access 应用一致 |
| `SITE_ORIGIN` | `https://nav.example.com` | 精确 Origin，不带结尾斜杠和路径 |

不需要 `ADMIN_PASSWORD_HASH`、`SESSION_SECRET` 或 R2。变量变更后重新部署。

在 Pages 自定义域名中绑定实际域名，并完成 DNS 验证。启用 HTTPS。

### 4. GitHub 登录与 Cloudflare Access

1. 在 Zero Trust → Settings → Authentication → Login methods 配置 GitHub 身份提供商；按控制台显示的回调 URL 创建 GitHub OAuth App，填入 Client ID 与 Secret。
2. 创建 Self-hosted Access 应用，使用导航站的自定义域名。
3. 覆盖 `/admin*`、`/my*`、`/api/admin/*`；可在同一应用配置多个域名／路径，或建立使用相同策略的应用。代码按配置的单个 AUD 校验；若拆成不同应用，请使用相同应用覆盖这三个路径，或扩展受信任 AUD 列表后再部署。
4. Allow 策略仅允许自己的邮箱，并仅选择 GitHub 登录方式。确认 GitHub 向 Access 提供了该邮箱。
5. 会话时长可设为 7 天，按账号与控制台支持范围调整。
6. 将应用 AUD 与团队域名填入 Pages 环境变量。

入口必须实际经过 Access，不只是设置环境变量。导航中的私有页／管理链接会触发完整页面请求，让 Access 拦截器接管登录。应用本身不做登录页、退出登录或修改密码。

还要处理绕过入口：

- 为预览部署启用 Pages 的 Access 保护，并为该环境设置相应 AUD。
- 对生产 `*.pages.dev` 地址配置重定向到正式自定义域名，或在 Zero Trust／账户可用设置中加上相应入口保护；只绑定自定义域名不会自动禁用默认域名。
- 即使默认域名没有正确保护，代码仍会拒绝未经验证的私有页面和管理 API。
- 预览 `SITE_ORIGIN` 应为固定的预览别名域名，并用这个地址测试写入；随机 PR URL 与固定 Origin 不匹配会返回 403。

### 5. 上线验收

- 未登录访问 `/admin`、`/my` 和 `/api/admin/sites` 会由 Access 拦截；应用层缺失／无效 JWT 也不能访问。
- GitHub 登录后能新增、修改、删除网站，能管理分类与批量移动网站。
- 私有、隐藏网站不出现在公共接口；仅用于私有项的分类名称不出现在公共分类接口。
- 私有导航可查看全部网站，包含隐藏项。
- 从其他 Origin 发起写入会返回 403。
- JSON 导出、导入预览和合并／覆盖工作正常。
- 手机没有横向溢出，主题刷新后保留，在线图标失败可以回退。
- 检查生产与预览环境的 D1 库不同，默认域名不能绕过管理 API 认证。

GitHub Actions 只运行检查；在 GitHub 仓库 Branch protection 中要求 `check` 成功后才能合并。Pages Git 自动部署自身不保证等 Actions 完成，因此正式分支保护需要单独设置。

## API

所有成功响应为 `{ "data": ... }`，错误为 `{ "error": { "code": "...", "message": "..." } }`。

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| GET | `/api/public/sites` | 公开且可见网站 |
| GET | `/api/public/categories` | 含公开可见网站的分类 |
| GET | `/api/admin/me` | 当前邮箱 |
| GET / POST | `/api/admin/sites` | 列表／新增 |
| PUT / DELETE | `/api/admin/sites/:id` | 修改／删除 |
| POST | `/api/admin/sites/batch` | 批量操作 |
| GET / POST | `/api/admin/categories` | 列表／新增 |
| PUT / DELETE | `/api/admin/categories/:id` | 修改／删除 |
| PUT | `/api/admin/categories/reorder` | 提交完整的分类 ID 顺序 |
| GET | `/api/admin/export` | 导出完整备份（位于 `data` 字段） |
| POST | `/api/admin/import` | 预览或提交导入 |

删除非空分类时，需显式使用 `?move_to_uncategorized=1`，通过外键 `ON DELETE SET NULL` 保留网站。所有写入都要求 `Content-Type: application/json` 与匹配的 `Origin`；DELETE 可传空 JSON 对象。

批量操作请求示例：

```json
{ "action": "move", "ids": [1, 2], "category_id": null }
```

`action` 支持 `show`、`hide`、`delete`、`move`。单次最多 2000 个 ID。

## 备份与导入规则

从后台导出的文件是原始备份对象，不包含 API 外层 `data` 包装：

```json
{
  "version": 1,
  "exported_at": "2026-10-16T00:00:00.000Z",
  "categories": [{ "id": 1, "name": "工具", "sort_order": 0 }],
  "sites": [{
    "id": 1,
    "name": "Example",
    "url": "https://example.com",
    "category_id": 1,
    "icon_type": "emoji",
    "icon_value": "🌙",
    "description": "示例链接",
    "sort_order": 0,
    "is_pinned": 0,
    "is_visible": 1,
    "visibility": "private"
  }]
}
```

- 网址先统一协议／主机名大小写、移除默认端口和路径尾部斜杠；保留路径大小写、查询和锚点，不将 HTTP 强行改为 HTTPS。
- 合并按分类名称与规范化网址匹配；匹配记录更新字段，其他记录保留；网站 ID 尽量沿用现有记录。
- 覆盖模式删除全部旧记录并重建；内部数字 ID 和创建时间可能变化，分类关联按名称重新映射，功能字段保留。
- 每次导入前先预览，预览包含新增、匹配更新、删除数；匹配更新也可能包含字段无变化的记录。
- 文件、模式或数据库内容变化后，需要重新预览；最终写入使用 `DB.batch()` 保证事务性。差异预览用于单管理员确认，不作为多写入者并发锁。
- 单次最多 2000 个网站、2000 个分类，请求体不超过 2 MiB。JSON 包装也占体积，接近 2 MiB 的文件可能需要缩减。
- 导入使用 `json_each` 批量 SQL，避免 2000 条逐项语句超出平台查询数限制。
- 备份含私有网址，请保存在自己的设备或可信位置；不上传 R2。

D1 Time Travel 保留期按套餐计算：免费通常 7 天，付费 30 天，以 Cloudflare 当期规则和账户额度为准。恢复前先停写并手动导出：

```sh
npx wrangler d1 time-travel info <正式数据库UUID>
npx wrangler d1 time-travel restore <正式数据库UUID> --timestamp <ISO时间>
```

远程恢复会修改线上数据，执行前务必核对数据库与时间点。开发工具不会自动执行恢复。

## 缓存与安全说明

- 公共接口使用 Cache API，缓存键不包含无效查询参数。自定义域名启用；本地与 `*.pages.dev` 跳过。
- TTL 为 60 秒，后台写入等待本数据中心缓存清除完成；其他中心最多约 60 秒生效。转私有或隐藏不会收回已经被访客读取的数据。
- 与修订版相比，省略 `stale-while-revalidate=600`，避免旧公开数据在 60 秒后继续被提供。
- 边缘缓存减少查询，但 Cache API 的命中仍需要进入 Function；不会将 Functions 调用次数降为零。
- 管理接口与私有页 `Cache-Control: no-store`；没有 Service Worker 或本地持久化管理数据。
- 公钥由 `jose` 缓存并轮换；要求 RS256、正确 issuer、audience、exp、iat、sub、email。
- `_headers` 设置 CSP 等响应头；构建时按实际主题脚本生成 SHA-256 哈希，无需开启任意内联 JavaScript。
- 自定义图片允许任意 HTTPS 来源，因此 `img-src` 放行 `https:`，脚本和网络 API 仍限制同源。图标无后端代理。
- 默认 favicon 使用 Google，地址集中在 `src/lib/icon.ts`。访问 favicon 会将对应域名发送到在线服务；敏感私有链接可选首字母／颜色／emoji。
- 所有外链使用 `noopener noreferrer`，图片不发送 referrer，无 `dangerouslySetInnerHTML`。
- 不支持自建密码、快捷键、多管理员、R2、拖拽、访问统计、书签 HTML 导入或 PWA，符合本期范围。

## 测试与检查

```sh
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

浏览器测试会将**本机 8788 端口**指向的本地 D1 替换为测试数据，请用于开发副本。配置固定回环地址，不访问线上数据库。测试验证 CRUD、私有可见性、搜索筛选、图标失败回退、主题、批量操作和 JSON 导入导出，并生成 `artifacts/preview-*.png` 预览截图。

修订版所列的 `@cloudflare/vitest-pool-workers` 已被官方更名并停止更新。本项目使用维护中的 `@cloudflare/vitest-plugin`，仍在真实 Workers 本地运行时测试 D1、Cache API、Web Crypto 与 Hono。

## 目录

```text
src/                 React 页面、组件与图标逻辑
shared/schema.ts     前后端共享校验与类型
server/              Hono API、认证、缓存、导入 SQL
functions/           Pages 入口与私有页面中间件
public/              图标、响应头模板、Functions 路由配置
migrations/          D1 只增迁移
scripts/             本地演示数据、构建 CSP
tests/               Workers 运行时的单元和接口测试
e2e/                 Playwright 操作测试
.github/workflows/   CI
```

## 官方参考

- [Pages Functions](https://developers.cloudflare.com/pages/functions/)
- [Pages Functions D1 绑定](https://developers.cloudflare.com/pages/functions/bindings/#d1-databases)
- [Access JWT 验证](https://developers.cloudflare.com/cloudflare-one/identity/authorization-cookie/validating-json/)
- [GitHub 身份提供商](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/github/)
- [D1 Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/)
- [Workers Vitest 测试](https://developers.cloudflare.com/workers/testing/vitest-integration/)

代码、迁移与本地测试可以独立完成；真实 GitHub OAuth、Access 路径策略、D1 绑定、Pages 发布与域名验证需在你的 Cloudflare 账户内完成。
