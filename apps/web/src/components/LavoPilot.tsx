import { cn } from '@/lib/cn';

/**
 * LavoPilot — the brand mascot: a friendly, personified washing machine that
 * acts as the assistant's face across the chat. Pure inline SVG so it inherits
 * the theme and needs no assets. `mood` nudges the expression; `size` scales the
 * whole thing. Used big on the empty chat state and small as the assistant
 * avatar next to each reply.
 */
export function LavoPilot({
  size = 96,
  mood = 'happy',
  waving = false,
  className,
}: {
  size?: number;
  mood?: 'happy' | 'thinking' | 'wave';
  waving?: boolean;
  className?: string;
}) {
  const thinking = mood === 'thinking';
  const wave = waving || mood === 'wave';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      className={cn('select-none', className)}
      role="img"
      aria-label="LavoPilot"
    >
      <defs>
        <linearGradient id="lp-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7DA9F6" />
          <stop offset="1" stopColor="#3C6FD6" />
        </linearGradient>
        <radialGradient id="lp-glass" cx="0.5" cy="0.42" r="0.65">
          <stop offset="0" stopColor="#EAF2FF" />
          <stop offset="0.7" stopColor="#BFE0F5" />
          <stop offset="1" stopColor="#8FC3E8" />
        </radialGradient>
      </defs>

      {/* waving arm (left) */}
      <g
        className={cn(wave && 'animate-lp-wave')}
        style={{ transformOrigin: '90% 60%', transformBox: 'fill-box' }}
      >
        <rect x="8" y="60" width="16" height="9" rx="4.5" fill="url(#lp-body)" />
        <circle cx="10" cy="64.5" r="6.5" fill="#7DA9F6" />
      </g>
      {/* right arm resting */}
      <rect x="96" y="70" width="16" height="9" rx="4.5" fill="url(#lp-body)" />
      <circle cx="110" cy="74.5" r="6.5" fill="#3C6FD6" />

      {/* body */}
      <rect x="22" y="18" width="76" height="90" rx="16" fill="url(#lp-body)" />
      <rect
        x="22"
        y="18"
        width="76"
        height="90"
        rx="16"
        fill="none"
        stroke="#2C56AE"
        strokeWidth="1.5"
        opacity="0.35"
      />

      {/* control panel */}
      <rect x="30" y="26" width="60" height="16" rx="6" fill="#EAF2FF" opacity="0.92" />
      <circle cx="40" cy="34" r="3.4" fill="#3C6FD6" />
      <circle cx="52" cy="34" r="3.4" fill="#7DA9F6" />
      <rect x="62" y="31" width="20" height="6" rx="3" fill="#9DC0F5" />

      {/* face: the door glass */}
      <circle cx="60" cy="72" r="28" fill="#EAF2FF" />
      <circle cx="60" cy="72" r="28" fill="none" stroke="#2C56AE" strokeWidth="2.5" opacity="0.4" />
      <circle cx="60" cy="72" r="22" fill="url(#lp-glass)" />

      {/* eyes */}
      <g fill="#26467F">
        {thinking ? (
          <>
            <rect x="47" y="66" width="8" height="3.2" rx="1.6" />
            <rect x="65" y="66" width="8" height="3.2" rx="1.6" />
          </>
        ) : (
          <>
            <circle cx="51" cy="68" r="3.6" />
            <circle cx="69" cy="68" r="3.6" />
            <circle cx="52.2" cy="66.8" r="1.1" fill="#EAF2FF" />
            <circle cx="70.2" cy="66.8" r="1.1" fill="#EAF2FF" />
          </>
        )}
      </g>
      {/* rosy cheeks */}
      <circle cx="45" cy="76" r="3.4" fill="#F6A9C0" opacity="0.6" />
      <circle cx="75" cy="76" r="3.4" fill="#F6A9C0" opacity="0.6" />
      {/* smile */}
      <path
        d={thinking ? 'M53 80 q7 4 14 0' : 'M50 78 q10 9 20 0'}
        fill="none"
        stroke="#26467F"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      {/* little water swirl */}
      <path
        d="M46 86 q6 4 12 0 q6 -4 12 0"
        fill="none"
        stroke="#8FC3E8"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.8"
      />
      {/* feet */}
      <rect x="30" y="107" width="10" height="6" rx="2.5" fill="#2C56AE" />
      <rect x="80" y="107" width="10" height="6" rx="2.5" fill="#2C56AE" />
    </svg>
  );
}
