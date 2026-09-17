"""Selecting and caching the rToken universe."""
from __future__ import annotations

import json
import os

from . import bitget

CACHE = os.path.join(os.path.dirname(__file__), "..", "data", "cache")


def cache_path(name: str) -> str:
    os.makedirs(CACHE, exist_ok=True)
    return os.path.abspath(os.path.join(CACHE, name))


def top_by_turnover(n: int = 60) -> list[dict]:
    """Most-traded rTokens by 24h USDT turnover, with their ticker snapshot."""
    live = {s["symbol"]: s for s in bitget.rtoken_symbols()}
    rows = [t for t in bitget.tickers() if t["symbol"] in live]
    rows.sort(key=lambda t: -float(t.get("usdtVolume") or 0))
    out = []
    for t in rows[:n]:
        out.append(
            {
                "symbol": t["symbol"],
                "base": live[t["symbol"]]["baseCoin"],
                "ticker": live[t["symbol"]]["baseCoin"][1:],
                "usdt_volume_24h": float(t.get("usdtVolume") or 0),
                "last": float(t.get("lastPr") or 0),
            }
        )
    return out


def save_universe(n: int = 60) -> str:
    uni = top_by_turnover(n)
    path = cache_path("universe.json")
    with open(path, "w") as fh:
        json.dump(uni, fh, indent=2)
    return path


def load_universe() -> list[dict]:
    with open(cache_path("universe.json")) as fh:
        return json.load(fh)
