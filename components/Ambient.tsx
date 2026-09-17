"use client";
import { useEffect, useRef } from "react";

/**
 * The background: a slow rotating beam and two drifting pools of light, drawn
 * very dim. It is the one ornament on the site and it is the subject's own —
 * a lamp turning over dark water. No grid, nothing that competes with a number.
 */
export default function Ambient() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0, w = 0, h = 0;

    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = cv.clientWidth; h = cv.clientHeight;
      cv.width = w * dpr; cv.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const light = () => document.documentElement.dataset.theme === "light";

    const pool = (x: number, y: number, r: number, rgb: string, a: number) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${rgb},${a})`);
      g.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    };

    const draw = (t: number) => {
      const s = t / 1000;
      const dim = light() ? 0.42 : 1;
      ctx.clearRect(0, 0, w, h);

      // two pools of light, drifting on different periods so they never repeat
      pool(w * (0.22 + 0.06 * Math.sin(s / 19)), h * (0.16 + 0.05 * Math.cos(s / 23)),
           Math.max(w, h) * 0.5, "78,230,168", 0.05 * dim);
      pool(w * (0.82 + 0.05 * Math.cos(s / 27)), h * (0.34 + 0.06 * Math.sin(s / 17)),
           Math.max(w, h) * 0.42, "87,199,255", 0.035 * dim);

      // the beam: one wedge sweeping from the lamp, slow enough to read as weather
      const cx = w * 0.5, cy = -h * 0.28;
      const ang = (s / 26) % (Math.PI * 2);
      const reach = Math.hypot(w, h) * 1.25;
      const spread = 0.30;
      const g = ctx.createLinearGradient(cx, cy, cx + Math.cos(ang) * reach, cy + Math.sin(ang) * reach);
      g.addColorStop(0, `rgba(78,230,168,${0.05 * dim})`);
      g.addColorStop(0.55, `rgba(78,230,168,${0.018 * dim})`);
      g.addColorStop(1, "rgba(78,230,168,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, reach, ang - spread, ang + spread);
      ctx.closePath();
      ctx.fill();

      if (!reduced) raf = requestAnimationFrame(draw);
    };

    size();
    draw(0);
    if (reduced) cancelAnimationFrame(raf);
    const ro = new ResizeObserver(() => { size(); if (reduced) draw(0); });
    ro.observe(cv);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className="fixed inset-0 -z-10 pointer-events-none"
      style={{ width: "100%", height: "100%" }}
    />
  );
}
