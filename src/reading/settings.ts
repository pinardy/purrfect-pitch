// Sight-reading settings: difficulty presets, key selection, persistence.

import type { Key, KeyMode } from './theory';
import { MAJOR_TONICS, MINOR_TONICS } from './theory';
import { pick } from './generator';

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface ReadingSettings {
  difficulty: Difficulty;
  /** 'random-major' | 'random-any' | fixed key */
  keyMode: 'random-major' | 'random-any' | 'fixed';
  fixedKey: Key;
  strictIntonation: boolean;
  noteCount: number;
}

export interface DifficultyPreset {
  /** tonics allowed in random-major mode; null = all */
  majorTonics: string[] | null;
  includeMinors: boolean;
  range: [number, number];
  maxLeap: number;
  chromaticProb: number;
}

export const PRESETS: Record<Difficulty, DifficultyPreset> = {
  // D4–D5: comfortable middle of the treble staff, simple keys
  easy: { majorTonics: ['C', 'G', 'D', 'F'], includeMinors: false, range: [62, 74], maxLeap: 5, chromaticProb: 0 },
  // G3–B5: the full staff plus a ledger line or two
  medium: { majorTonics: null, includeMinors: true, range: [55, 83], maxLeap: 12, chromaticProb: 0 },
  // G3–E6 with chromatic surprises
  hard: { majorTonics: null, includeMinors: true, range: [55, 88], maxLeap: 12, chromaticProb: 0.15 },
};

export const DEFAULT_READING_SETTINGS: ReadingSettings = {
  difficulty: 'easy',
  keyMode: 'random-major',
  fixedKey: { tonic: 'C', mode: 'major' },
  strictIntonation: false,
  noteCount: 8,
};

export function randomKey(settings: ReadingSettings, rng: () => number): Key {
  if (settings.keyMode === 'fixed') return settings.fixedKey;
  const preset = PRESETS[settings.difficulty];
  const majorTonics = preset.majorTonics ?? MAJOR_TONICS;
  const wantMinor =
    settings.keyMode === 'random-any' && preset.includeMinors && rng() < 0.3;
  if (wantMinor) return { tonic: pick(rng, MINOR_TONICS), mode: 'minor' as KeyMode };
  return { tonic: pick(rng, majorTonics), mode: 'major' as KeyMode };
}

const STORAGE_KEY = 'reading.settings';

export function loadReadingSettings(): ReadingSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_READING_SETTINGS;
    return { ...DEFAULT_READING_SETTINGS, ...(JSON.parse(raw) as Partial<ReadingSettings>) };
  } catch {
    return DEFAULT_READING_SETTINGS;
  }
}

export function saveReadingSettings(settings: ReadingSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // storage unavailable (private mode etc.) — settings just won't persist
  }
}
