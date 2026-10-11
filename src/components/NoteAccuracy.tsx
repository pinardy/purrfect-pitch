import { useState } from 'react';
import type { NoteStat, NoteStats } from '../reading/noteStats';
import {
  averageCents,
  intonationTendency,
  noteAccuracy,
  noteIntonation,
  parseFingerKey,
  parseStatKey,
} from '../reading/noteStats';
import { positionOrdinal } from '../reading/violin';

interface Props {
  stats: NoteStats;
  /** per finger and position, keyed "finger@position" */
  fingerStats: NoteStats;
  onReset: () => void;
  onExport: () => void;
  /** brief confirmation after an export */
  exportNote?: string | null;
}

type View = 'reading' | 'intonation' | 'fingers';

function grade(acc: number): 'good' | 'ok' | 'bad' {
  return acc >= 0.9 ? 'good' : acc >= 0.7 ? 'ok' : 'bad';
}

const TENDENCY_LABEL = { sharp: 'tends sharp', flat: 'tends flat', both: 'sharp & flat' };
const FINGER_LABEL = ['open', '1st finger', '2nd finger', '3rd finger', '4th finger'];

function formatCents(cents: number): string {
  const rounded = Math.round(cents);
  return `${rounded > 0 ? '+' : ''}${rounded}¢`;
}

interface Row {
  key: string;
  label: string;
  tag: string | null;
  attempts: number;
  hits: number;
  inTune: number;
  acc: number;
  intonation: number;
  avgCents: number;
  tendency: ReturnType<typeof intonationTendency>;
}

function toRow(key: string, label: string, tag: string | null, s: NoteStat): Row {
  return {
    key,
    label,
    tag,
    attempts: s.attempts,
    hits: s.attempts - s.misses,
    inTune: s.attempts - (s.outOfTune ?? 0),
    acc: noteAccuracy(s),
    intonation: noteIntonation(s),
    avgCents: averageCents(s),
    tendency: intonationTendency(s),
  };
}

/**
 * All-time stats, trickiest first: per-note reading accuracy, per-note
 * intonation (with average drift and tendency), or per-finger intonation by
 * position, which is the diagnosis a teacher would give.
 */
export default function NoteAccuracy({ stats, fingerStats, onReset, onExport, exportNote }: Props) {
  const [view, setView] = useState<View>('reading');
  const noteRows = Object.entries(stats).map(([key, s]) => {
    const { name, position } = parseStatKey(key);
    return toRow(key, name, position === null ? null : positionOrdinal(position), s);
  });
  const fingerRows = Object.entries(fingerStats).map(([key, s]) => {
    const { finger, position } = parseFingerKey(key);
    return toRow(key, FINGER_LABEL[finger] ?? `finger ${finger}`, positionOrdinal(position), s);
  });
  if (noteRows.length === 0) return null;

  const byIntonation = (a: Row, b: Row) => a.intonation - b.intonation || b.attempts - a.attempts;
  const rows =
    view === 'reading'
      ? [...noteRows].sort((a, b) => a.acc - b.acc || b.attempts - a.attempts)
      : view === 'intonation'
        ? [...noteRows].sort(byIntonation)
        : [...fingerRows].sort(byIntonation);

  const attempts = noteRows.reduce((sum, r) => sum + r.attempts, 0);
  const hits = noteRows.reduce((sum, r) => sum + r.hits, 0);
  const inTune = noteRows.reduce((sum, r) => sum + r.inTune, 0);
  const overall = Math.round((hits / attempts) * 100);
  const overallIntonation = Math.round((inTune / attempts) * 100);

  const VIEWS: { value: View; label: string }[] = [
    { value: 'reading', label: 'Reading' },
    { value: 'intonation', label: 'Intonation' },
    { value: 'fingers', label: 'Fingers' },
  ];

  return (
    <details className="note-accuracy">
      <summary>
        Note accuracy · {overall}% first try · {overallIntonation}% in tune all-time
      </summary>
      <div className="presets note-acc-views">
        {VIEWS.map((v) => (
          <button
            key={v.value}
            className={'chip' + (view === v.value ? ' active' : '')}
            onClick={() => setView(v.value)}
          >
            {v.label}
          </button>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="hint note-acc-empty">
          Finger stats appear once you have played lines in a position.
        </p>
      ) : (
        <div className={'note-acc-list' + (view === 'fingers' ? ' fingers' : '')}>
          {rows.map((r) => {
            const value = view === 'reading' ? r.acc : r.intonation;
            const count = view === 'reading' ? r.hits : r.inTune;
            return (
              <div key={r.key} className="note-acc-row" data-grade={grade(value)}>
                <span className="note-acc-name">
                  {r.label}
                  {r.tag && <span className="note-acc-pos">{r.tag}</span>}
                </span>
                <span className="note-acc-bar">
                  <span style={{ width: `${Math.round(value * 100)}%` }} />
                </span>
                <span className="note-acc-pct">
                  {Math.round(value * 100)}% · {count}/{r.attempts}
                </span>
                {view !== 'reading' && r.tendency && (
                  <span className="note-acc-sub">
                    {TENDENCY_LABEL[r.tendency]} · avg {formatCents(r.avgCents)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
      <div className="panel-actions">
        <button className="secondary-btn" onClick={onReset}>
          Reset stats
        </button>
        <button className="secondary-btn" onClick={onExport}>
          Export CSV
        </button>
      </div>
      {exportNote && <p className="hint panel-note">{exportNote}</p>}
    </details>
  );
}
