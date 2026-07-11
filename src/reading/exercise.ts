// Reducer for one line of a sight-reading exercise.

import type { Key, SpelledNote } from './theory';
import type { NoteStatus } from './renderScore';

export interface LineState {
  key: Key;
  notes: SpelledNote[];
  cursor: number;
  statuses: NoteStatus[];
  /** wrong attempts per note */
  wrongCounts: number[];
  phase: 'idle' | 'playing' | 'summary';
}

export type ExerciseAction =
  | { type: 'NEW_LINE'; key: Key; notes: SpelledNote[] }
  | { type: 'NOTE_CORRECT' }
  | { type: 'NOTE_WRONG' }
  | { type: 'STOP' };

export const INITIAL_LINE_STATE: LineState = {
  key: { tonic: 'C', mode: 'major' },
  notes: [],
  cursor: 0,
  statuses: [],
  wrongCounts: [],
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
        notes: action.notes,
        cursor: 0,
        statuses,
        wrongCounts: action.notes.map(() => 0),
        phase: 'playing',
      };
    }
    case 'NOTE_CORRECT': {
      if (state.phase !== 'playing') return state;
      const statuses = [...state.statuses];
      statuses[state.cursor] = state.wrongCounts[state.cursor] > 0 ? 'correctAfterMiss' : 'correct';
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
    case 'STOP':
      return { ...state, phase: 'idle' };
    default:
      return state;
  }
}

export function lineScore(state: LineState): { firstTry: number; total: number } {
  const total = state.notes.length;
  const firstTry = state.wrongCounts.filter((c, i) => c === 0 && i < state.cursor).length;
  return { firstTry, total };
}
