/** Continuum mark: a continuous Git path linking two nodes in Soft Graphite & Lavender Haze (#92A9E1) ending in a verified check. */
export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" role="img" aria-label="Continuum logo" className="shrink-0 drop-shadow-xs transition-transform hover:scale-105">
      <defs>
        <linearGradient id="continuum-logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2D3037" />
          <stop offset="100%" stopColor="#1E2025" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="10" fill="url(#continuum-logo-grad)" stroke="#434752" strokeWidth="1" />
      <path d="M9 26 C9 13 20 13 20 20 C20 27 31 27 31 14" fill="none" stroke="#92A9E1" strokeWidth="2.8" strokeLinecap="round" />
      <circle cx="9" cy="26" r="3.4" fill="#92A9E1" />
      <circle cx="31" cy="14" r="5" fill="#16a34a" />
      <path d="M28.6 14.2 l1.7 1.7 l3.2 -3.4" fill="none" stroke="white" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
