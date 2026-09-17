# Lighthouse

**A validated reference price for US equities while their home market is dark.**

Built for the [Bitget AI Base Camp Hackathon S2](https://bitget-ai.gitbook.io/bitgetai_hackathons2) — AI Trading Desk track.
**Live desk:** https://claude.ai/artifact/JioxixSGkFcqL4msSkuFyb

---

## The problem

Bitget's rTokens are tokenized US equities that trade 24/7 — **$7.7B of turnover a day across 1,653 symbols**. During US market hours their orders route to NYSE and Nasdaq, so the price is real.

Outside those hours it isn't. Bitget states plainly that weekend rToken prices are *indicative quotes, not live Nasdaq or NYSE transaction prices* — they come from internal matching and market-maker inventory. rTokens are also accepted as Unified Trading Account collateral at ratios up to **95%**, so positions can be marked, and liquidated, against a number nobody validates.

One narrow, testable question follows:

> When no US venue is quoting, what is this stock actually worth — and is the exchange's own quote any good?

## What Lighthouse does

It decomposes each name's dark-hours move into a **common component** (its loading on a cross-sectional factor built from the whole universe) and a **name-specific residual**, then weights each by how much history says survives to the reopen. Both weights are free to collapse to zero, in which case the answer is simply "the last close" — which is the correct answer at 22:00 ET.

Weights are refitted **walk-forward** on the trailing 40 closed windows. No forecast is ever produced with knowledge of its own answer, and there is a test that enforces it.

## The record

Ground truth is the 04:00 ET pre-market reopen. Median absolute error, in basis points. Lower is better.

| Into the dark window | Assume close held | Venue quote | Lighthouse | Forecasts graded |
|---|---|---|---|---|
| 25% (~22:00 ET) | 32.5 bps | 33.4 bps (+3%) | **29.1 bps (-11%)** | 5,214 |
| 50% (~00:00 ET) | 32.4 bps | 30.7 bps (-5%) | **26.3 bps (-19%)** | 5,234 |
| 75% (~02:00 ET) | 32.3 bps | 25.1 bps (-22%) | **22.6 bps (-30%)** | 5,243 |
| 90% (~03:10 ET) | 32.3 bps | 19.8 bps (-39%) | **19.4 bps (-40%)** | 5,243 |

Lighthouse beats the raw venue quote on **54–56%** of individual forecasts, and beats "assume nothing happened" at every horizon.

**Every one of these 20,934 forecasts is in [`data/ledger.csv`](data/ledger.csv)** — window, timestamp, symbol, the quote, the fair value, the realised reopen, and the error of all three models. Recompute it yourself; nothing is taken on trust.

## What the data said that we did not expect

Three findings that contradicted the original thesis and were kept:

1. **The dark window is not what it looks like.** US extended-hours sessions run 04:00–20:00 ET, so the genuinely dark stretch is **20:00 → 04:00 ET**, not 16:00 → 09:30. Measured on the wrong window, every error figure roughly triples and the conclusions invert.

2. **The relationship is non-stationary.** A fixed train/test split produced weights that actively hurt out of sample: across the split the dead zone grew quieter and the quote's correlation with the realised reopen move fell to +0.15. This is why calibration rolls rather than sits still.

3. **Early in the night, the venue's quote is worse than useless.** Measured at ~22:00 ET it carries *more* error than assuming the last close held. It overshoots the repricing that actually sticks by up to **1.39×**.

## Where it helps, and where it doesn't

The model earns its keep where there is something to explain. On quiet mega-caps it is a rounding error either way, and occasionally slightly worse. Both ends shown:

| Instrument | Typical reopen move | Assume close held | Lighthouse | Change |
|---|---|---|---|---|
| LITE | 97 bps | 97.0 | 42.1 | -57% |
| MU | 107 bps | 107.0 | 52.0 | -51% |
| TQQQ | 85 bps | 85.3 | 47.3 | -45% |
| COHR | 137 bps | 137.2 | 80.3 | -42% |
| JPM | 6 bps | 6.1 | 6.5 | +7% |
| AXP | 7 bps | 6.9 | 7.6 | +10% |
| EWZ | 8 bps | 8.4 | 11.4 | +36% |

13 names were dropped as stale — their price is identical at the close and the reopen, so there is nothing to price and any ratio against them is meaningless.

## Weekends

Weekend repricing is far larger: median **70 bps** from Friday's close to Monday's reopen, 90th percentile **299 bps**, and **19%** exceed 200 bps — against collateral accepted at up to 95%.

Weekend windows are **reported but not fitted**. There are only 31 of them, and weekend quoting on Bitget only became near-continuous in August 2026 (2–10% of weekend hours quoted Jan–May, 32% in June, 52% in July, 93% in August). Fitting on that would be dressing up noise.

## The trust curve

Fitted shrinkage on the common move, across the night: **0.85, 0.70, 0.90, 0.85, 1.00**. Read it as: trust this share of what the venue is showing you, at this hour.

## Running it

```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python scripts/fetch.py 60 22        # cache hourly candles (public API, no key)
.venv/bin/python scripts/build_ledger.py       # rebuild the full prediction ledger
.venv/bin/python scripts/export_calibration.py # refresh the desk's calibration
.venv/bin/python scripts/walkforward.py        # print the record
.venv/bin/python -m pytest tests/ -q           # 15 tests
```

No API key, no account, no signing — every Bitget endpoint used is public and read-only. The desk calls the same endpoints from the browser (`access-control-allow-origin: *`), so there is no backend to trust either.

## Layout

| Path | What's in it |
|---|---|
| `lighthouse/bitget.py` | Public API client |
| `lighthouse/dataset.py` | Dark-window construction; the 20:00→04:00 boundary lives here |
| `lighthouse/models.py` | Baselines and the calibrated model |
| `lighthouse/score.py` | Walk-forward harness |
| `lighthouse/ledger.py` | The auditable prediction ledger |
| `web/` | The desk |
| `tests/` | 15 tests, including the no-lookahead guarantee |
