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
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      setWidth(Math.floor(entries[0].contentRect.width));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || width === 0) return;
    renderScore(el, { notes, statuses, cursor, keySignature, width });
  }, [notes, statuses, cursor, keySignature, width]);

  return <div ref={containerRef} className="score-canvas" />;
}
