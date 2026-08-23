import { Flag, ShieldCheck, UserRoundX } from 'lucide-react';

export function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl">
      <p className="eyebrow">隐私与内容规范</p>
      <h1 className="page-title">真实经历，不等于暴露一个人</h1>
      <p className="mt-4 text-base leading-8 text-muted">
        学校和公司默认作为有效线索展示。我们不收集姓名、手机号、邮箱或工号；审核发现单项信息存在定位风险时，会单独隐藏学校或公司。
      </p>
      <div className="policy-list">
        <section>
          <UserRoundX />
          <div>
            <h2>不收身份信息</h2>
            <p>请勿投稿能够直接定位个人的信息。投稿者只能提交自己的或已经公开的经历。</p>
          </div>
        </section>
        <section>
          <ShieldCheck />
          <div>
            <h2>先审后发</h2>
            <p>新投稿不会立即进入题库。管理员会检查薪资口径、留言与潜在身份信息。</p>
          </div>
        </section>
        <section>
          <Flag />
          <div>
            <h2>举报入口</h2>
            <p>发现疑似冒用、泄露或明显失实的内容，请说明线索与原因。</p>
            <a className="btn-secondary mt-3 inline-flex" href="/report">
              提交举报
            </a>
          </div>
        </section>
      </div>
    </article>
  );
}
