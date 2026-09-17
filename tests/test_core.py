"""Tests for the parts that would silently corrupt every number if wrong."""
import datetime as dt
import os
import sys
from zoneinfo import ZoneInfo

import numpy as np
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from lighthouse import dataset, models, score  # noqa: E402

ET = ZoneInfo("America/New_York")


def bar(day, hour, close, vol=1.0):
    t = dt.datetime.combine(day, dt.time(hour), tzinfo=ET)
    return dataset.Bar(t, close, close, close, close, vol)


class TestDarkWindow:
    """The window boundaries decide every downstream figure."""

    def test_dark_window_is_20_to_04(self):
        assert dataset.SESSION_LAST_HOUR == 19, "session close bar is the 19:00 ET bar"
        assert dataset.SESSION_OPEN_HOUR == 4, "reopen reference is the 04:00 ET bar"

    def test_overnight_and_weekend_are_labelled_by_calendar_gap(self, tmp_path, monkeypatch):
        mon = dt.date(2026, 9, 14)
        days = [mon, mon + dt.timedelta(1), mon + dt.timedelta(4)]  # Mon, Tue, Fri
        bars = []
        for d in days:
            bars += [bar(d, 4, 100.0), bar(d, 19, 101.0)]
        monkeypatch.setattr(dataset, "load_bars", lambda s: bars)
        w = dataset.build_windows(["RXUSDT"])
        kinds = {(x.start.date(), x.kind) for x in w}
        assert (mon, "overnight") in kinds, "Mon->Tue is an overnight window"
        # Tue -> Fri is a 3-day gap that is not Friday-anchored: must be skipped.
        assert all(not (s == mon + dt.timedelta(1)) for s, _ in kinds)

    def test_weekend_window_requires_friday_anchor(self, monkeypatch):
        fri = dt.date(2026, 9, 11)
        mon = dt.date(2026, 9, 14)
        bars = []
        for d in (fri, mon):
            bars += [bar(d, 4, 100.0), bar(d, 19, 101.0)]
        monkeypatch.setattr(dataset, "load_bars", lambda s: bars)
        w = dataset.build_windows(["RXUSDT"])
        assert len(w) == 1 and w[0].kind == "weekend"
        assert w[0].start.hour == 20 and w[0].end.hour == 4


class TestQuoteLookup:
    def test_quote_at_never_looks_forward(self, monkeypatch):
        day = dt.date(2026, 9, 15)
        nxt = day + dt.timedelta(1)
        bars = [bar(day, 4, 100.0), bar(day, 19, 100.0),
                bar(day, 22, 105.0), bar(nxt, 1, 110.0),
                bar(nxt, 4, 120.0), bar(nxt, 19, 121.0)]
        monkeypatch.setattr(dataset, "load_bars", lambda s: bars)
        w = dataset.build_windows(["RXUSDT"])[0]
        at22 = dt.datetime.combine(day, dt.time(22, 30), tzinfo=ET)
        assert w.quote_at("RXUSDT", at22) == 105.0, "must not see the 01:00 bar"

    def test_quote_at_refuses_stale_quotes(self, monkeypatch):
        day = dt.date(2026, 9, 15)
        nxt = day + dt.timedelta(1)
        bars = [bar(day, 4, 100.0), bar(day, 19, 100.0),
                bar(day, 21, 105.0), bar(nxt, 4, 120.0), bar(nxt, 19, 121.0)]
        monkeypatch.setattr(dataset, "load_bars", lambda s: bars)
        w = dataset.build_windows(["RXUSDT"])[0]
        late = dt.datetime.combine(nxt, dt.time(3), tzinfo=ET)
        assert w.quote_at("RXUSDT", late, max_lag_h=2) is None, "6h-old quote is stale"
        assert w.quote_at("RXUSDT", late, max_lag_h=12) == 105.0


class TestMarketFactor:
    def test_uses_median_not_mean(self):
        d = {"a": 0.01, "b": 0.011, "c": 0.012, "d": 5.0}  # one stub quote
        assert models.market_factor(d) == pytest.approx(0.0115)

    def test_empty_is_zero(self):
        assert models.market_factor({}) == 0.0


class TestModels:
    def _obs(self):
        return {
            "dark_ret": {"A": 0.01, "B": -0.01, "C": 0.02},
            "truth": {"A": 0.005, "B": -0.005, "C": 0.01},
            "anchor": {"A": 100.0, "B": 100.0, "C": 100.0},
            "elapsed": 0.25,
            "exog": {},
            "window_start": dt.datetime(2026, 9, 15, 20, tzinfo=ET),
        }

    def test_last_close_predicts_no_change(self):
        assert set(models.LastClose().predict(self._obs()).values()) == {0.0}

    def test_venue_quote_passes_the_quote_through(self):
        assert models.NaiveQuote().predict(self._obs()) == self._obs()["dark_ret"]

    def test_zero_shrinkage_reproduces_the_baseline(self):
        m = models.LighthouseCalibrated()
        m.lam = {i: (0.0, 0.0) for i in range(len(m.EDGES) - 1)}
        assert set(m.predict(self._obs()).values()) == {0.0}

    def test_unit_shrinkage_reproduces_the_quote(self):
        m = models.LighthouseCalibrated()
        m.lam = {i: (1.0, 1.0) for i in range(len(m.EDGES) - 1)}
        m.beta = {"A": 1.0, "B": 1.0, "C": 1.0}
        got = m.predict(self._obs())
        for k, v in self._obs()["dark_ret"].items():
            assert got[k] == pytest.approx(v)

    def test_buckets_cover_the_whole_window(self):
        m = models.LighthouseCalibrated()
        seen = {m.bucket(x / 100) for x in range(101)}
        assert seen == set(range(len(m.EDGES) - 1))

    def test_beta_is_shrunk_toward_one_on_thin_history(self):
        m = models.LighthouseCalibrated()
        obs = []
        for i in range(3):  # only 3 observations: trust the prior, not the slope
            obs.append({
                "dark_ret": {"A": 0.01, "B": 0.01}, "truth": {"A": 0.30, "B": 0.01},
                "anchor": {"A": 100.0, "B": 100.0}, "elapsed": 0.25, "exog": {},
                "window_start": dt.datetime(2026, 9, 1 + i, 20, tzinfo=ET)})
        m.fit(obs)
        assert m.beta["A"] < 8.0, "a wild slope from 3 points must be shrunk"


class TestWalkForward:
    def test_never_trains_on_the_row_it_scores(self, monkeypatch):
        """The guarantee the whole project rests on."""
        seen = []
        real_fit = models.LighthouseCalibrated.fit

        def spy(self, train):
            seen.append([o["window_start"] for o in train])
            return real_fit(self, train)

        monkeypatch.setattr(models.LighthouseCalibrated, "fit", spy)
        obs = [{
            "dark_ret": {"A": 0.001 * i, "B": -0.001 * i},
            "truth": {"A": 0.0005 * i, "B": -0.0005 * i},
            "anchor": {"A": 100.0, "B": 100.0}, "elapsed": 0.5, "exog": {},
            "window_start": dt.datetime(2026, 1, 1, tzinfo=ET) + dt.timedelta(days=i),
        } for i in range(60)]
        monkeypatch.setattr(score, "snapshots", lambda w, e: obs)
        score.walk_forward([], 0.5, lookback=10, min_train=20)
        for i, train_starts in enumerate(seen):
            scored = obs[20 + i]["window_start"]
            assert scored not in train_starts, "scored window leaked into its own training set"
            assert all(t < scored for t in train_starts), "future window used for training"


class TestLedger:
    def test_stale_names_are_excluded(self):
        from lighthouse import ledger
        rows = [ledger.Row(
            window_start="", window_end="", kind="overnight", horizon=0.5, as_of="",
            symbol="RSTALEUSDT", anchor_close=100.0, venue_quote=100.0, fair_value=100.0,
            reopen=100.0, quote_move_bps=0.0, fair_move_bps=0.0, realised_bps=0.0,
            err_lighthouse_bps=1.0, err_venue_bps=0.0, err_lastclose_bps=0.0,
            lam_common=0.0, lam_idio=0.0, n_train=40) for _ in range(50)]
        assert ledger.per_symbol(rows) == [], "a book that never moves must not be scored"
