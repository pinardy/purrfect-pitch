// VexFlow rendering of one exercise line with per-note coloring and a
// translucent cursor behind the current note.

import { Accidental, Formatter, Renderer, Stave, StaveNote, Voice } from 'vexflow';
import type { SpelledNote } from './theory';
import { vexKey } from './theory';

export type NoteStatus = 'pending' | 'current' | 'correct' | 'correctAfterMiss' | 'wrongFlash';

const COLORS: Record<NoteStatus, string> = {
  pending: '#5b4636',
  current: '#ec5f96',
  correct: '#2f9e4d',
  correctAfterMiss: '#e8871e',
  wrongFlash: '#e0554f',
};

const CURSOR_FILL = 'rgba(244, 114, 166, 0.16)';

/** Minimum horizontal room per note; below this the line widens and scrolls. */
const MIN_NOTE_SPACING = 56;
/** Room reserved for clef, key signature, and stave margins. */
const LEFT_FIXTURES = 140;

export interface RenderScoreOptions {
  notes: SpelledNote[];
  statuses: NoteStatus[];
  cursor: number;
  /** VexFlow key signature name, e.g. 'D', 'Bb', 'Em' */
  keySignature: string;
  width: number;
}

/**
 * Renders the exercise line. When `o.width` is too narrow to give each note
 * MIN_NOTE_SPACING, the drawing widens beyond the container (which then
 * scrolls horizontally). Returns the current note's center x for scrolling
 * it into view, or null when there is no current note.
 */
export function renderScore(el: HTMLDivElement, o: RenderScoreOptions): number | null {
  el.innerHTML = ''; // idempotent: survives StrictMode double-effect and re-renders
  if (o.notes.length === 0 || o.width < 100) return null;

  const width = Math.max(o.width, LEFT_FIXTURES + o.notes.length * MIN_NOTE_SPACING);
  const height = 170;
  const renderer = new Renderer(el, Renderer.Backends.SVG);
  renderer.resize(width, height);
  const ctx = renderer.getContext();

  const stave = new Stave(10, 30, width - 20);
  stave.addClef('treble').addKeySignature(o.keySignature);
  stave.setContext(ctx).draw();

  const staveNotes = o.notes.map((n, i) => {
    // autoStem: stems point down for notes on or above the middle line
    const sn = new StaveNote({ keys: [vexKey(n)], duration: 'q', autoStem: true });
    const color = COLORS[o.statuses[i] ?? 'pending'];
    sn.setStyle({ fillStyle: color, strokeStyle: color });
    return sn;
  });

  const voice = new Voice({ numBeats: o.notes.length, beatValue: 4 });
  voice.setMode(Voice.Mode.SOFT);
  voice.addTickables(staveNotes);
  // renders accidentals only where the pitch deviates from the key signature
  // or from earlier accidentals in the bar
  Accidental.applyAccidentals([voice], o.keySignature);
  new Formatter().joinVoices([voice]).format([voice], width - LEFT_FIXTURES);
  voice.draw(ctx, stave);

  // translucent cursor highlight behind the current note (needs post-draw layout)
  const currentNote = staveNotes[o.cursor];
  const svg = el.querySelector('svg');
  if (currentNote && svg) {
    const bb = currentNote.getBoundingBox();
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', String(bb.x - 8));
    rect.setAttribute('y', String(stave.getYForLine(0) - 22));
    rect.setAttribute('width', String(bb.w + 16));
    rect.setAttribute('height', String(stave.getYForLine(4) - stave.getYForLine(0) + 44));
    rect.setAttribute('rx', '6');
    rect.setAttribute('fill', CURSOR_FILL);
    svg.insertBefore(rect, svg.firstChild);
    return bb.x + bb.w / 2;
  }
  return null;
}
