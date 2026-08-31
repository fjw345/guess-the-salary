# 猜薪资

根据学历、学校、专业、毕业已经、城市、公司和岗位七项线索猜真实投稿薪资。提交猜测后才返回薪资原文、客观差异和投稿者留言。

`种子数据.xlsx` 是唯一的种子数据源。本地开发、手动导入和 Docker 部署都会直接读取该工作簿；修改后重新导入即可同步原始线索和薪资字段。

更新线上 Supabase 时，在项目根目录运行：

```powershell
npm run data:update
```

脚本会先校验 Excel，再显示目标数据库并等待确认，最后执行幂等导入和数量核对。第一次运行需要粘贴一次 Supabase Session Pooler URL；连接串会通过 Windows 当前账户加密保存在本机，并被 Git 忽略。之后无需重复配置环境变量。可用 `npm run data:check` 只检查 Excel，用 `npm run data:forget` 清除本机保存的连接。

现有种子 ID 仍由 Excel 行号生成，因此请在末尾追加新数据，不要排序、插入或删除既有行；修改已有行内容是安全的。数据更新后网站会直接读取 Supabase，不需要重新部署 Vercel。

审核台不出现在公开导航中，路径由 `VITE_ADMIN_PATH` 配置。请在根目录 `.env` 中设置一个只有你知道的路径，例如 `VITE_ADMIN_PATH=/_review-你的随机字符串`，然后重启开发服务或重新构建前端。审核页面仍需要管理员密码，隐藏路径不能替代密码保护。

## 学校目录

`china_mainland_universities.json` 包含 31 个省级地区、3,309 个可选校名，是投稿学校搜索、审核绑定和主界面学校标签的统一数据源。目录保留历史校名，并依据教育部截至 2025 年的全国普通高校名单补充 2021 年后的新增及现用校名，以及 2026 年 7 月前正式批准的新设、升格和更名学校。每个校名在文件中直接带有本科或专科标签以及地区标签；C9、985、211、双一流标签按完整名单写入，校区、分校和医学部继承所属学校的层级标签。

“一本/二本”批次已经逐步取消且各省口径不同，因此不使用这两类标签。学校常用简称、职业本科例外和层次识别规则集中维护在 `apps/api/src/school-classifications.ts`。投稿页区分国内与海外高校：国内高校提供目录联想，海外高校允许直接填写全称。

高校更新依据为教育部《全国高等学校名单（截至 2025 年 6 月 20 日）》、2026 年专科层次高等职业学校备案名单，以及教育部 2026 年度高等学校设置审批结果。由于 2025 年附件在发布后更新过，目录以附件内实际校名为准。

## 专业与城市目录

投稿页会根据当前输入联想专业和城市，选择建议项后自动填入规范名称。目录只用于搜索建议，不是投稿白名单：目录外专业、海外城市以及“广西某城市”一类模糊表述仍可直接填写并正常投稿。

- `apps/api/data/undergraduate-majors.json`：815 个 2024 年本科专业，按 12 个学科门类整理，来源为[央广网转载的 2024 本科专业目录思维导图](https://news.cnr.cn/native/gd/20240620/t20240620_526755849.shtml)，专业代码通过公开的 2024 目录机器可读转录核对。
- `apps/api/data/graduate-majors.json`：776 个去重后的硕士、博士专业，保留专业代码、学科门类和适用学历，静态采集自[研招网专业知识库](https://yz.chsi.com.cn/zyk/)的公开分类目录。
- `apps/api/data/cities.json`：684 个去重城市，包含直辖市、地级市、县级市和港澳台城市，保留省份、级别以及带“市”后缀等别名，整理自[中国城市大全](https://0513.city/thought/165.html)。

这些目录随应用部署，API 运行时不会请求第三方网站。`GET /api/majors` 支持 `query`、`degree` 和 `limit`，`GET /api/cities` 支持 `query` 和 `limit`。

## 本地运行

```powershell
npm install
npm run dev
```

打开 `http://127.0.0.1:5173`。未配置数据库时 API 使用内存仓储并自动加载全部 272 条种子，适合开发与试玩；重启服务会清空玩家局次和新投稿。

`/stats` 是公开统计页，展示城市、学历薪资区间、学校年薪排行、留言高频词、专业和岗位排行。统计只使用审核通过的投稿；月薪会按 12 个月折算，无法识别年化口径的记录不参与薪资统计。

## PostgreSQL 模式

```powershell
docker compose up -d postgres
Copy-Item apps/api/.env.example apps/api/.env
npm run prisma:generate -w @guess-salary/api
npx prisma migrate deploy --schema apps/api/prisma/schema.prisma
npm run seed:import
npm run dev
```

Fastify 在存在 `DATABASE_URL` 时自动使用 Prisma/PostgreSQL。管理员密码只保存 bcrypt hash：

```powershell
npm run admin:hash -w @guess-salary/api -- "你的管理员密码"
```

把输出写入 `ADMIN_PASSWORD_HASH`，并为 `ADMIN_SESSION_SECRET`、`IP_HASH_SALT` 设置长随机值。数据库模式下验证码会写入数据库，管理员 token 是带过期时间的签名 token，可以跨 API 重启和多实例使用。

## 检查

```powershell
npm run lint
npm run test
npm run build
```

## 生产部署

在根目录从 `.env.example` 创建 `.env`，配置非空的 `DOMAIN`、`ADMIN_PASSWORD_HASH`、`ADMIN_SESSION_SECRET` 和 `IP_HASH_SALT`，然后运行：

```powershell
docker compose up -d --build
```

Caddy 提供静态前端、SPA 回退、API 反向代理和 HTTPS。容器启动时会执行幂等的 Prisma schema 同步和种子导入。域名部署到中国大陆服务器前需完成 ICP 备案；UGC 正式开放前还需接入合规的实名认证与举报处理渠道。

数据库备份：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/backup-postgres.ps1
```

## Cloudflare、Vercel、Supabase

云部署的具体步骤见 [`DEPLOYMENT.md`](DEPLOYMENT.md)。Vercel 同时部署前端和 `api/[...path].ts` Fastify Function，Supabase 提供 PostgreSQL，Cloudflare 负责 DNS、代理和 WAF。前端使用同域 `/api`，投稿、审核和答题记录会直接持续写入 Supabase，不需要重新部署前端。
