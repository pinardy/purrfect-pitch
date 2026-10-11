interface Props {
  /** first-heard cents per note; null until the note is played */
  cents: (number | null)[];
  /** intonation tolerance; null = not checked */
  tolerance: number | null;
}

const RANGE = 50;

/**
 * One dot per note, raised when it was first heard sharp and lowered when
 * flat, so a line's drift pattern is visible at a glance.
 */
export default function CentsStrip({ cents, tolerance }: Props) {
  return (
    <div className="cents-strip" aria-label="Intonation of each note: above the line is sharp, below is flat">
      <div className="cents-axis">
        <span>♯</span>
        <span>♭</span>
      </div>
      <div className="cents-cells">
        {cents.map((c, i) => {
          const clamped = c === null ? 0 : Math.max(-RANGE, Math.min(RANGE, c));
          const grade =
            c === null ? 'none' : tolerance !== null && Math.abs(c) > tolerance ? 'off' : 'ok';
          return (
            <div key={i} className="cents-cell" data-grade={grade} title={c === null ? '' : `${c > 0 ? '+' : ''}${Math.round(c)}¢`}>
              <span className="cents-mid" />
              {c !== null && (
                <span className="cents-dot" style={{ top: `${50 - (clamped / RANGE) * 50}%` }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
