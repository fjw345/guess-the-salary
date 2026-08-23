import { useCallback, useEffect, useState } from 'react';
import { Check, Flag, LoaderCircle, LockKeyhole, RefreshCw, X } from 'lucide-react';
import { api } from '../api';
import { StatusBanner } from '../components/StatusBanner';

interface PendingItem {
  id: string;
  degree: string;
  schoolId: number | null;
  schoolNameRaw: string;
  hideSchool: boolean;
  major: string;
  tenureText: string;
  city: string;
  companyName: string;
  hideCompany: boolean;
  position: string;
  salaryRaw: string;
  salaryPeriod: string;
  salaryBasis: string;
  authorNote: string;
  duplicates: number;
}
interface School {
  id: number;
  name: string;
  tags: string[];
}
interface ReportItem {
  id: string;
  reason: string;
  details: string;
  roundId: string | null;
  createdAt: string;
}

const reportReasons: Record<string, string> = {
  IDENTITY_LEAK: '可能泄露身份',
  FALSE_INFO: '信息疑似失实',
  OFFENSIVE: '不当或冒犯内容',
  OTHER: '其他问题',
};

export function AdminPage() {
  const [password, setPassword] = useState('');
  const [token, setToken] = useState(sessionStorage.getItem('guess-salary-admin') ?? '');
  const [items, setItems] = useState<PendingItem[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<'submissions' | 'reports'>('submissions');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadQueues = useCallback(async (authToken: string) => {
    const [pending, openReports, schoolList] = await Promise.all([
      api<{ items: PendingItem[] }>('/api/admin/submissions', {
        headers: { Authorization: `Bearer ${authToken}` },
      }),
      api<{ items: ReportItem[] }>('/api/admin/reports', {
        headers: { Authorization: `Bearer ${authToken}` },
      }),
      api<{ items: School[] }>('/api/schools?query=&limit=4000'),
    ]);
    setItems(pending.items);
    setReports(openReports.items);
    setSchools(schoolList.items);
    setSelected(new Set());
  }, []);

  useEffect(() => {
    if (token) {
      void loadQueues(token).catch(() => {
        setToken('');
        sessionStorage.removeItem('guess-salary-admin');
      });
    }
  }, [loadQueues, token]);

  const login = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await api<{ token: string }>('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify({ password }),
      });
      setToken(response.token);
      sessionStorage.setItem('guess-salary-admin', response.token);
      await loadQueues(response.token);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '登录失败。');
    } finally {
      setLoading(false);
    }
  };

  const review = async (item: PendingItem, status: 'APPROVED' | 'REJECTED') => {
    const rejectReason =
      status === 'REJECTED' ? window.prompt('请输入驳回理由')?.trim() : undefined;
    if (status === 'REJECTED' && !rejectReason) return;
    await api(`/api/admin/submissions/${item.id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        status,
        rejectReason,
        authorNote: item.authorNote,
        schoolId: item.schoolId,
        salaryPeriod: item.salaryPeriod,
        salaryBasis: item.salaryBasis,
        hideSchool: item.hideSchool,
        hideCompany: item.hideCompany,
      }),
    });
    setItems((current) => current.filter((currentItem) => currentItem.id !== item.id));
    setSelected((current) => {
      const next = new Set(current);
      next.delete(item.id);
      return next;
    });
  };

  const runAction = async (action: () => Promise<void>) => {
    setLoading(true);
    setError(null);
    try {
      await action();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '操作失败。');
    } finally {
      setLoading(false);
    }
  };

  const approveSelected = () =>
    runAction(async () => {
      for (const item of items.filter((candidate) => selected.has(candidate.id)))
        await review(item, 'APPROVED');
    });

  const updateItem = (
    id: string,
    key: keyof PendingItem,
    value: string | number | boolean | null,
  ) =>
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, [key]: value } : item)),
    );

  const resolveReport = (id: string) =>
    runAction(async () => {
      await api(`/api/admin/reports/${id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      setReports((current) => current.filter((report) => report.id !== id));
    });

  if (!token) {
    return (
      <section className="admin-login">
        <LockKeyhole size={34} />
        <p className="eyebrow">管理员</p>
        <h1>登录审核台</h1>
        <form onSubmit={login}>
          <label>
            <span>管理员密码</span>
            <input
              required
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {error && <StatusBanner tone="error">{error}</StatusBanner>}
          <button className="btn-primary w-full" disabled={loading}>
            {loading && <LoaderCircle className="animate-spin" size={18} />}登录
          </button>
        </form>
      </section>
    );
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">内容审核</p>
          <h1 className="page-title">审核工作台</h1>
        </div>
        <button
          className="btn-secondary"
          disabled={loading}
          onClick={() => void runAction(() => loadQueues(token))}
        >
          <RefreshCw size={17} />
          刷新
        </button>
      </div>
      <div className="tab-list" role="tablist" aria-label="审核队列">
        <button
          role="tab"
          aria-selected={tab === 'submissions'}
          onClick={() => setTab('submissions')}
        >
          投稿 <span>{items.length}</span>
        </button>
        <button role="tab" aria-selected={tab === 'reports'} onClick={() => setTab('reports')}>
          举报 <span>{reports.length}</span>
        </button>
      </div>
      {error && (
        <div className="my-4">
          <StatusBanner tone="error">{error}</StatusBanner>
        </div>
      )}

      {tab === 'submissions' && (
        <section role="tabpanel" className="mt-5">
          {items.length > 0 && (
            <div className="bulk-bar">
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={selected.size === items.length}
                  onChange={(event) =>
                    setSelected(
                      event.target.checked ? new Set(items.map((item) => item.id)) : new Set(),
                    )
                  }
                />
                <span>全选</span>
              </label>
              <button
                className="btn-primary"
                disabled={!selected.size || loading}
                onClick={() => void approveSelected()}
              >
                <Check size={17} />
                批量通过 {selected.size || ''}
              </button>
            </div>
          )}
          {items.length === 0 ? (
            <QueueEmpty icon="check" label="当前没有待审投稿" />
          ) : (
            <div className="review-list">
              {items.map((item) => (
                <article key={item.id} className="review-item review-item-editable">
                  <label className="review-select">
                    <input
                      type="checkbox"
                      checked={selected.has(item.id)}
                      onChange={(event) =>
                        setSelected((current) => {
                          const next = new Set(current);
                          if (event.target.checked) {
                            next.add(item.id);
                          } else {
                            next.delete(item.id);
                          }
                          return next;
                        })
                      }
                    />
                    <span className="sr-only">选择 {item.schoolNameRaw} 的投稿</span>
                  </label>
                  <div className="review-meta">
                    <strong>
                      {item.schoolNameRaw} · {item.major}
                    </strong>
                    <span>
                      {item.degree} / {item.tenureText} / {item.city}
                    </span>
                    <span>
                      {item.companyName} · {item.position}
                    </span>
                    {item.duplicates > 0 && <mark>发现 {item.duplicates} 条相似投稿</mark>}
                  </div>
                  <div className="review-edit-grid">
                    <p className="salary-review">{item.salaryRaw}</p>
                    <label>
                      <span>周期</span>
                      <select
                        value={item.salaryPeriod}
                        onChange={(event) =>
                          updateItem(item.id, 'salaryPeriod', event.target.value)
                        }
                      >
                        <option value="MONTHLY">月薪</option>
                        <option value="ANNUAL">年薪</option>
                        <option value="UNKNOWN">口径不明</option>
                      </select>
                    </label>
                    <label>
                      <span>税前 / 税后</span>
                      <select
                        value={item.salaryBasis}
                        onChange={(event) => updateItem(item.id, 'salaryBasis', event.target.value)}
                      >
                        <option value="PRETAX">税前</option>
                        <option value="AFTERTAX">税后</option>
                        <option value="UNKNOWN">不明</option>
                      </select>
                    </label>
                    <label>
                      <span>绑定学校</span>
                      <select
                        value={item.schoolId ?? ''}
                        onChange={(event) =>
                          updateItem(
                            item.id,
                            'schoolId',
                            event.target.value ? Number(event.target.value) : null,
                          )
                        }
                      >
                        <option value="">暂不绑定</option>
                        {schools.map((school) => (
                          <option value={school.id} key={school.id}>
                            {school.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="md:col-span-3">
                      <span>投稿者留言</span>
                      <textarea
                        rows={3}
                        value={item.authorNote ?? ''}
                        onChange={(event) => updateItem(item.id, 'authorNote', event.target.value)}
                      />
                    </label>
                    <label className="check-row">
                      <input
                        type="checkbox"
                        checked={item.hideSchool}
                        onChange={(event) =>
                          updateItem(item.id, 'hideSchool', event.target.checked)
                        }
                      />
                      <span>隐藏学校名称</span>
                    </label>
                    <label className="check-row">
                      <input
                        type="checkbox"
                        checked={item.hideCompany}
                        onChange={(event) =>
                          updateItem(item.id, 'hideCompany', event.target.checked)
                        }
                      />
                      <span>隐藏公司名称</span>
                    </label>
                  </div>
                  <div className="review-actions">
                    <button
                      className="btn-secondary"
                      disabled={loading}
                      onClick={() => void runAction(() => review(item, 'REJECTED'))}
                    >
                      <X size={17} />
                      驳回
                    </button>
                    <button
                      className="btn-primary"
                      disabled={loading}
                      onClick={() => void runAction(() => review(item, 'APPROVED'))}
                    >
                      <Check size={17} />
                      保存并通过
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === 'reports' && (
        <section role="tabpanel" className="mt-5">
          {reports.length === 0 ? (
            <QueueEmpty icon="flag" label="当前没有待处理举报" />
          ) : (
            <div className="report-list">
              {reports.map((report) => (
                <article key={report.id} className="report-item">
                  <div>
                    <span className="tag">{reportReasons[report.reason] ?? report.reason}</span>
                    <time>{new Date(report.createdAt).toLocaleString('zh-CN')}</time>
                  </div>
                  <p>{report.details}</p>
                  {report.roundId && <small>关联局次：{report.roundId}</small>}
                  <button
                    className="btn-primary"
                    disabled={loading}
                    onClick={() => void resolveReport(report.id)}
                  >
                    <Check size={17} />
                    标记已处理
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function QueueEmpty({ icon, label }: { icon: 'check' | 'flag'; label: string }) {
  return (
    <div className="empty-state">
      {icon === 'check' ? <Check size={34} /> : <Flag size={34} />}
      <h2>{label}</h2>
      <p>新的内容会显示在这里。</p>
    </div>
  );
}
