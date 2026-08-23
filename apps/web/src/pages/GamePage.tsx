import { useEffect, useState } from 'react';
import {
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  Clock3,
  GraduationCap,
  Landmark,
  LoaderCircle,
  MapPin,
  RefreshCw,
  Share2,
  Flag,
  Sparkles,
} from 'lucide-react';
import { formatSalaryAmount } from '@guess-salary/shared';
import { rangeFor, useGameStore } from '../store';
import { StatusBanner } from '../components/StatusBanner';

function sliderToAmount(position: number, min: number, max: number) {
  return Math.round((min * Math.pow(max / min, position / 1000)) / 100) * 100;
}

function amountToSlider(amount: number, min: number, max: number) {
  return Math.round((Math.log(amount / min) / Math.log(max / min)) * 1000);
}

function inputStep(period: 'MONTHLY' | 'ANNUAL') {
  return period === 'ANNUAL' ? 0.1 : 100;
}

function displayAmount(amount: number, period: 'MONTHLY' | 'ANNUAL') {
  return period === 'ANNUAL' ? (amount / 10_000).toFixed(1) : String(amount);
}

function rangeLabel(amount: number, period: 'MONTHLY' | 'ANNUAL') {
  return period === 'ANNUAL'
    ? `${displayAmount(amount, period)} 万元 / 年`
    : formatSalaryAmount(amount, period);
}

const clues = [
  ['学历', 'degree', GraduationCap],
  ['专业', 'major', Sparkles],
  ['学校', 'school', Landmark],
  ['城市', 'city', MapPin],
  ['毕业已经', 'tenureText', Clock3],
  ['公司', 'companyName', Building2],
  ['岗位', 'position', BriefcaseBusiness],
] as const;

export function GamePage() {
  const {
    round,
    result,
    questionNumber,
    stats,
    guessAmount,
    loading,
    submitting,
    error,
    setGuess,
    loadRound,
    submitGuess,
  } = useGameStore();
  const [guessInput, setGuessInput] = useState('');

  useEffect(() => {
    if (!round && !loading) void loadRound();
  }, [loadRound, loading, round]);

  const period = round?.salaryPeriod === 'MONTHLY' ? 'MONTHLY' : 'ANNUAL';
  const range = rangeFor(period);
  const sliderValue = Math.max(
    0,
    Math.min(1000, amountToSlider(guessAmount, range.min, range.max)),
  );
  const periodLabel = period === 'MONTHLY' ? '月薪' : '年薪';
  const inputUnit = period === 'ANNUAL' ? '万元' : '元';

  useEffect(() => {
    if (round?.id) setGuessInput(displayAmount(guessAmount, period));
  }, [round?.id, guessAmount, period]);

  const commitGuessInput = () => {
    const typedAmount = Number(guessInput);
    const unitAmount = Number.isFinite(typedAmount) ? typedAmount : 0;
    const amountInYuan = period === 'ANNUAL' ? unitAmount * 10_000 : unitAmount;
    const step = inputStep(period);
    const rounded =
      period === 'ANNUAL'
        ? Math.round(amountInYuan / (step * 10_000)) * step * 10_000
        : Math.round(amountInYuan / step) * step;
    const committed = Math.max(range.min, Math.min(range.max, Math.round(rounded)));
    setGuess(committed);
    setGuessInput(displayAmount(committed, period));
  };

  const shareResult = async () => {
    if (!result) return;
    const text = `我在「猜薪资」猜了 ${formatSalaryAmount(result.guess.amount, result.guess.period)}，真实投稿是「${result.salaryRaw}」。你会猜多少？`;
    if (navigator.share) {
      await navigator.share({ title: '猜薪资', text, url: window.location.origin });
    } else {
      await navigator.clipboard.writeText(`${text} ${window.location.origin}`);
    }
  };

  if (loading && !round) {
    return (
      <section className="game-shell" aria-busy="true">
        <div className="skeleton h-8 w-44" />
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 7 }, (_, index) => (
            <div className="skeleton h-24" key={index} />
          ))}
        </div>
      </section>
    );
  }

  if (!round) {
    return (
      <section className="empty-state">
        <BriefcaseBusiness size={36} aria-hidden="true" />
        <h1>暂时没有可用题目</h1>
        <p>{error ?? '题库正在补充中，请稍后再来。'}</p>
        <button type="button" className="btn-secondary" onClick={() => void loadRound()}>
          <RefreshCw size={18} /> 重试
        </button>
      </section>
    );
  }

  const profileValues: Record<string, React.ReactNode> = {
    degree: round.profile.degree,
    school: (
      <span className="flex flex-wrap items-center gap-2">
        <span>{round.profile.schoolName ?? '学校信息已隐藏'}</span>
        {round.profile.schoolTags.map((tag) => (
          <span className="tag" key={tag}>
            {tag}
          </span>
        ))}
      </span>
    ),
    major: round.profile.major,
    tenureText: round.profile.tenureText,
    city: round.profile.city,
    companyName: round.profile.companyName,
    position: round.profile.position,
  };

  return (
    <div className="game-shell">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">第 {questionNumber} 题</p>
          <h1 className="page-title">看看这些线索，你会怎么猜？</h1>
        </div>
        <div className="stats-strip" aria-label="本次游戏统计">
          <span>
            <strong>{stats.answeredCount}</strong> 已猜
          </span>
          <span className="stats-divider" />
          <span>
            <strong>
              {stats.medianDeviation === null ? '—' : `${Math.round(stats.medianDeviation * 100)}%`}
            </strong>{' '}
            中位偏差
          </span>
          <span className="stats-divider" />
          <span>
            <strong>{stats.hitRate === null ? '—' : `${Math.round(stats.hitRate * 100)}%`}</strong>{' '}
            ±20% 命中
          </span>
        </div>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.35fr_.65fr] lg:items-start">
        <section aria-labelledby="clues-title">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="clues-title" className="section-title">
              人物线索
            </h2>
            {(round.profile.schoolHidden || round.profile.companyHidden) && (
              <span className="privacy-chip">部分信息已单独隐藏</span>
            )}
          </div>
          <div className="clue-grid">
            {clues.map(([label, key, Icon]) => (
              <div className={`clue-item clue-item-${key}`} key={key}>
                <span className="clue-icon">
                  <Icon size={19} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="clue-label">{label}</p>
                  <div className="clue-value">{profileValues[key]}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <aside className="guess-panel" aria-labelledby="guess-title">
          {!result ? (
            <>
              <p className="eyebrow">本题口径</p>
              <h2 id="guess-title" className="guess-title">
                {round.prompt}
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                按这个口径输入金额，提交后才会显示原文和投稿者留言。
              </p>

              <label className="mt-7 block" htmlFor="salary-input">
                <span className="field-label">你的猜测</span>
                <div className="money-input-wrap">
                  <span>¥</span>
                  <input
                    id="salary-input"
                    type="number"
                    inputMode={period === 'ANNUAL' ? 'decimal' : 'numeric'}
                    min={period === 'ANNUAL' ? range.min / 10_000 : range.min}
                    max={period === 'ANNUAL' ? range.max / 10_000 : range.max}
                    step={inputStep(period)}
                    value={guessInput}
                    onChange={(event) => setGuessInput(event.target.value)}
                    onBlur={commitGuessInput}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        commitGuessInput();
                      }
                    }}
                  />
                  <small>
                    {inputUnit} / {period === 'MONTHLY' ? '每月' : '每年'}
                  </small>
                </div>
              </label>
              <input
                className="salary-slider mt-5"
                type="range"
                min="0"
                max="1000"
                value={sliderValue}
                onChange={(event) =>
                  (() => {
                    const amount = sliderToAmount(Number(event.target.value), range.min, range.max);
                    setGuess(amount);
                    setGuessInput(displayAmount(amount, period));
                  })()
                }
                aria-label={`${periodLabel}猜测滑块`}
                aria-valuetext={rangeLabel(guessAmount, period)}
              />
              <div className="mt-2 flex justify-between text-xs tabular-nums text-muted">
                <span>{rangeLabel(range.min, period)}</span>
                <span>{rangeLabel(range.max, period)}</span>
              </div>
              {error && (
                <div className="mt-4">
                  <StatusBanner tone="error">{error}</StatusBanner>
                </div>
              )}
              <button
                type="button"
                className="btn-primary mt-6 w-full"
                disabled={submitting}
                onClick={() => void submitGuess()}
              >
                {submitting ? (
                  <LoaderCircle className="animate-spin" size={18} />
                ) : (
                  <ArrowRight size={18} />
                )}
                {submitting ? '正在揭晓' : '提交并揭晓'}
              </button>
            </>
          ) : (
            <div className="reveal" aria-live="polite">
              <p className="eyebrow">真实投稿</p>
              <h2 id="guess-title" className="salary-raw">
                {result.salaryRaw}
              </h2>
              <div className="comparison-row">
                <span>你猜</span>
                <strong>{formatSalaryAmount(result.guess.amount, result.guess.period)}</strong>
              </div>
              <div className="diff-statement">
                {result.diff ? (
                  result.diff.direction === 'equal' ? (
                    <p>与{result.diff.comparisonLabel}一致。</p>
                  ) : (
                    <p>
                      比{result.diff.comparisonLabel}
                      {result.diff.direction === 'higher' ? '高' : '低'}{' '}
                      <strong>{result.diff.amount.toLocaleString('zh-CN')} 元</strong>
                      {result.diff.percent === null
                        ? ''
                        : `（约 ${Math.round(result.diff.percent * 100)}%）`}
                    </p>
                  )
                ) : (
                  <p>原文口径较复杂，这一题仅并列展示，不计算偏差。</p>
                )}
              </div>
              {result.authorNote && (
                <figure className="author-note">
                  <figcaption>投稿者想说</figcaption>
                  <blockquote>“{result.authorNote}”</blockquote>
                </figure>
              )}
              <div className="mt-6 grid grid-cols-[auto_auto_1fr] gap-2">
                <button
                  type="button"
                  className="btn-secondary px-3"
                  onClick={() => void shareResult()}
                  title="分享结果"
                  aria-label="分享结果"
                >
                  <Share2 size={18} />
                </button>
                <a
                  className="btn-secondary px-3"
                  href={`/report?roundId=${round.id}`}
                  title="举报本题"
                  aria-label="举报本题"
                >
                  <Flag size={18} />
                </a>
                <button
                  type="button"
                  className="btn-primary w-full"
                  onClick={() => void loadRound()}
                  disabled={loading}
                >
                  {loading ? (
                    <LoaderCircle className="animate-spin" size={18} />
                  ) : (
                    <ArrowRight size={18} />
                  )}
                  下一题
                </button>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
