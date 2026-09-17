"""Fair-value estimators for a US equity while its home market is dark.

Every model answers one question: given what is observable at time T inside a
dark window, what will this name print when the session reopens? Predictions are
expressed as a return from the last regular-session close, in decimals.
"""
from __future__ import annotations

import numpy as np


def market_factor(dark_ret: dict[str, float]) -> float:
    """Robust common component of the cross-section.

    The median, not the mean: individual rToken quotes during dark hours are
    sparse and noisy, and a handful of stale or stub quotes would drag a mean.
    """
    if not dark_ret:
        return 0.0
    return float(np.median(list(dark_ret.values())))


class LastClose:
    """Baseline. Assume nothing happened: the reopen equals the last close."""

    name = "last_close"
    needs_fit = False

    def predict(self, obs: dict) -> dict[str, float]:
        return {s: 0.0 for s in obs["dark_ret"]}


class NaiveQuote:
    """Take the venue's own dark-hours quote at face value."""

    name = "venue_quote"
    needs_fit = False

    def predict(self, obs: dict) -> dict[str, float]:
        return dict(obs["dark_ret"])


class Lighthouse:
    """Cross-sectional decomposition.

    Split each name's observed dark move into a common component (its loading on
    the cross-sectional factor) and an idiosyncratic residual, then weight the
    two by how much each has historically survived to the reopen. A single
    quote is mostly noise; the factor built from many quotes need not be.
    """

    name = "lighthouse"
    needs_fit = True

    def __init__(self) -> None:
        self.beta: dict[str, float] = {}
        self.w_factor: float = 1.0
        self.w_idio: float = 0.0
        self.fitted = False

    def fit(self, train_obs: list[dict]) -> "Lighthouse":
        # Stage 1: per-name loading of the realised reopen move on the dark factor.
        by_symbol: dict[str, list[tuple[float, float]]] = {}
        for obs in train_obs:
            f = market_factor(obs["dark_ret"])
            for s in obs["dark_ret"]:
                if s in obs["truth"]:
                    by_symbol.setdefault(s, []).append((f, obs["truth"][s]))

        for s, pairs in by_symbol.items():
            f = np.array([p[0] for p in pairs])
            y = np.array([p[1] for p in pairs])
            denom = float(f @ f)
            # Shrink thin-history names toward 1.0 rather than trusting a noisy slope.
            raw = float(f @ y) / denom if denom > 1e-12 else 1.0
            n = len(pairs)
            k = n / (n + 10.0)
            self.beta[s] = float(np.clip(k * raw + (1 - k) * 1.0, -0.5, 3.0))

        # Stage 2: how much of each component actually survives to the reopen.
        rows, ys = [], []
        for obs in train_obs:
            f = market_factor(obs["dark_ret"])
            for s, r in obs["dark_ret"].items():
                if s not in obs["truth"]:
                    continue
                b = self.beta.get(s, 1.0)
                rows.append([b * f, r - b * f])
                ys.append(obs["truth"][s])
        if rows:
            X = np.array(rows)
            y = np.array(ys)
            coef, *_ = np.linalg.lstsq(X, y, rcond=None)
            self.w_factor, self.w_idio = (float(np.clip(c, -1.0, 2.0)) for c in coef)
        self.fitted = True
        return self

    def predict(self, obs: dict) -> dict[str, float]:
        f = market_factor(obs["dark_ret"])
        out = {}
        for s, r in obs["dark_ret"].items():
            b = self.beta.get(s, 1.0)
            common = b * f
            out[s] = self.w_factor * common + self.w_idio * (r - common)
        return out


ALL = [LastClose, NaiveQuote, Lighthouse]
