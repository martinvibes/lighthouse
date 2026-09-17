import type { Metadata } from "next";
import { Instrument_Serif, Archivo, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { DeskProvider } from "@/lib/desk";
import Shell from "@/components/Shell";

const display = Instrument_Serif({ subsets: ["latin"], weight: "400", variable: "--font-display" });
const ui = Archivo({ subsets: ["latin"], variable: "--font-ui" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Lighthouse — dark-hours desk for tokenized US stocks",
  description:
    "Bitget's rToken prices outside US hours are indicative quotes, not transaction prices. Lighthouse measures how much of tonight's quote survives to the 04:00 ET reopen.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${ui.variable} ${mono.variable}`}>
      <body>
        <DeskProvider><Shell>{children}</Shell></DeskProvider>
      </body>
    </html>
  );
}
