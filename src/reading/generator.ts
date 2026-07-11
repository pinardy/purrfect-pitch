// Random exercise generator: diatonic lines in a key, with optional
// chromatic alterations on harder difficulties.

import type { Acc, Key, Letter, SpelledNote } from './theory';
import { keyAlterations, signatureCount, spell } from './theory';

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
}

const LETTERS: Letter[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

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
  for (let i = 0; i < o.noteCount; i++) {
    const prev = line[i - 1];
    const candidates = prev
      ? pool.filter((n) => n.midi !== prev.midi && Math.abs(n.midi - prev.midi) <= o.maxLeap)
      : pool;
    let note = pick(o.rng, candidates.length > 0 ? candidates : pool);
    if (o.rng() < o.chromaticProb) {
      const altered = chromaticAlter(note, o.key, o.range);
      // never allow a chromatic alteration to collide with the previous pitch
      if (altered && (!prev || altered.midi !== prev.midi)) note = altered;
    }
    line.push(note);
  }
  return line;
}
