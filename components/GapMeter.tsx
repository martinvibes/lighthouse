/** Where the venue's quote sits against fair value, on the measured error scale. */
export default function GapMeter({ devBps, band }: { devBps: number; band: number }) {
  const span = Math.max(band * 3, Math.abs(devBps) * 1.25, 40);
  const pos = (v: number) => 50 + (v / span) * 50;
  const wide = Math.abs(devBps) > band;
  const c = wide ? "var(--color-danger)" : "var(--color-mint)";
  return (
    <div className="relative h-11">
      <div className="absolute inset-x-0 top-4 h-2.5 rounded-full" style={{ background: "rgba(255,255,255,0.05)" }} />
      <div
        className="absolute top-4 h-2.5 rounded-full"
        style={{
          left: `${pos(-band)}%`, width: `${(band / span) * 100}%`,
          background: "rgba(78,230,168,0.14)", border: "1px solid rgba(78,230,168,0.3)",
        }}
      />
      <div className="absolute top-2.5 left-1/2 w-px h-5" style={{ background: "var(--color-cyan)" }} />
      <div
        className="absolute top-2 w-[3px] h-6 rounded-full"
        style={{ left: `${Math.min(98, Math.max(2, pos(devBps)))}%`, marginLeft: -1.5, background: c, boxShadow: `0 0 12px ${c}` }}
      />
      <span className="label absolute bottom-0 left-0">−{span.toFixed(0)} bps</span>
      <span className="label absolute bottom-0 left-1/2 -translate-x-1/2" style={{ color: "var(--color-cyan)" }}>fair value</span>
      <span className="label absolute bottom-0 right-0">+{span.toFixed(0)} bps</span>
    </div>
  );
}
