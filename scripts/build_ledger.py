import glob, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from lighthouse import dataset, ledger

syms = sorted(os.path.basename(p).replace("_1h.json","") for p in glob.glob("data/cache/*_1h.json") if os.path.basename(p).startswith("R"))
windows = dataset.build_windows(syms)
overnight = [w for w in windows if w.kind == "overnight"]
print(f"universe {len(syms)} | dark windows {len(windows)} ({len(overnight)} overnight)")
active = set(ledger.active_symbols(overnight))
print(f"active names (median reopen move >= 5bps): {len(active)} of {len(syms)}")
dropped = sorted(set(syms) - active)
print(f"dropped as stale: {', '.join(d[1:].replace('USDT','') for d in dropped[:14])}{' ...' if len(dropped)>14 else ''}")
overnight = [w for w in overnight]
for w in overnight:
    for s2 in list(w.anchor):
        if s2 not in active:
            w.anchor.pop(s2, None); w.target.pop(s2, None); w.quotes.pop(s2, None)
overnight = [w for w in overnight if len(w.symbols()) >= 8]
rows = ledger.build(overnight)
os.makedirs("web", exist_ok=True)
ledger.write_csv(rows, "data/ledger.csv")
summary = ledger.summarise(rows)
by_sym = ledger.per_symbol(rows)
json.dump({"summary": summary, "per_symbol": by_sym}, open("web/ledger.json","w"), indent=2)
print(f"ledger rows: {len(rows):,}  ->  data/ledger.csv")
for h, d in summary["by_horizon"].items():
    print(f"  {float(h):.0%} into window  n={d['n']:5d}  lighthouse {d['lighthouse_medae']:6.1f}  "
          f"venue {d['venue_medae']:6.1f}  lastclose {d['last_close_medae']:6.1f}  "
          f"({d['lighthouse_vs_lastclose_pct']:+.0f}% vs lastclose, beats venue {d['lighthouse_beats_venue_share']:.0%})")
print(f"\nper-symbol rows: {len(by_sym)}")
for d in by_sym[:6]:
    print(f"  best  {d['ticker']:6s} n={d['n']:4d} lighthouse {d['lighthouse']:6.1f} vs lastclose {d['last_close']:6.1f} ({d['vs_lastclose_pct']:+.0f}%)")
for d in by_sym[-4:]:
    print(f"  worst {d['ticker']:6s} n={d['n']:4d} lighthouse {d['lighthouse']:6.1f} vs lastclose {d['last_close']:6.1f} ({d['vs_lastclose_pct']:+.0f}%)")
