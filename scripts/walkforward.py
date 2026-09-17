import glob, os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from lighthouse import dataset, score

syms = sorted(os.path.basename(p).replace("_1h.json", "") for p in glob.glob("data/cache/*_1h.json") if os.path.basename(p).startswith("R"))
windows = dataset.build_windows(syms)
print(f"universe {len(syms)} rTokens | {len(windows)} dark windows | span {windows[0].start.date()} .. {windows[-1].end.date()}")
print("walk-forward: calibrate on the trailing 40 closed windows, predict the next. no future data.\n")
for label, subset in [("OVERNIGHT (20:00-04:00 ET)", [w for w in windows if w.kind == "overnight"]),
                      ("WEEKEND (Fri 20:00 - Mon 04:00 ET)", [w for w in windows if w.kind == "weekend"])]:
    print(f"=== {label}  n={len(subset)} ===")
    print(f"{'into window':>12s} {'scored':>7s} {'last close':>12s} {'venue quote':>20s} {'lighthouse':>20s} {'lambda c/i':>14s}")
    for el in (0.25, 0.50, 0.75, 0.90):
        r = score.walk_forward(subset, el)
        if r.get("insufficient"):
            print(f"{el:11.0%} {r['n']:7d}   insufficient")
            continue
        m = r["models"]
        print(f"{el:11.0%} {r['n_scored']:7d} {m['last_close']['medae']:9.1f}bps "
              f"{m['venue_quote']['medae']:12.1f}bps{m['venue_quote']['vs_baseline_pct']:+6.0f}% "
              f"{m['lighthouse_cal']['medae']:12.1f}bps{m['lighthouse_cal']['vs_baseline_pct']:+6.0f}% "
              f"{r['mean_lambda'][0]:6.2f}/{r['mean_lambda'][1]:.2f}")
    print()
