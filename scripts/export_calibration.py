"""Freeze the fitted model + validation record into a JSON the desk can load."""
import glob, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import numpy as np
from lighthouse import dataset, ledger, models, score

syms = sorted(os.path.basename(p).replace("_1h.json", "") for p in glob.glob("data/cache/*_1h.json") if os.path.basename(p).startswith("R"))
windows = dataset.build_windows(syms)
overnight = [w for w in windows if w.kind == "overnight"]
weekend = [w for w in windows if w.kind == "weekend"]

# Drop books that never reprice across the dark window: they are stale quotes,
# not cheap information, and they would flatter every aggregate.
active = set(ledger.active_symbols(overnight))
for w in windows:
    for s2 in list(w.anchor):
        if s2 not in active:
            w.anchor.pop(s2, None); w.target.pop(s2, None); w.quotes.pop(s2, None)
overnight = [w for w in overnight if len(w.symbols()) >= 8]
weekend = [w for w in weekend if len(w.symbols()) >= 8]
syms = sorted(active)

# Calibrate on the most recent snapshots across the whole dark window.
train = []
for el in (0.15, 0.25, 0.35, 0.45, 0.55, 0.65, 0.75, 0.85, 0.95):
    train += score.snapshots(overnight, el)
cal = models.LighthouseCalibrated().fit(train)

validation = {}
for el in (0.25, 0.50, 0.75, 0.90):
    r = score.walk_forward(overnight, el)
    if not r.get("insufficient"):
        validation[f"{el:.2f}"] = r

# How far the venue quote overshoots the move that actually sticks.
overshoot = {}
for el in (0.25, 0.50, 0.75, 0.90):
    obs = score.snapshots(overnight, el)
    q = np.array([abs(v) for o in obs for v in o["dark_ret"].values()]) * 1e4
    t = np.array([abs(v) for o in obs for v in o["truth"].values()]) * 1e4
    overshoot[f"{el:.2f}"] = {"median_quote_move_bps": float(np.median(q)),
                              "median_realised_bps": float(np.median(t)),
                              "ratio": float(np.median(q) / np.median(t))}

weekend_gap = []
for w in weekend:
    for s in w.symbols():
        weekend_gap.append(abs(w.target[s] / w.anchor[s] - 1) * 1e4)
wg = np.array(weekend_gap)

out = {
    "generated_utc": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(timespec="seconds"),
    "universe": syms,
    "universe_dropped_stale": sorted(set(os.path.basename(p).replace("_1h.json","") for p in glob.glob("data/cache/*_1h.json") if os.path.basename(p).startswith("R")) - active),
    "n_windows": {"overnight": len(overnight), "weekend": len(weekend)},
    "span": [str(windows[0].start.date()), str(windows[-1].end.date())],
    "edges": list(cal.EDGES),
    "lambda": {str(k): list(v) for k, v in cal.lam.items()},
    "band_bps": {str(k): (None if np.isnan(v) else round(v, 1)) for k, v in cal.residual_bps.items()},
    "beta": {k: round(v, 3) for k, v in cal.beta.items()},
    "validation": validation,
    "overshoot": overshoot,
    "weekend_gap": {"n": int(wg.size), "median_bps": float(np.median(wg)),
                    "p90_bps": float(np.percentile(wg, 90)),
                    "share_over_200bps": float((wg > 200).mean())},
}
path = "web/calibration.json"
json.dump(out, open(path, "w"), indent=2)
print(f"wrote {path}")
print(f"  universe {len(syms)} | overnight {len(overnight)} | weekend {len(weekend)}")
print(f"  lambda: " + ", ".join(f"{cal.bucket_label(int(k))}={v[0]:.2f}/{v[1]:.2f}" for k, v in sorted(cal.lam.items())))
print(f"  bands:  " + ", ".join(f"{cal.bucket_label(int(k))}={v:.0f}bps" for k, v in sorted(cal.residual_bps.items()) if not np.isnan(v)))
print(f"  overshoot ratios: " + ", ".join(f"{k}={v['ratio']:.2f}x" for k, v in overshoot.items()))
print(f"  weekend gap: median {np.median(wg):.0f}bps p90 {np.percentile(wg,90):.0f}bps >200bps {100*(wg>200).mean():.0f}%")
