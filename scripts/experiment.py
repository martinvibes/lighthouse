import glob, os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from lighthouse import dataset, score

syms = sorted(os.path.basename(p).replace("_1h.json", "") for p in glob.glob("data/cache/*_1h.json"))
windows = dataset.build_windows(syms)
print(f"universe {len(syms)} symbols | {len(windows)} dark windows "
      f"({sum(w.kind=='weekend' for w in windows)} weekend, {sum(w.kind=='overnight' for w in windows)} overnight)")
print(f"span {windows[0].start.date()} .. {windows[-1].end.date()}\n")

for label, subset in [("ALL", windows),
                      ("WEEKEND", [w for w in windows if w.kind == "weekend"]),
                      ("OVERNIGHT", [w for w in windows if w.kind == "overnight"])]:
    print(f"=== {label} (n={len(subset)}) ===")
    hdr = f"{'elapsed':>8s} {'obs':>5s} {'test n':>7s} " + "".join(f"{m:>16s}" for m in ["last_close", "venue_quote", "lighthouse"])
    print(hdr)
    for el in (0.25, 0.50, 0.75, 0.90, 0.98):
        r = score.evaluate(subset, el)
        if r.get("insufficient"):
            print(f"{el:8.0%} {r['n_windows']:5d}   insufficient")
            continue
        cells = ""
        for m in ["last_close", "venue_quote", "lighthouse"]:
            d = r["models"][m]
            cells += f"{d['medae']:10.1f}bps" + (f"{d['vs_baseline_pct']:+5.0f}%" if m != "last_close" else "     ")
        print(f"{el:8.0%} {r['n_windows']:5d} {r['n_test']:7d} {cells}")
    r = score.evaluate(subset, 0.75)
    if not r.get("insufficient"):
        print(f"   train<= {r['train_until']}  test>= {r['test_from']}  fit: {r.get('fit')}")
    print()
