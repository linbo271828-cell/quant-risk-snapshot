import type { HoldingsInput } from "./types";

export type Suggestion = {
  id: string;
  title: string;
  reason: string;
  confidence: "low" | "medium" | "high";
  actionLabel: string;
  patch: Partial<{
    benchmark: string;
    range: string;
    riskFreeRate: number;
    shrinkageEnabled: boolean;
    shrinkage: number;
    strategy: "BUY_HOLD" | "RISK_PARITY" | "MINVAR_QP";
  }>;
};

function confidenceByCount(count: number): Suggestion["confidence"] {
  if (count >= 8) return "high";
  if (count >= 4) return "medium";
  return "low";
}

export function getInputSuggestions(input: Partial<HoldingsInput>, holdingCount: number): Suggestion[] {
  const out: Suggestion[] = [];
  const confidence = confidenceByCount(holdingCount);
  if (!input.benchmark || input.benchmark.toUpperCase() !== "SPY") {
    out.push({
      id: "benchmark-spy",
      title: "Use SPY as baseline benchmark",
      reason: "SPY is a broad-market proxy and makes beta/abnormal comparisons easier to interpret.",
      confidence: "high",
      actionLabel: "Apply SPY benchmark",
      patch: { benchmark: "SPY" },
    });
  }
  if (!input.range || input.range === "3m") {
    out.push({
      id: "range-1y",
      title: "Use 1y lookback for stable metrics",
      reason: "A full year captures multiple market regimes and reduces noisy short-window statistics.",
      confidence,
      actionLabel: "Set range to 1y",
      patch: { range: "1y" },
    });
  }
  if ((input.riskFreeRate ?? 0) === 0) {
    out.push({
      id: "riskfree-2pct",
      title: "Set non-zero risk-free rate",
      reason: "Sharpe ratio is more meaningful when excess return is measured against a realistic base rate.",
      confidence: "medium",
      actionLabel: "Set risk-free to 2%",
      patch: { riskFreeRate: 0.02 },
    });
  }
  if (holdingCount >= 10 && input.shrinkage == null) {
    out.push({
      id: "enable-shrinkage",
      title: "Enable covariance shrinkage",
      reason: "Larger portfolios often produce unstable covariance estimates without light shrinkage.",
      confidence: "medium",
      actionLabel: "Enable shrinkage",
      patch: { shrinkageEnabled: true, shrinkage: 0.2 },
    });
  }
  return out;
}

export function getRebalanceSuggestions(holdingCount: number): Suggestion[] {
  const out: Suggestion[] = [];
  if (holdingCount <= 3) {
    out.push({
      id: "buy-hold-small",
      title: "Start with Buy & Hold baseline",
      reason: "Very small portfolios can overfit optimization targets; baseline gives a sanity comparison.",
      confidence: "medium",
      actionLabel: "Use Buy & Hold",
      patch: { strategy: "BUY_HOLD" },
    });
  } else {
    out.push({
      id: "minvar-mid",
      title: "Try Min-Variance (QP)",
      reason: "QP constraints give stable long-only allocations with optional caps.",
      confidence: "high",
      actionLabel: "Use Min-Variance",
      patch: { strategy: "MINVAR_QP" },
    });
    out.push({
      id: "risk-parity-alt",
      title: "Compare against Risk Parity",
      reason: "Risk parity helps avoid single-name risk concentration while keeping exposure diversified.",
      confidence: "medium",
      actionLabel: "Use Risk Parity",
      patch: { strategy: "RISK_PARITY" },
    });
  }
  return out;
}

export function getPortfolioNextSteps(args: {
  hasSnapshot: boolean;
  hasEvents: boolean;
  hasDetectiveReports: boolean;
  hasBacktests: boolean;
}): Array<{ id: string; label: string; actionHint: string }> {
  const steps: Array<{ id: string; label: string; actionHint: string }> = [];
  if (!args.hasSnapshot) {
    steps.push({
      id: "snapshot-first",
      label: "Run your first snapshot",
      actionHint: "Use Run Snapshot to compute baseline risk metrics before detective or alerts.",
    });
  }
  if (!args.hasEvents) {
    steps.push({
      id: "sync-events",
      label: "Sync events for holdings",
      actionHint: "Sync SEC filings so Portfolio Detective can attribute recent moves.",
    });
  }
  if (!args.hasDetectiveReports) {
    steps.push({
      id: "run-detective",
      label: "Generate a detective report",
      actionHint: "Run Detective Report for the latest trading date and review ranked likely drivers.",
    });
  }
  if (!args.hasBacktests) {
    steps.push({
      id: "run-backtest",
      label: "Run a monthly backtest",
      actionHint: "Compare Buy & Hold vs optimization strategies with transaction costs.",
    });
  }
  return steps;
}
