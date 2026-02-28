"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  AlertRule,
  BacktestRunSummary,
  DetectiveReportSummary,
  PortfolioDetail,
  SnapshotSummary,
} from "@/lib/types";
import { trackEvent } from "@/lib/telemetry";

type SnapshotConfig = {
  range: string;
  benchmark: string;
  riskFreeRate: number;
  shrinkage: boolean;
};

type DetectiveConfig = {
  analyzeDate: string;
  benchmark: string;
  eventWindowDays: number;
  maxTickers: number;
};

type BacktestConfig = {
  start: string;
  end: string;
  benchmark: string;
  frequency: "WEEKLY" | "MONTHLY";
  strategy: "BUY_HOLD" | "RISK_PARITY" | "MINVAR_QP";
  costBps: number;
  maxWeight: string;
  shrinkage: boolean;
};

export function usePortfolioDetailData(id: string) {
  const [portfolio, setPortfolio] = useState<PortfolioDetail | null>(null);
  const [history, setHistory] = useState<SnapshotSummary[]>([]);
  const [alerts, setAlerts] = useState<AlertRule[]>([]);
  const [detectiveReports, setDetectiveReports] = useState<DetectiveReportSummary[]>([]);
  const [backtests, setBacktests] = useState<BacktestRunSummary[]>([]);
  const [hasEvents, setHasEvents] = useState(false);
  const [config, setConfig] = useState<SnapshotConfig>({
    range: "1y",
    benchmark: "SPY",
    riskFreeRate: 0,
    shrinkage: false,
  });
  const [detectiveConfig, setDetectiveConfig] = useState<DetectiveConfig>({
    analyzeDate: new Date().toISOString().slice(0, 10),
    benchmark: "SPY",
    eventWindowDays: 5,
    maxTickers: 5,
  });
  const [backtestConfig, setBacktestConfig] = useState<BacktestConfig>({
    start: new Date(new Date().setUTCFullYear(new Date().getUTCFullYear() - 1)).toISOString().slice(0, 10),
    end: new Date().toISOString().slice(0, 10),
    benchmark: "SPY",
    frequency: "MONTHLY",
    strategy: "BUY_HOLD",
    costBps: 0,
    maxWeight: "",
    shrinkage: false,
  });
  const [alertType, setAlertType] = useState<"vol_gt" | "maxdd_lt" | "var_gt">("vol_gt");
  const [alertThreshold, setAlertThreshold] = useState("0.35");
  const [alertResult, setAlertResult] = useState("");
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [syncingEvents, setSyncingEvents] = useState(false);
  const [runningDetective, setRunningDetective] = useState(false);
  const [runningBacktest, setRunningBacktest] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [portfolioRes, snapshotsRes, alertsRes, detectiveRes, backtestsRes, eventsRes] = await Promise.all([
        fetch(`/api/portfolios/${id}`),
        fetch(`/api/portfolios/${id}/snapshots`),
        fetch(`/api/portfolios/${id}/alerts`),
        fetch(`/api/portfolios/${id}/detective/reports`),
        fetch(`/api/portfolios/${id}/backtests`),
        fetch(`/api/portfolios/${id}/events?limit=1`),
      ]);
      if (
        portfolioRes.status === 401 ||
        snapshotsRes.status === 401 ||
        alertsRes.status === 401 ||
        detectiveRes.status === 401 ||
        backtestsRes.status === 401 ||
        eventsRes.status === 401
      ) {
        window.location.href = "/auth/signin?callbackUrl=" + encodeURIComponent("/portfolios/" + id);
        return;
      }
      const portfolioData = await portfolioRes.json();
      const snapshotsData = await snapshotsRes.json();
      const alertsData = await alertsRes.json();
      const detectiveData = await detectiveRes.json();
      const backtestsData = await backtestsRes.json();
      const eventsData = await eventsRes.json();
      if (!portfolioRes.ok) throw new Error(portfolioData?.error ?? "Failed to load portfolio.");
      setPortfolio(portfolioData as PortfolioDetail);
      setConfig((portfolioData as PortfolioDetail).defaults);
      setHistory(snapshotsRes.ok && Array.isArray(snapshotsData) ? (snapshotsData as SnapshotSummary[]) : []);
      setAlerts(alertsRes.ok && Array.isArray(alertsData) ? (alertsData as AlertRule[]) : []);
      setDetectiveReports(
        detectiveRes.ok && Array.isArray(detectiveData) ? (detectiveData as DetectiveReportSummary[]) : [],
      );
      setBacktests(backtestsRes.ok && Array.isArray(backtestsData) ? (backtestsData as BacktestRunSummary[]) : []);
      setHasEvents(Boolean(eventsRes.ok && Array.isArray(eventsData?.items) && eventsData.items.length > 0));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load portfolio.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function runSnapshot() {
    setRunning(true);
    setError("");
    try {
      const res = await fetch(`/api/portfolios/${id}/snapshots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Snapshot run failed.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Snapshot run failed.");
    } finally {
      setRunning(false);
    }
  }

  async function createAlert() {
    setError("");
    try {
      const res = await fetch(`/api/portfolios/${id}/alerts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: alertType, threshold: Number(alertThreshold) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to create alert.");
      setAlerts((prev) => [data as AlertRule, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create alert.");
    }
  }

  async function syncEvents() {
    setSyncingEvents(true);
    setError("");
    try {
      const res = await fetch(`/api/portfolios/${id}/events/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sources: ["SEC"] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to sync events.");
      trackEvent("portfolio_sync_events", { portfolioId: id });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sync events.");
    } finally {
      setSyncingEvents(false);
    }
  }

  async function runDetective() {
    setRunningDetective(true);
    setError("");
    try {
      const res = await fetch(`/api/portfolios/${id}/detective/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(detectiveConfig),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Detective run failed.");
      trackEvent("portfolio_run_detective", { portfolioId: id, benchmark: detectiveConfig.benchmark });
      await load();
      if (data?.reportId) window.location.href = `/detective/reports/${data.reportId}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Detective run failed.");
    } finally {
      setRunningDetective(false);
    }
  }

  async function runBacktest() {
    setRunningBacktest(true);
    setError("");
    try {
      const maxWeightNum = Number(backtestConfig.maxWeight);
      const res = await fetch(`/api/portfolios/${id}/backtests/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start: backtestConfig.start,
          end: backtestConfig.end,
          benchmark: backtestConfig.benchmark,
          frequency: backtestConfig.frequency,
          strategy: backtestConfig.strategy,
          costBps: backtestConfig.costBps,
          maxWeight: Number.isFinite(maxWeightNum) && maxWeightNum > 0 ? maxWeightNum : undefined,
          shrinkage: backtestConfig.shrinkage,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Backtest run failed.");
      trackEvent("portfolio_run_backtest", {
        portfolioId: id,
        strategy: backtestConfig.strategy,
        frequency: backtestConfig.frequency,
      });
      await load();
      if (data?.backtestId) window.location.href = `/backtests/${data.backtestId}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Backtest run failed.");
    } finally {
      setRunningBacktest(false);
    }
  }

  async function checkAlerts() {
    setError("");
    setAlertResult("");
    try {
      const res = await fetch(`/api/portfolios/${id}/alerts/check`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to check alerts.");
      const triggered = (data?.triggered as Array<{ type: string; threshold: number; value: number }>) ?? [];
      setAlertResult(
        triggered.length === 0
          ? "No alerts triggered on the latest snapshot."
          : `Triggered: ${triggered
              .map((t) => `${t.type} (threshold=${t.threshold}, value=${t.value.toFixed(4)})`)
              .join("; ")}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to check alerts.");
    }
  }

  return {
    portfolio,
    history,
    alerts,
    detectiveReports,
    backtests,
    hasEvents,
    config,
    setConfig,
    detectiveConfig,
    setDetectiveConfig,
    backtestConfig,
    setBacktestConfig,
    alertType,
    setAlertType,
    alertThreshold,
    setAlertThreshold,
    alertResult,
    loading,
    running,
    syncingEvents,
    runningDetective,
    runningBacktest,
    error,
    runSnapshot,
    createAlert,
    syncEvents,
    runDetective,
    runBacktest,
    checkAlerts,
  };
}
