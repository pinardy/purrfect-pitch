import { useState } from 'react';
import type { History, PositionKey } from '../reading/history';
import { dailyTotals, recordedPositions } from '../reading/history';
import { positionOrdinal, type Position } from '../reading/violin';

interface Props {
  history: History;
}

const MAX_DAYS = 14;
const CHART_HEIGHT = 120;

function positionName(key: PositionKey | 'all'): string {
  if (key === 'all') return 'All';
  if (key === 'free') return 'Free';
  return positionOrdinal(Number(key) as Position);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function shortDay(day: string): string {
  const [, m, d] = day.split('-');
  return `${Number(d)} ${MONTHS[Number(m) - 1]}`;
}

/**
 * Day-by-day first-try and in-tune rates for the chosen position, so progress
 * in a position can be followed over time. Two series, one axis, with a
 * table view for exact figures.
 */
export default function SessionHistory({ history }: Props) {
  const [filter, setFilter] = useState<PositionKey | 'all'>('all');
  const [table, setTable] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const positions = recordedPositions(history);
  if (positions.length === 0) return null;

  const days = dailyTotals(history, filter).slice(-MAX_DAYS);
  const rows = days.map((d) => ({
    ...d,
    firstTryPct: Math.round((d.firstTry / d.notes) * 100),
    inTunePct: Math.round((d.inTune / d.notes) * 100),
  }));
  // label every nth day so dates never overlap on a phone; the tapped day shows its figures
  const labelStep = Math.ceil(rows.length / 5);
  const selected = rows.find((r) => r.day === selectedDay) ?? rows[rows.length - 1];
  const describe = (r: (typeof rows)[number]) =>
    `${shortDay(r.day)} · ${r.lines} line${r.lines === 1 ? '' : 's'} · ${r.firstTryPct}% first try · ${r.inTunePct}% in tune`;

  return (
    <details className="session-history">
      <summary>Practice history · {Object.keys(history).length} day{Object.keys(history).length === 1 ? '' : 's'}</summary>
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
            <tr><th>Day</th><th>Lines</th><th>First try</th><th>In tune</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.day}>
                <td>{shortDay(r.day)}</td>
                <td>{r.lines}</td>
                <td>{r.firstTryPct}%</td>
                <td>{r.inTunePct}%</td>
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
      <button className="secondary-btn history-toggle" onClick={() => setTable((t) => !t)}>
        {table ? 'Show chart' : 'Show table'}
      </button>
    </details>
  );
}
