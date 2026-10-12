// Random exercise generator: diatonic lines in a key, with optional
// chromatic alterations on harder difficulties.

import type { Acc, Key, SpelledNote } from './theory';
import { keyAlterations, LETTERS, signatureCount, spell } from './theory';

/** Mulberry32 seeded PRNG — deterministic for tests, fast enough for everything. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(rng: () => number, items: T[]): T {
  return items[Math.floor(rng() * items.length)];
}

/** Weighted random choice; non-positive weights never win unless all are. */
export function pickWeighted<T>(rng: () => number, items: T[], weight: (item: T) => number): T {
  const weights = items.map((item) => Math.max(0, weight(item)));
  const total = weights.reduce((sum, w) => sum + w, 0);
  if (total <= 0) return pick(rng, items);
  let r = rng() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r < 0) return items[i];
  }
  return items[items.length - 1];
}

export interface GeneratorOptions {
  key: Key;
  /** inclusive MIDI range */
  range: [number, number];
  /** max interval in semitones between consecutive notes */
  maxLeap: number;
  /** probability [0..1] that a note is chromatically altered */
  chromaticProb: number;
  noteCount: number;
  rng: () => number;
  /** note played just before this line segment, so the first note keeps within maxLeap of it */
  prev?: SpelledNote;
  /** relative likelihood of each candidate note; defaults to uniform */
  weight?: (note: SpelledNote) => number;
}

/** All diatonic notes of the key within the MIDI range, spelled per key signature. */
export function diatonicNotesInRange(key: Key, range: [number, number]): SpelledNote[] {
  const alterations = keyAlterations(key);
  const notes: SpelledNote[] = [];
  for (let octave = 0; octave <= 9; octave++) {
    for (const letter of LETTERS) {
      const n = spell(letter, alterations[letter] ?? '', octave);
      if (n.midi >= range[0] && n.midi <= range[1]) notes.push(n);
    }
  }
  return notes.sort((a, b) => a.midi - b.midi);
}

/**
 * Chromatically alter a diatonic note by a semitone, re-spelling on the same letter.
 * Sharp keys prefer raising, flat keys prefer lowering. Returns null if the result
 * would need a double accidental or leave the range.
 */
export function chromaticAlter(
  note: SpelledNote,
  key: Key,
  range: [number, number],
): SpelledNote | null {
  const raiseAcc: Record<Acc, Acc | null> = { b: '', '': '#', '#': null };
  const lowerAcc: Record<Acc, Acc | null> = { '#': '', '': 'b', b: null };
  const preferRaise = signatureCount(key) >= 0;
  const [first, second] = preferRaise ? [raiseAcc, lowerAcc] : [lowerAcc, raiseAcc];
  // fall back to the opposite direction rather than a double accidental
  const acc = first[note.acc] ?? second[note.acc];
  if (acc === null || acc === undefined) return null;
  const altered = spell(note.letter, acc, note.octave);
  if (altered.midi < range[0] || altered.midi > range[1]) return null;
  return altered;
}

export function generateLine(o: GeneratorOptions): SpelledNote[] {
  const pool = diatonicNotesInRange(o.key, o.range);
  if (pool.length < 2) throw new Error('Range too narrow to generate an exercise');
  const line: SpelledNote[] = [];
  const weight = o.weight ?? (() => 1);
  for (let i = 0; i < o.noteCount; i++) {
    const prev = i === 0 ? o.prev : line[i - 1];
    const candidates = prev
      ? pool.filter((n) => n.midi !== prev.midi && Math.abs(n.midi - prev.midi) <= o.maxLeap)
      : pool;
    let note = pickWeighted(o.rng, candidates.length > 0 ? candidates : pool, weight);
    if (o.rng() < o.chromaticProb) {
      const altered = chromaticAlter(note, o.key, o.range);
      // never allow a chromatic alteration to collide with the previous pitch
      if (altered && (!prev || altered.midi !== prev.midi)) note = altered;
    }
    line.push(note);
  }
  return line;
}

// ---- Shaped material: scales, arpeggios, broken thirds, intervals ----

export type Material = 'random' | 'scale' | 'arpeggio' | 'thirds' | 'intervals';

export interface MaterialOptions {
  kind: Exclude<Material, 'random'>;
  key: Key;
  range: [number, number];
  noteCount: number;
  rng: () => number;
  /** note before this segment; the material continues from it */
  prev?: SpelledNote;
  /** 1 = ascending, -1 = descending; random when omitted */
  direction?: 1 | -1;
  /** weighting for the free notes of an interval drill */
  weight?: (note: SpelledNote) => number;
}

const TONIC_SEMITONE: Record<string, number> = {
  C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6,
  G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11,
};

/** Pitch classes of the key's tonic triad. */
export function chordPitchClasses(key: Key): number[] {
  const root = TONIC_SEMITONE[key.tonic];
  if (root === undefined) throw new Error(`Unknown tonic: ${key.tonic}`);
  const third = key.mode === 'major' ? 4 : 3;
  return [root, (root + third) % 12, (root + 7) % 12];
}

export function isTonic(note: SpelledNote, key: Key): boolean {
  return ((note.midi % 12) + 12) % 12 === TONIC_SEMITONE[key.tonic];
}

/** Index in `pool` of the first note strictly beyond `midi` in `direction`, or null at the edge. */
function nextIndex(pool: SpelledNote[], midi: number, direction: 1 | -1): number | null {
  if (direction === 1) {
    const i = pool.findIndex((n) => n.midi > midi);
    return i === -1 ? null : i;
  }
  for (let i = pool.length - 1; i >= 0; i--) if (pool[i].midi < midi) return i;
  return null;
}

/**
 * A line with musical shape instead of random notes. Scales and arpeggios
 * walk the pool one note at a time and turn around at the edges of the
 * range; broken thirds climb in the pattern 1-3-2-4-3-5; the interval drill
 * alternates the tonic with a free note so every other interval is measured
 * from the same anchor.
 */
export function generateMaterial(o: MaterialOptions): SpelledNote[] {
  const scale = diatonicNotesInRange(o.key, o.range);
  const chord = chordPitchClasses(o.key);
  const pool = o.kind === 'arpeggio' ? scale.filter((n) => chord.includes(((n.midi % 12) + 12) % 12)) : scale;
  if (pool.length < 2) throw new Error('Range too narrow for this material');
  let direction: 1 | -1 = o.direction ?? (o.rng() < 0.5 ? 1 : -1);
  const line: SpelledNote[] = [];

  if (o.kind === 'intervals') {
    const tonics = pool.filter((n) => isTonic(n, o.key));
    // anchor on the tonic nearest the middle of the range so intervals go both ways
    const mid = (o.range[0] + o.range[1]) / 2;
    const anchor = (tonics.length > 0 ? tonics : pool).reduce((best, n) =>
      Math.abs(n.midi - mid) < Math.abs(best.midi - mid) ? n : best,
    );
    const others = pool.filter((n) => n.midi !== anchor.midi);
    const weight = o.weight ?? (() => 1);
    let onAnchor = o.prev ? o.prev.midi !== anchor.midi : true;
    for (let i = 0; i < o.noteCount; i++) {
      line.push(onAnchor ? anchor : pickWeighted(o.rng, others, weight));
      onAnchor = !onAnchor;
    }
    return line;
  }

  // starting point: continue from the previous note, else from a tonic at the
  // low (ascending) or high (descending) end, else the end of the pool itself
  let index: number;
  if (o.prev) {
    const next = nextIndex(pool, o.prev.midi, direction);
    if (next === null) {
      direction = direction === 1 ? -1 : 1;
      index = nextIndex(pool, o.prev.midi, direction) ?? 0;
    } else {
      index = next;
    }
  } else {
    const tonicIndices = pool.map((n, i) => (isTonic(n, o.key) ? i : -1)).filter((i) => i >= 0);
    index =
      direction === 1
        ? tonicIndices[0] ?? 0
        : tonicIndices[tonicIndices.length - 1] ?? pool.length - 1;
  }

  const step = (from: number, by: number): number | null => {
    const to = from + by * direction;
    return to >= 0 && to < pool.length ? to : null;
  };
  let k = 0; // position in the broken-thirds pattern
  while (line.length < o.noteCount) {
    line.push(pool[index]);
    let next: number | null;
    if (o.kind === 'thirds') {
      // 1-3-2-4-3-5: up a third, back a second
      next = step(index, k % 2 === 0 ? 2 : -1);
      k++;
    } else {
      next = step(index, 1);
    }
    if (next === null) {
      direction = direction === 1 ? -1 : 1;
      k = 0;
      next = step(index, o.kind === 'thirds' ? 2 : 1) ?? step(index, 1) ?? index;
    }
    index = next;
  }
  return line;
}
