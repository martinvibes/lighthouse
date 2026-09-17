"use client";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export default function ThemeToggle() {
  const [light, setLight] = useState<boolean | null>(null);

  useEffect(() => setLight(document.documentElement.dataset.theme === "light"), []);

  const flip = () => {
    const next = !light;
    setLight(next);
    document.documentElement.dataset.theme = next ? "light" : "dark";
    try { localStorage.setItem("lh-theme", next ? "light" : "dark"); } catch { /* private mode */ }
  };

  return (
    <button
      onClick={flip}
      aria-label={light ? "Switch to dark" : "Switch to light"}
      className="h-8 w-8 rounded-full hairline flex items-center justify-center text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors shrink-0"
      style={{ background: "rgba(255,255,255,0.025)" }}
    >
      {light === null ? <span className="h-3 w-3 rounded-full" style={{ background: "var(--color-faint)" }} />
        : light ? <Moon size={14} /> : <Sun size={14} />}
    </button>
  );
}
