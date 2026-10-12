// Plans one exercise line from the settings: key, position(s), and notes,
// including shifting lines that alternate between two positions.

import { generateLine, generateMaterial } from './generator';
import type { NoteStats } from './noteStats';
import { noteWeakness } from './noteStats';
import type { ReadingSettings } from './settings';
import {
  exerciseRange,
  MAX_SHIFTS_PER_LINE,
  PRESETS,
  randomKey,
  resolvePosition,
  shiftOriginFor,
} from './settings';
import type { Key, SpelledNote } from './theory';
import type { Position } from './violin';

export interface LinePlan {
  key: Key;
  /** target position; null = free range */
  position: Position | null;
  positions: (Position | null)[];
  /** indices of the first note after each shift */
  shifts: number[];
  notes: SpelledNote[];
}

/** Fewest notes on either side of a shift. */
const MIN_SEGMENT = 2;

/**
 * Split `count` notes into `parts` segments of at least MIN_SEGMENT each,
 * with random boundaries.
 */
function splitSegments(count: number, parts: number, rng: () => number): number[] {
  const spare = count - parts * MIN_SEGMENT;
  // distribute the spare notes randomly over the segments
  const lengths = Array<number>(parts).fill(MIN_SEGMENT);
  for (let i = 0; i < spare; i++) lengths[Math.floor(rng() * parts)]++;
  return lengths;
}

export function planLine(settings: ReadingSettings, stats: NoteStats, rng: () => number): LinePlan {
  const key = randomKey(settings, rng);
  const target = resolvePosition(settings.position, rng);
  const preset = PRESETS[settings.difficulty];
  const common = { key, maxLeap: preset.maxLeap, chromaticProb: preset.chromaticProb, rng };

  const segments: { position: Position | null; count: number }[] = [];
  const maxShifts = Math.floor(settings.noteCount / MIN_SEGMENT) - 1;
  const shifts = settings.shifting
    ? Math.min(Math.max(1, Math.round(settings.shiftsPerLine)), MAX_SHIFTS_PER_LINE, maxShifts)
    : 0;
  if (target !== null && shifts >= 1) {
    const origin = shiftOriginFor(settings, target);
    const lengths = splitSegments(settings.noteCount, shifts + 1, rng);
    // alternate origin → target → origin …, always ending in the target
    lengths.forEach((count, i) => {
      const fromEnd = lengths.length - 1 - i;
      segments.push({ position: fromEnd % 2 === 0 ? target : origin, count });
    });
  } else {
    segments.push({ position: target, count: settings.noteCount });
  }

  const notes: SpelledNote[] = [];
  const positions: (Position | null)[] = [];
  const shiftIndices: number[] = [];
  // shaped material keeps one direction across the shifts of a line
  const direction: 1 | -1 = rng() < 0.5 ? 1 : -1;
  for (const segment of segments) {
    if (notes.length > 0) shiftIndices.push(notes.length);
    const weight = settings.focusWeakNotes
      ? (n: SpelledNote) => 1 + 4 * noteWeakness(stats, n, segment.position)
      : undefined;
    const range = exerciseRange(settings, key, segment.position);
    const prev = notes[notes.length - 1];
    const part =
      settings.material === 'random'
        ? generateLine({ ...common, range, noteCount: segment.count, prev, weight })
        : generateMaterial({
            kind: settings.material,
            key,
            rng,
            range,
            noteCount: segment.count,
            prev,
            direction,
            weight,
          });
    notes.push(...part);
    for (let i = 0; i < part.length; i++) positions.push(segment.position);
  }

  return { key, position: target, positions, shifts: shiftIndices, notes };
}
