"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Logo from "./Logo";
import { useDesk } from "@/lib/desk";
import { fmtET } from "@/lib/time";

const NAV = [
  { href: "/", label: "Desk", note: "Live board", d: "M2 12h3l2-6 3 12 2.5-8 1.8 4H16" },
  { href: "/collateral", label: "Collateral", note: "Margin under an indicative mark", d: "M8 2 3 5v4.5C3 12.6 5.1 15 8 16c2.9-1 5-3.4 5-6.5V5Z" },
  { href: "/research", label: "Research", note: "Ask the desk", d: "M2.5 3.5h11v8h-6l-3 2.5v-2.5h-2Z" },
  { href: "/record", label: "The record", note: "20,934 graded forecasts", d: "M3 13V7m4.5 6V3m4.5 10V9" },
];

const TITLES: Record<string, string> = {
  "/": "Dark-hours desk",
  "/collateral": "Collateral under an indicative mark",
  "/research": "Research",
  "/record": "The measured record",
};

function Clock() {
  const { win } = useDesk();
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!win || !now) return <span className="num big dim">—:—:—</span>;
  const ms = Math.max(0, +win.end - +now);
  const h = Math.floor(ms / 3.6e6), m = Math.floor((ms % 3.6e6) / 6e4), s = Math.floor((ms % 6e4) / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return <span className="num big" style={{ color: win.active ? "var(--lamp)" : "var(--dim)" }}>
    {pad(h)}:{pad(m)}:{pad(s)}
  </span>;
}

function Theme() {
  const [dark, setDark] = useState<boolean | null>(null);
  useEffect(() => {
    const saved = (() => { try { return localStorage.getItem("lh-theme"); } catch { return null; } })();
    const d = saved ? saved === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    setDark(d);
    document.documentElement.dataset.theme = d ? "dark" : "light";
  }, []);
  const flip = () => {
    const d = !dark;
    setDark(d);
    document.documentElement.dataset.theme = d ? "dark" : "light";
    try { localStorage.setItem("lh-theme", d ? "dark" : "light"); } catch { /* private mode */ }
  };
  return (
    <button className="tbtn" onClick={flip} aria-label="Toggle theme">
      <span>{dark === null ? "Theme" : dark ? "Night" : "Day"}</span>
      <span className="label">{dark === null ? "" : dark ? "DARK" : "LIGHT"}</span>
    </button>
  );
}

export default function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { win, updated, rows, band, err } = useDesk();
  const wide = rows.filter((r) => r.wide).length;

  return (
    <div className="shell">
      <aside className="rail">
        <div className="rail-head">
          <Link href="/" className="lockup">
            <Logo />
            <span>
              <div className="lockup-name">Lighthouse</div>
              <div className="lockup-sub">Dark-hours desk</div>
            </span>
          </Link>
        </div>
        <nav className="nav">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={path === n.href ? "on" : ""} title={n.note}>
              <span className="glyph">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d={n.d} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="rail-foot">
          <div className="statebox">
            <div className="label">{win?.active ? "Until US reopen" : "Since last reopen"}</div>
            <div className="big num"><Clock /></div>
            <div className="faint" style={{ fontSize: 11, marginTop: 4 }}>
              {win ? `${win.kind === "weekend" ? "Weekend" : "Overnight"} window · 04:00 ET open` : "…"}
            </div>
          </div>
          <Theme />
          <a className="tbtn" href="https://github.com/martinvibes/lighthouse" target="_blank" rel="noreferrer">
            <span>Source</span><span className="label">GITHUB</span>
          </a>
        </div>
      </aside>

      <main className="stage">
        <div className="topbar">
          <h2>{TITLES[path] ?? "Lighthouse"}</h2>
          {win && (
            win.active
              ? <span className="pill live"><span className="beacon" />Market dark · {(win.elapsed * 100).toFixed(0)}% through</span>
              : <span className="pill"><span className="beacon" />US venues open · replaying last window</span>
          )}
          {band !== null && <span className="pill">Typical error now ±{band} bps</span>}
          {wide > 0 && <span className="pill warn">{wide} quote{wide > 1 ? "s" : ""} outside the band</span>}
          <span className="spacer" />
          {err && <span className="pill warn">{err}</span>}
          {updated && <span className="pill">Updated {fmtET(updated, { hour: "2-digit", minute: "2-digit", second: "2-digit" })} ET</span>}
        </div>
        <div className="body">{children}</div>
      </main>
    </div>
  );
}
