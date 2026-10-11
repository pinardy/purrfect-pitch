// Plans one exercise line from the settings: key, position(s), and notes,
// including shifting lines that start in one position and move to another.

import { generateLine } from './generator';
import type { NoteStats } from './noteStats';
import { noteWeakness } from './noteStats';
import type { ReadingSettings } from './settings';
import { exerciseRange, PRESETS, randomKey, resolvePosition } from './settings';
import type { Key, SpelledNote } from './theory';
import type { Position } from './violin';

export interface LinePlan {
  key: Key;
  /** target position; null = free range */
  position: Position | null;
  positions: (Position | null)[];
  shiftAt: number | null;
  notes: SpelledNote[];
}

/** The position a shifting line starts in before moving to `target`. */
export function shiftOrigin(target: Position): Position {
  return target === 1 ? 3 : 1;
}

/** Fewest notes on either side of a shift. */
const MIN_SEGMENT = 2;

export function planLine(settings: ReadingSettings, stats: NoteStats, rng: () => number): LinePlan {
  const key = randomKey(settings, rng);
  const target = resolvePosition(settings.position, rng);
  const preset = PRESETS[settings.difficulty];
  const common = { key, maxLeap: preset.maxLeap, chromaticProb: preset.chromaticProb, rng };

  const segments: { position: Position | null; count: number }[] = [];
  if (target !== null && settings.shifting && settings.noteCount >= 2 * MIN_SEGMENT) {
    const shiftAt =
      MIN_SEGMENT + Math.floor(rng() * (settings.noteCount - 2 * MIN_SEGMENT + 1));
    segments.push({ position: shiftOrigin(target), count: shiftAt });
    segments.push({ position: target, count: settings.noteCount - shiftAt });
  } else {
    segments.push({ position: target, count: settings.noteCount });
  }

  const notes: SpelledNote[] = [];
  const positions: (Position | null)[] = [];
  for (const segment of segments) {
    const weight = settings.focusWeakNotes
      ? (n: SpelledNote) => 1 + 4 * noteWeakness(stats, n, segment.position)
      : undefined;
    const part = generateLine({
      ...common,
      range: exerciseRange(settings, key, segment.position),
      noteCount: segment.count,
      prev: notes[notes.length - 1],
      weight,
    });
    notes.push(...part);
    for (let i = 0; i < part.length; i++) positions.push(segment.position);
  }

  return {
    key,
    position: target,
    positions,
    shiftAt: segments.length > 1 ? segments[0].count : null,
    notes,
  };
}
