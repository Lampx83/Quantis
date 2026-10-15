"""
Kiểm thử panel_impl.run_panel:
  1) bộ dữ liệu nhỏ có đáp án tính tay (FE slope = 2 chính xác);
  2) đối chiếu với linearmodels (PooledOLS / PanelOLS / RandomEffects) + statsmodels (LSDV) + Hausman tính tay
     trên panel cân bằng và không cân bằng. Bỏ qua phần (2) nếu chưa cài linearmodels.
Chạy:  cd backend-python && python -m pytest tests/test_panel.py -q   (hoặc python tests/test_panel.py)
"""
import os
import sys

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from panel_impl import run_panel  # noqa: E402


def _rows(df):
    return [list(map(str, df.columns))] + df.astype(str).values.tolist()


def make_panel(n_ent=30, n_t=6, seed=7, unbalanced=False, time_invariant=False):
    rng = np.random.default_rng(seed)
    recs = []
    alpha = rng.normal(0, 2.0, n_ent)
    for i in range(n_ent):
        zi = rng.normal()
        for t in range(n_t):
            x1 = rng.normal() + 0.8 * alpha[i]            # tương quan với hiệu ứng đơn vị -> FE/RE khác nhau
            x2 = rng.normal() + 0.3 * t
            e = rng.normal(0, 1.0)
            y = 1.5 + 2.0 * x1 - 1.0 * x2 + alpha[i] + 0.5 * zi + e
            rec = {"firm": f"F{i:02d}", "year": 2000 + t, "y": y, "x1": x1, "x2": x2}
            if time_invariant:
                rec["z"] = zi
            recs.append(rec)
    df = pd.DataFrame(recs)
    if unbalanced:
        drop = rng.random(len(df)) < 0.2
        df = df[~drop].reset_index(drop=True)
    return df


def test_hand_example():
    # 2 đơn vị x 3 năm; trong từng đơn vị y = 2x + const_i => FE slope = 2, R² within = 1
    df = pd.DataFrame({
        "id": ["A"] * 3 + ["B"] * 3,
        "t": [1, 2, 3] * 2,
        "x": [1, 2, 3, 4, 5, 6],
        "y": [2, 4, 6, 3, 5, 7],
    })
    r = run_panel(_rows(df), "y", ["x"], "id", "t")
    fe = r["fixed"]
    assert abs(fe["coefficients"][0]["coef"] - 2.0) < 1e-12
    assert abs(fe["r2Within"] - 1.0) < 1e-12
    assert r["nObs"] == 6 and r["nGroups"] == 2 and r["balanced"] is True
    # OLS gộp tính tay: x̄=3.5, ȳ=4.5; Sxy = Σ(x-x̄)(y-ȳ) = 2.5*? -> dùng numpy polyfit làm đáp án độc lập
    b = np.polyfit(df["x"], df["y"], 1)
    assert abs(r["pooled"]["coefficients"][1]["coef"] - b[0]) < 1e-12
    assert abs(r["pooled"]["coefficients"][0]["coef"] - b[1]) < 1e-12


def test_duplicate_pairs_rejected():
    df = pd.DataFrame({"id": ["A", "A", "B", "B"], "t": [1, 1, 1, 2], "x": [1, 2, 3, 4], "y": [1, 2, 3, 5]})
    try:
        run_panel(_rows(df), "y", ["x"], "id", "t")
    except ValueError as e:
        assert "trùng" in str(e)
    else:
        raise AssertionError("expected ValueError")


def _compare(df, xs, tol):
    from linearmodels.panel import PanelOLS, PooledOLS, RandomEffects
    from scipy import stats

    r = run_panel(_rows(df), "y", xs, "firm", "year")
    d = df.set_index(["firm", "year"])
    y = d["y"]
    X = d[xs]
    Xc = X.copy()
    Xc.insert(0, "const", 1.0)
    out = {}

    def cmp(label, mine, ref):
        err = float(np.max(np.abs(np.asarray(mine, float) - np.asarray(ref, float))))
        out[label] = err
        assert err < tol, f"{label}: max abs err {err}"

    pooled = PooledOLS(y, Xc).fit(cov_type="unadjusted")
    cmp("pooled coef", [c["coef"] for c in r["pooled"]["coefficients"]], pooled.params.values)
    cmp("pooled se", [c["se"] for c in r["pooled"]["coefficients"]], pooled.std_errors.values)
    cmp("pooled p", [c["p"] for c in r["pooled"]["coefficients"]], pooled.pvalues.values)
    cmp("pooled r2", [r["pooled"]["r2"]], [pooled.rsquared])

    fe = PanelOLS(y, X, entity_effects=True).fit(cov_type="unadjusted")
    cmp("fe coef", [c["coef"] for c in r["fixed"]["coefficients"]], fe.params.values)
    cmp("fe se", [c["se"] for c in r["fixed"]["coefficients"]], fe.std_errors.values)
    cmp("fe p", [c["p"] for c in r["fixed"]["coefficients"]], fe.pvalues.values)
    cmp("fe r2 within", [r["fixed"]["r2Within"]], [fe.corr_squared_within])
    cmp("fe r2 between", [r["fixed"]["r2Between"]], [fe.corr_squared_between])
    cmp("fe r2 overall", [r["fixed"]["r2Overall"]], [fe.corr_squared_overall])
    cmp("fe F(entity)", [r["fixed"]["fEntity"]], [fe.f_pooled.stat])
    cmp("fe F(slopes)", [r["fixed"]["fStat"]], [fe.f_statistic.stat])

    re_ = RandomEffects(y, Xc).fit(cov_type="unadjusted")
    cmp("re coef", [c["coef"] for c in r["random"]["coefficients"]], re_.params.values)
    cmp("re se", [c["se"] for c in r["random"]["coefficients"]], re_.std_errors.values)
    cmp("re p", [c["p"] for c in r["random"]["coefficients"]], re_.pvalues.values)
    cmp("re sigma_u", [r["random"]["sigmaU"]], [re_.variance_decomposition["Effects"] ** 0.5])
    cmp("re sigma_e", [r["random"]["sigmaE"]], [re_.variance_decomposition["Residual"] ** 0.5])
    cmp("re rho", [r["random"]["rho"]], [re_.variance_decomposition["Percent due to Effects"]])
    cmp("re r2 within", [r["random"]["r2Within"]], [re_.corr_squared_within])
    cmp("re r2 between", [r["random"]["r2Between"]], [re_.corr_squared_between])
    cmp("re r2 overall", [r["random"]["r2Overall"]], [re_.corr_squared_overall])

    # Hausman tính tay từ kết quả linearmodels
    bfe, bre = fe.params, re_.params[xs]
    Vd = fe.cov.values - re_.cov.loc[xs, xs].values
    diff = (bfe - bre).values
    H = float(diff @ np.linalg.inv(Vd) @ diff)
    cmp("hausman chi2", [r["hausman"]["chi2"]], [H])
    cmp("hausman p", [r["hausman"]["p"]], [stats.chi2.sf(H, len(xs))])

    # LSDV bằng statsmodels (độc lập hoàn toàn với linearmodels)
    import statsmodels.api as sm
    dm = df.copy()
    D = pd.get_dummies(dm["firm"], drop_first=True, dtype=float)
    Xl = sm.add_constant(pd.concat([dm[xs], D], axis=1))
    ls = sm.OLS(dm["y"], Xl).fit()
    cmp("lsdv coef", [c["coef"] for c in r["fixed"]["coefficients"]], ls.params[xs].values)
    cmp("lsdv se", [c["se"] for c in r["fixed"]["coefficients"]], ls.bse[xs].values)
    return out


def test_vs_linearmodels_balanced():
    try:
        import linearmodels  # noqa: F401
    except ImportError:
        return
    errs = _compare(make_panel(), ["x1", "x2"], 1e-8)
    print("balanced max errors:", {k: f"{v:.2e}" for k, v in errs.items()})


def test_vs_linearmodels_unbalanced():
    try:
        import linearmodels  # noqa: F401
    except ImportError:
        return
    errs = _compare(make_panel(n_ent=40, n_t=7, seed=11, unbalanced=True), ["x1", "x2"], 1e-8)
    print("unbalanced max errors:", {k: f"{v:.2e}" for k, v in errs.items()})


if __name__ == "__main__":
    test_hand_example()
    test_duplicate_pairs_rejected()
    test_vs_linearmodels_balanced()
    test_vs_linearmodels_unbalanced()
    print("OK")
