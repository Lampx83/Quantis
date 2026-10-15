"""
Phân tích dữ liệu bảng (panel) — numpy + scipy, không cần thêm thư viện.

  * Thống kê mô tả tổng thể / giữa các đơn vị (between) / trong từng đơn vị (within)
  * Hồi quy OLS gộp (pooled), Ảnh hưởng cố định (Fixed Effects, within),
    Ảnh hưởng ngẫu nhiên (Random Effects, Swamy-Arora như Stata `xtreg, re` / linearmodels RandomEffects)
  * Kiểm định Hausman (FE vs RE)

Sai số chuẩn: cổ điển (homoskedastic). FE/Pooled/RE đều dùng phân phối t với df = số bậc tự do dư.
Đối chiếu với linearmodels 7.0 / statsmodels 0.15 (xem docs hoặc tests ở repo).
"""
from __future__ import annotations

import math

import numpy as np
import pandas as pd
from scipy import stats as sps

from analysis_impl import _rows_to_df

_EPS = 1e-10


def _num(x) -> float | None:
    """float an toàn cho JSON (NaN/inf -> None)."""
    try:
        v = float(x)
    except (TypeError, ValueError):
        return None
    return v if math.isfinite(v) else None


def _ols_fit(y: np.ndarray, X: np.ndarray):
    """OLS bằng lstsq. Trả (beta, resid, rank)."""
    beta, _res, rank, _sv = np.linalg.lstsq(X, y, rcond=None)
    resid = y - X @ beta
    return beta, resid, int(rank)


def _coef_table(names, beta, cov, df, dist="t", alpha=0.05):
    se = np.sqrt(np.clip(np.diag(cov), 0, None))
    out = []
    for i, nm in enumerate(names):
        b, s = float(beta[i]), float(se[i])
        tv = b / s if s > 0 else float("nan")
        if dist == "t" and df > 0:
            p = 2 * sps.t.sf(abs(tv), df)
            crit = sps.t.ppf(1 - alpha / 2, df)
        else:
            p = 2 * sps.norm.sf(abs(tv))
            crit = sps.norm.ppf(1 - alpha / 2)
        out.append({
            "name": nm, "coef": _num(b), "se": _num(s), "t": _num(tv), "p": _num(p),
            "ciLower": _num(b - crit * s), "ciUpper": _num(b + crit * s),
        })
    return out


def _corr2(a: np.ndarray, b: np.ndarray) -> float:
    if len(a) < 2:
        return float("nan")
    sa, sb = np.std(a), np.std(b)
    if sa < _EPS or sb < _EPS:
        return float("nan")
    return float(np.corrcoef(a, b)[0, 1] ** 2)


def _group_mean(M: np.ndarray, codes: np.ndarray, n_groups: int, counts: np.ndarray) -> np.ndarray:
    """Trung bình theo nhóm cho ma trận M (n x k) -> (n_groups x k)."""
    sums = np.zeros((n_groups, M.shape[1]))
    np.add.at(sums, codes, M)
    return sums / counts[:, None]


def _prepare(rows, y_col, x_cols, entity_col, time_col):
    df = _rows_to_df(rows)
    for c in [y_col, entity_col, time_col] + list(x_cols):
        if c not in df.columns:
            raise ValueError(f"Không tìm thấy cột «{c}» trong dữ liệu")
    if not x_cols:
        raise ValueError("Cần chọn ít nhất một biến độc lập")
    if len(set(x_cols)) != len(x_cols):
        raise ValueError("Biến độc lập bị chọn trùng")
    if y_col in x_cols:
        raise ValueError("Biến phụ thuộc không được nằm trong danh sách biến độc lập")
    if entity_col in x_cols or entity_col == y_col:
        raise ValueError("Biến định danh đơn vị không được dùng làm biến phân tích")
    if time_col == entity_col:
        raise ValueError("Biến thời gian phải khác biến định danh đơn vị")
    if time_col in x_cols or time_col == y_col:
        raise ValueError("Biến thời gian không dùng làm biến phân tích; hãy bật «hiệu ứng thời gian» nếu cần")

    n_before = len(df)
    ent = df[entity_col].astype("string").str.strip()
    tim = df[time_col].astype("string").str.strip()
    nums = df[[y_col] + list(x_cols)].apply(pd.to_numeric, errors="coerce")
    ok = ent.notna() & (ent != "") & tim.notna() & (tim != "") & nums.notna().all(axis=1)
    ent, tim, nums = ent[ok], tim[ok], nums[ok]
    n_dropped = n_before - int(ok.sum())
    if len(nums) < 4:
        raise ValueError("Không đủ quan sát hợp lệ (cần ít nhất 4 dòng đủ giá trị)")

    # Thời gian: sắp theo số nếu tất cả là số, ngược lại theo chuỗi
    tnum = pd.to_numeric(tim, errors="coerce")
    t_key = tnum if tnum.notna().all() else tim
    frame = pd.DataFrame({"ent": ent.values, "tim": tim.values, "tkey": t_key.values})
    dup = frame.duplicated(["ent", "tim"], keep=False)
    if dup.any():
        ex = frame[dup].drop_duplicates(["ent", "tim"]).head(3)
        sample = "; ".join(f"({a}, {b})" for a, b in zip(ex["ent"], ex["tim"]))
        raise ValueError(
            f"Có {int(dup.sum())} dòng trùng cặp (đơn vị, thời gian), ví dụ: {sample}. "
            "Mỗi đơn vị chỉ được có một quan sát ở mỗi thời điểm — hãy xoá dòng trùng hoặc gộp trước."
        )
    order = np.lexsort((frame["tkey"].to_numpy(), frame["ent"].to_numpy()))
    frame = frame.iloc[order].reset_index(drop=True)
    nums = nums.iloc[order].reset_index(drop=True)
    return frame, nums, n_dropped


def run_panel(rows: list, y_col: str, x_cols: list, entity_col: str, time_col: str,
              time_effects: bool = False) -> dict:
    x_cols = list(x_cols)
    frame, nums, n_dropped = _prepare(rows, y_col, x_cols, entity_col, time_col)

    y = nums[y_col].to_numpy(float)
    Xdf = nums[x_cols].copy()
    # Hiệu ứng thời gian: thêm biến giả cho mỗi thời điểm (bỏ thời điểm đầu)
    time_levels = None
    if time_effects:
        tk = pd.Series(frame["tkey"].to_numpy())
        levels = sorted(tk.unique().tolist())
        if len(levels) < 2:
            raise ValueError("Cần ít nhất 2 thời điểm để thêm hiệu ứng thời gian")
        lab = dict(zip(frame["tkey"].to_numpy().tolist(), frame["tim"].to_numpy().tolist()))
        for lv in levels[1:]:
            Xdf[f"[{time_col}={lab[lv]}]"] = (tk == lv).astype(float).to_numpy()
        time_levels = len(levels)
    names = list(Xdf.columns)
    X = Xdf.to_numpy(float)
    n, k = X.shape

    ent_codes, ent_uniq = pd.factorize(frame["ent"])
    ent_codes = np.asarray(ent_codes)
    N = len(ent_uniq)
    if N < 2:
        raise ValueError("Cần ít nhất 2 đơn vị (nhóm) để phân tích dữ liệu bảng")
    Ti = np.bincount(ent_codes, minlength=N).astype(float)
    if n <= k + 1:
        raise ValueError("Số quan sát phải lớn hơn số biến độc lập + 1")
    balanced = bool(np.all(Ti == Ti[0]))

    ybar_i = _group_mean(y.reshape(-1, 1), ent_codes, N, Ti)[:, 0]
    Xbar_i = _group_mean(X, ent_codes, N, Ti)
    y_w = y - ybar_i[ent_codes]
    X_w = X - Xbar_i[ent_codes]

    # ---- thống kê mô tả within / between (như Stata xtsum) --------------------------------
    desc = []
    n_orig = len(x_cols)  # không đưa các biến giả thời gian vào bảng mô tả
    all_vars = [(y_col, y)] + [(nm, X[:, j]) for j, nm in enumerate(names[:n_orig])]
    for nm, v in all_vars:
        vbar_i = _group_mean(v.reshape(-1, 1), ent_codes, N, Ti)[:, 0]
        mean = float(np.mean(v))
        sd_o = float(np.std(v, ddof=1)) if n > 1 else float("nan")
        sd_b = float(np.std(vbar_i, ddof=1)) if N > 1 else float("nan")
        within = v - vbar_i[ent_codes] + mean
        sd_w = float(math.sqrt(np.sum((within - mean) ** 2) / (n - 1))) if n > 1 else float("nan")
        desc.append({"variable": nm, "mean": _num(mean), "sdOverall": _num(sd_o), "sdBetween": _num(sd_b),
                     "sdWithin": _num(sd_w), "min": _num(np.min(v)), "max": _num(np.max(v))})

    notes = []

    # ---- Pooled OLS -------------------------------------------------------------------------
    Xc = np.column_stack([np.ones(n), X])
    b_p, e_p, rank_p = _ols_fit(y, Xc)
    if rank_p < Xc.shape[1]:
        raise ValueError("Các biến độc lập có đa cộng tuyến hoàn hảo (một biến là tổ hợp tuyến tính của biến khác) — hãy bỏ bớt biến")
    df_p = n - k - 1
    ssr_p = float(e_p @ e_p)
    sst_p = float(np.sum((y - y.mean()) ** 2))
    s2_p = ssr_p / df_p
    cov_p = s2_p * np.linalg.inv(Xc.T @ Xc)
    r2_p = 1 - ssr_p / sst_p if sst_p > 0 else float("nan")
    f_p = ((sst_p - ssr_p) / k) / s2_p if s2_p > 0 else float("nan")
    pooled = {
        "coefficients": _coef_table(["(Hằng số)"] + names, b_p, cov_p, df_p),
        "r2": _num(r2_p), "adjR2": _num(1 - (1 - r2_p) * (n - 1) / df_p),
        "fStat": _num(f_p), "fP": _num(sps.f.sf(f_p, k, df_p)) if math.isfinite(f_p) else None,
        "dfModel": k, "dfResid": df_p, "nObs": n, "sigma": _num(math.sqrt(s2_p)),
    }

    # ---- Fixed Effects (within) ---------------------------------------------------------------
    scale = np.maximum(np.std(X, axis=0), 1.0)
    within_sd = np.std(X_w, axis=0)
    keep = within_sd > 1e-9 * scale
    dropped = [nm for nm, kp in zip(names, keep) if not kp]
    if dropped:
        notes.append("Biến không đổi theo thời gian trong từng đơn vị bị hấp thụ bởi hiệu ứng cố định, không ước lượng được trong FE: "
                     + ", ".join(dropped))
    kept_names = [nm for nm, kp in zip(names, keep) if kp]
    k_fe = len(kept_names)
    fe = None
    hausman = None
    re = None
    if k_fe == 0:
        notes.append("Không còn biến độc lập thay đổi theo thời gian — không thể ước lượng FE và kiểm định Hausman.")
    elif n - N - k_fe <= 0:
        notes.append("Số quan sát không đủ so với số đơn vị + số biến — không ước lượng được FE.")
    else:
        Xw_k = X_w[:, keep]
        b_fe, e_fe, rank_fe = _ols_fit(y_w, Xw_k)
        if rank_fe < k_fe:
            raise ValueError("Biến độc lập có đa cộng tuyến hoàn hảo sau khi loại hiệu ứng đơn vị (within)")
        df_fe = n - N - k_fe
        ssr_fe = float(e_fe @ e_fe)
        sst_w = float(y_w @ y_w)
        s2_fe = ssr_fe / df_fe
        cov_fe = s2_fe * np.linalg.inv(Xw_k.T @ Xw_k)
        r2_w = 1 - ssr_fe / sst_w if sst_w > 0 else float("nan")
        xb_it = X[:, keep] @ b_fe
        xb_bar = _group_mean(xb_it.reshape(-1, 1), ent_codes, N, Ti)[:, 0]
        r2_b = _corr2(xb_bar, ybar_i)
        r2_o = _corr2(xb_it, y)
        f_slopes = ((sst_w - ssr_fe) / k_fe) / s2_fe if s2_fe > 0 else float("nan")
        # F kiểm định "mọi hiệu ứng đơn vị = 0": so với OLS gộp cùng bộ biến
        Xc_k = np.column_stack([np.ones(n), X[:, keep]])
        _bk, e_k, _r = _ols_fit(y, Xc_k)
        ssr_pk = float(e_k @ e_k)
        f_ent = ((ssr_pk - ssr_fe) / (N - 1)) / s2_fe if s2_fe > 0 else float("nan")
        # Hằng số (trung bình hiệu ứng đơn vị) giống Stata: ybar - xbar·b
        const_fe = float(y.mean() - X[:, keep].mean(axis=0) @ b_fe)
        t_bar_h = N / float(np.sum(1.0 / Ti))  # trung bình điều hoà của T_i (dùng cho RE)
        fe = {
            "coefficients": _coef_table(kept_names, b_fe, cov_fe, df_fe),
            "constant": _num(const_fe),
            "r2Within": _num(r2_w), "r2Between": _num(r2_b), "r2Overall": _num(r2_o),
            "fStat": _num(f_slopes), "fP": _num(sps.f.sf(f_slopes, k_fe, df_fe)) if math.isfinite(f_slopes) else None,
            "fEntity": _num(f_ent), "fEntityDf1": N - 1, "fEntityDf2": df_fe,
            "fEntityP": _num(sps.f.sf(f_ent, N - 1, df_fe)) if math.isfinite(f_ent) else None,
            "dfResid": df_fe, "nObs": n, "nGroups": N, "sigmaE": _num(math.sqrt(s2_fe)),
            "droppedVars": dropped,
        }

        # ---- Random Effects (Swamy-Arora) -----------------------------------------------------
        sigma2_e = s2_fe
        Xbar_c = np.column_stack([np.ones(N), Xbar_i])
        b_b, e_b, rank_b = _ols_fit(ybar_i, Xbar_c)
        df_b = N - k - 1
        if df_b <= 0:
            notes.append("Số đơn vị không đủ để ước lượng phương sai giữa các đơn vị — bỏ qua RE và Hausman.")
        else:
            sigma2_b = float(e_b @ e_b) / df_b
            sigma2_u = max(0.0, sigma2_b - sigma2_e / t_bar_h)
            theta_i = 1 - np.sqrt(sigma2_e / (Ti * sigma2_u + sigma2_e))
            th = theta_i[ent_codes]
            y_q = y - th * ybar_i[ent_codes]
            Xq = Xc - th[:, None] * np.column_stack([np.ones(N), Xbar_i])[ent_codes]
            b_re, e_re, rank_re = _ols_fit(y_q, Xq)
            if rank_re < Xq.shape[1]:
                notes.append("RE: ma trận biến đổi không đủ hạng (đa cộng tuyến) — kết quả RE có thể không tin cậy.")
            df_re = n - k - 1
            s2_re = float(e_re @ e_re) / df_re
            cov_re = s2_re * np.linalg.pinv(Xq.T @ Xq)
            xb_re = X @ b_re[1:]
            xb_re_bar = _group_mean(xb_re.reshape(-1, 1), ent_codes, N, Ti)[:, 0]
            # R² within/between/overall (tương quan bình phương, như Stata)
            xw = (X - Xbar_i[ent_codes]) @ b_re[1:]
            r2w_re = _corr2(xw, y_w)
            r2b_re = _corr2(xb_re_bar, ybar_i)
            r2o_re = _corr2(xb_re, y)
            # Wald chi2 cho các hệ số dốc
            bs = b_re[1:]
            Vs = cov_re[1:, 1:]
            try:
                wald = float(bs @ np.linalg.solve(Vs, bs))
            except np.linalg.LinAlgError:
                wald = float("nan")
            theta_arr = np.asarray(theta_i)
            re = {
                "coefficients": _coef_table(["(Hằng số)"] + names, b_re, cov_re, df_re),
                "r2Within": _num(r2w_re), "r2Between": _num(r2b_re), "r2Overall": _num(r2o_re),
                "sigmaU": _num(math.sqrt(sigma2_u)), "sigmaE": _num(math.sqrt(sigma2_e)),
                "rho": _num(sigma2_u / (sigma2_u + sigma2_e)) if (sigma2_u + sigma2_e) > 0 else None,
                "thetaMean": _num(theta_arr.mean()), "thetaMin": _num(theta_arr.min()), "thetaMax": _num(theta_arr.max()),
                "waldChi2": _num(wald), "waldDf": k,
                "waldP": _num(sps.chi2.sf(wald, k)) if math.isfinite(wald) else None,
                "dfResid": df_re, "nObs": n, "nGroups": N,
            }

            # ---- Hausman -------------------------------------------------------------------------
            idx_re = [names.index(nm) for nm in kept_names]  # vị trí trong names
            b_re_c = b_re[1:][idx_re]
            V_re_c = cov_re[1:, 1:][np.ix_(idx_re, idx_re)]
            diff = b_fe - b_re_c
            Vd = cov_fe - V_re_c
            # pinv: Stata cũng cảnh báo khi Vd không xác định dương
            eig = np.linalg.eigvalsh((Vd + Vd.T) / 2)
            psd = bool(np.all(eig > -1e-10 * max(1.0, float(np.max(np.abs(eig))))))
            H = float(diff @ np.linalg.pinv(Vd) @ diff)
            dfh = int(np.linalg.matrix_rank(Vd)) if not psd else k_fe
            dfh = min(max(dfh, 1), k_fe)
            if H < 0:
                notes.append("Thống kê Hausman âm (V_FE − V_RE không xác định dương) — kiểm định không đáng tin; "
                             "cân nhắc tính bằng phương pháp khác (vd. kiểm định Mundlak).")
            ph = float(sps.chi2.sf(max(H, 0.0), dfh))
            hausman = {
                "chi2": _num(H), "df": dfh, "p": _num(ph), "psd": psd,
                "preferred": "FE" if ph < 0.05 else "RE",
                "conclusion": ("Bác bỏ H₀ (α = 0,05): ước lượng RE không nhất quán — nên dùng Fixed Effects." if ph < 0.05
                               else "Không bác bỏ H₀ (α = 0,05): chưa có bằng chứng RE bị chệch — có thể dùng Random Effects (hiệu quả hơn)."),
                "comparison": [
                    {"name": nm, "fe": _num(b_fe[i]), "re": _num(b_re_c[i]), "diff": _num(diff[i]),
                     "seDiff": _num(math.sqrt(max(Vd[i, i], 0.0)))}
                    for i, nm in enumerate(kept_names)
                ],
            }

    t_counts = Ti
    return {
        "yName": y_col, "xNames": names, "entityCol": entity_col, "timeCol": time_col,
        "timeEffects": bool(time_effects), "nTimePeriods": time_levels,
        "nObs": n, "nGroups": N, "droppedRows": n_dropped,
        "tMin": int(t_counts.min()), "tMax": int(t_counts.max()), "tAvg": _num(t_counts.mean()),
        "balanced": balanced,
        "descriptive": desc, "pooled": pooled, "fixed": fe, "random": re, "hausman": hausman,
        "notes": notes,
    }
