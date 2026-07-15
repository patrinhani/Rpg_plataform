import React from 'react';

const ICONS = {
  overview: (
    <>
      <rect x="4" y="4" width="6" height="6" rx="1" />
      <rect x="14" y="4" width="6" height="6" rx="1" />
      <rect x="4" y="14" width="6" height="6" rx="1" />
      <rect x="14" y="14" width="6" height="6" rx="1" />
    </>
  ),
  inventory: (
    <>
      <path d="M8 7V5.5A2.5 2.5 0 0 1 10.5 3h3A2.5 2.5 0 0 1 16 5.5V7" />
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M3 12h18M9 12v2h6v-2" />
    </>
  ),
  rituals: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m12 6 5.2 9H6.8L12 6Z" />
      <circle cx="12" cy="12" r="1.5" />
    </>
  ),
  powers: <path d="m13.5 2-8 12h6l-1 8 8-12h-6l1-8Z" />,
  progress: (
    <>
      <path d="M4 19V9M10 19V5M16 19v-8M22 19V3" />
      <path d="m3 13 6-5 6 2 6-6" />
    </>
  ),
  journal: (
    <>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11a3 3 0 0 1 3 3v15a3 3 0 0 0-3-3H4V5.5Z" />
      <path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H14v18a3 3 0 0 1 3-3h3V5.5Z" />
    </>
  ),
  export: (
    <>
      <path d="M12 16V3M7 8l5-5 5 5" />
      <path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
    </>
  ),
  rest: <path d="M20.5 15.5A8.5 8.5 0 0 1 8.5 3.5a8.5 8.5 0 1 0 12 12Z" />,
  back: <path d="m15 18-6-6 6-6M9 12h11" />,
  plus: <path d="M12 5v14M5 12h14" />,
  code: (
    <>
      <path d="m8 8-4 4 4 4M16 8l4 4-4 4" />
      <path d="m14 5-4 14" />
    </>
  ),
  logout: (
    <>
      <path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4" />
      <path d="m15 8 4 4-4 4M9 12h10" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  mission: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </>
  ),
};

export function AppIcon({ name, size = 20 }) {
  const icon = ICONS[name] || ICONS.overview;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {icon}
    </svg>
  );
}

export default AppIcon;
