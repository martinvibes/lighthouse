"""Scoring harness: strict time-ordered train/test, errors in basis points."""
from __future__ import annotations

import datetime as dt
import numpy as np

from . import dataset, models


_EXOG_CACHE: dict | None = None


def _exog() -> dict:
    global _EXOG_CACHE
    if _EXOG_CACHE is None:
        _EXOG_CACHE = {k: v for k, v in dataset.load_exog().items() if v}
    return _EXOG_CACHE


def snapshots(windows: list[dataset.Window], elapsed: float) -> list[dict]:
    out = []
    for w in windows:
        when = w.start + (w.end - w.start) * elapsed
        obs = dataset.observations(w, when, exog=_exog())
        if obs:
            obs["window_start"] = w.start
            out.append(obs)
    return out


def split(obs: list[dict], train_frac: float = 0.6) -> tuple[list[dict], list[dict]]:
    obs = sorted(obs, key=lambda o: o["window_start"])
    cut = int(len(obs) * train_frac)
    return obs[:cut], obs[cut:]


def errors_bps(model, obs_list: list[dict]) -> np.ndarray:
    errs = []
    for obs in obs_list:
        pred = model.predict(obs)
        for s, p in pred.items():
            if s in obs["truth"]:
                errs.append((obs["truth"][s] - p) * 1e4)
    return np.array(errs)


def evaluate(windows: list[dataset.Window], elapsed: float, train_frac: float = 0.6) -> dict:
    obs = snapshots(windows, elapsed)
    if len(obs) < 20:
        return {"elapsed": elapsed, "n_windows": len(obs), "insufficient": True}
    train, test = split(obs, train_frac)

    fitted = []
    for cls in models.ALL:
        m = cls()
        if getattr(m, "needs_fit", False):
            m.fit(train)
        fitted.append(m)

    base = np.abs(errors_bps(fitted[0], test))
    res = {
        "elapsed": elapsed,
        "n_windows": len(obs),
        "n_train": len(train),
        "n_test": len(test),
        "train_until": str(train[-1]["window_start"].date()),
        "test_from": str(test[0]["window_start"].date()),
        "models": {},
    }
    for m in fitted:
        e = np.abs(errors_bps(m, test))
        res["models"][m.name] = {
            "n": int(e.size),
            "medae": float(np.median(e)),
            "mae": float(e.mean()),
            "rmse": float(np.sqrt((e ** 2).mean())),
            "vs_baseline_pct": float((np.median(e) / np.median(base) - 1) * 100),
        }
    if isinstance(fitted[-1], models.Lighthouse):
        res["fit"] = {"w_factor": fitted[-1].w_factor, "w_idio": fitted[-1].w_idio}
    return res


def walk_forward(
    windows: list[dataset.Window],
    elapsed: float,
    lookback: int = 40,
    min_train: int = 25,
) -> dict:
    """Honest evaluation: at every dark window, calibrate only on windows that
    already closed, then predict the next one. No future information anywhere.

    A fixed train/test split assumes the quote's informativeness is stable. It
    is not -- it drifts with volatility regime and with how much market-maker
    attention the book is getting -- so the production model recalibrates on a
    trailing window and this is the evaluation that matches it.
    """
    obs = sorted(snapshots(windows, elapsed), key=lambda o: o["window_start"])
    if len(obs) < min_train + 10:
        return {"elapsed": elapsed, "n": len(obs), "insufficient": True}

    errs: dict[str, list[float]] = {"last_close": [], "venue_quote": [], "lighthouse_cal": []}
    lams: list[tuple[float, float]] = []
    for i in range(min_train, len(obs)):
        train = obs[max(0, i - lookback) : i]
        cur = obs[i]
        cal = models.LighthouseCalibrated().fit(train)
        lams.append(cal.lam.get(cal.bucket(elapsed), (0.0, 0.0)))
        for name, mdl in (
            ("last_close", models.LastClose()),
            ("venue_quote", models.NaiveQuote()),
            ("lighthouse_cal", cal),
        ):
            pred = mdl.predict(cur)
            for s, p in pred.items():
                if s in cur["truth"]:
                    errs[name].append(abs((cur["truth"][s] - p) * 1e4))

    base = float(np.median(errs["last_close"]))
    out = {
        "elapsed": elapsed,
        "n_windows": len(obs),
        "n_scored": len(obs) - min_train,
        "from": str(obs[min_train]["window_start"].date()),
        "to": str(obs[-1]["window_start"].date()),
        "mean_lambda": (
            float(np.mean([l[0] for l in lams])),
            float(np.mean([l[1] for l in lams])),
        ),
        "models": {},
    }
    for name, e in errs.items():
        arr = np.array(e)
        out["models"][name] = {
            "n": int(arr.size),
            "medae": float(np.median(arr)),
            "mae": float(arr.mean()),
            "p90": float(np.percentile(arr, 90)),
            "vs_baseline_pct": float((np.median(arr) / base - 1) * 100),
        }
    return out
