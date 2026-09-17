/** The mark: a lamp throwing a beam. Reads at 18px. */
export default function Logo({ size = 28 }: { size?: number }) {
  return (
    <div
      className="rounded-[8px] hairline flex items-center justify-center shrink-0"
      style={{ height: size, width: size, background: "linear-gradient(145deg, rgba(78,230,168,0.18), rgba(87,199,255,0.06))" }}
    >
      <svg width={size * 0.58} height={size * 0.58} viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M8 5.6 L16 2.4 L16 8.8 Z" fill="var(--color-mint)" opacity=".28" />
        <path d="M8 5.6 L0 2.4 L0 8.8 Z" fill="var(--color-mint)" opacity=".28" />
        <path d="M6.3 14 L7.1 8.2 L8.9 8.2 L9.7 14 Z" fill="none" stroke="var(--color-mint)" strokeWidth="1.1" strokeLinejoin="round" />
        <circle cx="8" cy="5.6" r="1.9" fill="var(--color-mint)" style={{ filter: "drop-shadow(0 0 5px var(--color-mint))" }} />
      </svg>
    </div>
  );
}
