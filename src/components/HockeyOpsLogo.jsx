export default function HockeyOpsLogo({ size = 40 }) {
  const w = size;
  const h = size;

  return (
    <svg width={w} height={h} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Net back wall */}
      <rect x="8" y="14" width="64" height="42" rx="3" fill="#0a0a0a" stroke="#888" strokeWidth="2.5"/>

      {/* Net mesh - horizontal lines */}
      {[22, 30, 38, 46].map((y, i) => (
        <line key={`h${i}`} x1="8" y1={y} x2="72" y2={y} stroke="#444" strokeWidth="0.8"/>
      ))}
      {/* Net mesh - vertical lines */}
      {[18, 28, 38, 48, 58, 68].map((x, i) => (
        <line key={`v${i}`} x1={x} y1="14" x2={x} y2="56" stroke="#444" strokeWidth="0.8"/>
      ))}

      {/* Calendar gold overlay on net */}
      <rect x="22" y="20" width="36" height="30" rx="3" fill="#d4af37" fillOpacity="0.18" stroke="#d4af37" strokeWidth="1.5"/>
      {/* Calendar header */}
      <rect x="22" y="20" width="36" height="8" rx="2" fill="#d4af37" fillOpacity="0.55"/>
      {/* Calendar hook pegs */}
      <rect x="29" y="18" width="2.5" height="5" rx="1.2" fill="#d4af37"/>
      <rect x="48.5" y="18" width="2.5" height="5" rx="1.2" fill="#d4af37"/>
      {/* Calendar dots grid */}
      {[
        [28,34],[35,34],[42,34],[49,34],[56,34],
        [28,40],[35,40],[42,40],[49,40],[56,40],
        [28,46],[35,46],[42,46],[49,46],
      ].map(([cx, cy], i) => (
        <rect key={i} x={cx - 2} y={cy - 2} width="4" height="4" rx="1" fill="#d4af37" fillOpacity="0.8"/>
      ))}

      {/* Net frame - top crossbar (gold) */}
      <rect x="6" y="12" width="68" height="5" rx="2" fill="url(#goldBar)"/>
      {/* Left post */}
      <rect x="6" y="12" width="5" height="48" rx="2" fill="url(#silverPost)"/>
      {/* Right post */}
      <rect x="69" y="12" width="5" height="48" rx="2" fill="url(#silverPost)"/>
      {/* Goal line / ice */}
      <rect x="6" y="58" width="68" height="4" rx="2" fill="url(#silverPost)"/>

      {/* Skate blade / red crease line */}
      <rect x="16" y="62" width="48" height="2.5" rx="1.2" fill="#c0c0c0" fillOpacity="0.4"/>

      <defs>
        <linearGradient id="goldBar" x1="6" y1="12" x2="74" y2="17" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#b8860b"/>
          <stop offset="40%" stopColor="#d4af37"/>
          <stop offset="70%" stopColor="#ffe066"/>
          <stop offset="100%" stopColor="#b8860b"/>
        </linearGradient>
        <linearGradient id="silverPost" x1="0" y1="0" x2="10" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#888"/>
          <stop offset="40%" stopColor="#e0e0e0"/>
          <stop offset="70%" stopColor="#c0c0c0"/>
          <stop offset="100%" stopColor="#777"/>
        </linearGradient>
      </defs>
    </svg>
  );
}