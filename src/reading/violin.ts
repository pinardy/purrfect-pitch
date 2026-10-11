// Violin fingerboard model for the sight-reading trainer: strings, left-hand
// positions, and the fingering of a written note within a position.

import type { Key, Letter, SpelledNote } from './theory';
import { keyAlterations, spell } from './theory';

export type Position = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const POSITIONS: Position[] = [1, 2, 3, 4, 5, 6, 7];

export type StringName = 'G' | 'D' | 'A' | 'E';

export interface ViolinString {
  name: StringName;
  /** Roman numeral as used in editions: I = E string … IV = G string */
  numeral: string;
  letter: Letter;
  octave: number;
}

/** Low to high. */
export const VIOLIN_STRINGS: ViolinString[] = [
  { name: 'G', numeral: 'IV', letter: 'G', octave: 3 },
  { name: 'D', numeral: 'III', letter: 'D', octave: 4 },
  { name: 'A', numeral: 'II', letter: 'A', octave: 4 },
  { name: 'E', numeral: 'I', letter: 'E', octave: 5 },
];

const LETTERS: Letter[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

/** Diatonic step index of a written pitch: C0 = 0, D0 = 1, … C1 = 7. */
export function letterIndex(letter: Letter, octave: number): number {
  return octave * 7 + LETTERS.indexOf(letter);
}

function letterAt(index: number): { letter: Letter; octave: number } {
  return { letter: LETTERS[((index % 7) + 7) % 7], octave: Math.floor(index / 7) };
}

export type Finger = 0 | 1 | 2 | 3 | 4;

export interface Fingering {
  string: ViolinString;
  /** 0 = open string */
  finger: Finger;
}

/**
 * Fingering of a note in the given position.
 *
 * A position is named for the letter the first finger sits on: in `position`
 * the first finger is that many letter names above the open string, and
 * fingers 1–4 cover four consecutive letters. Accidentals move a finger low or
 * high without renumbering it, so the fingering depends only on the letter.
 * Adjacent strings are a fifth (four letters) apart, so the four frames tile
 * the fingerboard without overlap. Returns null for notes outside the frame.
 */
export function fingeringFor(note: SpelledNote, position: Position): Fingering | null {
  const idx = letterIndex(note.letter, note.octave);
  for (const s of VIOLIN_STRINGS) {
    const finger = idx - letterIndex(s.letter, s.octave) - position + 1;
    if (finger >= 1 && finger <= 4) return { string: s, finger: finger as Finger };
  }
  // open strings sit below the frame of their own string in every position
  for (const s of VIOLIN_STRINGS) {
    if (note.acc === '' && note.letter === s.letter && note.octave === s.octave) {
      return { string: s, finger: 0 };
    }
  }
  return null;
}

/**
 * Inclusive MIDI range from the first finger on the lowest of `strings` to the
 * fourth finger on the highest, spelled per the key signature. `strings` must
 * be adjacent (e.g. D and A, or all four).
 */
export function positionRange(
  position: Position,
  strings: ViolinString[],
  key: Key,
): [number, number] {
  const alterations = keyAlterations(key);
  const lowest = strings[0];
  const highest = strings[strings.length - 1];
  const toMidi = (index: number) => {
    const { letter, octave } = letterAt(index);
    return spell(letter, alterations[letter] ?? '', octave).midi;
  };
  return [
    toMidi(letterIndex(lowest.letter, lowest.octave) + position),
    toMidi(letterIndex(highest.letter, highest.octave) + position + 3),
  ];
}

const ORDINALS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th'];

export function positionLabel(position: Position): string {
  return `${ORDINALS[position - 1]} position`;
}
