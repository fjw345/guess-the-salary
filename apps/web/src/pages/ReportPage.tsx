import { useState } from 'react';
import { CheckCircle2, Flag, LoaderCircle } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { StatusBanner } from '../components/StatusBanner';

export function ReportPage() {
  const [params] = useSearchParams();
  const [reason, setReason] = useState('IDENTITY_LEAK');
  const [details, setDetails] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle');
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus('loading');
    setError(null);
    try {
      await api('/api/reports', {
        method: 'POST',
        body: JSON.stringify({ reason, details, roundId: params.get('roundId') || undefined }),
      });
      setStatus('success');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '举报提交失败。');
      setStatus('idle');
    }
  };

  if (status === 'success')
    return (
      <section className="success-state">
        <CheckCircle2 size={42} />
        <p className="eyebrow">已收到</p>
        <h1>举报已进入审核队列</h1>
        <p>我们会核对内容并按需要脱敏、修正或下架。</p>
        <a className="btn-primary" href="/">
          返回游戏
        </a>
      </section>
    );

  return (
    <div className="mx-auto max-w-2xl">
      <p className="eyebrow">内容举报</p>
      <h1 className="page-title">指出需要核查的内容</h1>
      <p className="mt-3 text-sm leading-7 text-muted">
        请不要在说明中补充当事人的姓名、联系方式等新身份信息。
      </p>
      <form className="form-surface mt-7" onSubmit={submit}>
        <label>
          <span>问题类型</span>
          <select value={reason} onChange={(event) => setReason(event.target.value)}>
            <option value="IDENTITY_LEAK">可能泄露身份</option>
            <option value="FALSE_INFO">信息疑似失实</option>
            <option value="OFFENSIVE">不当或冒犯内容</option>
            <option value="OTHER">其他问题</option>
          </select>
        </label>
        <label>
          <span>具体说明</span>
          <textarea
            required
            minLength={5}
            maxLength={500}
            rows={6}
            value={details}
            onChange={(event) => setDetails(event.target.value)}
          />
        </label>
        {error && <StatusBanner tone="error">{error}</StatusBanner>}
        <button className="btn-primary" disabled={status === 'loading'}>
          {status === 'loading' ? (
            <LoaderCircle className="animate-spin" size={18} />
          ) : (
            <Flag size={18} />
          )}
          提交举报
        </button>
      </form>
    </div>
  );
}
