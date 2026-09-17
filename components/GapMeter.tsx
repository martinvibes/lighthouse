/** Where the venue's quote sits against our fair value, on the measured error scale. */
export default function GapMeter({ devBps, band }: { devBps: number; band: number }) {
  const span = Math.max(band * 3, Math.abs(devBps) * 1.25, 40);
  const pos = (v: number) => 50 + (v / span) * 50;
  const wide = Math.abs(devBps) > band;
  return (
    <div>
      <div style={{ position: "relative", height: 46 }}>
        <div style={{
          position: "absolute", inset: "18px 0 auto", height: 10, borderRadius: 5,
          background: "var(--line-soft)",
        }} />
        <div style={{
          position: "absolute", top: 18, height: 10, borderRadius: 5,
          left: `${pos(-band)}%`, width: `${(band / span) * 100}%`,
          background: "var(--lamp-wash)", border: "1px solid color-mix(in srgb, var(--lamp) 35%, transparent)",
        }} />
        <div style={{ position: "absolute", top: 12, left: "50%", width: 1, height: 22, background: "var(--lamp)" }} />
        <div style={{
          position: "absolute", top: 10, left: `${Math.min(98, Math.max(2, pos(devBps)))}%`,
          width: 3, height: 26, marginLeft: -1.5, borderRadius: 2,
          background: wide ? "var(--down)" : "var(--text)",
          boxShadow: `0 0 0 3px color-mix(in srgb, ${wide ? "var(--down)" : "var(--text)"} 15%, transparent)`,
        }} />
        <div style={{ position: "absolute", bottom: 0, left: 0, fontSize: 10 }} className="label">−{span.toFixed(0)} bps</div>
        <div style={{ position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)" }} className="label">fair value</div>
        <div style={{ position: "absolute", bottom: 0, right: 0 }} className="label">+{span.toFixed(0)} bps</div>
      </div>
    </div>
  );
}
