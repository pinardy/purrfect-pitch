import type { Difficulty, ReadingSettings as Settings } from '../reading/settings';
import { MAJOR_TONICS, MINOR_TONICS } from '../reading/theory';

const DIFFICULTIES: { value: Difficulty; label: string; hint: string }[] = [
  { value: 'easy', label: 'Easy', hint: 'middle of the staff, simple keys' },
  { value: 'medium', label: 'Medium', hint: 'full staff, all keys' },
  { value: 'hard', label: 'Hard', hint: 'high notes and accidentals' },
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

  const activeHint = DIFFICULTIES.find((d) => d.value === settings.difficulty)?.hint;

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
