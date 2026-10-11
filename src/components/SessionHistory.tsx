import { useState } from 'react';
import type { History, PositionKey } from '../reading/history';
import { dailyTotals, recordedPositions } from '../reading/history';
import { positionOrdinal, type Position } from '../reading/violin';

interface Props {
  history: History;
  onReset: () => void;
}

const MAX_DAYS = 14;
const CHART_HEIGHT = 120;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function positionName(key: PositionKey | 'all'): string {
  if (key === 'all') return 'All';
  if (key === 'free') return 'Free';
  return positionOrdinal(Number(key) as Position);
}

function shortDay(day: string): string {
  const [, m, d] = day.split('-');
  return `${Number(d)} ${MONTHS[Number(m) - 1]}`;
}

function pct(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 100) : null;
}

/**
 * Day-by-day first-try and in-tune rates for the chosen position, so progress
 * in a position can be followed over time. Two series, one axis, with a
 * table view for exact figures; shift accuracy is reported in the caption
 * and the table.
 */
export default function SessionHistory({ history, onReset }: Props) {
  const [filter, setFilter] = useState<PositionKey | 'all'>('all');
  const [table, setTable] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const positions = recordedPositions(history);
  if (positions.length === 0) return null;

  const days = dailyTotals(history, filter).slice(-MAX_DAYS);
  const rows = days.map((d) => ({
    ...d,
    firstTryPct: pct(d.firstTry, d.notes) ?? 0,
    inTunePct: pct(d.inTune, d.notes) ?? 0,
    shiftsPct: pct(d.shiftsClean ?? 0, d.shifts ?? 0),
  }));
  // label every nth day so dates never overlap on a phone; the tapped day shows its figures
  const labelStep = Math.ceil(rows.length / 5);
  const selected = rows.find((r) => r.day === selectedDay) ?? rows[rows.length - 1];
  const describe = (r: (typeof rows)[number]) =>
    `${shortDay(r.day)} · ${r.lines} line${r.lines === 1 ? '' : 's'} · ${r.firstTryPct}% first try · ${r.inTunePct}% in tune` +
    (r.shiftsPct !== null ? ` · ${r.shiftsPct}% shifts clean` : '');
  const dayCount = Object.keys(history).length;

  const confirmReset = () => {
    if (window.confirm('Clear all practice history? This cannot be undone.')) onReset();
  };

  return (
    <details className="session-history">
      <summary>
        Practice history · {dayCount} day{dayCount === 1 ? '' : 's'}
      </summary>
      {positions.length > 1 && (
        <div className="presets history-filters">
          {(['all', ...positions] as (PositionKey | 'all')[]).map((key) => (
            <button
              key={key}
              className={'chip' + (key === filter ? ' active' : '')}
              onClick={() => setFilter(key)}
            >
              {positionName(key)}
            </button>
          ))}
        </div>
      )}
      <div className="history-legend">
        <span><i className="swatch first-try" /> First try</span>
        <span><i className="swatch in-tune" /> In tune</span>
      </div>
      {rows.length === 0 ? (
        <p className="hint">No lines yet for this position.</p>
      ) : table ? (
        <table className="history-table">
          <thead>
            <tr><th>Day</th><th>Lines</th><th>First try</th><th>In tune</th><th>Shifts</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.day}>
                <td>{shortDay(r.day)}</td>
                <td>{r.lines}</td>
                <td>{r.firstTryPct}%</td>
                <td>{r.inTunePct}%</td>
                <td>{r.shiftsPct === null ? '–' : `${r.shiftsPct}%`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <>
          <div className="history-chart" style={{ height: CHART_HEIGHT }}>
            {rows.map((r, i) => (
              <div
                key={r.day}
                className={'history-day' + (selected?.day === r.day ? ' selected' : '')}
                title={describe(r)}
                onClick={() => setSelectedDay(r.day)}
              >
                <div className="history-bars">
                  <span className="bar first-try" style={{ height: `${r.firstTryPct}%` }} />
                  <span className="bar in-tune" style={{ height: `${r.inTunePct}%` }} />
                </div>
                <span className="history-day-label">
                  {i === rows.length - 1 || (i % labelStep === 0 && rows.length - 1 - i >= labelStep)
                    ? shortDay(r.day)
                    : ''}
                </span>
              </div>
            ))}
          </div>
          {selected && <p className="history-caption">{describe(selected)}</p>}
        </>
      )}
      <div className="panel-actions">
        <button className="secondary-btn" onClick={() => setTable((t) => !t)}>
          {table ? 'Show chart' : 'Show table'}
        </button>
        <button className="secondary-btn" onClick={confirmReset}>
          Reset history
        </button>
      </div>
    </details>
  );
}
