import { portfolioVariance, riskContributions } from "./math";

/* ---------- Matrix inverse (Gauss-Jordan) ---------- */

function invertMatrix(matrix: number[][]): number[][] | null {
  const n = matrix.length;
  const aug = matrix.map((row, i) => {
    const r = [...row];
    for (let j = 0; j < n; j++) r.push(i === j ? 1 : 0);
    return r;
  });

  for (let i = 0; i < n; i++) {
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(aug[k][i]) > Math.abs(aug[maxRow][i])) maxRow = k;
    }
    [aug[i], aug[maxRow]] = [aug[maxRow], aug[i]];

    if (Math.abs(aug[i][i]) < 1e-12) return null; // singular

    const pivot = aug[i][i];
    for (let j = 0; j < 2 * n; j++) aug[i][j] /= pivot;

    for (let k = 0; k < n; k++) {
      if (k === i) continue;
      const factor = aug[k][i];
      for (let j = 0; j < 2 * n; j++) aug[k][j] -= factor * aug[i][j];
    }
  }

  return aug.map((row) => row.slice(n));
}

/* ---------- Min-Variance (long-only heuristic) ---------- */

export function minVarianceWeights(cov: number[][], maxWeight?: number): number[] {
  const n = cov.length;
  if (n === 0) return [];

  const inv = invertMatrix(cov);
  let weights: number[];

  if (!inv) {
    // Fallback to equal weights if singular
    weights = Array.from({ length: n }, () => 1 / n);
  } else {
    const invOnes = inv.map((row) => row.reduce((a, v) => a + v, 0));
    const denom = invOnes.reduce((a, v) => a + v, 0);

    if (Math.abs(denom) < 1e-12) {
      weights = Array.from({ length: n }, () => 1 / n);
    } else {
      weights = invOnes.map((v) => v / denom);
    }
  }

  // Clip negatives (long-only) and renormalize
  weights = weights.map((w) => Math.max(0, w));

  // Enforce max-weight constraint if given
  if (maxWeight != null && maxWeight > 0 && maxWeight < 1) {
    for (let iter = 0; iter < 50; iter++) {
      const capped = weights.some((w) => w > maxWeight + 1e-9);
      if (!capped) break;
      weights = weights.map((w) => Math.min(w, maxWeight));
      const sum = weights.reduce((a, w) => a + w, 0);
      if (sum > 0) weights = weights.map((w) => w / sum);
    }
  }

  const sum = weights.reduce((a, w) => a + w, 0);
  if (sum > 0) weights = weights.map((w) => w / sum);
  else weights = Array.from({ length: n }, () => 1 / n);

  return weights;
}

/* ---------- Risk Parity (iterative heuristic) ---------- */

export function riskParityWeights(
  cov: number[][],
  maxWeight?: number,
  iterations = 200,
  eta = 0.5,
): number[] {
  const n = cov.length;
  if (n === 0) return [];
  const eps = 1e-10;
  let weights = Array.from({ length: n }, () => 1 / n);

  for (let iter = 0; iter < iterations; iter++) {
    const rc = riskContributions(weights, cov);
    const targetRC = 1 / n;

    for (let i = 0; i < n; i++) {
      const ratio = rc[i] > eps ? targetRC / rc[i] : 1;
      weights[i] = weights[i] * Math.pow(ratio, eta);
      weights[i] = Math.max(weights[i], eps);
    }

    // Enforce max-weight
    if (maxWeight != null && maxWeight > 0 && maxWeight < 1) {
      weights = weights.map((w) => Math.min(w, maxWeight));
    }

    // Normalize
    const sum = weights.reduce((a, w) => a + w, 0);
    weights = weights.map((w) => w / sum);
  }

  return weights;
}

/* ---------- Turnover blending ---------- */

export function blendWeights(current: number[], target: number[], gamma: number): number[] {
  const blended = current.map((w, i) => (1 - gamma) * w + gamma * (target[i] ?? 0));
  const sum = blended.reduce((a, w) => a + w, 0);
  return sum > 0 ? blended.map((w) => w / sum) : blended;
}

/* ---------- Trades computation ---------- */

export type TradeDetail = {
  ticker: string;
  currentWeight: number;
  targetWeight: number;
  finalWeight: number;
  currentShares: number;
  targetShares: number;
  tradeShares: number;
  tradeValue: number;
};

export function computeTrades(
  tickers: string[],
  currentShares: number[],
  lastPrices: number[],
  finalWeights: number[],
): { trades: TradeDetail[]; cashLeftover: number } {
  const totalValue = currentShares.reduce((a, s, i) => a + s * lastPrices[i], 0);
  let usedValue = 0;

  const trades = tickers.map((ticker, i) => {
    const currentWeight = totalValue > 0 ? (currentShares[i] * lastPrices[i]) / totalValue : 0;
    const targetValue = totalValue * finalWeights[i];
    const targetShares = Math.floor(targetValue / (lastPrices[i] || 1));
    const tradeShares = targetShares - currentShares[i];
    const tradeValue = tradeShares * lastPrices[i];
    usedValue += targetShares * lastPrices[i];
    return {
      ticker,
      currentWeight,
      targetWeight: finalWeights[i],
      finalWeight: finalWeights[i],
      currentShares: currentShares[i],
      targetShares,
      tradeShares,
      tradeValue,
    };
  });

  return { trades, cashLeftover: totalValue - usedValue };
}

/* ---------- Estimated turnover ---------- */

export function estimatedTurnover(currentWeights: number[], finalWeights: number[]): number {
  let sum = 0;
  for (let i = 0; i < currentWeights.length; i++) {
    sum += Math.abs((finalWeights[i] ?? 0) - (currentWeights[i] ?? 0));
  }
  return sum / 2; // one-way turnover
}

/* ---------- Portfolio volatility (for display) ---------- */

export function portfolioVol(weights: number[], cov: number[][]): number {
  return Math.sqrt(portfolioVariance(weights, cov));
}
