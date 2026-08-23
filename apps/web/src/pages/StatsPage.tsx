import { useCallback, useEffect, useState, type ComponentType } from 'react';
import {
  BarChart3,
  BookOpenText,
  BriefcaseBusiness,
  GraduationCap,
  Info,
  Landmark,
  MapPin,
  MessageSquareQuote,
  RefreshCw,
  Rows3,
} from 'lucide-react';
import { getPublicStats } from '../api';
import type { DatasetStats, RankedCount, SchoolSalaryStats } from '../types';
import { StatusBanner } from '../components/StatusBanner';

const integerFormat = new Intl.NumberFormat('zh-CN');

function formatAnnual(value: number | null) {
  if (value === null) return '暂无';
  if (value >= 10_000) {
    const wan = value / 10_000;
    return `${Number.isInteger(wan) ? wan : wan.toFixed(1)} 万元`;
  }
  return `${integerFormat.format(value)} 元`;
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: ComponentType<{ size?: number; 'aria-hidden'?: boolean }>;
  label: string;
  value: string;
  detail: string;
  tone: 'pink' | 'lemon' | 'mint' | 'neutral';
}) {
  return (
    <article className={`dataset-summary dataset-summary-${tone}`}>
      <Icon size={20} aria-hidden={true} />
      <p>{label}</p>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function CountRanking({ items, emptyLabel }: { items: RankedCount[]; emptyLabel: string }) {
  if (!items.length) return <p className="dataset-empty">{emptyLabel}</p>;
  const maximum = items[0]?.count ?? 1;
  return (
    <ol className="ranking-list">
      {items.map((item, index) => (
        <li key={item.label}>
          <span className="ranking-number">{String(index + 1).padStart(2, '0')}</span>
          <div className="ranking-content">
            <div className="ranking-label-row">
              <strong>{item.label}</strong>
              <span>{item.count} 次</span>
            </div>
            <div className="ranking-track" aria-hidden="true">
              <span style={{ width: `${Math.max(8, (item.count / maximum) * 100)}%` }} />
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

function SchoolRanking({ items }: { items: SchoolSalaryStats[] }) {
  if (!items.length) return <p className="dataset-empty">暂无可比较的学校薪资。</p>;
  const maximum = items[0]?.average ?? 1;
  return (
    <ol className="ranking-list school-ranking">
      {items.map((item, index) => (
        <li key={item.school}>
          <span className="ranking-number">{String(index + 1).padStart(2, '0')}</span>
          <div className="ranking-content">
            <div className="ranking-label-row">
              <strong>{item.school}</strong>
              <span>{formatAnnual(item.average)}</span>
            </div>
            <div className="ranking-track" aria-hidden="true">
              <span style={{ width: `${Math.max(8, (item.average / maximum) * 100)}%` }} />
            </div>
            <small>{item.count} 条可折算样本</small>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function StatsPage() {
  const [stats, setStats] = useState<DatasetStats | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setStats(await getPublicStats());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '统计数据加载失败，请稍后重试。');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  if (loading && !stats) {
    return (
      <section className="stats-page" aria-busy="true" aria-label="正在加载数据统计">
        <div className="skeleton h-8 w-56" />
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div className="skeleton h-32" key={index} />
          ))}
        </div>
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <div className="skeleton h-80" />
          <div className="skeleton h-80" />
        </div>
      </section>
    );
  }

  if (!stats) {
    return (
      <section className="empty-state">
        <BarChart3 size={36} aria-hidden="true" />
        <h1>统计数据暂时不可用</h1>
        <p>{error}</p>
        <button type="button" className="btn-secondary" onClick={() => void loadStats()}>
          <RefreshCw size={18} /> 重试
        </button>
      </section>
    );
  }

  const topCity = stats.topCities[0];
  const topSchool = stats.topSchools[0];

  return (
    <div className="stats-page">
      <header className="dataset-heading">
        <div>
          <p className="eyebrow">数据观察室</p>
          <h1 className="page-title">投稿里，藏着哪些职场切面？</h1>
        </div>
        <span className="dataset-count">
          <Rows3 size={18} aria-hidden="true" />
          {stats.totalSubmissions} 份公开样本
        </span>
      </header>

      {error && (
        <div className="mt-4">
          <StatusBanner tone="error">{error}</StatusBanner>
        </div>
      )}

      <section className="dataset-summary-grid" aria-label="核心统计">
        <SummaryCard
          icon={Rows3}
          label="已收录投稿"
          value={integerFormat.format(stats.totalSubmissions)}
          detail={`${stats.salariesWithAnnualEstimate} 条可折算年薪`}
          tone="pink"
        />
        <SummaryCard
          icon={MapPin}
          label="出现最多的城市"
          value={topCity?.label ?? '暂无'}
          detail={topCity ? `${topCity.count} 份投稿提到这里` : '等待更多样本'}
          tone="lemon"
        />
        <SummaryCard
          icon={BarChart3}
          label="年化薪资中位数"
          value={formatAnnual(stats.medianAnnualSalary)}
          detail="按现有薪资解析口径估算"
          tone="mint"
        />
        <SummaryCard
          icon={Landmark}
          label="平均年薪最高学校"
          value={topSchool?.school ?? '暂无'}
          detail={
            topSchool
              ? `${formatAnnual(topSchool.average)} · ${topSchool.count} 条样本`
              : '等待更多样本'
          }
          tone="neutral"
        />
      </section>

      <section className="stat-panel degree-panel" aria-labelledby="degree-salary-title">
        <div className="stat-panel-heading">
          <span className="stat-panel-icon stat-panel-icon-pink">
            <GraduationCap size={20} aria-hidden="true" />
          </span>
          <div>
            <p className="eyebrow">学历与薪资</p>
            <h2 id="degree-salary-title">不同学历的年化薪资区间</h2>
          </div>
        </div>
        <div className="salary-table-wrap">
          <table className="salary-table">
            <caption className="sr-only">本科、硕士和博士投稿的平均、最低及最高年化薪资</caption>
            <thead>
              <tr>
                <th scope="col">学历</th>
                <th scope="col">有效样本</th>
                <th scope="col">平均</th>
                <th scope="col">最低</th>
                <th scope="col">最高</th>
              </tr>
            </thead>
            <tbody>
              {stats.degreeSalaries.map((row) => (
                <tr key={row.degree}>
                  <th scope="row">{row.degree}</th>
                  <td data-label="有效样本">{row.count}</td>
                  <td data-label="平均" className="salary-average">
                    {formatAnnual(row.average)}
                  </td>
                  <td data-label="最低">{formatAnnual(row.minimum)}</td>
                  <td data-label="最高">{formatAnnual(row.maximum)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="dataset-two-column">
        <section className="stat-panel" aria-labelledby="city-ranking-title">
          <div className="stat-panel-heading">
            <span className="stat-panel-icon stat-panel-icon-lemon">
              <MapPin size={20} aria-hidden="true" />
            </span>
            <div>
              <p className="eyebrow">工作在哪里</p>
              <h2 id="city-ranking-title">投稿城市排行</h2>
            </div>
          </div>
          <CountRanking items={stats.topCities} emptyLabel="暂无城市数据。" />
        </section>

        <section className="stat-panel" aria-labelledby="school-ranking-title">
          <div className="stat-panel-heading">
            <span className="stat-panel-icon stat-panel-icon-mint">
              <Landmark size={20} aria-hidden="true" />
            </span>
            <div>
              <p className="eyebrow">学校样本</p>
              <h2 id="school-ranking-title">平均年薪靠前的学校</h2>
            </div>
          </div>
          <SchoolRanking items={stats.topSchools} />
        </section>
      </div>

      <section className="stat-panel words-panel" aria-labelledby="word-ranking-title">
        <div className="stat-panel-heading">
          <span className="stat-panel-icon stat-panel-icon-pink">
            <MessageSquareQuote size={20} aria-hidden="true" />
          </span>
          <div>
            <p className="eyebrow">大家想说</p>
            <h2 id="word-ranking-title">留言里的高频词</h2>
          </div>
        </div>
        {stats.topWords.length ? (
          <ol className="word-cloud">
            {stats.topWords.map((item, index) => (
              <li className={`word-rank-${Math.min(index + 1, 5)}`} key={item.word}>
                <strong>{item.word}</strong>
                <span>{item.count} 次</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="dataset-empty">暂无可统计的留言。</p>
        )}
      </section>

      <div className="dataset-two-column compact-rankings">
        <section className="stat-panel" aria-labelledby="major-ranking-title">
          <div className="stat-panel-heading">
            <span className="stat-panel-icon stat-panel-icon-lemon">
              <BookOpenText size={20} aria-hidden="true" />
            </span>
            <div>
              <p className="eyebrow">学过什么</p>
              <h2 id="major-ranking-title">高频专业</h2>
            </div>
          </div>
          <CountRanking items={stats.topMajors} emptyLabel="暂无专业数据。" />
        </section>
        <section className="stat-panel" aria-labelledby="position-ranking-title">
          <div className="stat-panel-heading">
            <span className="stat-panel-icon stat-panel-icon-mint">
              <BriefcaseBusiness size={20} aria-hidden="true" />
            </span>
            <div>
              <p className="eyebrow">在做什么</p>
              <h2 id="position-ranking-title">高频岗位</h2>
            </div>
          </div>
          <CountRanking items={stats.topPositions} emptyLabel="暂无岗位数据。" />
        </section>
      </div>

      <aside className="dataset-method">
        <Info size={18} aria-hidden="true" />
        <p>
          薪资按原文中可识别的月薪乘以 12
          或直接使用年薪；口径不明的记录不参与薪资统计。税前、税后、奖金与实习样本可能混合，结果仅反映当前投稿。
        </p>
      </aside>
    </div>
  );
}
