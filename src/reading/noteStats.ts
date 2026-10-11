// Persistent per-note first-try accuracy and intonation for the sight-reading
// trainer. Keyed by the note as written (e.g. "F♯4"), so F♯4 and G♭4 track
// separately.

import type { SpelledNote } from './theory';
import { spelledName } from './theory';

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
}

export interface NoteResult {
  /** a wrong pitch was played first */
  missed: boolean;
  /** cents offset of the first out-of-tune hold, or null if the note was in tune straight away */
  outOfTuneCents: number | null;
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
export function withNoteResult(stats: NoteStats, note: SpelledNote, result: NoteResult): NoteStats {
  const name = spelledName(note);
  const prev = stats[name] ?? { attempts: 0, misses: 0 };
  const off = result.outOfTuneCents;
  return {
    ...stats,
    [name]: {
      attempts: prev.attempts + 1,
      misses: prev.misses + (result.missed ? 1 : 0),
      outOfTune: (prev.outOfTune ?? 0) + (off !== null ? 1 : 0),
      sharp: (prev.sharp ?? 0) + (off !== null && off > 0 ? 1 : 0),
      flat: (prev.flat ?? 0) + (off !== null && off < 0 ? 1 : 0),
    },
  };
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
