"""Fetch and cache hourly candles for the rToken universe."""
from __future__ import annotations

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from lighthouse import bitget, universe  # noqa: E402


def main() -> None:
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 60
    pages = int(sys.argv[2]) if len(sys.argv) > 2 else 22
    print(f"selecting top {n} rTokens by 24h turnover ...", flush=True)
    universe.save_universe(n)
    uni = universe.load_universe()
    for i, row in enumerate(uni, 1):
        sym = row["symbol"]
        path = universe.cache_path(f"{sym}_1h.json")
        if os.path.exists(path):
            print(f"[{i}/{len(uni)}] {sym} cached", flush=True)
            continue
        rows = bitget.candle_history(sym, "1h", pages=pages)
        with open(path, "w") as fh:
            json.dump(rows, fh)
        print(f"[{i}/{len(uni)}] {sym} {len(rows)} bars", flush=True)


if __name__ == "__main__":
    main()
