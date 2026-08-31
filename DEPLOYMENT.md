# 云部署手册

本项目可以只使用 Cloudflare + Vercel + Supabase。Vercel 同时部署 Vite 前端和 Node.js Function，Supabase 提供 PostgreSQL，Cloudflare 负责 DNS、代理和 WAF：

```text
Cloudflare DNS/WAF
  └─ www.example.com -> Vercel (React/Vite + Fastify Function)
                                      |
                                      v
                              Supabase PostgreSQL
```

## 一次性准备

1. 在 Supabase 创建项目，并在 Connect 中复制两个连接串：
   - Pooler 连接串用于运行时 `DATABASE_URL`，通常是 6543 端口并带 `pgbouncer=true`。
   - Direct 连接串用于 Prisma migration，作为 `DIRECT_URL`。
   - 如果 Direct 主机在当前网络只提供 IPv6，Prisma migration 可以临时使用可达的 5432 Session Pooler 作为 `DIRECT_URL`；不要把 6543 Transaction Pooler 用作 migration URL。
2. 在本地生成管理员密码 hash：

   ```powershell
   npm run admin:hash -w @guess-salary/api -- "你的管理员密码"
   ```

3. 生成两个随机密钥。PowerShell 示例：

   ```powershell
   [Convert]::ToBase64String((1..48 | ForEach-Object { [byte](Get-Random -Maximum 256) }))
   ```

   分别用于 `ADMIN_SESSION_SECRET` 和 `IP_HASH_SALT`，不要提交到 Git。

## 初始化 Supabase

在本地临时设置 API 环境变量后执行（PowerShell）：

```powershell
$env:DATABASE_URL = "你的 Supabase Pooler URL"
$env:DIRECT_URL = "你的 Supabase Direct URL"
npm run prisma:generate -w @guess-salary/api
npx prisma migrate deploy --schema apps/api/prisma/schema.prisma
npm run seed:import
```

以后修改 Prisma schema 时，先在本地创建 migration，再把 migration 文件提交到 Git。生产环境只运行 `prisma migrate deploy`，不要使用 `migrate reset`，也不要让种子脚本删除用户投稿。

## 配置 Vercel

在 Vercel 导入仓库，保留根目录作为项目目录。`api/[...path].ts` 是 Fastify 的 Vercel Node Function 入口，`vercel.json` 已配置前端构建和 SPA 回退。

在 Vercel 的 Production 和 Preview 环境分别配置以下变量：

```env
DATABASE_URL=Supabase Pooler URL
DIRECT_URL=Supabase Direct URL
ADMIN_PASSWORD_HASH=生成的 bcrypt hash
ADMIN_SESSION_SECRET=至少 32 个字符的随机值
IP_HASH_SALT=随机值
CORS_ORIGINS=https://www.example.com
TRUST_PROXY=true
VITE_API_BASE_URL=
VITE_ADMIN_PATH=/_review-随机路径
```

`VITE_API_BASE_URL` 留空，前端会请求同一个 Vercel 域名下的 `/api/*`。`DATABASE_URL` 在 Function 运行时使用，`DIRECT_URL` 用于构建时生成 Prisma Client 和本地 migration；两个变量都只能放在 Vercel 的 Environment Variables 中，不能写进前端代码。

Vercel Function 是无状态、按请求运行的 Node.js 环境，适合本项目的 CRUD API，但不适合 WebSocket 或长时间后台任务。当前管理员 token 是签名 token，验证码存入 Supabase，重启和多实例不会丢失。

仓库中的 `vercel.json` 将 Function 区域设为 `icn1`（首尔），因为当前 Supabase 项目位于 `ap-northeast-2`。如果在 Vercel 的 Resources 页面仍看到 `IAD1`，说明部署没有使用最新提交，需要重新部署。

部署后先访问 `https://www.example.com/api/health`。该路径会由 Vercel Function 查询 Supabase，并返回数据库健康状态。

`TRUST_PROXY=true` 只应在 API 确实位于 Cloudflare 或平台反向代理后时使用。`CORS_ORIGINS` 填写实际前端 origin，不要使用 `*`。

仓库内的 `vercel.json` 已配置：

- install command：`npm ci`
- build command：生成 Prisma Client、构建 shared 包和前端
- output directory：`apps/web/dist`
- SPA 路由回退到 `index.html`

## Cloudflare 域名

1. 将域名 nameserver 切换到 Cloudflare。
2. 在 Vercel 中绑定 `www.example.com`，按 Vercel 提示添加 DNS 记录。
3. Cloudflare SSL/TLS 使用 Full (strict)，确认 Vercel 自定义域名证书生效后再开启代理。
4. 为 `/api/*` 配置基础 WAF/rate limit；API 自身也有 Fastify rate limit，但 Vercel Function 实例之间不共享内存，不能单独作为多实例限流方案。

## 持续更新数据库

- 用户投稿、审核结果、举报和游戏局次：通过 API 实时写入 Supabase，不需要重新部署。
- Excel 种子数据：修改后运行 `npm run data:update`，脚本会自动校验、连接 Supabase、导入并核对数量。第一次运行只需输入一次 Session Pooler URL，之后由 Windows 当前账户解密本机凭据。用 `npm run data:forget` 可以清除保存的连接。
- Excel 仍以行号作为种子 ID；只能在末尾追加或原地修改，不能排序、插入、删除既有行。导入不会删除用户投稿或旧种子记录。
- Prisma schema：提交 migration，使用本地命令或 CI 执行 `prisma migrate deploy`；不要在 Vercel build 中自动修改生产 schema。
- 生产数据库：开启 Supabase 备份，并定期运行 `scripts/backup-postgres.ps1` 验证可恢复性。

上线前请检查 `/health`、投稿、管理员登录、审核、答题和 `/api/public-stats`，并确认重启 API 后管理员 token 和验证码仍然正常工作。
