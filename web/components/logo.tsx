/** Continuum mark: a continuous path linking two nodes and ending in a check (knowledge carried over and verified). */
export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" role="img" aria-label="Continuum logo" className="shrink-0">
      <rect width="40" height="40" rx="10" fill="#1d4ed8" />
      <path d="M9 26 C9 13 20 13 20 20 C20 27 31 27 31 14" fill="none" stroke="white" strokeWidth="2.8" strokeLinecap="round" />
      <circle cx="9" cy="26" r="3.4" fill="white" />
      <circle cx="31" cy="14" r="5" fill="white" />
      <path d="M28.6 14.2 l1.7 1.7 l3.2 -3.4" fill="none" stroke="#1d4ed8" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
