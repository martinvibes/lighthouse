"""Scoring harness: strict time-ordered train/test, errors in basis points."""
from __future__ import annotations

import datetime as dt
import numpy as np

from . import dataset, models


def snapshots(windows: list[dataset.Window], elapsed: float) -> list[dict]:
    out = []
    for w in windows:
        when = w.start + (w.end - w.start) * elapsed
        obs = dataset.observations(w, when)
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
