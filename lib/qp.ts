const solveQP = require("quadprog-js") as (
  q: number[][],
  c: number[],
  a: number[][],
  b: number[],
) => { solution: number[] };

type MinVarConstraints = {
  maxWeight?: number;
};

function withRidge(cov: number[][], ridge: number): number[][] {
  return cov.map((row, i) => row.map((v, j) => (i === j ? v + ridge : v)));
}

function normalizeLongOnly(weights: number[]): number[] {
  const clipped = weights.map((w) => Math.max(0, w));
  const sum = clipped.reduce((a, w) => a + w, 0);
  if (sum <= 0) return clipped.map(() => 1 / (clipped.length || 1));
  return clipped.map((w) => w / sum);
}

export function solveMinVarQP(cov: number[][], constraints: MinVarConstraints = {}): number[] {
  const n = cov.length;
  if (n === 0) return [];

  const Q = withRidge(cov, 1e-8);
  const c = Array.from({ length: n }, () => 0);
  const A: number[][] = [];
  const b: number[] = [];

  // Sum-to-one as two inequalities.
  A.push(Array.from({ length: n }, () => 1));
  b.push(1);
  A.push(Array.from({ length: n }, () => -1));
  b.push(-1);

  // Long-only.
  for (let i = 0; i < n; i++) {
    const row = Array.from({ length: n }, () => 0);
    row[i] = -1;
    A.push(row);
    b.push(0);
  }

  if (constraints.maxWeight != null && constraints.maxWeight > 0 && constraints.maxWeight < 1) {
    for (let i = 0; i < n; i++) {
      const row = Array.from({ length: n }, () => 0);
      row[i] = 1;
      A.push(row);
      b.push(constraints.maxWeight);
    }
  }

  try {
    const solved = solveQP(Q, c, A, b);
    return normalizeLongOnly(solved.solution);
  } catch (_err) {
    return Array.from({ length: n }, () => 1 / n);
  }
}
