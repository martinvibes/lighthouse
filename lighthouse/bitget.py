"""Thin, dependency-light client for Bitget's public spot market API.

Only public endpoints are used: no API key, no account, no signing. Everything
here is read-only market data.
"""
from __future__ import annotations

import json
import time
import urllib.parse
import urllib.request
from typing import Any, Iterable

BASE = "https://api.bitget.com"
UA = "lighthouse/0.1 (+https://github.com/martinvibes/lighthouse)"


class BitgetError(RuntimeError):
    pass


def _get(path: str, params: dict[str, Any] | None = None, retries: int = 4) -> Any:
    url = f"{BASE}{path}"
    if params:
        url += "?" + urllib.parse.urlencode(params)
    last: Exception | None = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=30) as resp:
                payload = json.load(resp)
            if payload.get("code") != "00000":
                raise BitgetError(f"{payload.get('code')}: {payload.get('msg')} ({url})")
            return payload.get("data")
        except Exception as exc:  # noqa: BLE001 - retry any transport error
            last = exc
            time.sleep(0.4 * (attempt + 1))
    raise BitgetError(f"failed after {retries} attempts: {last}")


def symbols() -> list[dict]:
    """All spot symbols. rTokens have a baseCoin starting with a lowercase 'r'."""
    return _get("/api/v2/spot/public/symbols")


def rtoken_symbols(online_only: bool = True) -> list[dict]:
    out = []
    for s in symbols():
        base = s.get("baseCoin", "")
        if not base.startswith("r") or s.get("quoteCoin") != "USDT":
            continue
        if online_only and s.get("status") != "online":
            continue
        out.append(s)
    return out


def tickers() -> list[dict]:
    """24h ticker snapshot for every symbol - used to rank the universe by turnover."""
    return _get("/api/v2/spot/market/tickers")


def history_candles(
    symbol: str, granularity: str = "1h", end_ms: int | None = None, limit: int = 200
) -> list[list[str]]:
    """One page of history. `endTime` is REQUIRED by this endpoint.

    Returns oldest-first rows of [ts, open, high, low, close, baseVol, quoteVol, usdtVol].
    """
    if end_ms is None:
        end_ms = int(time.time() * 1000)
    return _get(
        "/api/v2/spot/market/history-candles",
        {"symbol": symbol, "granularity": granularity, "endTime": end_ms, "limit": limit},
    )


def candle_history(
    symbol: str, granularity: str = "1h", pages: int = 24, pause: float = 0.12
) -> list[list[str]]:
    """Page backwards from now, de-duplicated and sorted oldest-first."""
    end = int(time.time() * 1000)
    seen: dict[int, list[str]] = {}
    for _ in range(pages):
        rows = history_candles(symbol, granularity, end)
        if not rows:
            break
        for row in rows:
            seen[int(row[0])] = row
        oldest = int(rows[0][0])
        if oldest >= end:
            break
        end = oldest
        time.sleep(pause)
    return [seen[k] for k in sorted(seen)]
