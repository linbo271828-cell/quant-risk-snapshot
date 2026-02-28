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

export type DetectiveRunInput = {
  analyzeDate: string;
  benchmark: string;
  eventWindowDays: number;
  maxTickers: number;
};

export type DetectiveReportSummary = {
  id: string;
  portfolioId: string;
  createdAt: string;
  analyzeDate: string;
  benchmark: string;
  portfolioReturn: number;
  abnormalReturn: number;
};

export type DetectiveDriver = {
  ticker: string;
  weight: number;
  tickerReturn: number;
  contribution: number;
};

export type DetectiveEventItem = {
  id: string;
  ticker: string;
  score: number;
  explanation: {
    recencyDays: number;
    abret1d: number;
    contribution: number;
    eventType: string;
  };
  event: {
    id: string;
    type: string;
    eventTime: string;
    title: string;
    url: string;
    source: string;
  };
  reaction: {
    post1dAbRet: number | null;
    post3dAbRet: number | null;
    post5dAbRet: number | null;
    computedAt: string | null;
  };
};

export type DetectiveReportDetail = {
  id: string;
  portfolioId: string;
  portfolioName: string;
  createdAt: string;
  analyzeDate: string;
  benchmark: string;
  summary: {
    portfolioReturn: number;
    benchmarkReturn: number;
    abnormalReturn: number;
    topDrivers: DetectiveDriver[];
    contextWindow: {
      dates: string[];
      benchmarkPrices: number[];
    } | null;
  };
  items: DetectiveEventItem[];
};

export type BacktestFrequency = "WEEKLY" | "MONTHLY";
export type BacktestStrategy = "BUY_HOLD" | "RISK_PARITY" | "MINVAR_QP";

export type BacktestRunInput = {
  start: string;
  end: string;
  benchmark: string;
  frequency: BacktestFrequency;
  strategy: BacktestStrategy;
  costBps?: number;
  maxWeight?: number;
  shrinkage?: boolean;
};

export type BacktestRunSummary = {
  id: string;
  portfolioId: string;
  createdAt: string;
  startDate: string;
  endDate: string;
  benchmark: string;
  frequency: BacktestFrequency;
  strategy: BacktestStrategy;
  totalReturn: number;
  cagr: number;
  volAnn: number;
  sharpe: number;
  maxDD: number;
};

export type BacktestMetrics = {
  totalReturn: number;
  cagr: number;
  volAnn: number;
  sharpe: number;
  maxDD: number;
  turnover: number;
  avgRebalanceCost: number;
};

export type BacktestSeries = {
  dates: string[];
  equity: number[];
  drawdown: number[];
  returns: Array<number | null>;
};

export type BacktestRunDetail = {
  id: string;
  portfolioId: string;
  createdAt: string;
  startDate: string;
  endDate: string;
  benchmark: string;
  frequency: BacktestFrequency;
  strategy: BacktestStrategy;
  params: Record<string, unknown>;
  metrics: BacktestMetrics;
  series: BacktestSeries;
  weights: Array<{ date: string; weights: Record<string, number> }>;
};
