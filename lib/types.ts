export type HoldingsItem = {
  ticker: string;
  value: number;
};

export type HoldingsInput = {
  mode: "weights" | "shares";
  items: HoldingsItem[];
  range: string;
  benchmark?: string;
  riskFreeRate?: number;
  shrinkage?: number;
};

export type PricesByTicker = Record<string, number[]>;

export type PricesResponse = {
  range: string;
  start: string;
  end: string;
  dates: string[];
  pricesByTicker: PricesByTicker;
  /** Per-ticker errors (partial success). */
  errors?: Record<string, string>;
};

export type ReturnsByTicker = Record<string, number[]>;

export type PortfolioMetrics = {
  totalReturn: number;
  cagr: number;
  annualizedReturn: number;
  annualizedVolatility: number;
  sharpe: number;
  maxDrawdown: number;
  beta?: number;
  var95: number;
  cvar95: number;
  concentrationHhi: number;
  effectiveN: number;
  riskContributions: Record<string, number>;
};

export type RebalanceObjective = "min-variance" | "risk-parity";

export type TradeRow = {
  ticker: string;
  currentWeight: number;
  targetWeight: number;
  finalWeight: number;
  currentShares?: number;
  targetShares?: number;
  tradeShares?: number;
  tradeValue?: number;
};

export type SnapshotDefaults = {
  range: string;
  benchmark: string;
  riskFreeRate: number;
  shrinkage: boolean;
};

export type PortfolioListItem = {
  id: string;
  name: string;
  mode: "weights" | "shares";
  holdingCount: number;
  lastSnapshotAt: string | null;
  lastVolAnn: number | null;
};

export type PortfolioDetail = {
  id: string;
  name: string;
  mode: "weights" | "shares";
  createdAt: string;
  holdings: HoldingsItem[];
  defaults: SnapshotDefaults;
  latestSnapshot: SnapshotSummary | null;
};

export type SnapshotSummary = {
  id: string;
  createdAt: string;
  range: string;
  benchmark: string;
  volAnn: number;
  maxDD: number;
  beta: number | null;
};

export type HoldingsUsedRow = {
  ticker: string;
  inputValue: number;
  lastPrice: number;
  weight: number;
};

export type SnapshotSeries = {
  dates: string[];
  equity: number[];
  drawdown: number[];
  rollingVol: Array<number | null>;
  portfolioReturns: Array<number | null>;
};

export type SnapshotRisk = {
  tickers: string[];
  corrMatrix: number[][];
  riskContribPct: Record<string, number>;
};

export type SnapshotMetrics = {
  totalReturn: number;
  cagr: number;
  volAnn: number;
  sharpe: number;
  maxDD: number;
  beta: number | null;
  var95: number;
  cvar95: number;
  hhi: number;
  neff: number;
};

export type SnapshotDetail = {
  id: string;
  portfolioId: string;
  createdAt: string;
  range: string;
  benchmark: string;
  riskFreeRate: number;
  shrinkage: boolean;
  holdingsUsed: HoldingsUsedRow[];
  metrics: SnapshotMetrics;
  series: SnapshotSeries;
  risk: SnapshotRisk;
};

export type AlertRuleType = "vol_gt" | "maxdd_lt" | "var_gt";

export type AlertRule = {
  id: string;
  portfolioId: string;
  type: AlertRuleType;
  threshold: number;
  createdAt: string;
};
