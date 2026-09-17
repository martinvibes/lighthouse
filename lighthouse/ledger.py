"""Every prediction this system has ever made, and what actually happened.

The ledger is the point of the project. A fair-value model that cannot be
audited is an opinion; one that writes down each forecast before the reopen and
scores it afterwards is a measurement. Rows are produced walk-forward, so no row
was ever computed with knowledge of its own answer.
"""
from __future__ import annotations

import csv
import datetime as dt
from dataclasses import dataclass, asdict

import numpy as np

from . import dataset, models, score


@dataclass
class Row:
    window_start: str
    window_end: str
    kind: str
    horizon: float
    as_of: str
    symbol: str
    anchor_close: float
    venue_quote: float
    fair_value: float
    reopen: float
    quote_move_bps: float
    fair_move_bps: float
    realised_bps: float
    err_lighthouse_bps: float
    err_venue_bps: float
    err_lastclose_bps: float
    lam_common: float
    lam_idio: float
    n_train: int


def active_symbols(windows: list[dataset.Window], min_realised_bps: float = 5.0) -> set[str]:
    """Names that actually reprice across the dark window, by median absolute move."""
    moves: dict[str, list[float]] = {}
    for w in windows:
        for s in w.symbols():
            moves.setdefault(s, []).append(abs(w.target[s] / w.anchor[s] - 1) * 1e4)
    return {s: None for s, m in moves.items() if len(m) >= 20 and float(np.median(m)) >= min_realised_bps}.keys()


def build(
    windows: list[dataset.Window],
    horizons: tuple[float, ...] = (0.25, 0.50, 0.75, 0.90),
    lookback: int = 40,
    min_train: int = 25,
) -> list[Row]:
    rows: list[Row] = []
    for horizon in horizons:
        obs = sorted(score.snapshots(windows, horizon), key=lambda o: o["window_start"])
        if len(obs) < min_train + 5:
            continue
        for i in range(min_train, len(obs)):
            train = obs[max(0, i - lookback) : i]
            cur = obs[i]
            cal = models.LighthouseCalibrated().fit(train)
            bucket = cal.bucket(horizon)
            lam = cal.lam.get(bucket, (0.0, 0.0))
            pred = cal.predict(cur)
            win = next(w for w in windows if w.start == cur["window_start"])
            for sym, p in pred.items():
                if sym not in cur["truth"]:
                    continue
                anchor = cur["anchor"][sym]
                q = cur["dark_ret"][sym]
                t = cur["truth"][sym]
                rows.append(
                    Row(
                        window_start=win.start.isoformat(),
                        window_end=win.end.isoformat(),
                        kind=cur["kind"],
                        horizon=horizon,
                        as_of=cur["when"].isoformat(),
                        symbol=sym,
                        anchor_close=round(anchor, 4),
                        venue_quote=round(anchor * (1 + q), 4),
                        fair_value=round(anchor * (1 + p), 4),
                        reopen=round(anchor * (1 + t), 4),
                        quote_move_bps=round(q * 1e4, 2),
                        fair_move_bps=round(p * 1e4, 2),
                        realised_bps=round(t * 1e4, 2),
                        err_lighthouse_bps=round(abs(t - p) * 1e4, 2),
                        err_venue_bps=round(abs(t - q) * 1e4, 2),
                        err_lastclose_bps=round(abs(t) * 1e4, 2),
                        lam_common=round(lam[0], 3),
                        lam_idio=round(lam[1], 3),
                        n_train=len(train),
                    )
                )
    return rows


def write_csv(rows: list[Row], path: str) -> None:
    with open(path, "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=list(asdict(rows[0]).keys()))
        w.writeheader()
        for r in rows:
            w.writerow(asdict(r))


# A name whose price is identical at the close and the reopen is not being
# priced at all - it is a stale book. Ratios against a zero baseline are
# meaningless, so these are excluded rather than allowed to flatter or wreck
# the aggregate.
MIN_REALISED_BPS = 5.0


def per_symbol(rows: list[Row], min_rows: int = 30) -> list[dict]:
    by: dict[str, list[Row]] = {}
    for r in rows:
        by.setdefault(r.symbol, []).append(r)
    out = []
    for sym, rs in by.items():
        if len(rs) < min_rows:
            continue
        base = float(np.median([r.err_lastclose_bps for r in rs]))
        if base < MIN_REALISED_BPS:
            continue
        lh = np.array([r.err_lighthouse_bps for r in rs])
        vq = np.array([r.err_venue_bps for r in rs])
        lc = np.array([r.err_lastclose_bps for r in rs])
        out.append(
            {
                "symbol": sym,
                "ticker": sym[1:].replace("USDT", ""),
                "n": len(rs),
                "lighthouse": round(float(np.median(lh)), 1),
                "venue": round(float(np.median(vq)), 1),
                "last_close": round(float(np.median(lc)), 1),
                "vs_lastclose_pct": round(float((np.median(lh) / base - 1) * 100), 1),
                "beat_venue_share": round(float((lh < vq).mean()), 3),
                "median_realised_bps": round(float(np.median([abs(r.realised_bps) for r in rs])), 1),
            }
        )
    out.sort(key=lambda d: d["vs_lastclose_pct"])
    return out


def summarise(rows: list[Row]) -> dict:
    def med(vals):
        return round(float(np.median(vals)), 2)

    out = {"n_rows": len(rows), "by_horizon": {}}
    for h in sorted({r.horizon for r in rows}):
        rs = [r for r in rows if r.horizon == h]
        lh = [r.err_lighthouse_bps for r in rs]
        lc = [r.err_lastclose_bps for r in rs]
        vq = [r.err_venue_bps for r in rs]
        out["by_horizon"][f"{h:.2f}"] = {
            "n": len(rs),
            "lighthouse_medae": med(lh),
            "venue_medae": med(vq),
            "last_close_medae": med(lc),
            "lighthouse_vs_lastclose_pct": round((np.median(lh) / np.median(lc) - 1) * 100, 1),
            "lighthouse_beats_venue_share": round(float(np.mean(np.array(lh) < np.array(vq))), 3),
        }
    return out
