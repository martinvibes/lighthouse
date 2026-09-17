/** The mark: a lamp throwing two beams over a tower. Reads at 20px. */
export default function Logo({ size = 34 }: { size?: number }) {
  const id = "lh-beam";
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" role="img" aria-label="Lighthouse">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="var(--lamp)" stopOpacity="0" />
          <stop offset="1" stopColor="var(--lamp)" stopOpacity=".55" />
        </linearGradient>
        <linearGradient id={id + "-l"} x1="1" y1="0" x2="0" y2="0">
          <stop offset="0" stopColor="var(--lamp)" stopOpacity=".55" />
          <stop offset="1" stopColor="var(--lamp)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="32" height="32" rx="8.5" fill="var(--raise)" />
      <rect x="0.5" y="0.5" width="31" height="31" rx="8" fill="none" stroke="var(--line)" />
      <path d="M16 11.5 L32 5.5 L32 17.5 Z" fill={`url(#${id})`} />
      <path d="M16 11.5 L0 5.5 L0 17.5 Z" fill={`url(#${id}-l)`} />
      <path d="M13.1 26.5 L14.3 16.4 L17.7 16.4 L18.9 26.5 Z" fill="none" stroke="var(--text)" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M11.6 26.5 L20.4 26.5" stroke="var(--text)" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="16" cy="11.6" r="3.4" fill="var(--lamp)" />
      <circle cx="16" cy="11.6" r="6" fill="none" stroke="var(--lamp)" strokeOpacity=".28" strokeWidth="1" />
    </svg>
  );
}
