// PuckOps logo — a hockey puck with a stylized "P" and gold accent ring
export default function HockeyOpsLogo({ size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="puckGrad" x1="10" y1="28" x2="70" y2="52" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#2a2a2a"/>
          <stop offset="50%" stopColor="#1a1a1a"/>
          <stop offset="100%" stopColor="#111"/>
        </linearGradient>
        <linearGradient id="goldRing" x1="0" y1="0" x2="80" y2="80" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#b8860b"/>
          <stop offset="35%" stopColor="#d4af37"/>
          <stop offset="65%" stopColor="#ffe066"/>
          <stop offset="100%" stopColor="#b8860b"/>
        </linearGradient>
        <linearGradient id="silverShine" x1="20" y1="30" x2="60" y2="50" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#888"/>
          <stop offset="40%" stopColor="#e8e8e8"/>
          <stop offset="70%" stopColor="#c0c0c0"/>
          <stop offset="100%" stopColor="#777"/>
        </linearGradient>
        <linearGradient id="stickGrad" x1="0" y1="0" x2="1" y2="0" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#c0c0c0"/>
          <stop offset="60%" stopColor="#e8e8e8"/>
          <stop offset="100%" stopColor="#999"/>
        </linearGradient>
      </defs>

      {/* Hockey stick shaft — diagonal, behind puck */}
      <rect x="52" y="8" width="7" height="52" rx="3.5"
        fill="url(#silverShine)" transform="rotate(22 56 34)"/>
      {/* Stick blade */}
      <rect x="54" y="54" width="18" height="5" rx="2.5"
        fill="url(#silverShine)" transform="rotate(22 63 56)"/>

      {/* Puck shadow */}
      <ellipse cx="40" cy="54" rx="28" ry="6" fill="#000" fillOpacity="0.35"/>

      {/* Puck body — flat cylinder top */}
      <ellipse cx="40" cy="47" rx="27" ry="8" fill="#111"/>
      {/* Puck side */}
      <rect x="13" y="33" width="54" height="14" rx="0" fill="url(#puckGrad)"/>
      {/* Puck top face */}
      <ellipse cx="40" cy="33" rx="27" ry="8.5" fill="url(#puckGrad)"/>

      {/* Gold outer ring on top face */}
      <ellipse cx="40" cy="33" rx="27" ry="8.5" fill="none" stroke="url(#goldRing)" strokeWidth="2.5"/>
      {/* Inner silver ring */}
      <ellipse cx="40" cy="33" rx="21" ry="6.5" fill="none" stroke="url(#silverShine)" strokeWidth="1.2"/>

      {/* "P" letter on puck face */}
      <text x="40" y="37.5" textAnchor="middle" fontSize="12" fontWeight="900"
        fontFamily="Arial, sans-serif" fill="url(#goldRing)" letterSpacing="0">P</text>

      {/* Puck bottom edge highlight */}
      <ellipse cx="40" cy="47" rx="27" ry="8" fill="none" stroke="#333" strokeWidth="1.5"/>

      {/* Gold accent stripe on puck side */}
      <rect x="13" y="38" width="54" height="2.5" fill="url(#goldRing)" fillOpacity="0.5"/>
    </svg>
  );
}