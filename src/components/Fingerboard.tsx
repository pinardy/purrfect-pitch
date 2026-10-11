import type { Key, SpelledNote } from '../reading/theory';
import { spelledName } from '../reading/theory';
import type { Position, ViolinString } from '../reading/violin';
import {
  frameNotes,
  letterIndex,
  POSITIONS,
  positionOrdinal,
  semitonesOnString,
  VIOLIN_STRINGS,
} from '../reading/violin';
import { keyAlterations, spell } from '../reading/theory';

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
const HEIGHT = 116;
const NUT_X = 26;
const SCALE_LENGTH = 300;
/** semitones shown; 7th position on the E string reaches 17, and the note label needs room */
const MAX_SEMITONES = 21;
/** room above the board for the two-row position ruler */
const BOARD_TOP = 28;
const STRING_Y: Record<string, number> = { E: 40, A: 58, D: 76, G: 94 };
/** the string the position ruler is measured along */
const RULER_STRING = VIOLIN_STRINGS[2]; // A

/** x of a stop `semitones` above the nut, spaced like a real fingerboard. */
function xAt(semitones: number): number {
  const fraction = (1 - 2 ** (-semitones / 12)) / (1 - 2 ** (-MAX_SEMITONES / 12));
  return NUT_X + fraction * SCALE_LENGTH;
}

/**
 * Horizontal fingerboard (nut at the left, E string on top) with the current
 * position's hand frame shaded and numbered on each string in use. For
 * orientation, a ruler above the board marks where every position's first
 * finger sits, and the 1st-position home frame is outlined faintly whenever
 * the hand is higher, so the shift from home is visible at a glance.
 */
export default function Fingerboard({ key_, position, otherPosition, strings, current }: Props) {
  const inUse = new Set(strings.map((s) => s.name));
  // 1st position as the reference frame, unless it is already drawn as the shift's other position
  const homePosition: Position | null = position > 1 && otherPosition !== 1 ? 1 : null;
  const frames = VIOLIN_STRINGS.map((string) => ({
    string,
    notes: frameNotes(position, string, key_),
    other: otherPosition ? frameNotes(otherPosition, string, key_) : null,
    home: homePosition ? frameNotes(homePosition, string, key_) : null,
  }));
  // first-finger stop of each position along the ruler string, in the current key
  const alterations = keyAlterations(key_);
  const rulerBase = letterIndex(RULER_STRING.letter, RULER_STRING.octave);
  const rulerTicks = POSITIONS.map((p) => {
    const index = rulerBase + p;
    const letters = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
    const letter = letters[index % 7];
    const note = spell(letter, alterations[letter] ?? '', Math.floor(index / 7));
    return { position: p, x: xAt(semitonesOnString(note, RULER_STRING) ?? 0) };
  });
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
      <rect x={NUT_X} y={BOARD_TOP} width={WIDTH - NUT_X - 4} height={HEIGHT - BOARD_TOP - 6} rx={6} className="fb-board" />
      <rect x={NUT_X - 3} y={BOARD_TOP} width={4} height={HEIGHT - BOARD_TOP - 6} className="fb-nut" />
      {/* position ruler: where the first finger lands in each position */}
      <g className="fb-ruler">
        {rulerTicks.map((t) => (
          <g
            key={t.position}
            className={
              'fb-ruler-tick' +
              (t.position === position ? ' current' : t.position < position ? ' lower' : ' higher')
            }
          >
            {/* odd positions label on the upper row, even on the lower, so neighbours never collide */}
            <line x1={t.x} y1={t.position % 2 === 1 ? BOARD_TOP - 15 : BOARD_TOP - 5} x2={t.x} y2={BOARD_TOP + 2} />
            <text x={t.x} y={t.position % 2 === 1 ? BOARD_TOP - 18 : BOARD_TOP - 8} textAnchor="middle">
              {positionOrdinal(t.position)}
            </text>
          </g>
        ))}
      </g>
      {frames.map(({ string, notes, other, home }) => {
        const y = STRING_Y[string.name];
        const active = inUse.has(string.name);
        const box = frameBox(string, notes);
        return (
          <g key={string.name} className={active ? 'fb-string active' : 'fb-string'}>
            {home && active && (
              <>
                <rect
                  x={frameBox(string, home).x}
                  y={y - 7}
                  width={frameBox(string, home).w}
                  height={14}
                  rx={4}
                  className="fb-frame home"
                />
                {home.map(({ finger, note }) => {
                  const sem = semitonesOnString(note, string);
                  if (sem === null) return null;
                  return (
                    <text key={finger} x={xAt(sem)} y={y + 3.5} textAnchor="middle" className="fb-finger home">
                      {finger}
                    </text>
                  );
                })}
              </>
            )}
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
