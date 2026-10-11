import { useEffect, useRef, useState } from 'react';
import type { SpelledNote } from '../reading/theory';
import type { NoteStatus } from '../reading/renderScore';
import { renderScore } from '../reading/renderScore';
import type { Fingering } from '../reading/violin';
import type { RenderScoreOptions } from '../reading/renderScore';

interface Props {
  notes: SpelledNote[];
  statuses: NoteStatus[];
  cursor: number;
  keySignature: string;
  fingerings?: (Fingering | null)[];
  shiftAt?: number | null;
  guideNote?: RenderScoreOptions['guideNote'];
  onTap?: () => void;
}

export default function ScoreView({
  notes,
  statuses,
  cursor,
  keySignature,
  fingerings,
  shiftAt,
  guideNote,
  onTap,
}: Props) {
  const headerRef = useRef<HTMLDivElement>(null);
  const notesRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      setWidth(Math.floor(entries[0].contentRect.width));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const headerEl = headerRef.current;
    const notesEl = notesRef.current;
    if (!headerEl || !notesEl || width === 0) return;
    const cursorX = renderScore(headerEl, notesEl, {
      notes,
      statuses,
      cursor,
      keySignature,
      width,
      fingerings,
      shiftAt,
      guideNote,
    });
    // when the line is wider than the viewport, keep the current note centered
    if (cursorX !== null && notesEl.scrollWidth > notesEl.clientWidth) {
      notesEl.scrollTo({ left: cursorX - notesEl.clientWidth / 2, behavior: 'smooth' });
    }
  }, [notes, statuses, cursor, keySignature, fingerings, shiftAt, guideNote, width]);

  return (
    <div ref={wrapRef} className="score-line" onClick={onTap}>
      <div ref={headerRef} className="score-clef" />
      <div ref={notesRef} className="score-canvas" />
    </div>
  );
}
