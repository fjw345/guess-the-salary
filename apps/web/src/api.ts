import type { ApiErrorBody, DatasetStats, Round, RoundResult, Stats } from './types';

export interface MajorSuggestion {
  id: string;
  name: string;
  category: string;
  degreeTypes: Array<'BACHELOR' | 'MASTER' | 'DOCTOR'>;
  code?: string;
}

export interface CitySuggestion {
  id: string;
  name: string;
  province: string;
  level: 'MUNICIPALITY' | 'PREFECTURE' | 'COUNTY' | 'SPECIAL';
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
  }
}

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL?.trim() ?? '').replace(/\/$/, '');

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      signal: init?.signal ?? controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    });
    const body = (await response.json().catch(() => ({}))) as T & ApiErrorBody;
    if (!response.ok) {
      throw new ApiError(body.message ?? '请求失败，请稍后重试。', response.status, body.code);
    }
    return body;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError('请求超时，请检查网络后重试。', 408, 'REQUEST_TIMEOUT');
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export const getNextRound = async (sessionId: string) => {
  const round = await api<Round>(`/api/rounds/next?sessionId=${encodeURIComponent(sessionId)}`);
  if (
    !round ||
    typeof round !== 'object' ||
    !round.profile ||
    !Array.isArray(round.profile.schoolTags)
  ) {
    throw new ApiError('题目数据异常，请稍后重试。', 502, 'INVALID_ROUND');
  }
  return round;
};

export const answerRound = (id: string, guessAmount: number, guessPeriod: string) =>
  api<RoundResult>(`/api/rounds/${id}/answer`, {
    method: 'POST',
    body: JSON.stringify({ guessAmount, guessPeriod }),
  });

export const getStats = (sessionId: string) => api<Stats>(`/api/stats/${sessionId}`);

export const getPublicStats = () => api<DatasetStats>('/api/public-stats');

export const getMajors = (query: string, degree: string) =>
  api<{ items: MajorSuggestion[] }>(
    `/api/majors?query=${encodeURIComponent(query)}&degree=${encodeURIComponent(degree)}`,
  );

export const getCities = (query: string) =>
  api<{ items: CitySuggestion[] }>(`/api/cities?query=${encodeURIComponent(query)}`);
