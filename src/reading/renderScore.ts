// VexFlow rendering of one exercise line with per-note coloring and a
// translucent cursor behind the current note. The clef and key signature are
// drawn into a separate element so they stay pinned while the notes scroll.

import { Accidental, BarlineType, Formatter, Renderer, Stave, StaveNote, Voice } from 'vexflow';
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

const HEIGHT = 170;
const STAVE_Y = 30;

export interface RenderScoreOptions {
  notes: SpelledNote[];
  statuses: NoteStatus[];
  cursor: number;
  /** VexFlow key signature name, e.g. 'D', 'Bb', 'Em' */
  keySignature: string;
  /** total width available for header + notes */
  width: number;
}

/** Draws the pinned clef + key signature header; returns its width. */
function renderHeader(el: HTMLDivElement, keySignature: string): number {
  const renderer = new Renderer(el, Renderer.Backends.SVG);
  renderer.resize(220, HEIGHT);
  const ctx = renderer.getContext();
  const stave = new Stave(0, STAVE_Y, 220);
  stave.addClef('treble').addKeySignature(keySignature);
  stave.setContext(ctx).draw();
  // crop the SVG to just the clef + key signature
  const width = Math.ceil(stave.getNoteStartX());
  renderer.resize(width, HEIGHT);
  return width;
}

/**
 * Renders the exercise line: clef + key signature into `headerEl` (fixed) and
 * the notes into `notesEl` (scrolls when narrower than the line). Returns the
 * current note's center x within `notesEl`, or null when there is none.
 */
export function renderScore(
  headerEl: HTMLDivElement,
  notesEl: HTMLDivElement,
  o: RenderScoreOptions,
): number | null {
  // idempotent: survives StrictMode double-effect and re-renders
  headerEl.innerHTML = '';
  notesEl.innerHTML = '';
  if (o.notes.length === 0 || o.width < 100) return null;

  const headerWidth = renderHeader(headerEl, o.keySignature);

  const width = Math.max(o.width - headerWidth, o.notes.length * MIN_NOTE_SPACING + 30);
  const renderer = new Renderer(notesEl, Renderer.Backends.SVG);
  renderer.resize(width, HEIGHT);
  const ctx = renderer.getContext();

  const stave = new Stave(0, STAVE_Y, width);
  stave.setBegBarType(BarlineType.NONE); // staff lines continue from the header
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
  new Formatter().joinVoices([voice]).format([voice], width - 40);
  voice.draw(ctx, stave);

  // translucent cursor highlight behind the current note (needs post-draw layout)
  const currentNote = staveNotes[o.cursor];
  const svg = notesEl.querySelector('svg');
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
