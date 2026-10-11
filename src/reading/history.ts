// Persistent day-by-day sight-reading results, split by position, so progress
// in a position can be followed over time.

import type { LineScore } from './exercise';
import type { Position } from './violin';

export interface DayRecord {
  lines: number;
  notes: number;
  firstTry: number;
  inTune: number;
  /** shift notes played (absent in older saves) */
  shifts?: number;
  /** shift notes that were clean: right pitch, in tune, first time */
  shiftsClean?: number;
}

/** position key: 'free' or '1'..'7' */
export type PositionKey = 'free' | `${Position}`;

/** date (YYYY-MM-DD, local) -> position key -> totals */
export type History = Record<string, Partial<Record<PositionKey, DayRecord>>>;

const STORAGE_KEY = 'reading.history';

export function positionKey(position: Position | null): PositionKey {
  return position === null ? 'free' : (`${position}` as PositionKey);
}

/** Local calendar date as YYYY-MM-DD. */
export function dayOf(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function loadHistory(): History {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as History) : {};
  } catch {
    return {};
  }
}

export function saveHistory(history: History): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch {
    // storage unavailable — history just won't persist
  }
}

/** Returns a new history with one completed line added to today's totals. */
export function withLineResult(
  history: History,
  day: string,
  position: Position | null,
  score: LineScore,
): History {
  const key = positionKey(position);
  const dayRecord = history[day] ?? {};
  const prev = dayRecord[key] ?? { lines: 0, notes: 0, firstTry: 0, inTune: 0 };
  return {
    ...history,
    [day]: {
      ...dayRecord,
      [key]: {
        lines: prev.lines + 1,
        notes: prev.notes + score.total,
        firstTry: prev.firstTry + score.firstTry,
        inTune: prev.inTune + score.inTune,
        shifts: (prev.shifts ?? 0) + score.shifts,
        shiftsClean: (prev.shiftsClean ?? 0) + score.shiftsClean,
      },
    },
  };
}

export interface DayTotals extends DayRecord {
  day: string;
}

/**
 * Per-day totals for one position (or all positions), oldest first, for the
 * days that have any practice recorded.
 */
export function dailyTotals(history: History, filter: PositionKey | 'all'): DayTotals[] {
  return Object.keys(history)
    .sort()
    .map((day) => {
      const records = Object.entries(history[day])
        .filter(([key]) => filter === 'all' || key === filter)
        .map(([, r]) => r as DayRecord);
      return records.reduce<DayTotals>(
        (acc, r) => ({
          day,
          lines: acc.lines + r.lines,
          notes: acc.notes + r.notes,
          firstTry: acc.firstTry + r.firstTry,
          inTune: acc.inTune + r.inTune,
          shifts: (acc.shifts ?? 0) + (r.shifts ?? 0),
          shiftsClean: (acc.shiftsClean ?? 0) + (r.shiftsClean ?? 0),
        }),
        { day, lines: 0, notes: 0, firstTry: 0, inTune: 0, shifts: 0, shiftsClean: 0 },
      );
    })
    .filter((t) => t.lines > 0);
}

/** Position keys that appear anywhere in the history, free first then ascending. */
export function recordedPositions(history: History): PositionKey[] {
  const keys = new Set<PositionKey>();
  for (const day of Object.values(history)) {
    for (const key of Object.keys(day)) keys.add(key as PositionKey);
  }
  return [...keys].sort((a, b) => (a === 'free' ? -1 : b === 'free' ? 1 : Number(a) - Number(b)));
}
