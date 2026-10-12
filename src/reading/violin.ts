// Violin fingerboard model for the sight-reading trainer: strings, left-hand
// positions, and the fingering of a written note within a position.

import type { Key, Letter, SpelledNote } from './theory';
import { keyAlterations, LETTERS, letterIndex, spell } from './theory';

export { letterIndex };

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

function letterAt(index: number): { letter: Letter; octave: number } {
  return { letter: LETTERS[((index % 7) + 7) % 7], octave: Math.floor(index / 7) };
}

export type Finger = 0 | 1 | 2 | 3 | 4;

export interface Fingering {
  string: ViolinString;
  /** 0 = open string */
  finger: Finger;
}

export function openStringFor(note: SpelledNote): ViolinString | null {
  return (
    VIOLIN_STRINGS.find(
      (s) => note.acc === '' && note.letter === s.letter && note.octave === s.octave,
    ) ?? null
  );
}

/**
 * Fingering of a note in the given position.
 *
 * A position is named for the letter the first finger sits on: in `position`
 * the first finger is that many letter names above the open string, and
 * fingers 1–4 cover four consecutive letters. Accidentals move a finger low or
 * high without renumbering it, so the fingering depends only on the letter.
 * Adjacent strings are a fifth (four letters) apart, so the four frames tile
 * the fingerboard without overlap. With `preferOpen`, an open string inside
 * the frame is fingered 0 instead of with the fourth (or third) finger.
 * Returns null for notes outside the frame.
 */
export function fingeringFor(
  note: SpelledNote,
  position: Position,
  preferOpen = false,
): Fingering | null {
  const open = openStringFor(note);
  if (open && preferOpen) return { string: open, finger: 0 };
  const idx = letterIndex(note.letter, note.octave);
  for (const s of VIOLIN_STRINGS) {
    const finger = idx - letterIndex(s.letter, s.octave) - position + 1;
    if (finger >= 1 && finger <= 4) return { string: s, finger: finger as Finger };
  }
  // open strings sit below the frame of their own string in every position
  if (open) return { string: open, finger: 0 };
  return null;
}

/** Semitones above the open string where a note is stopped; null if not on that string. */
export function semitonesOnString(note: SpelledNote, string: ViolinString): number | null {
  const offset = note.midi - spell(string.letter, '', string.octave).midi;
  return offset >= 0 ? offset : null;
}

/**
 * The guide note of a shift: the finger that played `from` slides along its
 * own string into `toPosition` before the new finger is placed. This is the
 * note it lands on, i.e. what students are taught to hear during the slide.
 * Null when the previous note was an open string (no finger to slide).
 */
export function guideNote(
  from: Fingering,
  toPosition: Position,
  key: Key,
): SpelledNote | null {
  if (from.finger === 0) return null;
  const alterations = keyAlterations(key);
  const index = letterIndex(from.string.letter, from.string.octave) + toPosition + from.finger - 1;
  const { letter, octave } = letterAt(index);
  return spell(letter, alterations[letter] ?? '', octave);
}

/** Letters (as spelled notes in the key) under each finger on a string in a position. */
export function frameNotes(
  position: Position,
  string: ViolinString,
  key: Key,
): { finger: Finger; note: SpelledNote }[] {
  const alterations = keyAlterations(key);
  const base = letterIndex(string.letter, string.octave) + position;
  return [1, 2, 3, 4].map((finger) => {
    const { letter, octave } = letterAt(base + finger - 1);
    return { finger: finger as Finger, note: spell(letter, alterations[letter] ?? '', octave) };
  });
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

export function positionOrdinal(position: Position): string {
  return ORDINALS[position - 1];
}

export function positionLabel(position: Position): string {
  return `${positionOrdinal(position)} position`;
}
