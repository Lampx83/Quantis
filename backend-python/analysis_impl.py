"""
Phân tích thống kê — scipy, statsmodels, pandas.
Trả về dict/list giống format frontend (DescriptiveRow, TTestResult, ...).
"""
import os
import numpy as np
import pandas as pd
from scipy import stats as scipy_stats

MAX_ROWS = int(os.environ.get("QUANTIS_ANALYSIS_MAX_ROWS", "100000"))


def _rows_to_df(rows: list, max_rows: int = None) -> pd.DataFrame:
    max_rows = max_rows or MAX_ROWS
    if not rows or len(rows) < 2:
        raise ValueError("Cần ít nhất header và 1 dòng dữ liệu")
    if len(rows) > max_rows + 1:
        raise ValueError(f"Số dòng tối đa {max_rows}")
    headers = [str(h).strip() or f"col_{i}" for i, h in enumerate(rows[0])]
    data = rows[1:]
    df = pd.DataFrame(data, columns=headers)
    return df


def run_descriptive(rows: list) -> list:
    df = _rows_to_df(rows)
    out = []
    for col in df.columns:
        s = df[col].dropna()
        n = len(df[col])
        missing = n - len(s)
        try:
            num = pd.to_numeric(s, errors="coerce")
            valid = num.dropna()
            if len(valid) == len(s) and len(valid) > 0:
                q = valid.quantile([0.25, 0.5, 0.75])
                out.append({
                    "column": col,
                    "type": "numeric",
                    "n": n,
                    "missing": int(missing),
                    "mean": float(valid.mean()),
                    "median": float(valid.median()),
                    "std": float(valid.std()) if len(valid) > 1 else 0.0,
                    "min": float(valid.min()),
                    "max": float(valid.max()),
                    "q25": float(q.iloc[0]),
                    "q75": float(q.iloc[2]),
                })
            else:
                counts = s.astype(str).value_counts()
                freq = [{"value": str(k), "count": int(v)} for k, v in counts.items()]
                out.append({
                    "column": col,
                    "type": "categorical",
                    "n": n,
                    "missing": int(missing),
                    "freq": freq,
                })
        except Exception:
            counts = s.astype(str).value_counts()
            freq = [{"value": str(k), "count": int(v)} for k, v in counts.items()]
            out.append({
                "column": col,
                "type": "categorical",
                "n": n,
                "missing": int(missing),
                "freq": freq,
            })
    return out


def run_ttest(rows: list, group_col: str, group_val1: str, group_val2: str, num_col: str, equal_var: bool = False):
    df = _rows_to_df(rows)
    if group_col not in df.columns or num_col not in df.columns:
        return None
    df[num_col] = pd.to_numeric(df[num_col], errors="coerce")
    g1 = df[df[group_col].astype(str).str.strip() == group_val1][num_col].dropna()
    g2 = df[df[group_col].astype(str).str.strip() == group_val2][num_col].dropna()
    if len(g1) < 2 or len(g2) < 2:
        return None
    res = scipy_stats.ttest_ind(g1, g2, equal_var=equal_var)
    n1, n2 = len(g1), len(g2)
    m1, m2 = float(g1.mean()), float(g2.mean())
    s1, s2 = float(g1.std()), float(g2.std())
    pooled = np.sqrt(((n1 - 1) * g1.var() + (n2 - 1) * g2.var()) / (n1 + n2 - 2))
    cohen_d = float((m1 - m2) / pooled) if pooled and pooled > 0 else 0.0
    return {
        "t": float(res.statistic),
        "df": float(res.df),
        "pValue": float(res.pvalue),
        "cohenD": cohen_d,
        "mean1": m1,
        "mean2": m2,
        "n1": n1,
        "n2": n2,
        "std1": s1,
        "std2": s2,
    }


def run_chi2(rows: list, col1: str, col2: str):
    df = _rows_to_df(rows)
    if col1 not in df.columns or col2 not in df.columns:
        return None
    ct = pd.crosstab(df[col1].astype(str).str.strip(), df[col2].astype(str).str.strip())
    if ct.size < 4:
        return None
    chi2, p, dof, expected = scipy_stats.chi2_contingency(ct)
    row_labels = ct.index.tolist()
    col_labels = ct.columns.tolist()
    table = [{"row": str(r), "col": str(c), "count": int(ct.loc[r, c])} for r in row_labels for c in col_labels]
    return {
        "chi2": float(chi2),
        "df": int(dof),
        "pValue": float(p),
        "table": table,
        "rowLabels": row_labels,
        "colLabels": col_labels,
    }


def run_correlation(rows: list, method: str = "pearson"):
    df = _rows_to_df(rows)
    numeric = df.select_dtypes(include=[np.number])
    if numeric.shape[1] < 2 or len(numeric) < 3:
        return None
    corr = numeric.corr(method=method if method == "spearman" else "pearson")
    return {"matrix": corr.values.tolist(), "columnNames": corr.columns.tolist()}


def run_anova(rows: list, factor_col: str, value_col: str):
    from statsmodels.formula.api import ols
    from statsmodels.stats.anova import anova_lm

    df = _rows_to_df(rows)
    if factor_col not in df.columns or value_col not in df.columns:
        return None
    df[value_col] = pd.to_numeric(df[value_col], errors="coerce")
    df = df.dropna(subset=[value_col, factor_col])
    groups = df.groupby(factor_col)[value_col]
    if groups.ngroups < 2:
        return None
    group_means = []
    for name, g in groups:
        group_means.append({
            "group": str(name),
            "n": int(len(g)),
            "mean": float(g.mean()),
            "std": float(g.std()) if len(g) > 1 else 0.0,
        })
    try:
        formula = f"Q('{value_col}') ~ C(Q('{factor_col}'))"
        model = ols(formula, data=df).fit()
        a = anova_lm(model, typ=2)
        non_resid = [i for i in a.index if i not in ("Residual", "Intercept")]
        key = non_resid[0] if non_resid else None
        if not key:
            raise ValueError("No factor row")
        ss_between = float(a.loc[key, "sum_sq"])
        ss_within = float(a.loc["Residual", "sum_sq"])
        ss_total = ss_between + ss_within
        df_between = int(a.loc[key, "df"])
        df_within = int(a.loc["Residual", "df"])
        f_val = float(a.loc[key, "F"])
        p_val = float(a.loc[key, "PR(>F)"])
        eta_sq = ss_between / ss_total if ss_total > 0 else 0.0
    except Exception:
        grand_mean = df[value_col].mean()
        ss_between = sum(len(g) * (g.mean() - grand_mean) ** 2 for _, g in groups)
        ss_within = sum((g - g.mean()).pow(2).sum() for _, g in groups)
        ss_total = ss_between + ss_within
        df_between = groups.ngroups - 1
        df_within = len(df) - groups.ngroups
        ms_between = ss_between / df_between if df_between else 0
        ms_within = ss_within / df_within if df_within else 0
        f_val = float(ms_between / ms_within) if ms_within else 0
        p_val = float(1 - scipy_stats.f.cdf(f_val, df_between, df_within))
        eta_sq = ss_between / ss_total if ss_total else 0
    return {
        "f": f_val,
        "dfBetween": df_between,
        "dfWithin": df_within,
        "dfTotal": len(df) - 1,
        "ssBetween": ss_between,
        "ssWithin": ss_within,
        "ssTotal": ss_total,
        "msBetween": ss_between / df_between if df_between else 0,
        "msWithin": ss_within / df_within if df_within else 0,
        "pValue": p_val,
        "etaSq": eta_sq,
        "groupMeans": group_means,
    }


def run_ancova(rows: list, factor_col: str, value_col: str, covariate_cols: list[str]):
    """ANCOVA: Analysis of Covariance — DV ~ Factor + Covariate(s). Kiểm soát biến covariate khi so sánh nhóm."""
    from statsmodels.formula.api import ols
    from statsmodels.stats.anova import anova_lm

    df = _rows_to_df(rows)
    if factor_col not in df.columns or value_col not in df.columns:
        return None
    for c in covariate_cols:
        if c not in df.columns:
            return None
    df[value_col] = pd.to_numeric(df[value_col], errors="coerce")
    for c in covariate_cols:
        df[c] = pd.to_numeric(df[c], errors="coerce")
    use_cols = [value_col, factor_col] + covariate_cols
    df = df[use_cols].dropna()
    if len(df) < 4 or df.groupby(factor_col)[value_col].ngroups < 2:
        return None
    # Formula: value_col ~ C(factor_col) + cov1 + cov2 + ...
    cov_part = " + ".join([f"Q('{c}')" for c in covariate_cols])
    formula = f"Q('{value_col}') ~ C(Q('{factor_col}')) + {cov_part}"
    try:
        model = ols(formula, data=df).fit()
        a = anova_lm(model, typ=2)
        group_means = []
        for name, g in df.groupby(factor_col)[value_col]:
            group_means.append({
                "group": str(name),
                "n": int(len(g)),
                "mean": float(g.mean()),
                "std": float(g.std()) if len(g) > 1 else 0.0,
            })
        # Hàng factor (C(factor))
        factor_key = [i for i in a.index if "C(" in str(i) or (i != "Residual" and i != "Intercept")]
        factor_key = factor_key[0] if factor_key else None
        if factor_key is None:
            return None
        ss_factor = float(a.loc[factor_key, "sum_sq"])
        ss_resid = float(a.loc["Residual", "sum_sq"])
        df_factor = int(a.loc[factor_key, "df"])
        df_resid = int(a.loc["Residual", "df"])
        f_val = float(a.loc[factor_key, "F"]) if pd.notna(a.loc[factor_key, "F"]) else 0.0
        p_val = float(a.loc[factor_key, "PR(>F)"]) if pd.notna(a.loc[factor_key, "PR(>F)"]) else 1.0
        ss_total = a["sum_sq"].sum()
        eta_sq = ss_factor / ss_total if ss_total > 0 else 0.0
        return {
            "f": f_val,
            "dfBetween": df_factor,
            "dfWithin": df_resid,
            "dfTotal": len(df) - 1,
            "pValue": p_val,
            "etaSq": eta_sq,
            "factorCol": factor_col,
            "valueCol": value_col,
            "covariateCols": covariate_cols,
            "groupMeans": group_means,
            "n": len(df),
        }
    except Exception:
        return None


def run_manova(rows: list, factor_col: str, value_cols: list[str]):
    """MANOVA: Multivariate Analysis of Variance — nhiều biến phụ thuộc (DV), một nhân tố (IV)."""
    try:
        from statsmodels.multivariate.manova import MANOVA
    except ImportError:
        return None
    df = _rows_to_df(rows)
    if factor_col not in df.columns:
        return None
    for c in value_cols:
        if c not in df.columns:
            return None
    df = df[[factor_col] + value_cols].copy()
    for c in value_cols:
        df[c] = pd.to_numeric(df[c], errors="coerce")
    df = df.dropna()
    if len(df) < 4 or df[factor_col].nunique() < 2:
        return None
    formula = " + ".join(value_cols) + " ~ C(" + factor_col + ")"
    try:
        ma = MANOVA.from_formula(formula, data=df)
        result = ma.mv_test()
        # Wilks' lambda, Pillai's trace, etc. — lấy thống kê chính
        out = {"factorCol": factor_col, "valueCols": value_cols, "n": len(df)}
        if hasattr(result, "results"):
            r = result.results
            if "Intercept" in r:
                out["intercept"] = str(r["Intercept"])
            if "C(" + factor_col + ")" in r:
                out["factorTest"] = str(r["C(" + factor_col + ")"])
            out["summary"] = str(result)
        else:
            out["summary"] = str(result)
        return out
    except Exception as e:
        return {"error": str(e), "factorCol": factor_col, "valueCols": value_cols, "n": len(df)}


def run_mancova(rows: list, factor_col: str, value_cols: list[str], covariate_cols: list[str]):
    """MANCOVA: MANOVA với covariate — nhiều biến phụ thuộc (DV), một nhân tố (IV), kiểm soát covariate(s)."""
    try:
        from statsmodels.multivariate.manova import MANOVA
    except ImportError:
        return {"error": "statsmodels.multivariate.manova không khả dụng", "factorCol": factor_col, "valueCols": value_cols, "covariateCols": covariate_cols, "n": 0}
    df = _rows_to_df(rows)
    if factor_col not in df.columns:
        return None
    for c in value_cols:
        if c not in df.columns:
            return None
    for c in covariate_cols:
        if c not in df.columns or c in value_cols:
            return None
    if not covariate_cols:
        return None
    cols_use = [factor_col] + value_cols + covariate_cols
    df = df[cols_use].copy()
    for c in value_cols + covariate_cols:
        df[c] = pd.to_numeric(df[c], errors="coerce")
    df = df.dropna()
    if len(df) < 4 or df[factor_col].nunique() < 2:
        return None
    # Công thức: DVs ~ C(factor) + cov1 + cov2 + ...
    formula = " + ".join(value_cols) + " ~ C(" + factor_col + ") + " + " + ".join(covariate_cols)
    try:
        ma = MANOVA.from_formula(formula, data=df)
        result = ma.mv_test()
        out = {"factorCol": factor_col, "valueCols": value_cols, "covariateCols": covariate_cols, "n": len(df)}
        if hasattr(result, "results"):
            r = result.results
            if "Intercept" in r:
                out["intercept"] = str(r["Intercept"])
            if "C(" + factor_col + ")" in r:
                out["factorTest"] = str(r["C(" + factor_col + ")"])
            out["summary"] = str(result)
        else:
            out["summary"] = str(result)
        return out
    except Exception as e:
        return {"error": str(e), "factorCol": factor_col, "valueCols": value_cols, "covariateCols": covariate_cols, "n": len(df)}


def run_kruskal_wallis(rows: list, factor_col: str, value_col: str):
    """Kruskal-Wallis H (non-parametric one-way ANOVA): so sánh 3+ nhóm độc lập."""
    df = _rows_to_df(rows)
    if factor_col not in df.columns or value_col not in df.columns:
        return None
    df[value_col] = pd.to_numeric(df[value_col], errors="coerce")
    df = df.dropna(subset=[value_col, factor_col])
    groups = df.groupby(factor_col)[value_col]
    if groups.ngroups < 2:
        return None
    group_arrays = [g.values for _, g in groups]
    group_names = [str(name) for name, _ in groups]
    try:
        h_stat, p_val = scipy_stats.kruskal(*group_arrays)
    except Exception:
        return None
    group_medians = []
    for name, g in groups:
        group_medians.append({
            "group": str(name),
            "n": int(len(g)),
            "median": float(g.median()),
            "mean": float(g.mean()),
            "std": float(g.std()) if len(g) > 1 else 0.0,
        })
    return {
        "h": float(h_stat),
        "pValue": float(p_val),
        "df": groups.ngroups - 1,
        "groupMedians": group_medians,
        "nGroups": groups.ngroups,
    }


def run_ols(rows: list, y_col: str, x_cols: list):
    from statsmodels.regression.linear_model import OLS
    from statsmodels.tools import add_constant

    df = _rows_to_df(rows)
    for c in [y_col] + x_cols:
        if c not in df.columns:
            return None
    df = df[[y_col] + x_cols].copy().apply(pd.to_numeric, errors="coerce").dropna()
    if len(df) <= len(x_cols) + 1:
        return None
    y = df[y_col]
    X = add_constant(df[x_cols])
    model = OLS(y, X).fit()
    coeff = {"(Intercept)": float(model.params["const"])}
    for c in x_cols:
        coeff[c] = float(model.params[c])
    se = {"(Intercept)": float(model.bse["const"])}
    for c in x_cols:
        se[c] = float(model.bse[c])
    t_stat = {"(Intercept)": float(model.tvalues["const"])}
    for c in x_cols:
        t_stat[c] = float(model.tvalues[c])
    p_val = {"(Intercept)": float(model.pvalues["const"])}
    for c in x_cols:
        p_val[c] = float(model.pvalues[c])
    ci = model.conf_int(alpha=0.05)
    ci_lower = {"(Intercept)": float(ci.loc["const", 0])}
    ci_upper = {"(Intercept)": float(ci.loc["const", 1])}
    for c in x_cols:
        ci_lower[c] = float(ci.loc[c, 0])
        ci_upper[c] = float(ci.loc[c, 1])
    return {
        "coefficients": coeff,
        "intercept": float(model.params["const"]),
        "r2": float(model.rsquared),
        "adjR2": float(model.rsquared_adj),
        "se": se,
        "tStat": t_stat,
        "pValue": p_val,
        "ciLower": ci_lower,
        "ciUpper": ci_upper,
        "n": int(model.nobs),
        "df": int(model.df_resid),
        "s2": float(model.mse_resid),
        "yName": y_col,
        "xNames": x_cols,
    }


def run_logistic(rows: list, y_col: str, x_cols: list):
    from statsmodels.discrete.discrete_model import Logit
    from statsmodels.tools import add_constant
    from statsmodels.tools.sm_exceptions import PerfectSeparationError

    df = _rows_to_df(rows)
    for c in [y_col] + x_cols:
        if c not in df.columns:
            return None
    df = df[[y_col] + x_cols].copy().apply(pd.to_numeric, errors="coerce").dropna()
    y = df[y_col]
    if not set(y.astype(int).unique()).issubset({0, 1}):
        y = (y == y.max()).astype(int)
    if y.nunique() < 2:
        return None
    X = add_constant(df[x_cols])
    try:
        model = Logit(y, X).fit(disp=0)
    except (PerfectSeparationError, Exception):
        return None
    coeff = {"(Intercept)": float(model.params["const"])}
    for c in x_cols:
        coeff[c] = float(model.params[c])
    se = {"(Intercept)": float(model.bse["const"])}
    for c in x_cols:
        se[c] = float(model.bse[c])
    z_stat = {"(Intercept)": float(model.tvalues["const"])}
    for c in x_cols:
        z_stat[c] = float(model.tvalues[c])
    p_val = {"(Intercept)": float(model.pvalues["const"])}
    for c in x_cols:
        p_val[c] = float(model.pvalues[c])
    odds = {k: float(np.exp(v)) for k, v in model.params.items()}
    return {
        "coefficients": coeff,
        "intercept": float(model.params["const"]),
        "oddsRatios": odds,
        "se": se,
        "zStat": z_stat,
        "pValue": p_val,
        "logLikelihood": float(model.llf),
        "aic": float(model.aic),
        "n": int(model.nobs),
        "yName": y_col,
        "xNames": x_cols,
        "classCounts": {"0": int((y == 0).sum()), "1": int((y == 1).sum())},
    }


# ---------- Poisson regression (Y count: integer >= 0) ----------
def run_poisson(rows: list, y_col: str, x_cols: list):
    from statsmodels.genmod.generalized_linear_model import GLM
    from statsmodels.genmod.families import Poisson
    from statsmodels.tools import add_constant

    df = _rows_to_df(rows)
    for c in [y_col] + x_cols:
        if c not in df.columns:
            return None
    df = df[[y_col] + x_cols].copy().apply(pd.to_numeric, errors="coerce").dropna()
    y = df[y_col]
    if (y < 0).any():
        return None
    if len(df) <= len(x_cols) + 1:
        return None
    X = add_constant(df[x_cols])
    try:
        model = GLM(y, X, family=Poisson()).fit()
    except Exception:
        return None
    coeff = {"(Intercept)": float(model.params["const"])}
    for c in x_cols:
        coeff[c] = float(model.params[c])
    se = {"(Intercept)": float(model.bse["const"])}
    for c in x_cols:
        se[c] = float(model.bse[c])
    z_stat = {"(Intercept)": float(model.tvalues["const"])}
    for c in x_cols:
        z_stat[c] = float(model.tvalues[c])
    p_val = {"(Intercept)": float(model.pvalues["const"])}
    for c in x_cols:
        p_val[c] = float(model.pvalues[c])
    # Incidence rate ratios (IRR) = exp(coef) for Poisson
    irr = {k: float(np.exp(v)) for k, v in model.params.items()}
    return {
        "coefficients": coeff,
        "intercept": float(model.params["const"]),
        "irr": irr,
        "se": se,
        "zStat": z_stat,
        "pValue": p_val,
        "logLikelihood": float(model.llf),
        "aic": float(model.aic),
        "n": int(model.nobs),
        "yName": y_col,
        "xNames": x_cols,
    }


# ---------- Ridge regression (L2 regularized) ----------
def run_ridge(rows: list, y_col: str, x_cols: list, alpha: float = 1.0):
    from sklearn.linear_model import Ridge
    from sklearn.preprocessing import StandardScaler

    df = _rows_to_df(rows)
    for c in [y_col] + x_cols:
        if c not in df.columns:
            return None
    df = df[[y_col] + x_cols].copy().apply(pd.to_numeric, errors="coerce").dropna()
    if len(df) <= len(x_cols) + 1:
        return None
    y = df[y_col].values
    X = df[x_cols].values
    scaler_x = StandardScaler()
    X_scaled = scaler_x.fit_transform(X)
    scaler_y = StandardScaler()
    y_scaled = scaler_y.fit_transform(y.reshape(-1, 1)).ravel()
    model = Ridge(alpha=float(alpha), random_state=42).fit(X_scaled, y_scaled)
    # Map coefficients back to original scale: y = mean_y + std_y * (intercept + X_scaled @ coef) => coef_orig_j = std_y * coef_j / std_j, intercept_orig = mean_y + std_y*intercept - mean_X @ coef_orig
    coef_orig = model.coef_ * (float(scaler_y.scale_[0]) / scaler_x.scale_)
    intercept_orig = float(scaler_y.mean_[0] + scaler_y.scale_[0] * model.intercept_ - np.dot(scaler_x.mean_, coef_orig))
    coeff = {}
    for i, c in enumerate(x_cols):
        coeff[c] = float(coef_orig[i])
    return {
        "coefficients": coeff,
        "intercept": float(intercept_orig),
        "r2": float(model.score(X_scaled, y_scaled)),
        "alpha": float(alpha),
        "n": int(len(df)),
        "yName": y_col,
        "xNames": x_cols,
    }


# ---------- Mann-Whitney U (non-parametric) ----------
def run_mann_whitney(rows: list, group_col: str, group_val1: str, group_val2: str, num_col: str):
    df = _rows_to_df(rows)
    if group_col not in df.columns or num_col not in df.columns:
        return None
    df[num_col] = pd.to_numeric(df[num_col], errors="coerce")
    g1 = df[df[group_col].astype(str).str.strip() == group_val1][num_col].dropna()
    g2 = df[df[group_col].astype(str).str.strip() == group_val2][num_col].dropna()
    if len(g1) < 2 or len(g2) < 2:
        return None
    u_stat, p_val = scipy_stats.mannwhitneyu(g1, g2, alternative="two-sided")
    n1, n2 = len(g1), len(g2)
    return {
        "u": float(u_stat),
        "z": float(scipy_stats.norm.ppf(1 - p_val / 2)) if p_val < 1 else 0.0,
        "pValue": float(p_val),
        "n1": n1,
        "n2": n2,
        "median1": float(g1.median()),
        "median2": float(g2.median()),
        "rankSum1": float(scipy_stats.rankdata(pd.concat([g1, g2]))[:n1].sum()),
    }


# ---------- Shapiro-Wilk (normality) ----------
def run_shapiro_wilk(values: list[float]):
    if not values or len(values) < 3:
        return None
    a = np.array(values, dtype=float)
    a = a[~np.isnan(a)]
    if len(a) < 3:
        return None
    # scipy.shapiro giới hạn n <= 5000
    if len(a) > 5000:
        a = np.random.RandomState(42).choice(a, 5000, replace=False)
    stat, p = scipy_stats.shapiro(a)
    return {"w": float(stat), "pValue": float(p), "n": int(len(a))}


# ---------- Cronbach's alpha ----------
def run_cronbach_alpha(rows: list, column_names: list[str]):
    df = _rows_to_df(rows)
    cols = [c for c in column_names if c in df.columns]
    if len(cols) < 2 or len(df) < 3:
        return None
    data = df[cols].apply(pd.to_numeric, errors="coerce").dropna()
    if len(data) < 3:
        return None
    n_items = len(cols)
    item_vars = data.var(axis=0, ddof=1)
    total_var = data.sum(axis=1).var(ddof=1)
    if total_var <= 0:
        return None
    alpha = (n_items / (n_items - 1)) * (1 - item_vars.sum() / total_var)
    return float(alpha)


# ---------- VIF (Variance Inflation Factor) ----------
def run_vif(rows: list, x_cols: list[str]):
    if len(x_cols) < 2:
        return None
    vif_out = {}
    for i, target in enumerate(x_cols):
        others = [c for j, c in enumerate(x_cols) if j != i]
        res = run_ols(rows, target, others)
        if res is None or res["r2"] >= 1 - 1e-10:
            return None
        vif_out[target] = float(1 / (1 - res["r2"]))
    return vif_out


# ---------- Mediation (Baron-Kenny: X -> M -> Y) ----------
def run_mediation(rows: list, x_col: str, m_col: str, y_col: str):
    path_a = run_ols(rows, m_col, [x_col])
    path_c = run_ols(rows, y_col, [x_col])
    path_bc = run_ols(rows, y_col, [x_col, m_col])
    if not path_a or not path_c or not path_bc:
        return None
    a = path_a["coefficients"].get(x_col, 0)
    c = path_c["coefficients"].get(x_col, 0)
    b = path_bc["coefficients"].get(m_col, 0)
    c_prime = path_bc["coefficients"].get(x_col, 0)
    indirect = a * b
    pct_med = (indirect / c * 100) if c != 0 else 0
    return {
        "a": a,
        "b": b,
        "c": c,
        "cPrime": c_prime,
        "aSE": path_a["se"].get(x_col, 0),
        "bSE": path_bc["se"].get(m_col, 0),
        "cSE": path_c["se"].get(x_col, 0),
        "cPrimeSE": path_bc["se"].get(x_col, 0),
        "aP": path_a["pValue"].get(x_col, 1),
        "bP": path_bc["pValue"].get(m_col, 1),
        "cP": path_c["pValue"].get(x_col, 1),
        "cPrimeP": path_bc["pValue"].get(x_col, 1),
        "indirectEffect": indirect,
        "pctMediated": pct_med,
    }


# ---------- Moderation (Y ~ X + M + X*M) ----------
def run_moderation(rows: list, y_col: str, x_col: str, m_col: str):
    df = _rows_to_df(rows)
    for c in [y_col, x_col, m_col]:
        if c not in df.columns:
            return None
    df = df[[y_col, x_col, m_col]].copy().apply(pd.to_numeric, errors="coerce").dropna()
    if len(df) < 5:
        return None
    df["_XxM"] = df[x_col] * df[m_col]
    headers = list(df.columns)
    data_str = [[str(v) for v in row] for row in df.values]
    return run_ols([headers] + data_str, y_col, [x_col, m_col, "_XxM"])


# ---------- Path analysis (observed variables, multi-equation) — AMOS-style ----------
def run_path_analysis(rows: list, equations: list[dict]):
    """
    equations: list of { "yCol": str, "xCols": list[str] }. Order matters for recursive models.
    Returns path coefficients, R² per equation, and direct effects table.
    """
    if not equations:
        return None
    all_cols = set()
    for eq in equations:
        y = eq.get("yCol")
        x_list = eq.get("xCols") or []
        if not y or not isinstance(x_list, list):
            return None
        all_cols.add(y)
        all_cols.update(x_list)
    df = _rows_to_df(rows)
    for c in all_cols:
        if c not in df.columns:
            return None
    df = df[list(all_cols)].apply(pd.to_numeric, errors="coerce").dropna()
    if len(df) < 5:
        return None
    headers = list(df.columns)
    data_str = [[str(v) for v in row] for row in df.values]
    rows_clean = [headers] + data_str
    path_coefs = []
    r2_per_eq = []
    for eq in equations:
        y_col = eq["yCol"]
        x_cols = list(eq["xCols"])
        ols_res = run_ols(rows_clean, y_col, x_cols)
        if not ols_res:
            return None
        for x in x_cols:
            path_coefs.append({
                "from": x,
                "to": y_col,
                "coefficient": ols_res["coefficients"].get(x, 0),
                "se": ols_res["se"].get(x, 0),
                "tStat": ols_res["tStat"].get(x, 0),
                "pValue": ols_res["pValue"].get(x, 1),
            })
        r2_per_eq.append({"yCol": y_col, "r2": ols_res["r2"], "adjR2": ols_res["adjR2"], "n": ols_res["n"]})
    return {
        "pathCoefficients": path_coefs,
        "equationsR2": r2_per_eq,
        "n": len(df),
    }


# ---------- Confirmatory Factor Analysis (CFA) — AMOS/SmartPLS-style ----------
def run_cfa(rows: list, factor_spec: dict):
    """
    factor_spec: { "F1": ["x1", "x2", "x3"], "F2": ["y1", "y2"] }. Factors can correlate.
    Returns loadings, factor correlations, fit indices (chi2, df, p, CFI, TLI, RMSEA, etc.).
    """
    try:
        import semopy
        from semopy import Model
        from semopy.stats import calc_stats
    except ImportError:
        return {"error": "Thư viện semopy chưa được cài. Chạy: pip install semopy"}
    if not factor_spec or not isinstance(factor_spec, dict):
        return None
    all_indicators = []
    for f, inds in factor_spec.items():
        if not inds or not isinstance(inds, list):
            return None
        for i in inds:
            if i not in all_indicators:
                all_indicators.append(i)
    df = _rows_to_df(rows)
    for c in all_indicators:
        if c not in df.columns:
            return None
    df = df[all_indicators].apply(pd.to_numeric, errors="coerce").dropna()
    if len(df) < 10:
        return None
    # Build lavaan-like model: F =~ i1 + i2 + i3; F1 ~~ F2
    lines = []
    for f, inds in factor_spec.items():
        lines.append(f"{f} =~ " + " + ".join(inds))
    factors = list(factor_spec.keys())
    for i in range(len(factors)):
        for j in range(i + 1, len(factors)):
            lines.append(f"{factors[i]} ~~ {factors[j]}")
    model_str = "\n".join(lines)
    try:
        mod = Model(model_str)
        mod.fit(df)
        # Parameter estimates (loadings, etc.) — semopy inspect() returns DataFrame
        est = mod.inspect()
        loadings = []
        for _, row in est.iterrows():
            op = str(row.get("op", ""))
            if op == "~" or op == "=~":
                lval = row.get("lval", "")
                rval = row.get("rval", "")
                if pd.isna(lval) or pd.isna(rval):
                    continue
                loadings.append({
                    "factor": str(lval),
                    "indicator": str(rval),
                    "estimate": float(row.get("Estimate", row.get("estimate", 0))),
                    "se": float(row.get("Std err", row.get("se", 0))),
                    "z": float(row.get("z-value", row.get("z", 0))),
                    "pValue": float(row.get("p-value", row.get("pvalue", 1))),
                })
        factor_cov = []
        for _, row in est.iterrows():
            op = str(row.get("op", ""))
            if op == "~~":
                lval, rval = row.get("lval", ""), row.get("rval", "")
                if lval != rval:
                    factor_cov.append({
                        "factor1": str(lval),
                        "factor2": str(rval),
                        "covariance": float(row.get("Estimate", row.get("estimate", 0))),
                        "se": float(row.get("Std err", row.get("se", 0))),
                    })
        # Fit indices: calc_stats returns SEMStatistics or dict-like
        try:
            from semopy.stats import calc_stats
            stats_df = calc_stats(mod)
            fit = {}
            if hasattr(stats_df, "_asdict"):
                fit = stats_df._asdict()
            elif isinstance(stats_df, pd.DataFrame) and not stats_df.empty:
                fit = stats_df.iloc[0].to_dict() if len(stats_df) > 0 else {}
            elif isinstance(stats_df, dict):
                fit = stats_df
            # Normalize keys for frontend
            fit = {str(k): (float(v) if isinstance(v, (int, float)) else v) for k, v in fit.items()}
        except Exception:
            fit = {}
        return {
            "loadings": loadings,
            "factorCovariances": factor_cov,
            "fitIndices": fit,
            "n": int(len(df)),
            "model": model_str,
        }
    except Exception as e:
        return {"error": str(e)}


# ---------- PLS-SEM (variance-based path model) — SmartPLS-style ----------
def run_pls_sem(rows: list, outer_model: dict, inner_paths: list[dict], n_bootstrap: int = 500):
    """
    outer_model: { "LV1": ["ind1", "ind2", "ind3"], "LV2": ["ind4", "ind5"] } — reflective.
    inner_paths: [ { "from": "LV1", "to": "LV2" }, ... ] — structural paths.
    Returns latent scores, path coefficients, R², loadings, bootstrap SE/CI, HTMT (if multiple LVs).
    """
    from sklearn.preprocessing import StandardScaler
    from sklearn.cross_decomposition import PLSRegression

    if not outer_model or not inner_paths:
        return None
    all_inds = []
    for lv, inds in outer_model.items():
        if not inds or not isinstance(inds, list):
            return None
        for i in inds:
            if i not in all_inds:
                all_inds.append(i)
    df = _rows_to_df(rows)
    for c in all_inds:
        if c not in df.columns:
            return None
    df = df[all_inds].apply(pd.to_numeric, errors="coerce").dropna()
    if len(df) < 20:
        return None
    X = StandardScaler().fit_transform(df)
    # Reflective: latent = mean of standardized indicators per block
    lv_scores = {}
    loadings_out = []
    for lv, inds in outer_model.items():
        cols_idx = [df.columns.get_loc(c) for c in inds if c in df.columns]
        if not cols_idx:
            return None
        block = X[:, cols_idx]
        # Latent score = mean of indicators (reflective)
        lv_scores[lv] = np.mean(block, axis=1)
        for j, c in enumerate(inds):
            if c in df.columns:
                r = np.corrcoef(block[:, j], lv_scores[lv])[0, 1] if block.shape[1] > 0 else 0
                loadings_out.append({"latent": lv, "indicator": c, "loading": float(r)})
    lv_df = pd.DataFrame(lv_scores)
    # Inner model: OLS for each endogenous LV
    endo = set(p["to"] for p in inner_paths)
    path_coefs = []
    r2 = {}
    for target in endo:
        preds = [p["from"] for p in inner_paths if p["to"] == target]
        if not preds or not all(p in lv_df.columns for p in preds):
            continue
        y = lv_df[target].values
        X_inner = lv_df[preds].values
        X_inner = np.column_stack([np.ones(len(y)), X_inner])
        b = np.linalg.lstsq(X_inner, y, rcond=None)[0]
        r2[target] = float(1 - np.var(y - X_inner @ b) / np.var(y)) if np.var(y) > 0 else 0
        for i, p in enumerate(preds):
            path_coefs.append({
                "from": p,
                "to": target,
                "coefficient": float(b[i + 1]),
                "se": None,
                "tStat": None,
                "pValue": None,
            })
    # Bootstrap for SE and p-value
    n = len(lv_df)
    rng = np.random.default_rng(42)
    boot_coefs = {f"{p['from']}->{p['to']}": [] for p in inner_paths}
    for _ in range(n_bootstrap):
        idx = rng.integers(0, n, size=n)
        b_df = lv_df.iloc[idx]
        for target in endo:
            preds = [p["from"] for p in inner_paths if p["to"] == target]
            if not preds or not all(p in b_df.columns for p in preds):
                continue
            y = b_df[target].values
            X_inner = np.column_stack([np.ones(len(y)), b_df[preds].values])
            b = np.linalg.lstsq(X_inner, y, rcond=None)[0]
            for i, p in enumerate(preds):
                key = f"{p}->{target}"
                if key in boot_coefs:
                    boot_coefs[key].append(float(b[i + 1]))
    for pc in path_coefs:
        key = f"{pc['from']}->{pc['to']}"
        arr = boot_coefs.get(key, [])
        if len(arr) >= 10:
            pc["se"] = float(np.std(arr))
            if pc["se"] and pc["se"] > 0:
                pc["tStat"] = float(pc["coefficient"] / pc["se"])
                pc["pValue"] = float(2 * (1 - scipy_stats.t.cdf(abs(pc["tStat"]), n - len([x for x in path_coefs if x["to"] == pc["to"]]) - 1)))
            pc["ciLower"] = float(np.percentile(arr, 2.5))
            pc["ciUpper"] = float(np.percentile(arr, 97.5))
    # Fornell-Larcker: sqrt(AVE) per LV; AVE = mean of squared loadings
    avg_load = {}
    for lv in outer_model:
        ld = [x["loading"] ** 2 for x in loadings_out if x["latent"] == lv]
        avg_load[lv] = float(np.sqrt(np.mean(ld))) if ld else 0
    return {
        "pathCoefficients": path_coefs,
        "loadings": loadings_out,
        "r2": r2,
        "n": n,
        "bootstrapSamples": n_bootstrap,
        "fornellLarcker": avg_load,
    }


# ---------- K-means clustering ----------
def run_kmeans(rows: list, column_names: list[str], k: int, max_iter: int = 100):
    from sklearn.cluster import KMeans

    df = _rows_to_df(rows)
    cols = [c for c in column_names if c in df.columns]
    if not cols or k < 2:
        return None
    data = df[cols].apply(pd.to_numeric, errors="coerce").dropna()
    if len(data) < k:
        return None
    model = KMeans(n_clusters=k, max_iter=max_iter, random_state=42, n_init=10)
    labels = model.fit_predict(data)
    within_ss = float(model.inertia_)
    return {
        "assignments": labels.tolist(),
        "centroids": model.cluster_centers_.tolist(),
        "iterations": int(model.n_iter_),
        "withinSS": within_ss,
    }


# ---------- EFA (PCA extraction + varimax rotation) ----------
def _varimax(loadings: np.ndarray, tol: float = 1e-8, max_iter: int = 100) -> np.ndarray:
    p, k = loadings.shape
    L = loadings.copy()
    for _ in range(max_iter):
        L_old = L.copy()
        Lambda = L
        u, s, vh = np.linalg.svd(Lambda.T @ (Lambda**2 - (Lambda**2).mean(axis=0)))
        R = u @ vh
        L = Lambda @ R
        if np.abs(L - L_old).max() < tol:
            break
    return L


def run_efa(rows: list, column_names: list[str], n_factors: int = None):
    from sklearn.decomposition import PCA
    from sklearn.preprocessing import StandardScaler

    df = _rows_to_df(rows)
    cols = [c for c in column_names if c in df.columns]
    if len(cols) < 2 or len(df) < 10:
        return None
    data = df[cols].apply(pd.to_numeric, errors="coerce").dropna()
    if len(data) < 10:
        return None
    X = StandardScaler().fit_transform(data)
    n_components = min(len(cols), len(data) - 1)
    pca = PCA(n_components=n_components)
    pca.fit(X)
    eigenvalues = pca.explained_variance_.tolist()
    loadings = pca.components_.T * np.sqrt(pca.explained_variance_)
    if n_factors is None:
        n_factors = max(1, sum(1 for e in eigenvalues if e > 1))
    n_factors = min(int(n_factors), loadings.shape[1])
    loadings_k = loadings[:, :n_factors]
    rotated = _varimax(loadings_k)
    total_var = sum(eigenvalues)
    variance_explained = [(eigenvalues[i] / total_var * 100) for i in range(n_factors)] if total_var else []
    return {
        "eigenvalues": eigenvalues,
        "varianceExplained": variance_explained,
        "loadings": rotated.tolist(),
        "columnNames": cols,
        "nFactors": n_factors,
    }


# ---------- Post-hoc pairwise (sau ANOVA: Welch t + Bonferroni) ----------
def run_pairwise_posthoc(group_means: list[dict]) -> list[dict]:
    """group_means: [{"group": str, "n": int, "mean": float, "std": float}, ...]"""
    from scipy.stats import t as t_dist
    k = len(group_means)
    if k < 2:
        return []
    n_pairs = k * (k - 1) // 2
    out = []
    for i in range(k):
        for j in range(i + 1, k):
            m1, m2 = group_means[i], group_means[j]
            n1, n2 = m1["n"], m2["n"]
            mean1, mean2 = m1["mean"], m2["mean"]
            var1 = m1["std"] ** 2
            var2 = m2["std"] ** 2
            se = np.sqrt(var1 / n1 + var2 / n2)
            if se <= 0:
                continue
            t = (mean1 - mean2) / se
            denom = var1 / n1 + var2 / n2
            df = (denom ** 2) / ((var1 / n1) ** 2 / (n1 - 1) + (var2 / n2) ** 2 / (n2 - 1)) if denom > 0 else 0
            p = 2 * (1 - t_dist.cdf(abs(t), df)) if df > 0 else 1
            p_bonf = min(1.0, p * n_pairs)
            out.append({
                "group1": m1["group"],
                "group2": m2["group"],
                "meanDiff": mean1 - mean2,
                "t": float(t),
                "df": float(df),
                "p": float(p),
                "pBonferroni": float(p_bonf),
            })
    return out


# ---------- Crosstab (bảng tần số 2 chiều) ----------
def run_crosstab(rows: list, col1: str, col2: str) -> dict | None:
    df = _rows_to_df(rows)
    if col1 not in df.columns or col2 not in df.columns:
        return None
    ct = pd.crosstab(
        df[col1].astype(str).str.strip(),
        df[col2].astype(str).str.strip(),
    )
    row_labels = ct.index.tolist()
    col_labels = ct.columns.tolist()
    counts = ct.values.tolist()
    return {"rowLabels": row_labels, "colLabels": col_labels, "counts": counts}


# ---------- Box plot stats theo nhóm ----------
def run_box_stats(rows: list, group_col: str, value_col: str) -> list[dict]:
    df = _rows_to_df(rows)
    if group_col not in df.columns or value_col not in df.columns:
        return []
    df[value_col] = pd.to_numeric(df[value_col], errors="coerce")
    df = df.dropna(subset=[group_col, value_col])
    out = []
    for name, g in df.groupby(group_col)[value_col]:
        vals = g.dropna()
        if len(vals) == 0:
            continue
        q = vals.quantile([0.25, 0.5, 0.75])
        out.append({
            "group": str(name),
            "min": float(vals.min()),
            "q1": float(q.iloc[0]),
            "median": float(q.iloc[1]),
            "q3": float(q.iloc[2]),
            "max": float(vals.max()),
            "n": int(len(vals)),
        })
    return sorted(out, key=lambda x: x["group"])


# ---------- Histogram bins ----------
def run_histogram_bins(values: list[float], bin_count: int | None = None) -> list[dict]:
    a = np.array(values, dtype=float)
    a = a[~np.isnan(a)]
    if len(a) == 0:
        return []
    k = bin_count or min(20, max(5, int(np.sqrt(len(a)))))
    k = max(2, min(k, len(a)))
    counts, edges = np.histogram(a, bins=k)
    out = []
    for i in range(len(counts)):
        out.append({
            "binStart": float(edges[i]),
            "binEnd": float(edges[i + 1]),
            "count": int(counts[i]),
        })
    return out


# ---------- Power / sample size ----------
def run_power_ttest(effect_size_d: float, alpha: float = 0.05, power: float = 0.8) -> dict:
    """Cỡ mẫu cho t-test 2 nhóm (mỗi nhóm n), Cohen d."""
    from statsmodels.stats.power import TTestIndPower
    obj = TTestIndPower()
    n_per = obj.solve_power(effect_size=effect_size_d, alpha=alpha, power=power, alternative="two-sided")
    n_per = max(2, int(np.ceil(n_per)))
    return {"nRequired": n_per * 2, "power": power, "effectSize": effect_size_d, "alpha": alpha, "testType": "ttest"}


def run_sample_size_proportion(p0: float, p1: float, alpha: float = 0.05, power: float = 0.8) -> dict:
    """Cỡ mẫu cho kiểm định tỉ lệ (z-test 2 tỉ lệ)."""
    from scipy.stats import norm
    z_alpha = norm.ppf(1 - alpha / 2)
    z_beta = norm.ppf(power)
    pbar = (p0 + p1) / 2
    effect = p1 - p0
    if effect == 0:
        return {"nRequired": 0, "p0": p0, "p1": p1, "alpha": alpha, "power": power}
    num = z_alpha * np.sqrt(2 * pbar * (1 - pbar)) + z_beta * np.sqrt(p0 * (1 - p0) + p1 * (1 - p1))
    n = (num / effect) ** 2
    return {"nRequired": max(10, int(np.ceil(n))), "p0": p0, "p1": p1, "alpha": alpha, "power": power}


def run_sample_size_anova(k: int, effect_size_f: float, alpha: float = 0.05, power: float = 0.8) -> dict:
    """Cỡ mẫu cho ANOVA 1 nhân tố, k nhóm. effect_size_f = sqrt(eta_sq/(1-eta_sq))."""
    from statsmodels.stats.power import FTestAnovaPower
    obj = FTestAnovaPower()
    n_per = obj.solve_power(effect_size=effect_size_f, alpha=alpha, power=power, nobs=None, k_groups=k)
    n_per = max(2, int(np.ceil(n_per)))
    return {"nRequired": n_per * k, "nPerGroup": n_per, "k": k, "effectSizeF": effect_size_f, "alpha": alpha, "power": power}


# ---------- Outlier count (IQR: 1.5 * IQR rule) ----------
def run_outlier_count_iqr(values: list[float]) -> dict:
    """Số điểm ngoại lai theo quy tắc Q1 - 1.5*IQR, Q3 + 1.5*IQR."""
    a = np.array(values, dtype=float)
    a = a[~np.isnan(a)]
    if len(a) < 4:
        return {"outlierCount": 0, "q1": None, "q3": None, "iqr": None, "lower": None, "upper": None}
    q1, q3 = np.percentile(a, [25, 75])
    iqr = q3 - q1
    if iqr <= 0:
        return {"outlierCount": 0, "q1": float(q1), "q3": float(q3), "iqr": 0.0, "lower": float(q1), "upper": float(q3)}
    lower, upper = q1 - 1.5 * iqr, q3 + 1.5 * iqr
    count = int(np.sum((a < lower) | (a > upper)))
    return {
        "outlierCount": count,
        "q1": float(q1),
        "q3": float(q3),
        "iqr": float(iqr),
        "lower": float(lower),
        "upper": float(upper),
    }


# ---------- Beta posterior (Bayesian: Beta-Binomial) ----------
def run_beta_posterior(successes: int, n: int, prior_alpha: float = 1, prior_beta: float = 1) -> dict:
    """Prior Beta(alpha, beta), data = successes trong n trials → posterior Beta."""
    if n < 0 or successes < 0 or successes > n:
        return {"postAlpha": 0.5, "postBeta": 0.5, "mean": 0.5, "variance": 0.25, "ci95Lower": 0, "ci95Upper": 1}
    pa = prior_alpha + successes
    pb = prior_beta + (n - successes)
    s = pa + pb
    mean = pa / s
    var = (pa * pb) / (s * s * (s + 1))
    std = np.sqrt(var)
    ci_low = max(0, mean - 1.96 * std)
    ci_high = min(1, mean + 1.96 * std)
    return {
        "postAlpha": float(pa),
        "postBeta": float(pb),
        "mean": float(mean),
        "variance": float(var),
        "ci95Lower": float(ci_low),
        "ci95Upper": float(ci_high),
    }


# ---------- Sample size Chi-square (Cohen w) ----------
def run_sample_size_chisquare(effect_size_w: float, df: int, alpha: float = 0.05, power: float = 0.8) -> dict:
    """Cỡ mẫu cho kiểm định Chi-square. effect_size_w = Cohen w (approximate formula)."""
    if effect_size_w <= 0:
        return {"nRequired": df + 1, "effectSizeW": effect_size_w, "df": df, "alpha": alpha, "power": power}
    z_alpha = scipy_stats.norm.ppf(1 - alpha / 2)
    z_beta = scipy_stats.norm.ppf(power)
    n = (df + 1 + (z_alpha + z_beta) ** 2) / (effect_size_w ** 2)
    n = max(df + 1, int(np.ceil(n)))
    return {"nRequired": n, "effectSizeW": effect_size_w, "df": df, "alpha": alpha, "power": power}


# ---------- Sample size regression (rule of thumb) ----------
def run_sample_size_regression(n_predictors: int, rule: str = "10") -> dict:
    """Quy tắc ngón tay cái: n >= 10 hoặc 20 trên mỗi biến dự đoán + hằng số."""
    mult = 20 if rule == "20" else 10
    n = max(20, n_predictors * mult + 10)
    return {"nRequired": n, "nPredictors": n_predictors, "rule": f"n ≥ {mult} × số biến + 10"}


# ---------- Phân tích định tính (thống kê văn bản) ----------
def run_text_stats(rows: list, col: str, top_n: int = 100) -> dict | None:
    """Thống kê văn bản: đếm từ, tần số từ (token đơn giản tách bằng khoảng trắng)."""
    df = _rows_to_df(rows)
    if col not in df.columns:
        return None
    series = df[col].astype(str).str.strip()
    n_rows = len(series)
    n_empty = int(series.str.len().eq(0).sum())
    words_per_row = series.str.split().str.len()
    total_words = int(words_per_row.sum())
    all_words: list[str] = []
    for s in series:
        if s:
            all_words.extend(s.lower().split())
    from collections import Counter
    counter = Counter(all_words)
    word_freq = [{"word": w, "count": c} for w, c in counter.most_common(top_n)]
    unique_words = len(counter)
    return {
        "column": col,
        "nRows": n_rows,
        "nEmpty": n_empty,
        "totalWords": total_words,
        "uniqueWords": unique_words,
        "avgWordsPerRow": float(words_per_row.mean()) if n_rows else 0,
        "minWordsPerRow": int(words_per_row.min()) if n_rows else 0,
        "maxWordsPerRow": int(words_per_row.max()) if n_rows else 0,
        "wordFreq": word_freq,
    }


def run_keyword_counts(rows: list, col: str, keywords: list[str]) -> dict | None:
    """Đếm từ khóa / mã (định tính): số dòng chứa từ khóa và tổng số lần xuất hiện."""
    df = _rows_to_df(rows)
    if col not in df.columns or not keywords:
        return None
    series = df[col].astype(str).str.strip().str.lower()
    result = []
    for kw in keywords:
        kw_clean = kw.strip().lower()
        if not kw_clean:
            continue
        row_count = int(series.str.contains(kw_clean, regex=False, na=False).sum())
        total_occ = sum(int(s.count(kw_clean)) for s in series)
        result.append({"keyword": kw_clean, "rowCount": row_count, "totalOccurrences": total_occ})
    return {"column": col, "keywords": [r["keyword"] for r in result], "counts": result}


def run_ngram_freq(rows: list, col: str, n: int = 2, top_n: int = 50) -> dict | None:
    """Tần số cụm từ (n-gram) — định tính: bigram (n=2), trigram (n=3), ..."""
    df = _rows_to_df(rows)
    if col not in df.columns or n < 1:
        return None
    from collections import Counter
    series = df[col].astype(str).str.strip().str.lower()
    ngrams: list[str] = []
    for s in series:
        if not s:
            continue
        tokens = s.split()
        for i in range(len(tokens) - n + 1):
            ngrams.append(" ".join(tokens[i : i + n]))
    counter = Counter(ngrams)
    ngram_freq = [{"ngram": g, "count": c} for g, c in counter.most_common(top_n)]
    return {"column": col, "n": n, "totalNgrams": len(ngrams), "uniqueNgrams": len(counter), "ngramFreq": ngram_freq}


def run_cohens_kappa(rows: list, col1: str, col2: str) -> dict | None:
    """Cohen's Kappa — độ đồng nhất mã hóa giữa 2 coder (2 cột phân loại)."""
    df = _rows_to_df(rows)
    if col1 not in df.columns or col2 not in df.columns:
        return None
    from collections import Counter
    c1 = df[col1].astype(str).str.strip()
    c2 = df[col2].astype(str).str.strip()
    pairs = list(zip(c1, c2))
    n = len(pairs)
    if n == 0:
        return None
    agree = sum(1 for a, b in pairs if a == b)
    p_o = agree / n
    cnt1 = Counter(c1)
    cnt2 = Counter(c2)
    labels = sorted(set(cnt1.keys()) | set(cnt2.keys()))
    p_e = sum((cnt1[lab] / n) * (cnt2[lab] / n) for lab in labels)
    if p_e >= 1:
        kappa = 0.0
    else:
        kappa = (p_o - p_e) / (1 - p_e)
    table: dict[str, dict[str, int]] = {}
    for a, b in pairs:
        table.setdefault(a, {})
        table[a][b] = table[a].get(b, 0) + 1
    return {"col1": col1, "col2": col2, "n": n, "kappa": round(kappa, 4), "observedAgreement": round(p_o, 4), "expectedAgreement": round(p_e, 4), "table": table}


# ---------- Excel Data Analysis tools (bổ sung) ----------

def run_covariance(rows: list, method: str = "population") -> dict | None:
    """Ma trận hiệp phương sai (Covariance). method: 'population' (N) hoặc 'sample' (N-1)."""
    df = _rows_to_df(rows)
    numeric = df.select_dtypes(include=[np.number])
    if numeric.shape[1] < 2 or len(numeric) < 2:
        return None
    ddof = 0 if method == "population" else 1
    cov = numeric.cov(ddof=ddof)
    return {"matrix": cov.values.tolist(), "columnNames": cov.columns.tolist(), "ddof": ddof}


def run_ftest_two_sample(rows: list, group_col: str, group_val1: str, group_val2: str, num_col: str) -> dict | None:
    """F-test hai mẫu cho phương sai (so sánh var1 vs var2)."""
    df = _rows_to_df(rows)
    if group_col not in df.columns or num_col not in df.columns:
        return None
    df[num_col] = pd.to_numeric(df[num_col], errors="coerce")
    g1 = df[df[group_col].astype(str).str.strip() == group_val1][num_col].dropna()
    g2 = df[df[group_col].astype(str).str.strip() == group_val2][num_col].dropna()
    if len(g1) < 2 or len(g2) < 2:
        return None
    var1, var2 = float(g1.var(ddof=1)), float(g2.var(ddof=1))
    if var2 == 0:
        return None
    f_stat = var1 / var2
    df1, df2 = len(g1) - 1, len(g2) - 1
    p_val = 2 * min(scipy_stats.f.cdf(f_stat, df1, df2), 1 - scipy_stats.f.cdf(f_stat, df1, df2))
    return {
        "f": f_stat,
        "pValue": float(p_val),
        "df1": df1,
        "df2": df2,
        "var1": var1,
        "var2": var2,
        "n1": len(g1),
        "n2": len(g2),
    }


def run_exponential_smoothing(values: list[float], alpha: float = 0.3) -> dict:
    """Làm mượt hàm mũ (Exponential Smoothing). alpha: hệ số làm mượt (0–1)."""
    a = np.array(values, dtype=float)
    a = a[~np.isnan(a)]
    if len(a) == 0:
        return {"smoothed": [], "alpha": alpha}
    smoothed = [float(a[0])]
    for i in range(1, len(a)):
        smoothed.append(alpha * a[i] + (1 - alpha) * smoothed[-1])
    return {"smoothed": smoothed, "alpha": alpha, "n": len(a)}


def run_moving_average(values: list[float], period: int = 3) -> dict | None:
    """Trung bình trượt (Moving Average). period: số kỳ."""
    a = np.array(values, dtype=float)
    a = a[~np.isnan(a)]
    if len(a) == 0 or period < 1 or period > len(a):
        return None
    ma = np.convolve(a, np.ones(period) / period, mode="valid")
    return {"movingAverage": ma.tolist(), "period": period, "n": len(a)}


def run_anova_two_factor_replication(rows: list, factor_a: str, factor_b: str, value_col: str) -> dict | None:
    """ANOVA hai nhân tố có lặp (Two-Factor With Replication)."""
    from statsmodels.formula.api import ols
    from statsmodels.stats.anova import anova_lm

    df = _rows_to_df(rows)
    for c in [factor_a, factor_b, value_col]:
        if c not in df.columns:
            return None
    df[value_col] = pd.to_numeric(df[value_col], errors="coerce")
    df = df.dropna(subset=[factor_a, factor_b, value_col])
    if len(df) < 4:
        return None
    formula = f"Q('{value_col}') ~ C(Q('{factor_a}')) * C(Q('{factor_b}'))"
    try:
        model = ols(formula, data=df).fit()
        a = anova_lm(model, typ=2)
        rows_out = []
        for name in a.index:
            if name == "Residual":
                rows_out.append({"source": "Within", "ss": float(a.loc[name, "sum_sq"]), "df": int(a.loc[name, "df"]), "ms": float(a.loc[name, "sum_sq"] / a.loc[name, "df"]), "f": None, "pValue": None})
            else:
                f_val = float(a.loc[name, "F"]) if pd.notna(a.loc[name, "F"]) else None
                p_val = float(a.loc[name, "PR(>F)"]) if pd.notna(a.loc[name, "PR(>F)"]) else None
                rows_out.append({"source": name, "ss": float(a.loc[name, "sum_sq"]), "df": int(a.loc[name, "df"]), "ms": float(a.loc[name, "sum_sq"] / a.loc[name, "df"]), "f": f_val, "pValue": p_val})
        return {"table": rows_out, "factorA": factor_a, "factorB": factor_b, "valueCol": value_col, "n": len(df)}
    except Exception:
        return None


def run_anova_two_factor_no_replication(rows: list, factor_a: str, factor_b: str, value_col: str) -> dict | None:
    """ANOVA hai nhân tố không lặp (One observation per cell)."""
    from statsmodels.formula.api import ols
    from statsmodels.stats.anova import anova_lm

    df = _rows_to_df(rows)
    for c in [factor_a, factor_b, value_col]:
        if c not in df.columns:
            return None
    df[value_col] = pd.to_numeric(df[value_col], errors="coerce")
    df = df.dropna(subset=[factor_a, factor_b, value_col])
    if len(df) < 3:
        return None
    formula = f"Q('{value_col}') ~ C(Q('{factor_a}')) + C(Q('{factor_b}'))"
    try:
        model = ols(formula, data=df).fit()
        a = anova_lm(model, typ=2)
        rows_out = []
        for name in a.index:
            if name == "Residual":
                rows_out.append({"source": "Error", "ss": float(a.loc[name, "sum_sq"]), "df": int(a.loc[name, "df"]), "ms": float(a.loc[name, "sum_sq"] / a.loc[name, "df"]), "f": None, "pValue": None})
            else:
                f_val = float(a.loc[name, "F"]) if pd.notna(a.loc[name, "F"]) else None
                p_val = float(a.loc[name, "PR(>F)"]) if pd.notna(a.loc[name, "PR(>F)"]) else None
                rows_out.append({"source": name, "ss": float(a.loc[name, "sum_sq"]), "df": int(a.loc[name, "df"]), "ms": float(a.loc[name, "sum_sq"] / a.loc[name, "df"]), "f": f_val, "pValue": p_val})
        return {"table": rows_out, "factorA": factor_a, "factorB": factor_b, "valueCol": value_col, "n": len(df)}
    except Exception:
        return None


def run_fourier_analysis(values: list[float]) -> dict | None:
    """Phân tích Fourier (FFT): biên độ và tần số."""
    a = np.array(values, dtype=float)
    a = a[~np.isnan(a)]
    n = len(a)
    if n < 4:
        return None
    fft_vals = np.fft.fft(a)
    magnitudes = np.abs(fft_vals[: n // 2 + 1]) / n
    magnitudes[1:-1] *= 2
    freqs = np.fft.fftfreq(n)[: n // 2 + 1]
    return {"magnitudes": magnitudes.tolist(), "frequencies": freqs.tolist(), "n": n}


def run_rank_percentile(rows: list, value_col: str) -> dict | None:
    """Rank and Percentile: xếp hạng và phần trăm."""
    df = _rows_to_df(rows)
    if value_col not in df.columns:
        return None
    s = pd.to_numeric(df[value_col], errors="coerce").dropna()
    if len(s) == 0:
        return None
    ranked = s.rank(method="average", ascending=True)
    pct = (ranked - 0.5) / len(s) * 100
    out = []
    for i in s.sort_values().index:
        out.append({"value": float(s.loc[i]), "rank": int(ranked.loc[i]), "percentile": float(pct.loc[i])})
    out.sort(key=lambda x: x["rank"])
    return {"column": value_col, "n": len(s), "data": out}


def run_random_number_generation(n: int, distribution: str = "uniform", **kwargs) -> dict:
    """Sinh số ngẫu nhiên. distribution: uniform, normal, integer, binomial."""
    if n < 1 or n > 100000:
        return {"values": [], "error": "n phải từ 1 đến 100000"}
    rng = np.random.default_rng(kwargs.get("seed"))
    if distribution == "uniform":
        low, high = kwargs.get("low", 0), kwargs.get("high", 1)
        values = rng.uniform(low, high, size=n).tolist()
    elif distribution == "normal":
        loc = kwargs.get("mean", 0)
        scale = kwargs.get("std", 1)
        values = rng.normal(loc=loc, scale=scale, size=n).tolist()
    elif distribution == "integer":
        low, high = int(kwargs.get("low", 0)), int(kwargs.get("high", 100))
        values = rng.integers(low, high + 1, size=n).tolist()
    elif distribution == "binomial":
        n_trials = int(kwargs.get("nTrials", 10))
        p = float(kwargs.get("p", 0.5))
        values = rng.binomial(n_trials, p, size=n).tolist()
    else:
        return {"values": [], "error": "distribution không hợp lệ"}
    return {"values": values, "n": n, "distribution": distribution}


def run_sampling(rows: list, n: int, method: str = "random", seed: int | None = None) -> dict | None:
    """Lấy mẫu từ dữ liệu. method: 'random' hoặc 'periodic'."""
    if not rows or len(rows) < 2:
        return None
    headers, data = rows[0], rows[1:]
    N = len(data)
    if n >= N:
        return {"rows": [headers] + data, "nSampled": N, "method": method}
    rng = np.random.default_rng(seed)
    if method == "random":
        idx = np.sort(rng.choice(N, size=min(n, N), replace=False))
    else:
        step = max(1, N // n)
        idx = np.array(list(range(0, N, step))[:n])
    sampled = [data[i] for i in idx]
    return {"rows": [headers] + sampled, "nSampled": len(sampled), "method": method, "indices": [int(i) for i in idx]}


def run_ttest_paired(rows: list, col1: str, col2: str) -> dict | None:
    """t-test hai mẫu phụ thuộc (paired)."""
    df = _rows_to_df(rows)
    if col1 not in df.columns or col2 not in df.columns:
        return None
    df[col1] = pd.to_numeric(df[col1], errors="coerce")
    df[col2] = pd.to_numeric(df[col2], errors="coerce")
    df = df[[col1, col2]].dropna()
    if len(df) < 3:
        return None
    a, b = df[col1].values, df[col2].values
    t_stat, p_val = scipy_stats.ttest_rel(a, b)
    diff = a - b
    n = len(diff)
    mean_diff = float(np.mean(diff))
    std_diff = float(np.std(diff, ddof=1)) if n > 1 else 0.0
    pooled_std = float(np.std(np.concatenate([a, b]), ddof=1)) if len(a) + len(b) > 2 else 0.0
    cohen_d = (mean_diff / pooled_std) if pooled_std > 0 else 0.0
    return {
        "t": float(t_stat),
        "df": n - 1,
        "pValue": float(p_val),
        "cohenD": float(cohen_d),
        "meanDiff": mean_diff,
        "stdDiff": std_diff,
        "mean1": float(np.mean(a)),
        "mean2": float(np.mean(b)),
        "n": n,
    }


def run_ztest_two_means(
    rows: list,
    group_col: str,
    group_val1: str,
    group_val2: str,
    num_col: str,
    known_var1: float,
    known_var2: float,
) -> dict | None:
    """z-Test hai mẫu cho trung bình khi đã biết phương sai tổng thể."""
    df = _rows_to_df(rows)
    if group_col not in df.columns or num_col not in df.columns:
        return None
    df[num_col] = pd.to_numeric(df[num_col], errors="coerce")
    g1 = df[df[group_col].astype(str).str.strip() == group_val1][num_col].dropna()
    g2 = df[df[group_col].astype(str).str.strip() == group_val2][num_col].dropna()
    if len(g1) < 1 or len(g2) < 1:
        return None
    m1, m2 = float(g1.mean()), float(g2.mean())
    n1, n2 = len(g1), len(g2)
    se = np.sqrt(known_var1 / n1 + known_var2 / n2)
    if se <= 0:
        return None
    z = (m1 - m2) / se
    p_val = 2 * (1 - scipy_stats.norm.cdf(abs(z)))
    return {
        "z": float(z),
        "pValue": float(p_val),
        "mean1": m1,
        "mean2": m2,
        "n1": n1,
        "n2": n2,
        "knownVar1": known_var1,
        "knownVar2": known_var2,
    }
