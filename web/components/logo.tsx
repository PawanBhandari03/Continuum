/** Continuum mark: a continuous path linking two nodes, ending in a check (a handover that is carried over and verified). */
export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" role="img" aria-label="Continuum logo" className="shrink-0 drop-shadow-md">
      <defs>
        <linearGradient id="cg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6366f1" />
          <stop offset="0.55" stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#d946ef" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill="url(#cg)" />
      <rect x="0.75" y="0.75" width="38.5" height="38.5" rx="10.25" fill="none" stroke="white" strokeOpacity="0.3" strokeWidth="1.5" />
      {/* the path that continues from one person to the next */}
      <path d="M9 26 C9 13 20 13 20 20 C20 27 31 27 31 14" fill="none" stroke="white" strokeWidth="2.8" strokeLinecap="round" strokeOpacity="0.95" />
      <circle cx="9" cy="26" r="3.4" fill="white" />
      <circle cx="31" cy="14" r="5" fill="white" />
      <path d="M28.6 14.2 l1.7 1.7 l3.2 -3.4" fill="none" stroke="#7c3aed" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
