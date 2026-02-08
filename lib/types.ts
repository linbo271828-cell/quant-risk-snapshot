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
