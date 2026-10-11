import type { Key, SpelledNote } from '../reading/theory';
import { spelledName } from '../reading/theory';
import type { Position, ViolinString } from '../reading/violin';
import { frameNotes, semitonesOnString, VIOLIN_STRINGS } from '../reading/violin';

interface Props {
  key_: Key;
  /** position whose hand frame is shaded */
  position: Position;
  /** the other position of a shifting line, outlined for reference */
  otherPosition?: Position | null;
  strings: ViolinString[];
  /** note to mark, with the string it is played on */
  current?: { note: SpelledNote; string: ViolinString } | null;
}

const WIDTH = 340;
const HEIGHT = 92;
const NUT_X = 26;
const SCALE_LENGTH = 300;
/** semitones shown; 7th position on the E string reaches 17, and the note label needs room */
const MAX_SEMITONES = 21;
const STRING_Y: Record<string, number> = { E: 18, A: 36, D: 54, G: 72 };

/** x of a stop `semitones` above the nut, spaced like a real fingerboard. */
function xAt(semitones: number): number {
  const fraction = (1 - 2 ** (-semitones / 12)) / (1 - 2 ** (-MAX_SEMITONES / 12));
  return NUT_X + fraction * SCALE_LENGTH;
}

/**
 * Horizontal fingerboard (nut at the left, E string on top) with the current
 * position's hand frame shaded and numbered on each string in use.
 */
export default function Fingerboard({ key_, position, otherPosition, strings, current }: Props) {
  const inUse = new Set(strings.map((s) => s.name));
  const frames = VIOLIN_STRINGS.map((string) => ({
    string,
    notes: frameNotes(position, string, key_),
    other: otherPosition ? frameNotes(otherPosition, string, key_) : null,
  }));
  const frameBox = (string: ViolinString, frame: { note: SpelledNote }[]) => {
    const lo = semitonesOnString(frame[0].note, string) ?? 0;
    const hi = semitonesOnString(frame[frame.length - 1].note, string) ?? 0;
    // the box spans half a semitone either side of the outer fingers
    return { x: xAt(Math.max(0, lo - 0.5)), w: xAt(hi + 0.5) - xAt(Math.max(0, lo - 0.5)) };
  };
  const currentX =
    current && semitonesOnString(current.note, current.string) !== null
      ? xAt(semitonesOnString(current.note, current.string) as number)
      : null;

  return (
    <svg
      className="fingerboard"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label={`Fingerboard: hand frame of position ${position}`}
    >
      <rect x={NUT_X} y={6} width={WIDTH - NUT_X - 4} height={HEIGHT - 12} rx={6} className="fb-board" />
      <rect x={NUT_X - 3} y={6} width={4} height={HEIGHT - 12} className="fb-nut" />
      {frames.map(({ string, notes, other }) => {
        const y = STRING_Y[string.name];
        const active = inUse.has(string.name);
        const box = frameBox(string, notes);
        return (
          <g key={string.name} className={active ? 'fb-string active' : 'fb-string'}>
            {other && active && (
              <rect
                x={frameBox(string, other).x}
                y={y - 7}
                width={frameBox(string, other).w}
                height={14}
                rx={4}
                className="fb-frame other"
              />
            )}
            {active && <rect x={box.x} y={y - 7} width={box.w} height={14} rx={4} className="fb-frame" />}
            <line x1={NUT_X} y1={y} x2={WIDTH - 4} y2={y} className="fb-line" />
            <text x={NUT_X - 10} y={y + 4} textAnchor="middle" className="fb-label">
              {string.name}
            </text>
            {active &&
              notes.map(({ finger, note }) => {
                const s = semitonesOnString(note, string);
                if (s === null) return null;
                return (
                  <text key={finger} x={xAt(s)} y={y + 3.5} textAnchor="middle" className="fb-finger">
                    {finger}
                  </text>
                );
              })}
          </g>
        );
      })}
      {current && currentX !== null && (
        <g className="fb-current">
          <circle cx={currentX} cy={STRING_Y[current.string.name]} r={7} />
          {/* the note name sits at the far end of its string, clear of the finger numbers */}
          <text x={WIDTH - 10} y={STRING_Y[current.string.name] + 4} textAnchor="end">
            {spelledName(current.note)}
          </text>
        </g>
      )}
    </svg>
  );
}
