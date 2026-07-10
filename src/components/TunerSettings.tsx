export const DEFAULT_A4 = 440;
export const MIN_A4 = 400;
export const MAX_A4 = 480;

export function clampA4(value: number): number {
  return Math.min(MAX_A4, Math.max(MIN_A4, Math.round(value)));
}

const PRESETS = [415, 432, 440, 441, 442, 443];

interface Props {
  a4: number;
  onChange: (a4: number) => void;
  devices: MediaDeviceInfo[];
  deviceId: string;
  onSelectDevice: (deviceId: string) => void;
  onClose: () => void;
}

export default function TunerSettings({
  a4,
  onChange,
  devices,
  deviceId,
  onSelectDevice,
  onClose,
}: Props) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-label="Tuner settings"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-header">
          <h2>Tuner settings</h2>
          <button className="icon-btn" aria-label="Close settings" onClick={onClose}>
            ✕
          </button>
        </div>

        <label className="field-label" htmlFor="a4-input">
          A4 reference pitch (Hz)
        </label>
        <div className="stepper">
          <button aria-label="Decrease A4" onClick={() => onChange(clampA4(a4 - 1))}>
            −
          </button>
          <input
            id="a4-input"
            type="number"
            inputMode="numeric"
            min={MIN_A4}
            max={MAX_A4}
            value={a4}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v)) onChange(v);
            }}
            onBlur={(e) => onChange(clampA4(Number(e.target.value) || DEFAULT_A4))}
          />
          <button aria-label="Increase A4" onClick={() => onChange(clampA4(a4 + 1))}>
            +
          </button>
        </div>

        <div className="presets">
          {PRESETS.map((p) => (
            <button
              key={p}
              className={'chip' + (p === a4 ? ' active' : '')}
              onClick={() => onChange(p)}
            >
              {p}
            </button>
          ))}
        </div>

        <p className="hint">
          All note frequencies are derived from this reference using equal temperament
          ({MIN_A4}–{MAX_A4} Hz).
        </p>

        <label className="field-label" htmlFor="mic-select">
          Microphone
        </label>
        {devices.length > 0 ? (
          <select
            id="mic-select"
            className="mic-select"
            value={deviceId}
            onChange={(e) => onSelectDevice(e.target.value)}
          >
            <option value="">System default</option>
            {devices.map((d, i) => (
              <option key={d.deviceId || i} value={d.deviceId}>
                {d.label || `Microphone ${i + 1}`}
              </option>
            ))}
          </select>
        ) : (
          <p className="hint">Start the tuner once to grant mic access, then pick a device here.</p>
        )}
        <p className="hint">
          Bluetooth earbud mics (like AirPods) are tuned for speech — they often filter out
          instrument tones and run at a low sample rate. For tuning, your device&apos;s built-in
          microphone almost always works better.
        </p>
      </div>
    </div>
  );
}
