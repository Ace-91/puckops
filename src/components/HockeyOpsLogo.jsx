export default function HockeyOpsLogo({ size = 48 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="puckGrad" cx="40%" cy="35%" r="60%">
          <stop offset="0%" stopColor="#555" />
          <stop offset="50%" stopColor="#222" />
          <stop offset="100%" stopColor="#111" />
        </radialGradient>
        <radialGradient id="puckTop" cx="40%" cy="30%" r="60%">
          <stop offset="0%" stopColor="#666" />
          <stop offset="100%" stopColor="#1a1a1a" />
        </radialGradient>
        <linearGradient id="goldRing" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f0c040" />
          <stop offset="40%" stopColor="#d4af37" />
          <stop offset="100%" stopColor="#a07820" />
        </linearGradient>
        <linearGradient id="grayRing" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#888" />
          <stop offset="50%" stopColor="#444" />
          <stop offset="100%" stopColor="#222" />
        </linearGradient>
      </defs>

      {/* Back half of gray orbital ring */}
      <ellipse cx="50" cy="55" rx="42" ry="16" fill="none" stroke="url(#grayRing)" strokeWidth="5"
        strokeDasharray="132 132" strokeDashoffset="66" opacity="0.85" />

      {/* Back half of gold orbital ring */}
      <ellipse cx="50" cy="45" rx="38" ry="14" fill="none" stroke="url(#goldRing)" strokeWidth="5"
        strokeDasharray="120 120" strokeDashoffset="60" opacity="0.9"
        transform="rotate(-15, 50, 45)" />

      {/* Puck body (side) */}
      <ellipse cx="50" cy="56" rx="22" ry="8" fill="url(#puckGrad)" />
      {/* Puck top face */}
      <ellipse cx="50" cy="48" rx="22" ry="8" fill="url(#puckTop)" />
      {/* Puck connecting side */}
      <rect x="28" y="48" width="44" height="8" fill="#1e1e1e" />
      {/* Puck top sheen */}
      <ellipse cx="44" cy="46" rx="8" ry="3" fill="rgba(255,255,255,0.07)" />

      {/* Front half of gold orbital ring */}
      <ellipse cx="50" cy="45" rx="38" ry="14" fill="none" stroke="url(#goldRing)" strokeWidth="5"
        strokeDasharray="120 120" strokeDashoffset="-60" opacity="0.95"
        transform="rotate(-15, 50, 45)" />

      {/* Front half of gray orbital ring */}
      <ellipse cx="50" cy="55" rx="42" ry="16" fill="none" stroke="url(#grayRing)" strokeWidth="5"
        strokeDasharray="132 132" strokeDashoffset="-66" opacity="0.8" />
    </svg>
  );
}