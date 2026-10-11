import { useState } from 'react';
import type { NoteStats } from '../reading/noteStats';
import {
  averageCents,
  intonationTendency,
  noteAccuracy,
  noteIntonation,
  parseStatKey,
} from '../reading/noteStats';
import { positionOrdinal } from '../reading/violin';

interface Props {
  stats: NoteStats;
  onReset: () => void;
}

type View = 'reading' | 'intonation';

function grade(acc: number): 'good' | 'ok' | 'bad' {
  return acc >= 0.9 ? 'good' : acc >= 0.7 ? 'ok' : 'bad';
}

const TENDENCY_LABEL = { sharp: 'tends sharp', flat: 'tends flat', both: 'sharp & flat' };

function formatCents(cents: number): string {
  const rounded = Math.round(cents);
  return `${rounded > 0 ? '+' : ''}${rounded}¢`;
}

/**
 * All-time per-note stats, trickiest notes first: first-try reading accuracy,
 * or how often each note was in tune straight away, its average drift, and
 * which way it tends. Notes are tracked per position, so the same written
 * note can appear once per position it was read in.
 */
export default function NoteAccuracy({ stats, onReset }: Props) {
  const [view, setView] = useState<View>('reading');
  const rows = Object.entries(stats)
    .map(([key, s]) => ({
      key,
      ...parseStatKey(key),
      attempts: s.attempts,
      hits: s.attempts - s.misses,
      inTune: s.attempts - (s.outOfTune ?? 0),
      acc: noteAccuracy(s),
      intonation: noteIntonation(s),
      avgCents: averageCents(s),
      tendency: intonationTendency(s),
    }))
    .sort((a, b) =>
      view === 'reading'
        ? a.acc - b.acc || b.attempts - a.attempts
        : a.intonation - b.intonation || b.attempts - a.attempts,
    );
  if (rows.length === 0) return null;

  const attempts = rows.reduce((sum, r) => sum + r.attempts, 0);
  const hits = rows.reduce((sum, r) => sum + r.hits, 0);
  const inTune = rows.reduce((sum, r) => sum + r.inTune, 0);
  const overall = Math.round((hits / attempts) * 100);
  const overallIntonation = Math.round((inTune / attempts) * 100);

  return (
    <details className="note-accuracy">
      <summary>
        Note accuracy · {overall}% first try · {overallIntonation}% in tune all-time
      </summary>
      <div className="presets note-acc-views">
        <button
          className={'chip' + (view === 'reading' ? ' active' : '')}
          onClick={() => setView('reading')}
        >
          Reading
        </button>
        <button
          className={'chip' + (view === 'intonation' ? ' active' : '')}
          onClick={() => setView('intonation')}
        >
          Intonation
        </button>
      </div>
      <div className="note-acc-list">
        {rows.map((r) => {
          const value = view === 'reading' ? r.acc : r.intonation;
          const count = view === 'reading' ? r.hits : r.inTune;
          return (
            <div key={r.key} className="note-acc-row" data-grade={grade(value)}>
              <span className="note-acc-name">
                {r.name}
                {r.position !== null && (
                  <span className="note-acc-pos">{positionOrdinal(r.position)}</span>
                )}
              </span>
              <span className="note-acc-bar">
                <span style={{ width: `${Math.round(value * 100)}%` }} />
              </span>
              <span className="note-acc-pct">
                {Math.round(value * 100)}% · {count}/{r.attempts}
                {view === 'intonation' && r.tendency && (
                  <span className="note-acc-tendency">
                    {' '}· {TENDENCY_LABEL[r.tendency]} · avg {formatCents(r.avgCents)}
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>
      <button className="secondary-btn note-acc-reset" onClick={onReset}>
        Reset stats
      </button>
    </details>
  );
}
