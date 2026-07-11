import type { NoteStats } from '../reading/noteStats';
import { noteAccuracy } from '../reading/noteStats';

interface Props {
  stats: NoteStats;
  onReset: () => void;
}

function grade(acc: number): 'good' | 'ok' | 'bad' {
  return acc >= 0.9 ? 'good' : acc >= 0.7 ? 'ok' : 'bad';
}

/** All-time per-note accuracy, trickiest notes first. */
export default function NoteAccuracy({ stats, onReset }: Props) {
  const rows = Object.entries(stats)
    .map(([name, s]) => ({ name, ...s, acc: noteAccuracy(s) }))
    .sort((a, b) => a.acc - b.acc || b.attempts - a.attempts);
  if (rows.length === 0) return null;

  const attempts = rows.reduce((sum, r) => sum + r.attempts, 0);
  const hits = rows.reduce((sum, r) => sum + r.attempts - r.misses, 0);
  const overall = Math.round((hits / attempts) * 100);

  return (
    <details className="note-accuracy">
      <summary>Note accuracy · {overall}% first try all-time</summary>
      <div className="note-acc-list">
        {rows.map((r) => (
          <div key={r.name} className="note-acc-row" data-grade={grade(r.acc)}>
            <span className="note-acc-name">{r.name}</span>
            <span className="note-acc-bar">
              <span style={{ width: `${Math.round(r.acc * 100)}%` }} />
            </span>
            <span className="note-acc-pct">
              {Math.round(r.acc * 100)}% · {r.attempts - r.misses}/{r.attempts}
            </span>
          </div>
        ))}
      </div>
      <button className="secondary-btn note-acc-reset" onClick={onReset}>
        Reset stats
      </button>
    </details>
  );
}
