import type { Metadata } from "next";
import { Fraunces, Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";
import Ambient from "@/components/Ambient";
import { DeskProvider } from "@/lib/desk";

const display = Fraunces({
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});
const sans = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const mono = JetBrains_Mono({ weight: ["400", "500", "600"], subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: "Lighthouse — the dark-hours desk for tokenized US stocks",
  description:
    "Bitget's rToken prices outside US hours are indicative quotes, not transaction prices. Lighthouse measures how much of tonight's quote survives to the 04:00 ET reopen — and what that gap does to your collateral.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body>
        {/* Stamp the theme before first paint so the page never flashes the wrong one. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("lh-theme");if(!t)t=window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";document.documentElement.dataset.theme=t;}catch(e){document.documentElement.dataset.theme="dark";}})();`,
          }}
        />
        <Ambient />
        <DeskProvider>
          <Nav />
          {children}
        </DeskProvider>
      </body>
    </html>
  );
}
