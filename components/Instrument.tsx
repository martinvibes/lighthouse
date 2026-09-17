"use client";
import { useEffect, useRef } from "react";
import { createChart, ColorType, type IChartApi } from "lightweight-charts";
import type { Candle } from "@/lib/bitget";
import type { Row } from "@/lib/model";
import { fmtET, type DarkWindow } from "@/lib/time";

const css = (n: string) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const fmtUsd = (v: number) => (v >= 1000 ? v.toFixed(0) : v.toFixed(2));
const fmtBps = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(0)} bps`;

/** Candles for one name, with the session close and the fair value drawn on. */
export default function Instrument({ row, candles, win, band }: {
  row: Row; candles: Candle[]; win: DarkWindow; band: number | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!ref.current || !candles.length) return;
    const chart = createChart(ref.current, {
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: css("--muted"), fontFamily: "IBM Plex Mono, monospace", fontSize: 11 },
      grid: { vertLines: { color: css("--grid") }, horzLines: { color: css("--grid") } },
      rightPriceScale: { borderColor: css("--hair") },
      timeScale: { borderColor: css("--hair"), timeVisible: true, secondsVisible: false },
      crosshair: { mode: 1 },
      height: 340,
      autoSize: true,
    });
    chartRef.current = chart;
    const s = chart.addCandlestickSeries({
      upColor: css("--sea"), downColor: css("--clay"),
      borderUpColor: css("--sea"), borderDownColor: css("--clay"),
      wickUpColor: css("--sea"), wickDownColor: css("--clay"),
      priceFormat: { type: "price", precision: 2, minMove: 0.01 },
    });
    s.setData(candles.map((c) => ({ time: (c.t / 1000) as never, open: c.o, high: c.h, low: c.l, close: c.c })));
    s.createPriceLine({ price: row.anchor, color: css("--faint"), lineWidth: 1, lineStyle: 2, title: "session close" });
    s.createPriceLine({ price: row.fair, color: css("--lamp"), lineWidth: 2, lineStyle: 0, title: "fair value" });
    if (band) {
      s.createPriceLine({ price: row.fair * (1 + band / 1e4), color: css("--lamp"), lineWidth: 1, lineStyle: 3, title: "" });
      s.createPriceLine({ price: row.fair * (1 - band / 1e4), color: css("--lamp"), lineWidth: 1, lineStyle: 3, title: "" });
    }
    chart.timeScale().fitContent();
    return () => { chart.remove(); chartRef.current = null; };
  }, [row.symbol, candles, row.anchor, row.fair, band]);

  return (
    <div className="chartgrid">
      <div className="panel chartcard">
        <div className="sechead">
          <div>
            <h2 className="serif">{row.ticker}</h2>
            <p className="sub">{row.symbol} · hourly · {fmtET(win.start, { weekday: "short", hour: "2-digit", minute: "2-digit" })} → {fmtET(win.end, { weekday: "short", hour: "2-digit", minute: "2-digit" })} ET</p>
          </div>
          <span className={`flag ${row.wide ? "wide" : "ok"}`}>{row.wide ? "outside band" : "inside band"}</span>
        </div>
        <div id="tvchart" ref={ref} />
        <div className="legend">
          <span><i className="swatch" style={{ background: "var(--faint)" }} />Last session close</span>
          <span><i className="swatch" style={{ background: "var(--lamp)" }} />Lighthouse fair value</span>
          {band ? <span><i className="swatch" style={{ background: "var(--lamp)", opacity: .5 }} />± {band.toFixed(0)} bps calibrated band</span> : null}
        </div>
      </div>
      <div className="panel chartcard">
        <h3 className="serif" style={{ fontSize: 20, marginBottom: 14 }}>What the desk sees</h3>
        <div className="kv">
          <div className="kvrow"><span className="k">Last session close</span><span className="v">{fmtUsd(row.anchor)}</span></div>
          <div className="kvrow"><span className="k">Venue quote now</span><span className="v">{fmtUsd(row.quote)}</span></div>
          <div className="kvrow"><span className="k">Quote has moved</span><span className="v" style={{ color: row.quoteRet >= 0 ? "var(--sea)" : "var(--clay)" }}>{fmtBps(row.quoteRet * 1e4)}</span></div>
          <div className="kvrow"><span className="k">Lighthouse fair value</span><span className="v" style={{ color: "var(--lamp)" }}>{fmtUsd(row.fair)}</span></div>
          <div className="kvrow"><span className="k">Quote − fair</span><span className="v" style={{ color: row.wide ? "var(--clay)" : undefined }}>{fmtBps(row.devBps)}</span></div>
          <div className="kvrow"><span className="k">Calibrated band</span><span className="v">± {band ? band.toFixed(0) : "—"} bps</span></div>
          <div className="kvrow"><span className="k">Factor loading (β)</span><span className="v">{row.beta.toFixed(2)}</span></div>
        </div>
        <p className="note" style={{ marginTop: 16, fontSize: 13 }}>
          {row.wide
            ? `The venue is showing ${fmtBps(row.devBps)} more move than the record supports at this hour of the night. Historically most of that is walked back by the reopen.`
            : `The venue's quote is inside the calibrated band for this hour. Nothing here contradicts the record.`}
        </p>
      </div>
    </div>
  );
}
