import { ReturnsByTicker } from "./types";

const TRADING_DAYS = 252;

export function normalizeWeights(values: number[]): number[] {
  const sum = values.reduce((acc, v) => acc + Math.abs(v), 0);
  if (sum <= 0) return values.map(() => 0);
  return values.map((v) => v / sum);
}

export function computeReturns(prices: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    const prev = prices[i - 1];
    const next = prices[i];
    out.push(prev > 0 ? next / prev - 1 : 0);
  }
  return out;
}

export function portfolioReturns(returnsByTicker: ReturnsByTicker, weightsByTicker: Record<string, number>): number[] {
  const tickers = Object.keys(returnsByTicker);
  if (tickers.length === 0) return [];
  const n = returnsByTicker[tickers[0]].length;
  const out = Array.from({ length: n }, () => 0);

  for (const t of tickers) {
    const w = weightsByTicker[t] ?? 0;
    const series = returnsByTicker[t];
    for (let i = 0; i < n; i++) out[i] += w * series[i];
  }
  return out;
}

export function equityCurveFromReturns(returns: number[], startValue = 1): number[] {
  const curve: number[] = [startValue];
  for (const r of returns) {
    const prev = curve[curve.length - 1];
    curve.push(prev * (1 + r));
  }
  return curve;
}

export function annualizedReturn(returns: number[]): number {
  if (returns.length === 0) return 0;
  const avg = returns.reduce((acc, r) => acc + r, 0) / returns.length;
  return avg * TRADING_DAYS;
}

export function annualizedVolatility(returns: number[]): number {
  if (returns.length === 0) return 0;
  const avg = returns.reduce((acc, r) => acc + r, 0) / returns.length;
  const variance = returns.reduce((acc, r) => acc + (r - avg) ** 2, 0) / returns.length;
  return Math.sqrt(variance) * Math.sqrt(TRADING_DAYS);
}

export function drawdownSeries(equityCurve: number[]): number[] {
  let peak = -Infinity;
  return equityCurve.map((v) => {
    if (v > peak) peak = v;
    return peak > 0 ? v / peak - 1 : 0;
  });
}

export function rollingVolatility(returns: number[], window: number): Array<number | null> {
  const out: Array<number | null> = [];
  for (let i = 0; i < returns.length; i++) {
    if (i + 1 < window) {
      out.push(null);
      continue;
    }
    const slice = returns.slice(i + 1 - window, i + 1);
    out.push(annualizedVolatility(slice));
  }
  return out;
}

export function covarianceMatrix(returnsByTicker: ReturnsByTicker): { tickers: string[]; matrix: number[][] } {
  const tickers = Object.keys(returnsByTicker);
  const n = tickers.length;
  if (n === 0) return { tickers: [], matrix: [] };

  const len = returnsByTicker[tickers[0]].length;
  const means = tickers.map((t) => returnsByTicker[t].reduce((a, r) => a + r, 0) / len);
  const matrix = Array.from({ length: n }, () => Array.from({ length: n }, () => 0));

  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      let cov = 0;
      for (let k = 0; k < len; k++) {
        cov += (returnsByTicker[tickers[i]][k] - means[i]) * (returnsByTicker[tickers[j]][k] - means[j]);
      }
      cov = len > 1 ? cov / (len - 1) : 0;
      matrix[i][j] = cov;
      matrix[j][i] = cov;
    }
  }

  return { tickers, matrix };
}

export function shrinkCovariance(matrix: number[][], shrinkage: number): number[][] {
  const s = Math.min(Math.max(shrinkage, 0), 1);
  const n = matrix.length;
  const out = matrix.map((row) => row.slice());

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      out[i][j] = (1 - s) * out[i][j];
    }
    out[i][i] = out[i][i];
  }
  return out;
}

export function correlationMatrix(cov: number[][]): number[][] {
  const n = cov.length;
  const out = Array.from({ length: n }, () => Array.from({ length: n }, () => 0));
  const std = cov.map((row, i) => Math.sqrt(cov[i][i]));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const denom = std[i] * std[j];
      out[i][j] = denom > 0 ? cov[i][j] / denom : 0;
    }
  }
  return out;
}

export function portfolioVariance(weights: number[], cov: number[][]): number {
  let sum = 0;
  for (let i = 0; i < weights.length; i++) {
    for (let j = 0; j < weights.length; j++) {
      sum += weights[i] * cov[i][j] * weights[j];
    }
  }
  return sum;
}

export function riskContributions(weights: number[], cov: number[][]): number[] {
  const portVar = portfolioVariance(weights, cov);
  if (portVar <= 0) return weights.map(() => 0);
  const n = weights.length;
  const marginal = Array.from({ length: n }, () => 0);

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      marginal[i] += cov[i][j] * weights[j];
    }
  }

  return weights.map((w, i) => (w * marginal[i]) / portVar);
}

export function betaToBenchmark(portfolio: number[], benchmark: number[]): number | undefined {
  if (portfolio.length === 0 || portfolio.length !== benchmark.length) return undefined;
  const meanP = portfolio.reduce((a, r) => a + r, 0) / portfolio.length;
  const meanB = benchmark.reduce((a, r) => a + r, 0) / benchmark.length;

  let cov = 0;
  let varB = 0;
  for (let i = 0; i < portfolio.length; i++) {
    cov += (portfolio[i] - meanP) * (benchmark[i] - meanB);
    varB += (benchmark[i] - meanB) ** 2;
  }
  cov = portfolio.length > 1 ? cov / (portfolio.length - 1) : 0;
  varB = benchmark.length > 1 ? varB / (benchmark.length - 1) : 0;
  return varB > 0 ? cov / varB : undefined;
}

export function varCvar(returns: number[], alpha = 0.05): { var95: number; cvar95: number } {
  if (returns.length === 0) return { var95: 0, cvar95: 0 };
  const sorted = [...returns].sort((a, b) => a - b);
  const idx = Math.max(0, Math.min(sorted.length - 1, Math.floor(alpha * sorted.length)));
  const q = sorted[idx];
  const tail = sorted.filter((r) => r <= q);
  const avg = tail.reduce((a, r) => a + r, 0) / (tail.length || 1);
  return { var95: -q, cvar95: -avg };
}

export function concentrationHhi(weights: number[]): number {
  return weights.reduce((acc, w) => acc + w * w, 0);
}

export function effectiveN(weights: number[]): number {
  const hhi = concentrationHhi(weights);
  return hhi > 0 ? 1 / hhi : 0;
}

export function totalReturn(returns: number[]): number {
  if (returns.length === 0) return 0;
  let prod = 1;
  for (const r of returns) prod *= 1 + r;
  return prod - 1;
}

export function cagr(returns: number[]): number {
  if (returns.length === 0) return 0;
  const total = totalReturn(returns);
  if (total <= -1) return -1;
  return Math.pow(1 + total, TRADING_DAYS / returns.length) - 1;
}

export function sharpeRatio(returns: number[], riskFreeRate = 0): number {
  const vol = annualizedVolatility(returns);
  if (vol <= 0) return 0;
  const meanAnnualized = annualizedReturn(returns);
  return (meanAnnualized - riskFreeRate) / vol;
}
