// Reducer for one line of a sight-reading exercise.

import type { Key, SpelledNote } from './theory';
import type { NoteStatus } from './renderScore';
import type { Position } from './violin';

export interface LineState {
  key: Key;
  /** target position of the line; null = free range */
  position: Position | null;
  /** position each note is played in (differs from `position` before a shift) */
  positions: (Position | null)[];
  /** index of the first note after the shift, if the line shifts */
  shiftAt: number | null;
  notes: SpelledNote[];
  cursor: number;
  statuses: NoteStatus[];
  /** wrong attempts per note */
  wrongCounts: number[];
  /** out-of-tune holds per note (right pitch, outside the intonation tolerance) */
  outOfTuneCounts: number[];
  /** cents offset of the first out-of-tune hold per note; 0 when none */
  outOfTuneCents: number[];
  /** cents offset when the right pitch was first heard; null until the note is done */
  cents: (number | null)[];
  /** fingerings revealed per note by a wrong or out-of-tune attempt */
  revealed: boolean[];
  /** fingerings revealed for the whole line by tapping the staff */
  revealAll: boolean;
  phase: 'idle' | 'playing' | 'summary';
}

export type ExerciseAction =
  | {
      type: 'NEW_LINE';
      key: Key;
      position: Position | null;
      positions: (Position | null)[];
      shiftAt: number | null;
      notes: SpelledNote[];
    }
  | { type: 'NOTE_CORRECT'; cents: number }
  | { type: 'NOTE_WRONG' }
  | { type: 'NOTE_OUT_OF_TUNE'; cents: number }
  | { type: 'TOGGLE_REVEAL' }
  | { type: 'STOP' };

export const INITIAL_LINE_STATE: LineState = {
  key: { tonic: 'C', mode: 'major' },
  position: null,
  positions: [],
  shiftAt: null,
  notes: [],
  cursor: 0,
  statuses: [],
  wrongCounts: [],
  outOfTuneCounts: [],
  outOfTuneCents: [],
  cents: [],
  revealed: [],
  revealAll: false,
  phase: 'idle',
};

export function exerciseReducer(state: LineState, action: ExerciseAction): LineState {
  switch (action.type) {
    case 'NEW_LINE': {
      const statuses: NoteStatus[] = action.notes.map((_, i) =>
        i === 0 ? 'current' : 'pending',
      );
      return {
        key: action.key,
        position: action.position,
        positions: action.positions,
        shiftAt: action.shiftAt,
        notes: action.notes,
        cursor: 0,
        statuses,
        wrongCounts: action.notes.map(() => 0),
        outOfTuneCounts: action.notes.map(() => 0),
        outOfTuneCents: action.notes.map(() => 0),
        cents: action.notes.map(() => null),
        revealed: action.notes.map(() => false),
        revealAll: false,
        phase: 'playing',
      };
    }
    case 'NOTE_CORRECT': {
      if (state.phase !== 'playing') return state;
      const statuses = [...state.statuses];
      const i = state.cursor;
      statuses[i] =
        state.wrongCounts[i] > 0
          ? 'correctAfterMiss'
          : state.outOfTuneCounts[i] > 0
            ? 'correctAfterOutOfTune'
            : 'correct';
      const cents = [...state.cents];
      // the first-heard offset: the out-of-tune hold if there was one, else where it registered
      cents[i] = state.outOfTuneCounts[i] > 0 ? state.outOfTuneCents[i] : action.cents;
      const cursor = state.cursor + 1;
      const done = cursor >= state.notes.length;
      if (!done) statuses[cursor] = 'current';
      return { ...state, statuses, cents, cursor, phase: done ? 'summary' : 'playing' };
    }
    case 'NOTE_WRONG': {
      if (state.phase !== 'playing') return state;
      const wrongCounts = [...state.wrongCounts];
      wrongCounts[state.cursor]++;
      return { ...state, wrongCounts, revealed: revealAt(state.revealed, state.cursor) };
    }
    case 'NOTE_OUT_OF_TUNE': {
      if (state.phase !== 'playing') return state;
      const i = state.cursor;
      const outOfTuneCounts = [...state.outOfTuneCounts];
      const outOfTuneCents = [...state.outOfTuneCents];
      if (outOfTuneCounts[i] === 0) outOfTuneCents[i] = action.cents;
      outOfTuneCounts[i]++;
      const statuses = [...state.statuses];
      statuses[i] = 'outOfTune';
      return {
        ...state,
        statuses,
        outOfTuneCounts,
        outOfTuneCents,
        revealed: revealAt(state.revealed, i),
      };
    }
    case 'TOGGLE_REVEAL':
      return { ...state, revealAll: !state.revealAll };
    case 'STOP':
      return { ...state, phase: 'idle' };
    default:
      return state;
  }
}

function revealAt(revealed: boolean[], i: number): boolean[] {
  if (revealed[i]) return revealed;
  const next = [...revealed];
  next[i] = true;
  return next;
}

export interface LineScore {
  /** notes played with no wrong pitch */
  firstTry: number;
  /** notes played with no out-of-tune hold */
  inTune: number;
  total: number;
}

export function lineScore(state: LineState): LineScore {
  const total = state.notes.length;
  const firstTry = state.wrongCounts.filter((c, i) => c === 0 && i < state.cursor).length;
  const inTune = state.outOfTuneCounts.filter((c, i) => c === 0 && i < state.cursor).length;
  return { firstTry, inTune, total };
}
