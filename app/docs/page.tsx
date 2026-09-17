"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useDesk } from "@/lib/desk";

const SECTIONS = [
  ["what", "What this is"],
  ["window", "The dark window"],
  ["model", "How fair value is built"],
  ["validation", "How it was validated"],
  ["wrong", "What we got wrong"],
  ["collateral", "The collateral arithmetic"],
  ["analyst", "The analyst"],
  ["data", "Data and reproduction"],
  ["limits", "Limits"],
] as const;

export default function Docs() {
  const { cal, led } = useDesk();
  const [active, setActive] = useState<string>("what");

  useEffect(() => {
    const obs = new IntersectionObserver(
      (es) => es.forEach((e) => e.isIntersecting && setActive(e.target.id)),
      { rootMargin: "-20% 0px -70% 0px" }
    );
    SECTIONS.forEach(([id]) => {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, []);

  const H = led?.summary.by_horizon;
  const g = cal?.weekend_gap;

  return (
    <main className="relative min-h-screen px-4 md:px-6 py-8 max-w-[1480px] mx-auto z-10">
      <div className="grid-atmos fixed inset-0 -z-10 opacity-25" />

      <motion.header initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}
                     className="max-w-[760px]">
        <div className="label mb-4">documentation</div>
        <h1 className="display text-[clamp(32px,5.2vw,54px)] leading-[1.02]">
          Everything behind the number,{" "}
          <span className="italic" style={{ color: "var(--color-mint)" }}>written down.</span>
        </h1>
        <p className="text-[15px] text-[var(--color-muted)] leading-relaxed mt-5">
          Lighthouse makes one claim: that it can estimate where a tokenized US equity will reopen better than
          the quote Bitget is showing while the US market is shut. This page is the whole method, the whole
          validation, and the places it fails — so the claim can be argued with rather than believed.
        </p>
      </motion.header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-10">
        {/* ── contents ── */}
        <nav className="lg:col-span-3 order-2 lg:order-1">
          <div className="lg:sticky lg:top-20 flex flex-col gap-1">
            <div className="label mb-2">contents</div>
            {SECTIONS.map(([id, label], i) => (
              <a key={id} href={`#${id}`}
                 className="flex items-baseline gap-2.5 py-1.5 text-[13px] transition-colors"
                 style={{ color: active === id ? "var(--color-mint)" : "var(--color-muted)" }}>
                <span className="tnum text-[10px] opacity-60">{String(i + 1).padStart(2, "0")}</span>
                {label}
              </a>
            ))}
            <div className="hairline rounded-xl px-4 py-3.5 mt-5" style={{ background: "rgba(255,255,255,0.02)" }}>
              <div className="label mb-2">the artifacts</div>
              <div className="flex flex-col gap-1.5">
                <a href="/ledger.csv" download className="text-[12.5px] hover:text-[var(--color-mint)] transition-colors">
                  ledger.csv — every graded forecast ↓
                </a>
                <a href="/calibration.json" target="_blank" rel="noreferrer" className="text-[12.5px] hover:text-[var(--color-mint)] transition-colors">
                  calibration.json — the frozen model ↗
                </a>
                <a href="/tails.json" target="_blank" rel="noreferrer" className="text-[12.5px] hover:text-[var(--color-mint)] transition-colors">
                  tails.json — measured error tails ↗
                </a>
                <a href="https://github.com/martinvibes/lighthouse" target="_blank" rel="noreferrer"
                   className="text-[12.5px] hover:text-[var(--color-mint)] transition-colors">
                  source, tests and scripts ↗
                </a>
              </div>
            </div>
          </div>
        </nav>

        {/* ── body ── */}
        <div className="lg:col-span-9 order-1 lg:order-2 flex flex-col gap-14 max-w-[760px]">
          <S id="what" n="01" title="What this is">
            <P>
              Bitget lists rTokens: tokenized US equities backed 1:1 through Reality Protocol, with roughly 1,650
              symbols live. During US trading hours an order routes through to NYSE or Nasdaq and the price you
              see is a real transaction price. Outside those hours it is not. Bitget says so plainly in its own
              documentation: the price shown is an <B>indicative quote from market makers, not a transaction
              price</B>.
            </P>
            <P>
              That distinction is doing a lot of work, because those quotes are not decorative. They mark your
              collateral in the unified account. They set the number you see when you decide whether to hold
              through the night. Lighthouse exists to answer one question about them: how much of tonight&apos;s
              quote will still be true when the market actually reopens?
            </P>
            <Callout>
              This is a measurement desk, not a signal service. Nothing here is a trade instruction and nothing
              here places an order. There is no exchange key anywhere in the codebase — every figure comes from
              Bitget&apos;s public market endpoints.
            </Callout>
          </S>

          <S id="window" n="02" title="The dark window">
            <P>
              The obvious framing is wrong, and getting it wrong roughly triples every error figure on this site.
              US equities do not stop trading at 16:00 ET. Extended hours run <B>04:00 to 20:00 ET</B>, so the
              stretch from the closing bell to the next morning is mostly still quoted by real US venues.
            </P>
            <P>
              The genuinely dark window — no US venue of any kind quoting, only Bitget&apos;s market makers — is{" "}
              <B>20:00 to 04:00 ET</B>. That is the eight-hour span this desk models. The 19:00 ET hourly bar
              closes at 20:00 and gives us the anchor; the 04:00 ET bar is the reopen we grade against. Friday
              20:00 to Monday 04:00 is folded into one long weekend window, which behaves very differently.
            </P>
            <Grid>
              <Cell k="anchor" v="20:00 ET" s="close of the 19:00 hourly bar" />
              <Cell k="graded against" v="04:00 ET" s="pre-market reopen" />
              <Cell k="overnight span" v="8 hours" s="no US venue quoting" />
              <Cell k="weekend span" v="56 hours" s="folded into one window" />
            </Grid>
          </S>

          <S id="model" n="03" title="How fair value is built">
            <P>
              Every rToken&apos;s overnight move splits into two parts. Some of it is the whole tape moving together —
              a futures drift, a macro print, general risk appetite. The rest is specific to the name. We
              separate them, because they survive to the reopen at very different rates.
            </P>
            <Steps
              items={[
                ["The common move", "Take the median return across every name on the board since its 20:00 close. The median, not the mean, so a single stub quote cannot drag the tape."],
                ["Each name's share of it", "Multiply by that name's beta, fitted on closed windows rather than assumed to be 1.0."],
                ["What's left is idiosyncratic", "The quote's move minus its share of the common move."],
                ["Shrink both, separately", "Each component is multiplied by its own weight — around 0.85 on the common move and 0.70 on the name-specific one at midnight. A weight below 1.0 means the quote is overshooting and we pull it back toward the close."],
                ["Fair value", "The 20:00 close, moved by the shrunk components. Every figure on the board is that number against the live quote."],
              ]}
            />
            <P>
              The weights are not constant across the night. They are fitted per elapsed bucket, because a quote
              two hours into the window and a quote ten minutes before the reopen deserve very different amounts
              of trust. Fitting minimises <B>median absolute error</B> by coordinate descent, not squared error
              by least squares — overnight returns have fat tails, and squared error would let a handful of gap
              nights dictate the weights for every ordinary one.
            </P>
          </S>

          <S id="validation" n="04" title="How it was validated">
            <P>
              The single guarantee this project rests on: <B>no forecast is ever scored by a model that was
              allowed to see it</B>. For each window we refit on the trailing 40 windows that had already closed,
              then score the next one. Walk-forward, never in-sample. There is a test in the repository whose
              only job is to assert that the window being scored never appears in its own training set.
            </P>
            {H && (
              <Table
                head={["into the window", "close held", "venue quote", "lighthouse"]}
                rows={[
                  ["25% · ≈22:00 ET", `${H["0.25"].last_close_medae.toFixed(1)}`, `${H["0.25"].venue_medae.toFixed(1)}`, `${H["0.25"].lighthouse_medae.toFixed(1)}`],
                  ["50% · ≈00:00 ET", `${H["0.50"].last_close_medae.toFixed(1)}`, `${H["0.50"].venue_medae.toFixed(1)}`, `${H["0.50"].lighthouse_medae.toFixed(1)}`],
                  ["75% · ≈02:00 ET", `${H["0.75"].last_close_medae.toFixed(1)}`, `${H["0.75"].venue_medae.toFixed(1)}`, `${H["0.75"].lighthouse_medae.toFixed(1)}`],
                  ["90% · ≈03:10 ET", `${H["0.90"].last_close_medae.toFixed(1)}`, `${H["0.90"].venue_medae.toFixed(1)}`, `${H["0.90"].lighthouse_medae.toFixed(1)}`],
                ]}
                note="median absolute error against the 04:00 ET reopen, in basis points — lower is better"
              />
            )}
            <P>
              Across {led ? led.summary.n_rows.toLocaleString() : "20,934"} graded forecasts on{" "}
              {cal?.n_windows.overnight ?? "—"} closed windows, Lighthouse beats the venue&apos;s own quote on
              roughly 54 to 56% of individual forecasts. That is a real edge and a modest one, and we would
              rather publish it at that size than dress it up.
            </P>
          </S>

          <S id="wrong" n="05" title="What we got wrong">
            <P>
              Three findings contradicted what we expected going in. All three are in the ledger, and none were
              removed for being inconvenient.
            </P>
            <Steps
              items={[
                ["The venue's quote starts out worse than doing nothing", H ? `Two hours into the dark window the venue quote's median error is ${H["0.25"].venue_medae.toFixed(1)} bps against ${H["0.25"].last_close_medae.toFixed(1)} bps for simply assuming the close held. It is not until the last stretch before the reopen that the quote earns its keep.` : "Early in the window the quote is worse than assuming the close held."],
                ["The first version of the model learned to do nothing", "Fitted on a fixed train/test split it converged on weights of almost exactly 1.0 — it had learned the identity function. The cause was assuming stationarity across months of data. Rolling recalibration fixed it, and the failure is why the walk-forward test exists."],
                ["A seventh of the universe has a stale book", "Thirteen of sixty names showed identical prices at the close and the reopen, which is not a forecast being right, it is nobody trading. They are excluded by a minimum-realised-move filter and named in the calibration file."],
              ]}
            />
          </S>

          <S id="collateral" n="06" title="The collateral arithmetic">
            <P>
              rTokens are accepted as collateral in Bitget&apos;s unified account at up to 95%. Between 20:00 and
              04:00 ET that collateral is marked at the indicative quote — so the margin ratio and liquidation
              distance the venue shows you are computed on a price nobody traded on.
            </P>
            <P>
              The <Link href="/collateral" style={{ color: "var(--color-mint)" }}>collateral page</Link> prices
              the gap. Collateral is the mark times the haircut; liquidation is where collateral stops covering
              the debt. We compute your distance to that point twice — once at the venue&apos;s mark, once at fair
              value — and then read the probability of crossing it off the measured error tails for the names you
              actually hold, blended by position size.
            </P>
            <Callout>
              That probability is a count, not a model. It answers &ldquo;how often has the reopen been at least
              this far from our fair value, for these specific names, at this point in the window&rdquo; — taken
              straight from the graded ledger. Correlation between holdings is ignored, which makes it a floor
              rather than a ceiling.
            </Callout>
            {g && (
              <Grid>
                <Cell k="weekend median" v={`${g.median_bps.toFixed(0)} bps`} s="friday close → monday open" />
                <Cell k="weekend p90" v={`${g.p90_bps.toFixed(0)} bps`} s="90th percentile" />
                <Cell k="past 200 bps" v={`${(g.share_over_200bps * 100).toFixed(0)}%`} s="of weekends" />
                <Cell k="haircut room" v="5%" s="at a 95% haircut" />
              </Grid>
            )}
          </S>

          <S id="analyst" n="07" title="The analyst">
            <P>
              The research analyst is an OpenAI-compatible model with no browser, no memory and no prices of its
              own. It receives one message: the desk state — tonight&apos;s full board, each name&apos;s historical
              accuracy and overshoot, the shrinkage weights in force, and the walk-forward error table. That
              context is <Link href="/research" style={{ color: "var(--color-mint)" }}>published verbatim</Link>{" "}
              next to every answer.
            </P>
            <P>
              It answers in four parts — a read, the reasoning, the figures it leaned on, and what would change
              its mind. Then <B>every figure it cites is matched back against the context before rendering</B>.
              Anything the model could not have read there is stripped and the count of what was stripped is
              shown. It is instructed never to say buy or sell, and to say plainly when the context does not
              contain what the question needs.
            </P>
          </S>

          <S id="data" n="08" title="Data and reproduction">
            <P>
              Everything comes from Bitget&apos;s public market endpoints — tickers and hourly candles. No API key,
              no account, no signing. The history endpoint requires an explicit <Code>endTime</Code>, so history
              is paged backwards from now and de-duplicated.
            </P>
            <Table
              head={["artifact", "what it holds"]}
              rows={[
                ["ledger.csv", `${led ? led.summary.n_rows.toLocaleString() : "20,934"} rows: anchor close, venue quote, fair value, realised reopen, and the weights in force for each`],
                ["calibration.json", "the frozen model — edges, lambdas, per-name betas, error bands, weekend statistics"],
                ["tails.json", "measured survival curves per name and per horizon, behind the collateral probability"],
                ["tests/", "including the one asserting no window is ever scored by a model that saw it"],
              ]}
              note="all four published at the links in the sidebar"
            />
            <P>
              The Python side fetches, builds windows, fits and grades. The web side re-implements only the
              forward pass — market factor, shrinkage, band — so the browser can price the live board without a
              server. The numbers on this site are produced by the same arithmetic that produced the ledger.
            </P>
          </S>

          <S id="limits" n="09" title="Limits">
            <Steps
              items={[
                ["The weekend model is not fitted", `Thirty-one weekend windows is too few to fit on without overfitting, so weekend behaviour is reported${g ? ` — median ${g.median_bps.toFixed(0)} bps, p90 ${g.p90_bps.toFixed(0)} bps` : ""} and not modelled. The board applies overnight weights on a weekend and says so.`],
                ["The edge is modest", "Beating the venue on 54 to 56% of forecasts is an edge, not an oracle. On some names the venue's quote is simply better than ours, and those names are published next to the ones we win on."],
                ["Hourly resolution", "Everything is built on hourly bars. A quote that moves and reverts inside an hour is invisible to this desk."],
                ["Thin books distort everything", "Names that barely trade overnight produce error figures that look excellent because nothing happened. They are filtered out, not flattered."],
                ["It cannot see news", "Fair value is built from price alone. An earnings release at 21:00 ET is exactly the situation where the venue's quote deserves more trust than our shrinkage gives it."],
              ]}
            />
          </S>

          <div className="hairline rounded-2xl px-6 py-7 flex items-center gap-5 flex-wrap"
               style={{ background: "rgba(255,255,255,0.02)" }}>
            <div className="flex-1 min-w-[260px]">
              <div className="label mb-2">see it running</div>
              <p className="text-[14px] text-[var(--color-muted)] leading-relaxed">
                The desk prices the live board every 45 seconds against the calibration described above.
              </p>
            </div>
            <Link href="/desk"
                  className="rounded-full px-5 py-2.5 text-[13.5px] font-semibold transition-transform hover:scale-[1.03] active:scale-95"
                  style={{ background: "var(--color-mint)", color: "#08080b" }}>
              Enter the desk →
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

/* ── pieces ─────────────────────────────────────────────────────────────── */
function S({ id, n, title, children }: { id: string; n: string; title: string; children: React.ReactNode }) {
  return (
    <motion.section id={id} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.55 }}
                    className="scroll-mt-24">
      <div className="flex items-baseline gap-3 mb-5 pb-3 border-b border-[var(--color-line)]">
        <span className="tnum text-[11px]" style={{ color: "var(--color-mint)" }}>{n}</span>
        <h2 className="display text-[26px] leading-tight">{title}</h2>
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </motion.section>
  );
}

const P = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[14.5px] leading-[1.75] text-[var(--color-muted)]">{children}</p>
);
const B = ({ children }: { children: React.ReactNode }) => (
  <strong className="text-[var(--color-fg)] font-semibold">{children}</strong>
);
const Code = ({ children }: { children: React.ReactNode }) => (
  <code className="tnum text-[12.5px] rounded px-1.5 py-0.5" style={{ background: "rgba(255,255,255,0.05)", color: "var(--color-cyan)" }}>{children}</code>
);

const Callout = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-xl px-4 py-3.5 text-[13.5px] leading-relaxed"
       style={{ background: "rgba(78,230,168,0.05)", border: "1px solid rgba(78,230,168,0.18)" }}>
    {children}
  </div>
);

const Grid = ({ children }: { children: React.ReactNode }) => (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{children}</div>
);
const Cell = ({ k, v, s }: { k: string; v: string; s: string }) => (
  <div className="panel px-3.5 py-3">
    <div className="label">{k}</div>
    <div className="tnum text-[17px] mt-1">{v}</div>
    <div className="text-[11px] text-[var(--color-faint)] mt-0.5 leading-snug">{s}</div>
  </div>
);

function Steps({ items }: { items: [string, string][] }) {
  return (
    <ol className="flex flex-col">
      {items.map(([h, b], i) => (
        <li key={h} className="flex gap-4 py-3.5 border-b border-[var(--color-line)] last:border-0">
          <span className="tnum text-[11px] shrink-0 mt-1 w-5" style={{ color: "var(--color-mint)" }}>
            {String(i + 1).padStart(2, "0")}
          </span>
          <div>
            <div className="text-[14px] font-medium">{h}</div>
            <p className="text-[13px] text-[var(--color-muted)] leading-relaxed mt-1">{b}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function Table({ head, rows, note }: { head: string[]; rows: string[][]; note?: string }) {
  return (
    <div className="panel overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-[var(--color-line)]">
              {head.map((h, i) => (
                <th key={h} className={`label py-2.5 px-3.5 ${i ? "text-right" : "text-left"}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-[var(--color-line)] last:border-0">
                {r.map((c, j) => (
                  <td key={j}
                      className={`py-2.5 px-3.5 ${j ? "text-right tnum" : "text-left"} ${j === r.length - 1 && r.length > 2 ? "font-semibold" : ""}`}
                      style={j === r.length - 1 && r.length > 2 ? { color: "var(--color-mint)" } : j && r.length > 2 ? { color: "var(--color-muted)" } : undefined}>
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {note && <div className="px-3.5 py-2.5 border-t border-[var(--color-line)] label">{note}</div>}
    </div>
  );
}
