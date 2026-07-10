export type CatMood = 'sleepy' | 'neutral' | 'sad' | 'happy';

const MOOD_LABEL: Record<CatMood, string> = {
  sleepy: 'Sleeping cat',
  neutral: 'Cat listening',
  sad: 'Cat looking concerned — out of tune',
  happy: 'Cat smiling — in tune!',
};

interface Props {
  mood: CatMood;
  size?: number;
}

export default function CatFace({ mood, size = 190 }: Props) {
  return (
    <svg
      className={`cat-face mood-${mood}`}
      viewBox="0 0 200 180"
      width={size}
      height={(size * 180) / 200}
      role="img"
      aria-label={MOOD_LABEL[mood]}
    >
      {/* ears */}
      <g stroke="#7c4a21" strokeWidth="5" strokeLinejoin="round">
        <path d="M30 64 L20 12 L78 32 Z" fill="#f6a55c" />
        <path d="M170 64 L180 12 L122 32 Z" fill="#f6a55c" />
      </g>
      <path d="M38 52 L32 24 L64 36 Z" fill="#fca5c0" />
      <path d="M162 52 L168 24 L136 36 Z" fill="#fca5c0" />

      {/* head */}
      <ellipse cx="100" cy="102" rx="76" ry="70" fill="#f6a55c" stroke="#7c4a21" strokeWidth="5" />

      {/* forehead stripes */}
      <g stroke="#d97b36" strokeWidth="7" strokeLinecap="round">
        <line x1="100" y1="36" x2="100" y2="54" />
        <line x1="78" y1="42" x2="82" y2="58" />
        <line x1="122" y1="42" x2="118" y2="58" />
      </g>

      {/* whiskers */}
      <g stroke="#7c4a21" strokeWidth="4" strokeLinecap="round">
        <line x1="18" y1="104" x2="50" y2="108" />
        <line x1="20" y1="120" x2="50" y2="118" />
        <line x1="26" y1="136" x2="52" y2="128" />
        <line x1="182" y1="104" x2="150" y2="108" />
        <line x1="180" y1="120" x2="150" y2="118" />
        <line x1="174" y1="136" x2="148" y2="128" />
      </g>

      {/* muzzle */}
      <ellipse cx="100" cy="126" rx="34" ry="24" fill="#fff3e4" />

      {/* eyes */}
      {mood === 'happy' && (
        <g stroke="#402a1e" strokeWidth="6" strokeLinecap="round" fill="none">
          <path d="M56 92 Q68 78 80 92" />
          <path d="M120 92 Q132 78 144 92" />
        </g>
      )}
      {mood === 'sleepy' && (
        <g stroke="#402a1e" strokeWidth="6" strokeLinecap="round" fill="none">
          <path d="M56 92 Q68 102 80 92" />
          <path d="M120 92 Q132 102 144 92" />
        </g>
      )}
      {(mood === 'neutral' || mood === 'sad') && (
        <g>
          <circle cx="68" cy="92" r="10" fill="#402a1e" />
          <circle cx="132" cy="92" r="10" fill="#402a1e" />
          <circle cx="65" cy="89" r="3" fill="#fff" />
          <circle cx="129" cy="89" r="3" fill="#fff" />
        </g>
      )}
      {mood === 'sad' && (
        <g stroke="#402a1e" strokeWidth="5" strokeLinecap="round">
          <line x1="54" y1="74" x2="78" y2="80" />
          <line x1="146" y1="74" x2="122" y2="80" />
        </g>
      )}

      {/* blush */}
      {mood === 'happy' && (
        <g fill="#fb9ec0" opacity="0.75">
          <ellipse cx="46" cy="116" rx="11" ry="6" />
          <ellipse cx="154" cy="116" rx="11" ry="6" />
        </g>
      )}

      {/* nose */}
      <path
        d="M92 112 L108 112 L100 122 Z"
        fill="#f472a6"
        stroke="#f472a6"
        strokeWidth="4"
        strokeLinejoin="round"
      />

      {/* mouth */}
      {mood === 'happy' && (
        <path
          d="M82 128 Q100 150 118 128 Q100 136 82 128 Z"
          fill="#8c4a3c"
          stroke="#402a1e"
          strokeWidth="4"
          strokeLinejoin="round"
        />
      )}
      {mood === 'neutral' && (
        <g stroke="#402a1e" strokeWidth="4" strokeLinecap="round" fill="none">
          <path d="M100 124 Q93 133 86 129" />
          <path d="M100 124 Q107 133 114 129" />
        </g>
      )}
      {mood === 'sad' && (
        <path
          d="M88 136 Q100 126 112 136"
          stroke="#402a1e"
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
        />
      )}
      {mood === 'sleepy' && (
        <g>
          <path d="M92 130 h16" stroke="#402a1e" strokeWidth="4" strokeLinecap="round" />
          <text x="152" y="52" className="zzz">z</text>
          <text x="168" y="32" className="zzz small">z</text>
        </g>
      )}
    </svg>
  );
}
