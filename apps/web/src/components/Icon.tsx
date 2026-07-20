import type { CSSProperties, ReactNode } from 'react';

/**
 * Icon set ported verbatim from the Claude Design handoff so glyphs match the
 * mockup exactly (stroke = currentColor, 24×24 viewBox).
 */
export type IconName =
  | 'dashboard'
  | 'washer'
  | 'dryer'
  | 'euro'
  | 'leaf'
  | 'wrench'
  | 'tag'
  | 'users'
  | 'bank'
  | 'network'
  | 'gear'
  | 'mapPin'
  | 'search'
  | 'bell'
  | 'chevronDown'
  | 'chevronRight'
  | 'power'
  | 'droplet'
  | 'alert'
  | 'clock'
  | 'trendUp'
  | 'download'
  | 'sparkles'
  | 'thumbsUp'
  | 'file'
  | 'check'
  | 'filter'
  | 'bolt'
  | 'flame'
  | 'close'
  | 'plus'
  | 'arrowRight'
  | 'logo'
  | 'info'
  | 'chat'
  | 'menu'
  | 'shield'
  | 'link';

const PATHS: Record<IconName, ReactNode> = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
    </>
  ),
  washer: (
    <>
      <rect x="4" y="2.5" width="16" height="19" rx="2.2" />
      <circle cx="12" cy="13" r="5" />
      <circle cx="12" cy="13" r="1.6" />
      <path d="M7 6h.01M10 6h.01" />
    </>
  ),
  dryer: (
    <>
      <path d="M5 8h11a3 3 0 1 0-3-3" />
      <path d="M5 12h14a3 3 0 1 1-3 3" />
      <path d="M5 16h8a2.5 2.5 0 1 1-2.5 2.5" />
    </>
  ),
  euro: (
    <>
      <path d="M16 6.5a6 6 0 1 0 0 11" />
      <path d="M4 10.5h10M4 14h10" />
    </>
  ),
  leaf: (
    <>
      <path d="M5 20c8 1.5 15-4 15-13 0 0-11-1.5-13.5 6C5.3 16.5 5 18 5 20Z" />
      <path d="M5 20c1.5-5.5 5-8.5 9-9.5" />
    </>
  ),
  wrench: <path d="M14.5 5.5a4 4 0 0 1-5.2 5.2L4 16l4 4 5.3-5.3a4 4 0 0 1 5.2-5.2l-2.8 2.8-2.5-2.5 2.8-2.8Z" />,
  tag: (
    <>
      <path d="M3 11.5 11 3.5l9 9-8 8z" />
      <circle cx="8" cy="8" r="1.4" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
      <path d="M16 5.2a3.2 3.2 0 0 1 0 6.1" />
      <path d="M20.5 20a5.5 5.5 0 0 0-4-5.3" />
    </>
  ),
  bank: (
    <>
      <path d="M3 10 12 4l9 6" />
      <path d="M5 10v9M19 10v9M9.5 10v9M14.5 10v9M3 20h18" />
    </>
  ),
  network: (
    <>
      <rect x="9" y="3" width="6" height="5" rx="1.2" />
      <rect x="3" y="16" width="6" height="5" rx="1.2" />
      <rect x="15" y="16" width="6" height="5" rx="1.2" />
      <path d="M12 8v3M6 16v-2.5h12V16" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.2 5.2 7 7M17 17l1.8 1.8M18.8 5.2 17 7M7 17l-1.8 1.8" />
    </>
  ),
  mapPin: (
    <>
      <path d="M12 21s-7-5.2-7-11a7 7 0 0 1 14 0c0 5.8-7 11-7 11Z" />
      <circle cx="12" cy="10" r="2.4" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.6" y2="16.6" />
    </>
  ),
  bell: (
    <>
      <path d="M6 9a6 6 0 0 1 12 0c0 5 2 7 2 7H4s2-2 2-7" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </>
  ),
  chevronDown: <polyline points="6 9 12 15 18 9" />,
  chevronRight: <polyline points="9 6 15 12 9 18" />,
  power: (
    <>
      <path d="M12 5v8" />
      <path d="M6.5 8a8 8 0 1 0 11 0" />
    </>
  ),
  droplet: <path d="M12 3s6 6 6 11a6 6 0 0 1-12 0c0-5 6-11 6-11Z" />,
  alert: (
    <>
      <path d="M12 3 21 19H3z" />
      <line x1="12" y1="10" x2="12" y2="14" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v4l3 2" />
    </>
  ),
  trendUp: (
    <>
      <line x1="7" y1="17" x2="17" y2="7" />
      <polyline points="9 7 17 7 17 15" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v12M7 11l5 4 5-4" />
      <path d="M4 19h16" />
    </>
  ),
  sparkles: (
    <>
      <path d="M12 3l1.7 4.6L18 9.3l-4.3 1.7L12 15.6l-1.7-4.6L6 9.3l4.3-1.7z" />
      <path d="M18.5 14.5l.8 2.1 2.2.8-2.2.8-.8 2.1-.8-2.1-2.2-.8 2.2-.8z" />
    </>
  ),
  thumbsUp: (
    <>
      <path d="M7 11v9H4v-9z" />
      <path d="M7 11l4-7.5a2 2 0 0 1 3 1.8l-.8 4.2H19a2 2 0 0 1 2 2.4l-1.2 5.6A2 2 0 0 1 17.8 20H7" />
    </>
  ),
  file: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <polyline points="14 3 14 8 19 8" />
    </>
  ),
  check: <polyline points="5 12 10 17 19 7" />,
  filter: (
    <>
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="7" y1="12" x2="17" y2="12" />
      <line x1="10" y1="18" x2="14" y2="18" />
    </>
  ),
  bolt: <polygon points="13 2 4 14 11 14 10 22 20 9 13 9" />,
  flame: <path d="M12 3c1 4 5 5 5 9a5 5 0 0 1-10 0c0-2 1-3 2-4 1 2 2 2 3 1z" />,
  close: (
    <>
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </>
  ),
  plus: (
    <>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </>
  ),
  arrowRight: <path d="M4 12h12M12 6l6 6-6 6" />,
  logo: (
    <>
      <path d="M3 18V9a2 2 0 0 1 2-2h3l2-3h4l2 3h3a2 2 0 0 1 2 2v9" />
      <circle cx="12" cy="13" r="3.4" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="8" x2="12" y2="13" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </>
  ),
  chat: <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 9.5 9.5 0 0 1-4-.9L3 21l1.9-5.5a8.38 8.38 0 0 1-.9-4 8.5 8.5 0 0 1 8.5-8.5 8.38 8.38 0 0 1 8.5 8.5z" />,
  shield: (
    <>
      <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  menu: (
    <>
      <path d="M3 6h18" />
      <path d="M3 12h18" />
      <path d="M3 18h18" />
    </>
  ),
  link: (
    <>
      <path d="M9.5 14.5 14.5 9.5" />
      <path d="M8.5 12 6 14.5a3.5 3.5 0 0 0 5 5L13.5 17" />
      <path d="M15.5 12 18 9.5a3.5 3.5 0 0 0-5-5L10.5 7" />
    </>
  ),
};

export interface IconProps {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
  style?: CSSProperties;
}

export function Icon({ name, size = 18, strokeWidth = 1.8, className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
