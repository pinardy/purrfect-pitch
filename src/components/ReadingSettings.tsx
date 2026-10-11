import type { Difficulty, ReadingSettings as Settings } from '../reading/settings';
import { MAJOR_TONICS, MINOR_TONICS } from '../reading/theory';
import { POSITIONS, positionLabel, type Position } from '../reading/violin';

const DIFFICULTIES: { value: Difficulty; label: string; hint: string; positionHint: string }[] = [
  {
    value: 'easy',
    label: 'Easy',
    hint: 'middle of the staff, simple keys',
    positionHint: 'D and A strings only, simple keys',
  },
  {
    value: 'medium',
    label: 'Medium',
    hint: 'full staff, all keys',
    positionHint: 'all four strings, all keys',
  },
  {
    value: 'hard',
    label: 'Hard',
    hint: 'high notes and accidentals',
    positionHint: 'all four strings, with accidentals',
  },
];

const POSITION_CHOICES: { value: Position | null; label: string }[] = [
  { value: null, label: 'Any' },
  ...POSITIONS.map((p) => ({ value: p, label: positionLabel(p).replace(' position', '') })),
];

const NOTE_COUNTS = [4, 8, 12, 16];

interface Props {
  settings: Settings;
  onChange: (settings: Settings) => void;
  onClose: () => void;
}

export default function ReadingSettings({ settings, onChange, onClose }: Props) {
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    onChange({ ...settings, [key]: value });

  const activeDifficulty = DIFFICULTIES.find((d) => d.value === settings.difficulty);
  const inPosition = settings.position !== null;
  const activeHint = inPosition ? activeDifficulty?.positionHint : activeDifficulty?.hint;

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-label="Sight reading settings"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-header">
          <h2>Sight reading settings</h2>
          <button className="icon-btn" aria-label="Close settings" onClick={onClose}>
            ✕
          </button>
        </div>

        <span className="field-label">Difficulty</span>
        <div className="presets">
          {DIFFICULTIES.map((d) => (
            <button
              key={d.value}
              className={'chip' + (d.value === settings.difficulty ? ' active' : '')}
              onClick={() => set('difficulty', d.value)}
            >
              {d.label}
            </button>
          ))}
        </div>
        <p className="hint">{activeHint}</p>

        <span className="field-label">Violin position</span>
        <div className="presets">
          {POSITION_CHOICES.map((p) => (
            <button
              key={p.label}
              className={'chip' + (p.value === settings.position ? ' active' : '')}
              onClick={() => set('position', p.value)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <p className="hint">
          {inPosition
            ? `Every note sits under the hand in ${positionLabel(settings.position as Position)}, so you can practise reading there without shifting.`
            : 'Pick a position to keep every note within reach of that hand frame.'}
        </p>

        {inPosition && (
          <>
            <label className="check-row">
              <input
                type="checkbox"
                checked={settings.showFingerings}
                onChange={(e) => set('showFingerings', e.target.checked)}
              />
              <span>Show fingerings</span>
            </label>
            <p className="hint">
              Finger numbers appear above each note; the string (I = E, II = A, III = D,
              IV = G) is marked below where it changes.
            </p>
          </>
        )}

        <label className="field-label" htmlFor="key-mode-select">
          Keys
        </label>
        <select
          id="key-mode-select"
          className="mic-select"
          value={settings.keyMode}
          onChange={(e) => set('keyMode', e.target.value as Settings['keyMode'])}
        >
          <option value="random-major">Random major keys</option>
          <option value="random-any">Random major & minor keys</option>
          <option value="fixed">Fixed key</option>
        </select>

        {settings.keyMode === 'fixed' && (
          <select
            className="mic-select"
            aria-label="Fixed key"
            value={`${settings.fixedKey.tonic}|${settings.fixedKey.mode}`}
            onChange={(e) => {
              const [tonic, mode] = e.target.value.split('|');
              set('fixedKey', { tonic, mode: mode as 'major' | 'minor' });
            }}
          >
            {MAJOR_TONICS.map((t) => (
              <option key={`${t}major`} value={`${t}|major`}>{t} major</option>
            ))}
            {MINOR_TONICS.map((t) => (
              <option key={`${t}minor`} value={`${t}|minor`}>{t} minor</option>
            ))}
          </select>
        )}

        <span className="field-label">Notes per line</span>
        <div className="presets">
          {NOTE_COUNTS.map((n) => (
            <button
              key={n}
              className={'chip' + (n === settings.noteCount ? ' active' : '')}
              onClick={() => set('noteCount', n)}
            >
              {n}
            </button>
          ))}
        </div>

        <label className="check-row">
          <input
            type="checkbox"
            checked={settings.strictIntonation}
            onChange={(e) => set('strictIntonation', e.target.checked)}
          />
          <span>Strict intonation (within ±30 cents)</span>
        </label>
        <p className="hint">
          Notes are checked against the tuner&apos;s A4 reference. Play single notes —
          pitch detection is monophonic.
        </p>
      </div>
    </div>
  );
}
