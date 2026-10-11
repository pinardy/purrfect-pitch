// Persistent per-note first-try accuracy and intonation for the sight-reading
// trainer. Keyed by the note as written (e.g. "F♯4"), so F♯4 and G♭4 track
// separately, plus the position it was read in ("F♯4@3"); free-range lines
// use the bare name.

import type { SpelledNote } from './theory';
import { spelledName } from './theory';
import type { Position } from './violin';

export interface NoteStat {
  attempts: number;
  /** attempts that needed at least one retry */
  misses: number;
  /** attempts where the right pitch was first held out of tune (absent in older saves) */
  outOfTune?: number;
  /** out-of-tune attempts that started sharp */
  sharp?: number;
  /** out-of-tune attempts that started flat */
  flat?: number;
  /** sum of each attempt's first-heard cents offset, for the average drift */
  centsSum?: number;
}

export interface NoteResult {
  /** a wrong pitch was played first */
  missed: boolean;
  /** cents offset of the first out-of-tune hold, or null if the note was in tune straight away */
  outOfTuneCents: number | null;
  /** cents offset when the right pitch was first heard (out of tune or not) */
  cents: number;
}

export function statKey(note: SpelledNote, position: Position | null): string {
  const name = spelledName(note);
  return position === null ? name : `${name}@${position}`;
}

export function parseStatKey(key: string): { name: string; position: Position | null } {
  const [name, pos] = key.split('@');
  return { name, position: pos ? (Number(pos) as Position) : null };
}

export type NoteStats = Record<string, NoteStat>;

const STORAGE_KEY = 'reading.noteStats';

export function loadNoteStats(): NoteStats {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as NoteStats) : {};
  } catch {
    return {};
  }
}

export function saveNoteStats(stats: NoteStats): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch {
    // storage unavailable (private mode etc.) — stats just won't persist
  }
}

/** Returns a new map with one played note recorded. */
export function withNoteResult(
  stats: NoteStats,
  note: SpelledNote,
  position: Position | null,
  result: NoteResult,
): NoteStats {
  const key = statKey(note, position);
  const prev = stats[key] ?? { attempts: 0, misses: 0 };
  const off = result.outOfTuneCents;
  return {
    ...stats,
    [key]: {
      attempts: prev.attempts + 1,
      misses: prev.misses + (result.missed ? 1 : 0),
      outOfTune: (prev.outOfTune ?? 0) + (off !== null ? 1 : 0),
      sharp: (prev.sharp ?? 0) + (off !== null && off > 0 ? 1 : 0),
      flat: (prev.flat ?? 0) + (off !== null && off < 0 ? 1 : 0),
      centsSum: (prev.centsSum ?? 0) + result.cents,
    },
  };
}

/** Average first-heard cents offset; 0 for older records without it. */
export function averageCents(s: NoteStat): number {
  return s.attempts > 0 ? (s.centsSum ?? 0) / s.attempts : 0;
}

function sumStats(a: NoteStat, b: NoteStat): NoteStat {
  return {
    attempts: a.attempts + b.attempts,
    misses: a.misses + b.misses,
    outOfTune: (a.outOfTune ?? 0) + (b.outOfTune ?? 0),
    sharp: (a.sharp ?? 0) + (b.sharp ?? 0),
    flat: (a.flat ?? 0) + (b.flat ?? 0),
    centsSum: (a.centsSum ?? 0) + (b.centsSum ?? 0),
  };
}

/**
 * How much a note deserves practice, roughly 0 (solid) to 1 (weak): the
 * record for this exact position when there is one, otherwise everything
 * recorded for the note; unfamiliar notes count as weak too.
 */
export function noteWeakness(stats: NoteStats, note: SpelledNote, position: Position | null): number {
  const name = spelledName(note);
  const exact = stats[statKey(note, position)];
  const record =
    exact && exact.attempts >= 3
      ? exact
      : Object.entries(stats)
          .filter(([key]) => parseStatKey(key).name === name)
          .map(([, s]) => s)
          .reduce(sumStats, { attempts: 0, misses: 0 });
  if (record.attempts === 0) return 1;
  const missRate = record.misses / record.attempts;
  const offRate = (record.outOfTune ?? 0) / record.attempts;
  const unfamiliar = record.attempts < 3 ? 0.4 : 0;
  return Math.min(1, 0.5 * missRate + 0.5 * offRate + unfamiliar);
}

/** First-try accuracy in [0, 1]. */
export function noteAccuracy(s: NoteStat): number {
  return s.attempts > 0 ? (s.attempts - s.misses) / s.attempts : 1;
}

/** Share of attempts that were in tune straight away, in [0, 1]. */
export function noteIntonation(s: NoteStat): number {
  return s.attempts > 0 ? (s.attempts - (s.outOfTune ?? 0)) / s.attempts : 1;
}

/** Which way a note usually drifts when it is out of tune. */
export function intonationTendency(s: NoteStat): 'sharp' | 'flat' | 'both' | null {
  const sharp = s.sharp ?? 0;
  const flat = s.flat ?? 0;
  if (sharp === 0 && flat === 0) return null;
  if (sharp > flat) return 'sharp';
  if (flat > sharp) return 'flat';
  return 'both';
}
