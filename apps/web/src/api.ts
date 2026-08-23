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
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
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
}

export const getNextRound = (sessionId: string) =>
  api<Round>(`/api/rounds/next?sessionId=${encodeURIComponent(sessionId)}`);

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
