"use client";
import { useEffect, useRef } from "react";
import {
  createChart, ColorType, CrosshairMode, LineStyle,
  type IChartApi, type ISeriesApi, type UTCTimestamp, type IPriceLine,
} from "lightweight-charts";
import type { Candle } from "@/lib/bitget";

type Line = { price: number; color: string; title: string; dashed?: boolean };

const css = (v: string) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

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
        textColor: css("--faint"),
        fontFamily: "var(--font-mono), monospace",
        fontSize: 10,
      },
      grid: { vertLines: { color: css("--line-soft") }, horzLines: { color: css("--line-soft") } },
      rightPriceScale: { borderColor: css("--line"), scaleMargins: { top: 0.12, bottom: 0.12 } },
      timeScale: { borderColor: css("--line"), timeVisible: true, secondsVisible: false, rightOffset: 4 },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: css("--lamp"), width: 1, style: LineStyle.Dotted, labelBackgroundColor: css("--lamp") },
        horzLine: { color: css("--lamp"), width: 1, style: LineStyle.Dotted, labelBackgroundColor: css("--lamp") },
      },
      handleScale: { axisPressedMouseMove: { time: true, price: false } },
    });
    const s = c.addCandlestickSeries({
      upColor: css("--up"), downColor: css("--down"),
      borderUpColor: css("--up"), borderDownColor: css("--down"),
      wickUpColor: css("--up"), wickDownColor: css("--down"),
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
