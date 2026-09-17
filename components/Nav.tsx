"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import Logo from "./Logo";
import { useDesk } from "@/lib/desk";

const LINKS = [
  { href: "/", label: "Overview" },
  { href: "/desk", label: "Desk" },
  { href: "/collateral", label: "Collateral" },
  { href: "/research", label: "Research" },
  { href: "/record", label: "Record" },
];

export default function Nav() {
  const path = usePathname();
  const { win } = useDesk();
  return (
    <motion.nav
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="sticky top-0 z-50 backdrop-blur-xl"
      style={{
        background: "linear-gradient(180deg, rgba(7,8,10,0.9), rgba(7,8,10,0.45))",
        borderBottom: "1px solid var(--color-line)",
      }}
    >
      <div className="max-w-[1480px] mx-auto px-5 md:px-8 h-14 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <Logo />
          <span className="display text-[20px]">
            Light<span className="italic" style={{ color: "var(--color-mint)" }}>house</span>
          </span>
        </Link>

        <div
          className="hidden md:flex absolute left-1/2 -translate-x-1/2 items-center gap-1 rounded-full px-1.5 py-1.5 hairline"
          style={{ background: "rgba(255,255,255,0.025)" }}
        >
          {LINKS.map((l) => {
            const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className="relative px-4 py-1.5 text-[13px] rounded-full transition-colors"
                style={{ color: active ? "#07080a" : "var(--color-muted)" }}
              >
                {active && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-0 rounded-full"
                    style={{ background: "var(--color-mint)" }}
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
                <span className="relative z-10">{l.label}</span>
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {win && (
            <span
              className="hidden sm:inline-flex items-center gap-2 rounded-full px-3 py-1.5 hairline"
              style={{ background: "rgba(255,255,255,0.02)" }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full live-dot"
                style={{ background: win.active ? "var(--color-mint)" : "var(--color-faint)" }}
              />
              <span className="label" style={{ color: win.active ? "var(--color-mint)" : undefined }}>
                {win.active ? "market dark" : "us open"}
              </span>
            </span>
          )}
          <a
            href="https://github.com/martinvibes/lighthouse"
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1.5 text-[13px] text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors hidden sm:block"
          >
            GitHub ↗
          </a>
          <Link
            href="/desk"
            className="rounded-full px-4 py-1.5 text-[13px] font-semibold transition-transform hover:scale-[1.03] active:scale-95"
            style={{ background: "var(--color-mint)", color: "#08080b" }}
          >
            Desk
          </Link>
        </div>
      </div>
    </motion.nav>
  );
}
