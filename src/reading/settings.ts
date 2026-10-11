// Sight-reading settings: difficulty presets, key selection, persistence.

import type { Key, KeyMode } from './theory';
import { MAJOR_TONICS, MINOR_TONICS } from './theory';
import { pick } from './generator';
import type { Position, StringName, ViolinString } from './violin';
import { POSITIONS, positionRange, VIOLIN_STRINGS } from './violin';

export type Difficulty = 'easy' | 'medium' | 'hard';

/** a fixed position, a random one per line ('odd' = 1st/3rd/5th/7th), or free range */
export type PositionSetting = Position | 'odd' | 'all' | null;

export type FingeringDisplay = 'off' | 'always' | 'tap' | 'after-miss';

/** 'auto' = strings chosen by difficulty; otherwise drill a single string */
export type StringFocus = 'auto' | StringName;

/** feedback when a note registers */
export type CueMode = 'off' | 'haptic' | 'sound' | 'both';

export interface ReadingSettings {
  difficulty: Difficulty;
  /** 'random-major' | 'random-any' | fixed key */
  keyMode: 'random-major' | 'random-any' | 'fixed';
  fixedKey: Key;
  /** cents tolerance before a note counts as out of tune; null = pitch class only */
  intonationTolerance: number | null;
  noteCount: number;
  /** violin left-hand position to stay within; null = free range from the difficulty preset */
  position: PositionSetting;
  /** start each line in another position and shift into the target partway */
  shifting: boolean;
  /** position a shifting line starts in; 'auto' = 1st (3rd when the target is 1st) */
  shiftOrigin: Position | 'auto';
  /** shifts per line (1–3); the line alternates between origin and target */
  shiftsPerLine: number;
  /** show the guide note (old finger sliding into the new position) at each shift */
  showGuideNotes: boolean;
  /** when finger numbers and strings are annotated (positions only) */
  fingeringDisplay: FingeringDisplay;
  /** finger open strings as 0 instead of with the 4th finger */
  useOpenStrings: boolean;
  stringFocus: StringFocus;
  /** weight the random notes toward ones you misread, play out of tune, or rarely see */
  focusWeakNotes: boolean;
  /** fingerboard diagram of the current hand frame under the staff (positions only) */
  showFingerboard: boolean;
  /** how long a note must stay in tune before it registers */
  settleMs: number;
  /** keep the finished line on screen until "Next line" is tapped */
  pauseAfterLine: boolean;
  cue: CueMode;
}

export interface DifficultyPreset {
  /** tonics allowed in random-major mode; null = all */
  majorTonics: string[] | null;
  includeMinors: boolean;
  /** MIDI range used when no position is set */
  range: [number, number];
  /** adjacent strings whose hand frame is used when a position is set */
  positionStrings: ViolinString[];
  maxLeap: number;
  chromaticProb: number;
}

const INNER_STRINGS = VIOLIN_STRINGS.slice(1, 3); // D and A

export const PRESETS: Record<Difficulty, DifficultyPreset> = {
  // D4–D5: comfortable middle of the treble staff, simple keys
  // D4–D5: comfortable middle of the treble staff, simple keys. In a position: D and A strings only.
  easy: {
    majorTonics: ['C', 'G', 'D', 'F'],
    includeMinors: false,
    range: [62, 74],
    positionStrings: INNER_STRINGS,
    maxLeap: 5,
    chromaticProb: 0,
  },
  // G3–B5: the full staff plus a ledger line or two. In a position: all four strings.
  medium: {
    majorTonics: null,
    includeMinors: true,
    range: [55, 83],
    positionStrings: VIOLIN_STRINGS,
    maxLeap: 12,
    chromaticProb: 0,
  },
  // G3–E6 with chromatic surprises. In a position: all four strings.
  hard: {
    majorTonics: null,
    includeMinors: true,
    range: [55, 88],
    positionStrings: VIOLIN_STRINGS,
    maxLeap: 12,
    chromaticProb: 0.15,
  },
};

export const INTONATION_TOLERANCES = [10, 20, 30];
export const SETTLE_TIMES = [0, 300, 600];

export const DEFAULT_READING_SETTINGS: ReadingSettings = {
  difficulty: 'easy',
  keyMode: 'random-major',
  fixedKey: { tonic: 'C', mode: 'major' },
  intonationTolerance: 20,
  noteCount: 8,
  position: null,
  shifting: false,
  shiftOrigin: 'auto',
  shiftsPerLine: 1,
  showGuideNotes: true,
  fingeringDisplay: 'always',
  useOpenStrings: false,
  stringFocus: 'auto',
  focusWeakNotes: false,
  showFingerboard: true,
  settleMs: 0,
  pauseAfterLine: false,
  cue: 'off',
};

export const MAX_SHIFTS_PER_LINE = 3;

/** The position a shifting line starts in before moving to `target`. */
export function shiftOriginFor(settings: ReadingSettings, target: Position): Position {
  if (settings.shiftOrigin !== 'auto' && settings.shiftOrigin !== target) return settings.shiftOrigin;
  return target === 1 ? 3 : 1;
}

export interface PracticePreset {
  id: string;
  label: string;
  hint: string;
  apply: Partial<ReadingSettings>;
}

/** One-tap bundles of settings for common practice goals. */
export const PRACTICE_PRESETS: PracticePreset[] = [
  {
    id: 'free',
    label: 'Free reading',
    hint: 'no position, full range by difficulty',
    apply: { position: null, shifting: false, focusWeakNotes: false },
  },
  {
    id: 'position-intro',
    label: 'Position intro',
    hint: '3rd position, D & A strings, fingerings shown, fingerboard on',
    apply: {
      difficulty: 'easy',
      position: 3,
      shifting: false,
      stringFocus: 'auto',
      fingeringDisplay: 'always',
      showFingerboard: true,
      intonationTolerance: 30,
      settleMs: 0,
    },
  },
  {
    id: 'shifting',
    label: 'Shifting drill',
    hint: '1st ↔ 3rd position, two shifts a line, guide notes on',
    apply: {
      difficulty: 'medium',
      position: 3,
      shifting: true,
      shiftOrigin: 1,
      shiftsPerLine: 2,
      showGuideNotes: true,
      fingeringDisplay: 'always',
      showFingerboard: true,
      noteCount: 8,
    },
  },
  {
    id: 'intonation',
    label: 'Intonation tightener',
    hint: '±10¢, 0.6 s settle, fingerings only after a slip, weak notes first',
    apply: {
      intonationTolerance: 10,
      settleMs: 600,
      fingeringDisplay: 'after-miss',
      focusWeakNotes: true,
    },
  },
  {
    id: 'test',
    label: 'Test yourself',
    hint: 'random odd positions, no fingerings or fingerboard, ±20¢',
    apply: {
      position: 'odd',
      shifting: false,
      fingeringDisplay: 'off',
      showFingerboard: false,
      intonationTolerance: 20,
      focusWeakNotes: false,
    },
  },
];

/** Pick the concrete position for one line. */
export function resolvePosition(setting: PositionSetting, rng: () => number): Position | null {
  if (setting === 'odd') return pick(rng, POSITIONS.filter((p) => p % 2 === 1));
  if (setting === 'all') return pick(rng, POSITIONS);
  return setting;
}

/** Strings a positioned line may use: a single drilled string, or the difficulty's set. */
export function positionStrings(settings: ReadingSettings): ViolinString[] {
  if (settings.stringFocus !== 'auto') {
    return VIOLIN_STRINGS.filter((s) => s.name === settings.stringFocus);
  }
  return PRESETS[settings.difficulty].positionStrings;
}

/**
 * MIDI range for a line (or line segment): the hand frame of `position` on the
 * chosen strings, or the preset's free range when no position is set.
 */
export function exerciseRange(
  settings: ReadingSettings,
  key: Key,
  position: Position | null,
): [number, number] {
  if (position === null) return PRESETS[settings.difficulty].range;
  return positionRange(position, positionStrings(settings), key);
}

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
    const stored = JSON.parse(raw) as Partial<ReadingSettings> & {
      strictIntonation?: boolean;
      showFingerings?: boolean;
    };
    // migrate the former on/off "strict intonation" switch (±30¢ when on)
    const { strictIntonation, showFingerings, ...rest } = stored;
    if (strictIntonation !== undefined && rest.intonationTolerance === undefined) {
      rest.intonationTolerance = strictIntonation ? 30 : DEFAULT_READING_SETTINGS.intonationTolerance;
    }
    // ...and the former "show fingerings" checkbox
    if (showFingerings !== undefined && rest.fingeringDisplay === undefined) {
      rest.fingeringDisplay = showFingerings ? 'always' : 'off';
    }
    return { ...DEFAULT_READING_SETTINGS, ...rest };
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
