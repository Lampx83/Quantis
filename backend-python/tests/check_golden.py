"""So run_panel với đáp án vàng (tests/panel_golden.json, sinh bằng linearmodels 7.0). Chạy được ngay trong container quantis-python:
   docker exec quantis-python python /tmp/check_golden.py /tmp/panel_golden.json"""
import json, os, sys
sys.path.insert(0, os.environ.get("PANEL_APP_DIR", "/app"))
from panel_impl import run_panel

g = json.load(open(sys.argv[1]))
worst = 0.0
for label, d in g.items():
    r = run_panel(d["rows"], "y", d["xs"], "firm", "year")
    pairs = {
        "pooled coef": ([c["coef"] for c in r["pooled"]["coefficients"]], d["pooled"]["coef"]),
        "pooled se": ([c["se"] for c in r["pooled"]["coefficients"]], d["pooled"]["se"]),
        "pooled r2": ([r["pooled"]["r2"]], [d["pooled"]["r2"]]),
        "fe coef": ([c["coef"] for c in r["fixed"]["coefficients"]], d["fe"]["coef"]),
        "fe se": ([c["se"] for c in r["fixed"]["coefficients"]], d["fe"]["se"]),
        "fe r2 w/b/o": ([r["fixed"]["r2Within"], r["fixed"]["r2Between"], r["fixed"]["r2Overall"]], [d["fe"]["r2w"], d["fe"]["r2b"], d["fe"]["r2o"]]),
        "fe F(entity)": ([r["fixed"]["fEntity"]], [d["fe"]["fent"]]),
        "re coef": ([c["coef"] for c in r["random"]["coefficients"]], d["re"]["coef"]),
        "re se": ([c["se"] for c in r["random"]["coefficients"]], d["re"]["se"]),
        "re sigma_u,sigma_e": ([r["random"]["sigmaU"], r["random"]["sigmaE"]], [d["re"]["sigma_u"], d["re"]["sigma_e"]]),
        "re r2 overall": ([r["random"]["r2Overall"]], [d["re"]["r2o"]]),
        "hausman chi2,p": ([r["hausman"]["chi2"], r["hausman"]["p"]], [d["hausman"]["chi2"], d["hausman"]["p"]]),
    }
    print(f"== {label}: n={r['nObs']}, groups={r['nGroups']}, balanced={r['balanced']}")
    for k, (a, b) in pairs.items():
        e = max(abs(x - y) for x, y in zip(a, b))
        worst = max(worst, e)
        print(f"  {k:22s} max|diff| = {e:.2e}")
print("WORST", f"{worst:.2e}")
sys.exit(0 if worst < 1e-8 else 1)
