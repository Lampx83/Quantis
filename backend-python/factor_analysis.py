"""Correlation-based PCA and shared factor-analysis routines."""

import numpy as np
import pandas as pd


class FactorAnalysisError(ValueError):
    def __init__(self, code: str, status: int = 400, **details):
        super().__init__(code)
        self.status = status
        self.detail = {"code": code, **details}


def complete_sample(rows: list, columns: list[str], max_rows: int) -> np.ndarray:
    if len(rows) > max_rows + 1:
        raise FactorAnalysisError("rowLimit", max=max_rows)
    header = rows[0] if rows else []
    if len(columns) < 2 or len(columns) != len(set(columns)):
        raise FactorAnalysisError("invalidColumns")
    # Exact names take precedence. Legacy requests used trimmed header names.
    trimmed = [name.strip() or f"col_{i}" for i, name in enumerate(header)]
    missing = [name for name in columns if name not in header and name not in trimmed]
    if missing:
        raise FactorAnalysisError("missingColumns", columns=missing)
    indices = [header.index(name) if name in header else trimmed.index(name) for name in columns]
    frame = pd.DataFrame(rows[1:]).reindex(columns=indices)
    data = frame.apply(pd.to_numeric, errors="coerce").to_numpy(dtype=float)
    return data[np.isfinite(data).all(axis=1)]


def correlation_matrix(data: np.ndarray, columns: list[str], failure_code: str) -> np.ndarray:
    constant = np.all(data == data[0], axis=0)
    if constant.any():
        raise FactorAnalysisError("constantColumns", columns=[name for name, flag in zip(columns, constant) if flag])
    # Rescale first to keep finite data finite during centering and cross-products.
    scaled = data / np.max(np.abs(data), axis=0)
    offsets = scaled - scaled[0]
    centered = offsets - offsets.mean(axis=0)
    norms = np.linalg.norm(centered, axis=0)
    if np.any(norms == 0):
        raise FactorAnalysisError(failure_code, 422)
    correlation = (centered.T @ centered) / np.outer(norms, norms)
    np.fill_diagonal(correlation, 1)
    return correlation


def descending_eigen(matrix: np.ndarray, failure_code: str) -> tuple[np.ndarray, np.ndarray]:
    try:
        values, vectors = np.linalg.eigh(matrix)
    except np.linalg.LinAlgError as error:
        raise FactorAnalysisError(failure_code, 422) from error
    if not (np.isfinite(values).all() and np.isfinite(vectors).all()):
        raise FactorAnalysisError(failure_code, 422)
    order = np.argsort(-values, kind="stable")
    vectors = vectors[:, order]
    pivots = vectors[np.argmax(np.abs(vectors), axis=0), np.arange(len(values))]
    return values[order], vectors * np.where(pivots < 0, -1.0, 1.0)


def numerical_rank(eigenvalues: np.ndarray) -> int:
    return int(np.count_nonzero(eigenvalues > eigenvalues[0] * 1e-10))


def validate_count(count: object, maximum: int, code: str) -> int:
    # Keep accepting integer-valued numeric strings from legacy /efa callers.
    try:
        value = float(count) if isinstance(count, (int, float, str)) and not isinstance(count, bool) else np.nan
    except (ValueError, OverflowError):
        value = np.nan
    if not (1 <= value <= maximum and value == int(value)):
        raise FactorAnalysisError(code, max=maximum)
    return int(value)


def varimax(loadings: np.ndarray, failure_code: str) -> np.ndarray:
    """Raw Varimax using the same pairwise sweeps as browser PCA."""
    rotated = loadings.copy()
    p, k = rotated.shape
    for _ in range(100):
        converged = True
        for i in range(k - 1):
            for j in range(i + 1, k):
                left, right = rotated[:, i], rotated[:, j]
                u, v = left**2 - right**2, 2 * left * right
                numerator = 2 * (u @ v - u.sum() * v.sum() / p)
                denominator = u @ u - v @ v - (u.sum()**2 - v.sum()**2) / p
                if np.hypot(numerator, denominator) <= 1e-14:
                    continue
                angle = np.arctan2(numerator, denominator) / 4
                if abs(angle) <= 1e-10:
                    continue
                converged = False
                cosine, sine = np.cos(angle), np.sin(angle)
                rotated[:, [i, j]] = np.column_stack((cosine * left + sine * right, cosine * right - sine * left))
        if converged:
            rotated *= np.where(rotated.sum(axis=0) < 0, -1.0, 1.0)
            return rotated[:, np.argsort(-(rotated**2).sum(axis=0), kind="stable")]
    raise FactorAnalysisError(failure_code, 422)


def summarize_solution(unrotated: np.ndarray, failure_code: str) -> dict:
    p, count = unrotated.shape
    rotated = unrotated if count == 1 else varimax(unrotated, failure_code)
    return {
        "nFactors": count,
        "rotation": "none" if count == 1 else "varimax",
        "unrotatedLoadings": unrotated.tolist(),
        "loadings": rotated.tolist(),
        "communalities": (rotated**2).sum(axis=1).tolist(),
        "varianceBefore": (100 * (unrotated**2).sum(axis=0) / p).tolist(),
        "varianceAfter": (100 * (rotated**2).sum(axis=0) / p).tolist(),
    }


def run_pca(rows: list, columns: list[str], count: object, max_rows: int) -> dict:
    data = complete_sample(rows, columns, max_rows)
    if len(data) < 10:
        raise FactorAnalysisError("pcaMinimumRows")
    correlation = correlation_matrix(data, columns, "pcaEigenFailed")
    values, vectors = descending_eigen(correlation, "pcaEigenFailed")
    if values[-1] < -len(columns) * 1e-12:
        raise FactorAnalysisError("pcaEigenFailed", 422)
    values = np.maximum(values, 0)
    suggested = int(np.count_nonzero(values > 1))
    n_factors = max(1, suggested) if count is None else validate_count(count, numerical_rank(values), "pcaInvalidCount")
    unrotated = vectors[:, :n_factors] * np.sqrt(values[:n_factors])
    solution = summarize_solution(unrotated, "pcaRotationFailed")
    return {
        "method": "pca",
        "columnNames": columns,
        "nUsed": len(data),
        "eigenvalues": values[:min(len(columns), len(data) - 1)].tolist(),
        "screeEigenvalues": values.tolist(),
        "suggestedCount": suggested,
        "varianceExplained": solution["varianceBefore"],
        **solution,
    }
