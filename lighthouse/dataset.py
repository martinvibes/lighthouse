"""Turn cached hourly candles into 'dark window' observations.

A dark window is any stretch when NYSE/Nasdaq are shut but rTokens keep quoting:
an overnight (Mon-Thu 16:00 ET -> next 09:00 ET) or a weekend (Fri -> Mon).

For each window we record, per symbol, the last regular-session price before the
close, the series of quotes during the dark stretch, and the price when the
session reopens. That reopen price is the ground truth every model is scored on.
"""
from __future__ import annotations

import datetime as dt
import json
import os
from dataclasses import dataclass, field
from zoneinfo import ZoneInfo

from . import universe

ET = ZoneInfo("America/New_York")
UTC = ZoneInfo("UTC")

# US extended-hours trading runs 04:00-20:00 ET, so 16:00->09:00 is NOT dark.
# The genuinely dark stretch - no US venue of any kind quoting - is 20:00->04:00 ET.
SESSION_OPEN_HOUR = 4    # 04:00 ET bar: US pre-market reopens, our ground truth
SESSION_LAST_HOUR = 19   # 19:00 ET bar; its close is the 20:00 ET post-market close


@dataclass
class Bar:
    t: dt.datetime
    open: float
    high: float
    low: float
    close: float
    volume: float


@dataclass
class Window:
    kind: str                     # "overnight" | "weekend"
    start: dt.datetime            # session close, ET
    end: dt.datetime              # session reopen, ET
    anchor: dict[str, float] = field(default_factory=dict)   # symbol -> last close
    target: dict[str, float] = field(default_factory=dict)   # symbol -> reopen price
    quotes: dict[str, list[Bar]] = field(default_factory=dict)

    @property
    def hours(self) -> float:
        return (self.end - self.start).total_seconds() / 3600

    def symbols(self) -> list[str]:
        return sorted(set(self.anchor) & set(self.target))

    def quote_at(self, symbol: str, when: dt.datetime, max_lag_h: float = 8.0) -> float | None:
        """Most recent quote at or before `when`, if one exists within max_lag."""
        best: Bar | None = None
        for bar in self.quotes.get(symbol, []):
            if bar.t <= when and (best is None or bar.t > best.t):
                best = bar
        if best is None:
            return None
        if (when - best.t).total_seconds() > max_lag_h * 3600:
            return None
        return best.close

    def elapsed_fraction(self, when: dt.datetime) -> float:
        return max(0.0, min(1.0, (when - self.start).total_seconds() / (self.end - self.start).total_seconds()))


def load_bars(symbol: str) -> list[Bar]:
    path = universe.cache_path(f"{symbol}_1h.json")
    if not os.path.exists(path):
        return []
    with open(path) as fh:
        raw = json.load(fh)
    bars = []
    for row in raw:
        t = dt.datetime.fromtimestamp(int(row[0]) / 1000, UTC).astimezone(ET)
        bars.append(Bar(t, float(row[1]), float(row[2]), float(row[3]), float(row[4]), float(row[5])))
    bars.sort(key=lambda b: b.t)
    return bars


def _session_days(bars: list[Bar]) -> dict[dt.date, list[Bar]]:
    by: dict[dt.date, list[Bar]] = {}
    for b in bars:
        by.setdefault(b.t.date(), []).append(b)
    return by


def build_windows(symbols: list[str]) -> list[Window]:
    """Build every dark window that at least one symbol covers."""
    series = {s: load_bars(s) for s in symbols}
    series = {s: b for s, b in series.items() if b}
    if not series:
        return []

    # Candidate session days: any weekday on which some symbol printed a 09:00 and 15:00 bar.
    day_sets: dict[dt.date, set[str]] = {}
    per_symbol_days: dict[str, dict[dt.date, list[Bar]]] = {}
    for sym, bars in series.items():
        byday = _session_days(bars)
        per_symbol_days[sym] = byday
        for day, dbars in byday.items():
            if day.weekday() >= 5:
                continue
            hours = {b.t.hour for b in dbars}
            if SESSION_OPEN_HOUR in hours and SESSION_LAST_HOUR in hours:
                day_sets.setdefault(day, set()).add(sym)

    days = sorted(day_sets)
    windows: list[Window] = []
    for i in range(len(days) - 1):
        d0, d1 = days[i], days[i + 1]
        gap = (d1 - d0).days
        if gap == 1:
            kind = "overnight"
        elif gap == 3 and d0.weekday() == 4:
            kind = "weekend"
        else:
            continue  # holiday-extended or missing day: skip rather than mislabel

        start = dt.datetime.combine(d0, dt.time(SESSION_LAST_HOUR + 1), tzinfo=ET)
        end = dt.datetime.combine(d1, dt.time(SESSION_OPEN_HOUR), tzinfo=ET)
        if end <= start:
            continue
        w = Window(kind=kind, start=start, end=end)

        for sym in sorted(day_sets[d0] & day_sets[d1]):
            byday = per_symbol_days[sym]
            close_bar = next((b for b in byday[d0] if b.t.hour == SESSION_LAST_HOUR), None)
            open_bar = next((b for b in byday[d1] if b.t.hour == SESSION_OPEN_HOUR), None)
            if not close_bar or not open_bar:
                continue
            if close_bar.close <= 0 or open_bar.open <= 0:
                continue
            w.anchor[sym] = close_bar.close
            w.target[sym] = open_bar.open
            w.quotes[sym] = [b for b in series[sym] if start < b.t < end]
        if w.symbols():
            windows.append(w)
    return windows


def observations(window: Window, when: dt.datetime, min_symbols: int = 8) -> dict | None:
    """Snapshot of what is knowable at time `when` inside a dark window."""
    syms = window.symbols()
    dark_ret: dict[str, float] = {}
    for s in syms:
        q = window.quote_at(s, when)
        if q is None or q <= 0:
            continue
        dark_ret[s] = q / window.anchor[s] - 1.0
    if len(dark_ret) < min_symbols:
        return None
    truth = {s: window.target[s] / window.anchor[s] - 1.0 for s in syms}
    return {
        "when": when,
        "kind": window.kind,
        "elapsed": window.elapsed_fraction(when),
        "dark_ret": dark_ret,
        "truth": truth,
        "anchor": dict(window.anchor),
    }
