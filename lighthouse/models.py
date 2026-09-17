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



class LighthouseV2:
    """Lighthouse with the two fixes the data asked for.

    1. The cross-sectional factor and the name-specific residual are weighted
       separately and the weights are allowed to vary with how far into the dark
       window we are. Early on the residual is almost pure noise; near the reopen
       it is tracking real pre-market interest.
    2. Crypto majors are added as exogenous risk proxies. They are the only
       deeply liquid instruments still trading in the dead zone, and they carry
       a measurable R^2 on the realised reopen move.

    Weights are fitted to minimise MEDIAN absolute error, not squared error --
    the metric the model is judged on, and one that refuses to be dragged around
    by the fat tails these windows are full of.
    """

    name = "lighthouse_v2"
    needs_fit = True
    BUCKETS = ((0.0, 0.55), (0.55, 1.01))
    FEATURES = ("common", "idio", "btc", "eth")

    def __init__(self) -> None:
        self.beta: dict[str, float] = {}
        self.weights: dict[int, list[float]] = {i: [1.0, 0.0, 0.0, 0.0] for i in range(len(self.BUCKETS))}
        self.fitted = False

    def _bucket(self, elapsed: float) -> int:
        for i, (lo, hi) in enumerate(self.BUCKETS):
            if lo <= elapsed < hi:
                return i
        return len(self.BUCKETS) - 1

    def _features(self, obs: dict) -> tuple[list[str], np.ndarray]:
        f = market_factor(obs["dark_ret"])
        btc = obs.get("exog", {}).get("BTCUSDT") or 0.0
        eth = obs.get("exog", {}).get("ETHUSDT") or 0.0
        syms, rows = [], []
        for s, r in obs["dark_ret"].items():
            b = self.beta.get(s, 1.0)
            common = b * f
            syms.append(s)
            rows.append([common, r - common, b * btc, b * eth])
        return syms, np.array(rows) if rows else np.zeros((0, 4))

    def fit(self, train_obs: list[dict]) -> "LighthouseV2":
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
            raw = float(f @ y) / denom if denom > 1e-12 else 1.0
            n = len(pairs)
            k = n / (n + 10.0)
            self.beta[s] = float(np.clip(k * raw + (1 - k) * 1.0, -0.5, 3.0))

        per_bucket: dict[int, list[tuple[np.ndarray, float]]] = {}
        for obs in train_obs:
            bi = self._bucket(obs.get("elapsed", 0.5))
            syms, X = self._features(obs)
            for s, row in zip(syms, X):
                if s in obs["truth"]:
                    per_bucket.setdefault(bi, []).append((row, obs["truth"][s]))

        for bi, rows in per_bucket.items():
            X = np.array([r[0] for r in rows])
            y = np.array([r[1] for r in rows])
            self.weights[bi] = _fit_median_abs(X, y)
        self.fitted = True
        return self

    def predict(self, obs: dict) -> dict[str, float]:
        syms, X = self._features(obs)
        if not syms:
            return {}
        w = np.array(self.weights[self._bucket(obs.get("elapsed", 0.5))])
        return dict(zip(syms, X @ w))


def _fit_median_abs(X: np.ndarray, y: np.ndarray, rounds: int = 6) -> list[float]:
    """Coordinate descent on median absolute error, seeded from least squares."""
    if X.size == 0:
        return [1.0, 0.0, 0.0, 0.0]
    w, *_ = np.linalg.lstsq(X, y, rcond=None)
    w = np.clip(w, -1.5, 2.0)

    def loss(v: np.ndarray) -> float:
        return float(np.median(np.abs(y - X @ v)))

    best = loss(w)
    for step in (0.5, 0.25, 0.1, 0.05, 0.02, 0.01):
        for _ in range(rounds):
            improved = False
            for j in range(X.shape[1]):
                for delta in (step, -step):
                    cand = w.copy()
                    cand[j] = float(np.clip(cand[j] + delta, -1.5, 2.0))
                    lc = loss(cand)
                    if lc < best - 1e-12:
                        w, best, improved = cand, lc, True
            if not improved:
                break
    return [float(v) for v in w]


ALL = [LastClose, NaiveQuote, Lighthouse, LighthouseV2]


class LighthouseCalibrated:
    """Learn how much to trust the venue, minute by minute into the dark window.

    The earlier experiments settled the question the hard way: no combination of
    observable signals out-predicts 'assume the last close held' early in the
    dead zone, and the venue's own quote is materially worse than it. But the
    quote does become informative as the reopen approaches.

    So this model does not try to beat the quote. It estimates how much of the
    quote survives to the reopen -- separately for the common component and the
    name-specific one, separately for each slice of the dark window. Both
    shrinkage weights are free to collapse to zero, in which case the model
    simply returns the last close, which is the correct answer at 22:00 ET.
    """

    name = "lighthouse_cal"
    needs_fit = True
    EDGES = (0.0, 0.35, 0.60, 0.80, 0.92, 1.01)

    def __init__(self) -> None:
        self.beta: dict[str, float] = {}
        self.lam: dict[int, tuple[float, float]] = {}
        self.residual_bps: dict[int, float] = {}
        self.fitted = False

    def bucket(self, elapsed: float) -> int:
        for i in range(len(self.EDGES) - 1):
            if self.EDGES[i] <= elapsed < self.EDGES[i + 1]:
                return i
        return len(self.EDGES) - 2

    def bucket_label(self, i: int) -> str:
        return f"{self.EDGES[i]:.0%}-{min(self.EDGES[i+1],1.0):.0%}"

    def fit(self, train_obs: list[dict]) -> "LighthouseCalibrated":
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
            raw = float(f @ y) / denom if denom > 1e-12 else 1.0
            n = len(pairs)
            k = n / (n + 10.0)
            self.beta[s] = float(np.clip(k * raw + (1 - k) * 1.0, -0.5, 3.0))

        grouped: dict[int, list[tuple[float, float, float]]] = {}
        for obs in train_obs:
            bi = self.bucket(obs.get("elapsed", 0.5))
            f = market_factor(obs["dark_ret"])
            for s, r in obs["dark_ret"].items():
                if s not in obs["truth"]:
                    continue
                b = self.beta.get(s, 1.0)
                common = b * f
                grouped.setdefault(bi, []).append((common, r - common, obs["truth"][s]))

        grid = np.linspace(0.0, 1.2, 25)
        for bi in range(len(self.EDGES) - 1):
            rows = grouped.get(bi, [])
            if len(rows) < 40:
                self.lam[bi] = (0.0, 0.0)
                self.residual_bps[bi] = float("nan")
                continue
            c = np.array([r[0] for r in rows])
            d = np.array([r[1] for r in rows])
            y = np.array([r[2] for r in rows])
            best, best_l = None, (0.0, 0.0)
            for lc in grid:
                base = y - lc * c
                for ld in grid:
                    err = float(np.median(np.abs(base - ld * d)))
                    if best is None or err < best:
                        best, best_l = err, (float(lc), float(ld))
            self.lam[bi] = best_l
            self.residual_bps[bi] = best * 1e4
        self.fitted = True
        return self

    def predict(self, obs: dict) -> dict[str, float]:
        bi = self.bucket(obs.get("elapsed", 0.5))
        lc, ld = self.lam.get(bi, (0.0, 0.0))
        f = market_factor(obs["dark_ret"])
        out = {}
        for s, r in obs["dark_ret"].items():
            b = self.beta.get(s, 1.0)
            common = b * f
            out[s] = lc * common + ld * (r - common)
        return out

    def band_bps(self, elapsed: float) -> float:
        """Calibrated uncertainty for a quote at this point in the window."""
        return self.residual_bps.get(self.bucket(elapsed), float("nan"))


ALL = [LastClose, NaiveQuote, Lighthouse, LighthouseV2, LighthouseCalibrated]
