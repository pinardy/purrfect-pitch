// VexFlow rendering of one exercise line with per-note coloring, optional
// violin fingerings, and a translucent cursor behind the current note. The
// clef and key signature are drawn into a separate element so they stay
// pinned while the notes scroll.

import {
  Accidental,
  Annotation,
  BarlineType,
  Formatter,
  GraceNote,
  GraceNoteGroup,
  Renderer,
  Stave,
  StaveNote,
  Voice,
} from 'vexflow';
import type { Acc, SpelledNote } from './theory';
import { vexKey } from './theory';
import type { Fingering } from './violin';

export type NoteStatus =
  | 'pending'
  | 'current'
  /** the right pitch, held but out of tune — waiting to be corrected */
  | 'outOfTune'
  | 'correct'
  | 'correctAfterMiss'
  | 'correctAfterOutOfTune'
  | 'wrongFlash';

const COLORS: Record<NoteStatus, string> = {
  pending: '#5b4636',
  current: '#ec5f96',
  outOfTune: '#d9a400',
  correct: '#2f9e4d',
  correctAfterMiss: '#e8871e',
  correctAfterOutOfTune: '#d9a400',
  wrongFlash: '#e0554f',
};

const CURSOR_FILL = 'rgba(244, 114, 166, 0.16)';
const STRING_LABEL_COLOR = '#a78b6f';
const GUIDE_NOTE_COLOR = '#b9a48c';
const INTERVAL_COLOR = '#8a6a4b';
/** extra height for the interval row under the staff */
const INTERVAL_ROW = 14;

const ANNOTATION_FONT = "'Comic Sans MS', 'Comic Sans', 'Chalkboard SE', 'Segoe UI', system-ui, sans-serif";

/** Minimum horizontal room per note; below this the line widens and scrolls. */
const MIN_NOTE_SPACING = 56;

const HEIGHT = 170;
/** Extra room above and below the staff for fingering annotations on ledger-line notes. */
const FINGERING_PAD = 14;
const STAVE_Y = 30;

export interface RenderScoreOptions {
  notes: SpelledNote[];
  statuses: NoteStatus[];
  cursor: number;
  /** VexFlow key signature name, e.g. 'D', 'Bb', 'Em' */
  keySignature: string;
  /** total width available for header + notes */
  width: number;
  /** per-note violin fingering to annotate; omit or leave entries null to show none */
  fingerings?: (Fingering | null)[];
  /** indices of the first note after each shift; marked with a dash before the finger */
  shifts?: number[];
  /** per-note guide note drawn as a small grey grace note before a shift note */
  guideNotes?: (GuideNote | null)[];
  /** interval from the previous note, drawn between the pair under the staff (entry 0 unused) */
  intervals?: (string | null)[];
}

export interface GuideNote {
  note: SpelledNote;
  /** accidental to print, or null when the key signature already implies it */
  accidental: Acc | null;
}

/** Draws the pinned clef + key signature header; returns its width. */
function renderHeader(
  el: HTMLDivElement,
  keySignature: string,
  height: number,
  staveY: number,
): number {
  const renderer = new Renderer(el, Renderer.Backends.SVG);
  renderer.resize(220, height);
  const ctx = renderer.getContext();
  const stave = new Stave(0, staveY, 220);
  stave.addClef('treble').addKeySignature(keySignature);
  stave.setContext(ctx).draw();
  // crop the SVG to just the clef + key signature
  const width = Math.ceil(stave.getNoteStartX());
  renderer.resize(width, height);
  return width;
}

function annotation(text: string, color: string, size: number, vertical: number): Annotation {
  const a = new Annotation(text);
  a.setFont(ANNOTATION_FONT, size, 'bold');
  a.setVerticalJustification(vertical);
  a.setStyle({ fillStyle: color, strokeStyle: color });
  return a;
}

/**
 * Finger number above the note; the string's roman numeral below it on the
 * first note and wherever the string changes, as in printed editions.
 */
function addFingering(
  sn: StaveNote,
  fingering: Fingering,
  previous: Fingering | null | undefined,
  color: string,
  isShift: boolean,
): void {
  // editions mark a shift with a dash leading into the new finger: "–3"
  const label = (isShift ? '–' : '') + String(fingering.finger);
  sn.addModifier(annotation(label, color, 13, Annotation.VerticalJustify.TOP), 0);
  if (!previous || previous.string.name !== fingering.string.name) {
    sn.addModifier(
      annotation(fingering.string.numeral, STRING_LABEL_COLOR, 11, Annotation.VerticalJustify.BOTTOM),
      0,
    );
  }
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

  const fingerings = o.fingerings?.some((f) => f !== null) ? o.fingerings : undefined;
  const intervals = o.intervals?.some((i) => i !== null) ? o.intervals : undefined;
  const pad = fingerings ? FINGERING_PAD : 0;
  const height = HEIGHT + 2 * pad + (intervals ? INTERVAL_ROW : 0);
  const staveY = STAVE_Y + pad;

  const headerWidth = renderHeader(headerEl, o.keySignature, height, staveY);

  const width = Math.max(o.width - headerWidth, o.notes.length * MIN_NOTE_SPACING + 30);
  const renderer = new Renderer(notesEl, Renderer.Backends.SVG);
  renderer.resize(width, height);
  const ctx = renderer.getContext();

  const stave = new Stave(0, staveY, width);
  stave.setBegBarType(BarlineType.NONE); // staff lines continue from the header
  stave.setContext(ctx).draw();

  const shifts = new Set(o.shifts ?? []);
  const staveNotes = o.notes.map((n, i) => {
    // autoStem: stems point down for notes on or above the middle line
    const sn = new StaveNote({ keys: [vexKey(n)], duration: 'q', autoStem: true });
    const color = COLORS[o.statuses[i] ?? 'pending'];
    sn.setStyle({ fillStyle: color, strokeStyle: color });
    const isShift = shifts.has(i);
    const fingering = fingerings?.[i];
    if (fingering) {
      addFingering(sn, fingering, fingerings?.[i - 1], color, isShift);
    } else if (isShift) {
      // fingerings hidden: still say where the hand moves
      sn.addModifier(annotation('shift', STRING_LABEL_COLOR, 10, Annotation.VerticalJustify.TOP), 0);
    }
    const guideNote = isShift ? o.guideNotes?.[i] : null;
    if (guideNote) {
      const guide = new GraceNote({ keys: [vexKey(guideNote.note)], duration: '8', slash: false });
      guide.setStyle({ fillStyle: GUIDE_NOTE_COLOR, strokeStyle: GUIDE_NOTE_COLOR });
      if (guideNote.accidental !== null) {
        guide.addModifier(new Accidental(guideNote.accidental || 'n'), 0);
      }
      sn.addModifier(new GraceNoteGroup([guide], true), 0);
    }
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

  const svg = notesEl.querySelector('svg');

  // interval names centred between each pair of notes, in their own row at the bottom
  if (intervals && svg) {
    const centers = staveNotes.map((sn) => {
      const bb = sn.getBoundingBox();
      return bb.x + bb.w / 2;
    });
    intervals.forEach((label, i) => {
      if (!label || i === 0) return;
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', String((centers[i - 1] + centers[i]) / 2));
      text.setAttribute('y', String(height - 4));
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('font-size', '10');
      text.setAttribute('font-weight', 'bold');
      text.setAttribute('font-family', ANNOTATION_FONT);
      text.setAttribute('fill', INTERVAL_COLOR);
      text.setAttribute('class', 'interval-label');
      text.textContent = label;
      svg.appendChild(text);
    });
  }

  // translucent cursor highlight behind the current note (needs post-draw layout)
  const currentNote = staveNotes[o.cursor];
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
