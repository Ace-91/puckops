// Puck with silver lining + gold calendar icon SVG logo
export default function HockeyOpsLogo({ size = 36 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Puck body - dark */}
      <ellipse cx="18" cy="20" rx="15" ry="8" fill="#1a1a1a" />
      {/* Puck silver rim */}
      <ellipse cx="18" cy="20" rx="15" ry="8" fill="none" stroke="#c0c0c0" strokeWidth="2" />
      <ellipse cx="18" cy="16" rx="15" ry="8" fill="#111" />
      <ellipse cx="18" cy="16" rx="15" ry="8" fill="none" stroke="#c0c0c0" strokeWidth="1.5" />
      {/* Puck top face */}
      <ellipse cx="18" cy="16" rx="13" ry="6.5" fill="#222" />
      {/* Gold calendar icon on puck face */}
      {/* Calendar border */}
      <rect x="12" y="11" width="12" height="10" rx="1.5" fill="none" stroke="#d4af37" strokeWidth="1.3" />
      {/* Calendar top bar */}
      <rect x="12" y="11" width="12" height="3" rx="1.5" fill="#d4af37" opacity="0.85" />
      {/* Calendar hooks */}
      <line x1="15" y1="10" x2="15" y2="13" stroke="#d4af37" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="21" y1="10" x2="21" y2="13" stroke="#d4af37" strokeWidth="1.2" strokeLinecap="round" />
      {/* Calendar dots */}
      <rect x="14.5" y="16" width="1.5" height="1.5" rx="0.4" fill="#d4af37" />
      <rect x="17.25" y="16" width="1.5" height="1.5" rx="0.4" fill="#d4af37" />
      <rect x="20" y="16" width="1.5" height="1.5" rx="0.4" fill="#d4af37" />
      <rect x="14.5" y="18.2" width="1.5" height="1.5" rx="0.4" fill="#d4af37" />
      <rect x="17.25" y="18.2" width="1.5" height="1.5" rx="0.4" fill="#d4af37" />
      {/* Side of puck - silver sheen */}
      <path d="M3 16 Q3 24 18 28 Q33 24 33 16" fill="none" stroke="#c0c0c0" strokeWidth="1.2" opacity="0.5" />
    </svg>
  );
}