export type Team = { id: string; name: string; city: string };
export type Match = {
  id: string;
  startsAt: string | null;
  status: string;
  minute?: number;
  home: Team;
  away: Team;
  score: { home: number; away: number } | null;
};
export type MatchesResponse = { round: number; matches: Match[] };
export type MatchFilter = 'all' | 'upcoming' | 'finished';

export function filterMatches(matches: Match[], filter: MatchFilter): Match[] {
  return matches.filter((match) => filter === 'all'
    || (filter === 'upcoming' && ['scheduled', 'postponed'].includes(match.status))
    || (filter === 'finished' && match.status === 'finished'));
}

const statusLabels: Record<string, string> = {
  scheduled: 'Предстоит', finished: 'Завершён', live: 'В прямом эфире', postponed: 'Перенесён',
};
export function statusLabel(match: Match): string {
  const label = statusLabels[match.status] ?? 'Статус неизвестен';
  return match.status === 'live' && match.minute != null ? `${label} · ${match.minute} мин` : label;
}

export function formatStart(startsAt: string | null): string {
  if (!startsAt) return 'Дата уточняется';
  const date = new Date(startsAt);
  if (Number.isNaN(date.getTime())) return 'Дата уточняется';
  return date.toLocaleString('ru-RU', {
    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// Не доверяем TypeScript-приведению для JSON, пришедшего по сети.
export function parseMatches(value: unknown): MatchesResponse {
  const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
  const isTeam = (v: unknown) => isObject(v) && ['id', 'name', 'city'].every((key) => typeof v[key] === 'string');
  const isGoals = (v: unknown) => typeof v === 'number' && Number.isInteger(v) && v >= 0;
  if (!isObject(value) || !Number.isInteger(value.round) || !Array.isArray(value.matches)) {
    throw new Error('Некорректный формат ответа сервера');
  }
  const ids = new Set<string>();
  for (const match of value.matches) {
    if (!isObject(match) || typeof match.id !== 'string' || !match.id || ids.has(match.id)
      || typeof match.status !== 'string' || !isTeam(match.home) || !isTeam(match.away)
      || !(match.startsAt === null || typeof match.startsAt === 'string')
      || !(match.minute === undefined || isGoals(match.minute))
      || !(match.score === null || (isObject(match.score) && isGoals(match.score.home) && isGoals(match.score.away)))) {
      throw new Error('Некорректные данные матча');
    }
    ids.add(match.id);
  }
  return value as MatchesResponse;
}
