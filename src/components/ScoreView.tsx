import { useEffect, useRef, useState } from 'react';
import type { SpelledNote } from '../reading/theory';
import type { NoteStatus } from '../reading/renderScore';
import { renderScore } from '../reading/renderScore';

interface Props {
  notes: SpelledNote[];
  statuses: NoteStatus[];
  cursor: number;
  keySignature: string;
}

export default function ScoreView({ notes, statuses, cursor, keySignature }: Props) {
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
    const cursorX = renderScore(headerEl, notesEl, { notes, statuses, cursor, keySignature, width });
    // when the line is wider than the viewport, keep the current note centered
    if (cursorX !== null && notesEl.scrollWidth > notesEl.clientWidth) {
      notesEl.scrollTo({ left: cursorX - notesEl.clientWidth / 2, behavior: 'smooth' });
    }
  }, [notes, statuses, cursor, keySignature, width]);

  return (
    <div ref={wrapRef} className="score-line">
      <div ref={headerRef} className="score-clef" />
      <div ref={notesRef} className="score-canvas" />
    </div>
  );
}
