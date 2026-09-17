"use client";
import { useEffect, useRef, useState } from "react";
import {
  createChart, ColorType, CrosshairMode, LineStyle,
  type IChartApi, type ISeriesApi, type UTCTimestamp, type IPriceLine,
} from "lightweight-charts";
import type { Candle } from "@/lib/bitget";

type Line = { price: number; color: string; title: string; dashed?: boolean };
type OHLC = { o: number; h: number; l: number; c: number } | null;

const THEMES = {
  dark: { text: "#5a5e68", grid: "rgba(255,255,255,0.045)", border: "rgba(255,255,255,0.09)", up: "#4ee6a8", down: "#ff5d6c" },
  light: { text: "#8a94a3", grid: "rgba(16,21,31,0.06)", border: "rgba(16,21,31,0.12)", up: "#0b8f62", down: "#c9334a" },
};

const f = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function Chart({ candles, lines, height = 320 }: {
  candles: Candle[]; lines: Line[]; height?: number;
}) {
  const box = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const series = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const drawn = useRef<IPriceLine[]>([]);
  const [hover, setHover] = useState<OHLC>(null);
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const read = () => setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark");
    read();
    const mo = new MutationObserver(read);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => mo.disconnect();
  }, []);

  useEffect(() => {
    if (!box.current) return;
    const C = THEMES[theme];
    const c = createChart(box.current, {
      height,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: C.text,
        fontFamily: "var(--font-mono), monospace",
        fontSize: 10,
      },
      grid: { vertLines: { color: C.grid }, horzLines: { color: C.grid } },
      rightPriceScale: { borderColor: C.border, scaleMargins: { top: 0.14, bottom: 0.12 } },
      timeScale: { borderColor: C.border, timeVisible: true, secondsVisible: false, rightOffset: 3 },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: C.up, width: 1, style: LineStyle.Dotted, labelBackgroundColor: C.up },
        horzLine: { color: C.up, width: 1, style: LineStyle.Dotted, labelBackgroundColor: C.up },
      },
      handleScale: { axisPressedMouseMove: { time: true, price: false } },
    });
    const s = c.addCandlestickSeries({
      upColor: C.up, downColor: C.down,
      borderUpColor: C.up, borderDownColor: C.down,
      wickUpColor: C.up, wickDownColor: C.down,
    });
    c.subscribeCrosshairMove((p) => {
      const d = p.seriesData.get(s) as { open: number; high: number; low: number; close: number } | undefined;
      setHover(d ? { o: d.open, h: d.high, l: d.low, c: d.close } : null);
    });
    chart.current = c; series.current = s; drawn.current = [];

    const ro = new ResizeObserver(() => box.current && c.applyOptions({ width: box.current.clientWidth }));
    ro.observe(box.current);
    c.applyOptions({ width: box.current.clientWidth });
    return () => { ro.disconnect(); c.remove(); chart.current = null; series.current = null; drawn.current = []; };
  }, [height, theme]);

  useEffect(() => {
    const s = series.current;
    if (!s || !candles.length) return;
    s.setData(candles.map((k) => ({
      time: Math.floor(k.t / 1000) as UTCTimestamp,
      open: k.o, high: k.h, low: k.l, close: k.c,
    })));
    chart.current?.timeScale().fitContent();
  }, [candles, theme]);

  useEffect(() => {
    const s = series.current;
    if (!s) return;
    for (const l of drawn.current) s.removePriceLine(l);
    drawn.current = lines.filter((l) => Number.isFinite(l.price)).map((l) =>
      s.createPriceLine({
        price: l.price, color: l.color, lineWidth: 1,
        lineStyle: l.dashed ? LineStyle.Dashed : LineStyle.Solid,
        axisLabelVisible: true, title: l.title,
      })
    );
  }, [lines, candles, theme]);

  const last = candles.length ? candles[candles.length - 1] : null;
  const bar = hover ?? (last ? { o: last.o, h: last.h, l: last.l, c: last.c } : null);

  return (
    <div className="relative">
      {bar && (
        <div className="absolute top-2 left-3 z-10 flex gap-3.5 pointer-events-none">
          {([["O", bar.o], ["H", bar.h], ["L", bar.l], ["C", bar.c]] as [string, number][]).map(([k, v]) => (
            <span key={k} className="tnum text-[10.5px]">
              <span className="text-[var(--color-faint)]">{k}</span>{" "}
              <span style={{ color: bar.c >= bar.o ? "var(--color-mint)" : "var(--color-danger)" }}>{f(v)}</span>
            </span>
          ))}
        </div>
      )}
      <div ref={box} style={{ width: "100%" }} />
      {!candles.length && (
        <div className="absolute inset-0 grid place-items-center label">loading candles…</div>
      )}
    </div>
  );
}
