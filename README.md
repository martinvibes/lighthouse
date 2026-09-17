# Lighthouse

**A validated reference price for US equities while their home market is dark.**

Built for the [Bitget AI Base Camp Hackathon S2](https://bitget-ai.gitbook.io/bitgetai_hackathons2) — AI Trading Desk track.

---

## The problem

Bitget's rTokens are tokenized US equities that trade 24/7 — about **$7.7B of turnover a day across 1,653 symbols**. During US market hours their orders route to NYSE and Nasdaq, so the price is real.

Outside those hours it isn't. Bitget states plainly that weekend rToken prices are *indicative quotes, not live Nasdaq or NYSE transaction prices* — they come from internal matching and market-maker inventory. rTokens are also accepted as Unified Trading Account collateral at ratios up to 95%, which means positions can be marked, and liquidated, against a number nobody validates.

So the question this repo answers is narrow and testable:

> When no US venue is quoting, what is this stock actually worth — and is the exchange's own quote any good?

## What we measured

The genuinely dark window is **20:00 → 04:00 ET** on weeknights and **Friday 20:00 → Monday 04:00 ET** across weekends. (16:00–20:00 and 04:00–09:30 are US extended-hours sessions and are *not* dark — an easy mistake that inflates every result.)

Ground truth is the price when US pre-market reopens at 04:00 ET. Errors are median absolute, in basis points, on a **time-ordered out-of-sample split** — models are fit on the earlier period and scored on the later one.

Headline, measured on real Bitget data:

| Point in the dark window | Assume last close | Trust the venue quote |
|---|---|---|
| ~25% elapsed (≈22:00 ET) | 25.0 bps | 31.8 bps — **27% worse** |
| ~50% elapsed (≈00:00 ET) | 25.0 bps | 29.9 bps — **20% worse** |
| ~75% elapsed (≈02:00 ET) | 25.0 bps | 21.2 bps — 15% better |

**Early in the dark window the exchange's own quote carries less information than assuming nothing happened at all.** It only becomes useful as the reopen approaches, by which point it is largely just tracking pre-market.

Across weekends the move to be explained is far larger: median **65.5 bps** of repricing from Friday's close, and 12% of weekends exceed 200 bps.

## Status

Working: public-API data layer, dark-window dataset builder, scoring harness with out-of-sample split, three baseline models.

In progress: crypto-implied risk factor, elapsed-dependent shrinkage, and the research dashboard.

## Reproducing

```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python scripts/fetch.py 60 22      # cache hourly candles (public API, no key)
.venv/bin/python scripts/experiment.py       # print the table above
```

No API key, no account, no signing — every endpoint used is public and read-only.
