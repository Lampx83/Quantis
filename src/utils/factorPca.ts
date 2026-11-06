import type { FactorSample, FactorSampleIssue } from "./factorSample";

export interface FactorSolution {
  nFactors: number;
  rotation: "none" | "varimax";
  unrotatedLoadings: number[][];
  loadings: number[][];
  communalities: number[];
  varianceBefore: number[];
  varianceAfter: number[];
}

type PcaIssue = FactorSampleIssue
  | { code: "pcaMinimumRows" | "pcaEigenFailed" | "pcaRotationFailed" }
  | { code: "pcaInvalidCount"; max: number };

export interface PcaRun {
  method: "pca";
  columnNames: string[];
  nUsed: number;
  eigenvalues: number[];
  suggestedCount: number | null;
  solution: FactorSolution | null;
  issue: PcaIssue | null;
}

export function computeFactorPca(sample: FactorSample, count?: number): PcaRun {
  const { columnNames, correlation, nUsed } = sample;
  const run = { method: "pca" as const, columnNames, nUsed, eigenvalues: [], suggestedCount: null, solution: null };
  if (!correlation || nUsed < 10 || columnNames.length < 2) {
    return { ...run, issue: sample.issue ?? { code: "pcaMinimumRows" } };
  }

  const eigen = decomposeCorrelation(correlation);
  if (!eigen) return { ...run, issue: { code: "pcaEigenFailed" } };
  const { eigenvalues, eigenvectors } = eigen;
  const rankThreshold = eigenvalues[0] * 1e-10;
  const rank = eigenvalues.filter((value) => value > rankThreshold).length;
  const suggestedCount = eigenvalues.filter((value) => value > 1).length;
  const scree = { ...run, eigenvalues, suggestedCount };
  const nFactors = count ?? Math.max(1, suggestedCount);
  if (!Number.isInteger(nFactors) || nFactors < 1 || nFactors > rank) {
    return { ...scree, issue: { code: "pcaInvalidCount", max: rank } };
  }

  const unrotatedLoadings = eigenvectors.map((row) => row.slice(0, nFactors).map((value, j) => value * Math.sqrt(eigenvalues[j])));
  const loadings = nFactors === 1 ? unrotatedLoadings : varimax(unrotatedLoadings);
  if (!loadings) return { ...scree, issue: { code: "pcaRotationFailed" } };
  const percentVariance = (matrix: number[][]) => matrix[0].map((_, j) =>
    100 * matrix.reduce((sum, row) => sum + row[j] ** 2, 0) / columnNames.length);
  return {
    ...scree,
    issue: null,
    solution: {
      nFactors,
      rotation: nFactors === 1 ? "none" : "varimax",
      unrotatedLoadings,
      loadings,
      communalities: loadings.map((row) => row.reduce((sum, value) => sum + value ** 2, 0)),
      varianceBefore: percentVariance(unrotatedLoadings),
      varianceAfter: percentVariance(loadings),
    },
  };
}

/** Cyclic Jacobi sweeps on a symmetric correlation matrix. */
function decomposeCorrelation(matrix: number[][]) {
  const size = matrix.length;
  const a = matrix.map((row) => [...row]);
  const vectors: number[][] = a.map((_, i) => a.map((_, j) => i === j ? 1 : 0));
  const tolerance = 1e-12;
  for (let sweep = 0; sweep < 50; sweep++) {
    let converged = true;
    for (let p = 0; p < size - 1; p++) for (let q = p + 1; q < size; q++) {
      const pivot = a[p][q];
      if (!Number.isFinite(pivot)) return null;
      if (Math.abs(pivot) <= tolerance) continue;
      converged = false;
      const tau = (a[q][q] - a[p][p]) / (2 * pivot);
      const tangent = (tau < 0 ? -1 : 1) / (Math.abs(tau) + Math.hypot(1, tau));
      const cosine = 1 / Math.hypot(1, tangent);
      const sine = tangent * cosine;
      a[p][p] -= tangent * pivot;
      a[q][q] += tangent * pivot;
      a[p][q] = a[q][p] = 0;
      for (let i = 0; i < size; i++) {
        if (i !== p && i !== q) {
          const left = a[i][p];
          const right = a[i][q];
          a[p][i] = a[i][p] = cosine * left - sine * right;
          a[q][i] = a[i][q] = sine * left + cosine * right;
        }
        const left = vectors[i][p];
        const right = vectors[i][q];
        vectors[i][p] = cosine * left - sine * right;
        vectors[i][q] = sine * left + cosine * right;
      }
    }
    if (converged) {
      const roots = a.map((row, i) => ({ value: row[i], i })).sort((l, r) => r.value - l.value);
      if (roots.some(({ value }) => !Number.isFinite(value) || value < -tolerance * size)) return null;
      return {
        eigenvalues: roots.map(({ value }) => Math.max(0, value)),
        eigenvectors: vectors.map((row) => roots.map(({ i }) => row[i])),
      };
    }
  }
  return null;
}

/** Raw Varimax by pairwise column rotations, with no Kaiser normalization. */
function varimax(loadings: number[][]): number[][] | null {
  const matrix = loadings.map((row) => [...row]);
  const p = matrix.length;
  const k = matrix[0].length;
  for (let sweep = 0; sweep < 100; sweep++) {
    let converged = true;
    for (let i = 0; i < k - 1; i++) for (let j = i + 1; j < k; j++) {
      let sumU = 0, sumV = 0, sumDifference = 0, sumProduct = 0;
      for (const row of matrix) {
        const u = row[i] ** 2 - row[j] ** 2;
        const v = 2 * row[i] * row[j];
        sumU += u;
        sumV += v;
        sumDifference += u ** 2 - v ** 2;
        sumProduct += u * v;
      }
      const numerator = 2 * (sumProduct - sumU * sumV / p);
      const denominator = sumDifference - (sumU ** 2 - sumV ** 2) / p;
      if (Math.hypot(numerator, denominator) <= 1e-14) continue;
      const angle = Math.atan2(numerator, denominator) / 4;
      if (Math.abs(angle) <= 1e-10) continue;
      converged = false;
      const cosine = Math.cos(angle);
      const sine = Math.sin(angle);
      for (const row of matrix) {
        const left = row[i];
        const right = row[j];
        row[i] = cosine * left + sine * right;
        row[j] = cosine * right - sine * left;
      }
    }
    if (converged) {
      const columns = matrix[0].map((_, j) => ({
        j,
        sign: matrix.reduce((sum, row) => sum + row[j], 0) < 0 ? -1 : 1,
        squares: matrix.reduce((sum, row) => sum + row[j] ** 2, 0),
      })).sort((left, right) => right.squares - left.squares);
      return matrix.map((row) => columns.map(({ j, sign }) => row[j] * sign));
    }
  }
  return null;
}
