"use client";
import { useEffect, useRef } from "react";
import {
  createChart, ColorType, CrosshairMode, LineStyle,
  type IChartApi, type ISeriesApi, type UTCTimestamp, type IPriceLine,
} from "lightweight-charts";
import type { Candle } from "@/lib/bitget";

type Line = { price: number; color: string; title: string; dashed?: boolean };

const C = {
  faint: "#5a5e68", line: "rgba(255,255,255,0.05)", lineBright: "rgba(255,255,255,0.1)",
  mint: "#4ee6a8", danger: "#ff5d6c",
};

export default function Chart({ candles, lines, height = 340 }: {
  candles: Candle[]; lines: Line[]; height?: number;
}) {
  const box = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const series = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const drawn = useRef<IPriceLine[]>([]);

  useEffect(() => {
    if (!box.current) return;
    const c = createChart(box.current, {
      height,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: C.faint,
        fontFamily: "var(--font-mono), monospace",
        fontSize: 10,
      },
      grid: { vertLines: { color: C.line }, horzLines: { color: C.line } },
      rightPriceScale: { borderColor: C.lineBright, scaleMargins: { top: 0.12, bottom: 0.12 } },
      timeScale: { borderColor: C.lineBright, timeVisible: true, secondsVisible: false, rightOffset: 4 },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: C.mint, width: 1, style: LineStyle.Dotted, labelBackgroundColor: C.mint },
        horzLine: { color: C.mint, width: 1, style: LineStyle.Dotted, labelBackgroundColor: C.mint },
      },
      handleScale: { axisPressedMouseMove: { time: true, price: false } },
    });
    const s = c.addCandlestickSeries({
      upColor: C.mint, downColor: C.danger,
      borderUpColor: C.mint, borderDownColor: C.danger,
      wickUpColor: C.mint, wickDownColor: C.danger,
    });
    chart.current = c; series.current = s;
    const ro = new ResizeObserver(() => box.current && c.applyOptions({ width: box.current.clientWidth }));
    ro.observe(box.current);
    c.applyOptions({ width: box.current.clientWidth });
    return () => { ro.disconnect(); c.remove(); chart.current = null; series.current = null; drawn.current = []; };
  }, [height]);

  useEffect(() => {
    const s = series.current;
    if (!s || !candles.length) return;
    s.setData(candles.map((k) => ({
      time: Math.floor(k.t / 1000) as UTCTimestamp,
      open: k.o, high: k.h, low: k.l, close: k.c,
    })));
    chart.current?.timeScale().fitContent();
  }, [candles]);

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
  }, [lines, candles]);

  return <div ref={box} style={{ width: "100%" }} />;
}
