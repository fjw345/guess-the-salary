import type { SalaryPeriod } from '@guess-salary/shared';
import { create } from 'zustand';
import { answerRound, getNextRound, getStats } from './api';
import type { Round, RoundResult, Stats } from './types';

function getSessionId() {
  const key = 'guess-salary-session';
  const current = localStorage.getItem(key);
  if (current) return current;
  const created = crypto.randomUUID();
  localStorage.setItem(key, created);
  return created;
}

interface GameStore {
  sessionId: string;
  round: Round | null;
  result: RoundResult | null;
  questionNumber: number;
  stats: Stats;
  guessAmount: number;
  loading: boolean;
  submitting: boolean;
  error: string | null;
  setGuess: (amount: number) => void;
  loadRound: () => Promise<void>;
  submitGuess: () => Promise<void>;
}

const rangeFor = (period: SalaryPeriod) =>
  period === 'MONTHLY'
    ? { min: 1_000, max: 500_000, initial: 15_000 }
    : { min: 10_000, max: 8_000_000, initial: 300_000 };

export const useGameStore = create<GameStore>((set, get) => ({
  sessionId: getSessionId(),
  round: null,
  result: null,
  questionNumber: 1,
  stats: { answeredCount: 0, medianDeviation: null, hitRate: null },
  guessAmount: 15_000,
  loading: false,
  submitting: false,
  error: null,
  setGuess: (guessAmount) => set({ guessAmount }),
  loadRound: async () => {
    set({ loading: true, error: null, result: null });
    try {
      const round = await getNextRound(get().sessionId);
      const period = round.salaryPeriod === 'MONTHLY' ? 'MONTHLY' : 'ANNUAL';
      const stats = await getStats(get().sessionId);
      set({
        round,
        questionNumber: stats.answeredCount + 1,
        stats,
        guessAmount: rangeFor(period).initial,
        loading: false,
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '题目加载失败。', loading: false });
    }
  },
  submitGuess: async () => {
    const { round, guessAmount } = get();
    if (!round) return;
    const guessPeriod = round.salaryPeriod === 'MONTHLY' ? 'MONTHLY' : 'ANNUAL';
    set({ submitting: true, error: null });
    try {
      const result = await answerRound(round.id, guessAmount, guessPeriod);
      const stats = await getStats(get().sessionId);
      set({ result, stats, submitting: false });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '提交失败。', submitting: false });
    }
  },
}));

export { rangeFor };
