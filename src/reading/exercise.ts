// Reducer for one line of a sight-reading exercise.

import type { Key, SpelledNote } from './theory';
import type { NoteStatus } from './renderScore';
import type { Position } from './violin';

export interface LineState {
  key: Key;
  /** position the line was generated for; null = free range */
  position: Position | null;
  notes: SpelledNote[];
  cursor: number;
  statuses: NoteStatus[];
  /** wrong attempts per note */
  wrongCounts: number[];
  /** out-of-tune holds per note (right pitch, outside the intonation tolerance) */
  outOfTuneCounts: number[];
  /** cents offset of the first out-of-tune hold per note; 0 when none */
  outOfTuneCents: number[];
  phase: 'idle' | 'playing' | 'summary';
}

export type ExerciseAction =
  | { type: 'NEW_LINE'; key: Key; position: Position | null; notes: SpelledNote[] }
  | { type: 'NOTE_CORRECT' }
  | { type: 'NOTE_WRONG' }
  | { type: 'NOTE_OUT_OF_TUNE'; cents: number }
  | { type: 'STOP' };

export const INITIAL_LINE_STATE: LineState = {
  key: { tonic: 'C', mode: 'major' },
  position: null,
  notes: [],
  cursor: 0,
  statuses: [],
  wrongCounts: [],
  outOfTuneCounts: [],
  outOfTuneCents: [],
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
        notes: action.notes,
        cursor: 0,
        statuses,
        wrongCounts: action.notes.map(() => 0),
        outOfTuneCounts: action.notes.map(() => 0),
        outOfTuneCents: action.notes.map(() => 0),
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
      const cursor = state.cursor + 1;
      const done = cursor >= state.notes.length;
      if (!done) statuses[cursor] = 'current';
      return { ...state, statuses, cursor, phase: done ? 'summary' : 'playing' };
    }
    case 'NOTE_WRONG': {
      if (state.phase !== 'playing') return state;
      const wrongCounts = [...state.wrongCounts];
      wrongCounts[state.cursor]++;
      return { ...state, wrongCounts };
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
      return { ...state, statuses, outOfTuneCounts, outOfTuneCents };
    }
    case 'STOP':
      return { ...state, phase: 'idle' };
    default:
      return state;
  }
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
