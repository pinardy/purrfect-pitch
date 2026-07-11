// Persistent per-note first-try accuracy for the sight-reading trainer.
// Keyed by the note as written (e.g. "F♯4"), so F♯4 and G♭4 track separately.

import type { SpelledNote } from './theory';
import { spelledName } from './theory';

export interface NoteStat {
  attempts: number;
  /** attempts that needed at least one retry */
  misses: number;
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
export function withNoteResult(stats: NoteStats, note: SpelledNote, missed: boolean): NoteStats {
  const name = spelledName(note);
  const prev = stats[name] ?? { attempts: 0, misses: 0 };
  return {
    ...stats,
    [name]: { attempts: prev.attempts + 1, misses: prev.misses + (missed ? 1 : 0) },
  };
}

/** First-try accuracy in [0, 1]. */
export function noteAccuracy(s: NoteStat): number {
  return s.attempts > 0 ? (s.attempts - s.misses) / s.attempts : 1;
}
