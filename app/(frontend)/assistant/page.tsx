"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import AssistantDecisionCard from "../../../components/assistant/AssistantDecisionCard";
import AssistantProgress from "../../../components/assistant/AssistantProgress";
import AssistantStepCard from "../../../components/assistant/AssistantStepCard";
import { trackEvent } from "../../../lib/telemetry";

type Goal = "explain_move" | "reduce_risk" | "compare_strategies";
type DataSource = "manual" | "saved";
type Analysis = "snapshot" | "detective" | "backtest";

export default function AssistantPage() {
  const [step, setStep] = useState(1);
  const [goal, setGoal] = useState<Goal>("explain_move");
  const [source, setSource] = useState<DataSource>("saved");
  const [analysis, setAnalysis] = useState<Analysis>("detective");

  const recommendation = useMemo(() => {
    if (goal === "explain_move") return "Run Portfolio Detective with benchmark SPY and event window 5 days.";
    if (goal === "reduce_risk") return "Start with Snapshot then compare Rebalance Min-Variance (QP) vs Risk Parity.";
    return "Run monthly backtests for Buy & Hold, Risk Parity, and Min-Variance (QP).";
  }, [goal]);

  function nextStep() {
    setStep((s) => Math.min(4, s + 1));
    trackEvent("assistant_next_step", { step });
  }
  function prevStep() {
    setStep((s) => Math.max(1, s - 1));
  }

  return (
    <main className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Guided Assistant</h1>
        <p className="mt-1 text-sm text-slate-500">
          Follow a step-by-step workflow and get a recommended next action based on your goal.
        </p>
      </div>

      <AssistantProgress step={step} total={4} label="Portfolio analysis setup" />

      {step === 1 ? (
        <AssistantStepCard title="Step 1: Define your goal" subtitle="Pick the outcome you care about most.">
          <div className="grid gap-3 md:grid-cols-3">
            <AssistantDecisionCard
              title="Explain what moved today"
              description="Attribute portfolio move to likely event-driven drivers."
              selected={goal === "explain_move"}
              onClick={() => setGoal("explain_move")}
            />
            <AssistantDecisionCard
              title="Reduce risk"
              description="Understand risk profile then optimize allocation constraints."
              selected={goal === "reduce_risk"}
              onClick={() => setGoal("reduce_risk")}
            />
            <AssistantDecisionCard
              title="Compare strategies"
              description="Evaluate strategy behavior over historical periods with costs."
              selected={goal === "compare_strategies"}
              onClick={() => setGoal("compare_strategies")}
            />
          </div>
        </AssistantStepCard>
      ) : null}

      {step === 2 ? (
        <AssistantStepCard title="Step 2: Choose data source" subtitle="Where should we start from?">
          <div className="grid gap-3 md:grid-cols-2">
            <AssistantDecisionCard
              title="Saved portfolio"
              description="Use an existing portfolio from your account and run workflows from there."
              selected={source === "saved"}
              onClick={() => setSource("saved")}
            />
            <AssistantDecisionCard
              title="Manual input"
              description="Start from scratch by entering holdings and defaults first."
              selected={source === "manual"}
              onClick={() => setSource("manual")}
            />
          </div>
        </AssistantStepCard>
      ) : null}

      {step === 3 ? (
        <AssistantStepCard title="Step 3: Pick analysis type" subtitle="Choose your first run.">
          <div className="grid gap-3 md:grid-cols-3">
            <AssistantDecisionCard
              title="Snapshot"
              description="Baseline performance/risk metrics with charts."
              selected={analysis === "snapshot"}
              onClick={() => setAnalysis("snapshot")}
            />
            <AssistantDecisionCard
              title="Detective"
              description="Rank likely event drivers for portfolio moves."
              selected={analysis === "detective"}
              onClick={() => setAnalysis("detective")}
            />
            <AssistantDecisionCard
              title="Backtest"
              description="Simulate strategy outcomes over time."
              selected={analysis === "backtest"}
              onClick={() => setAnalysis("backtest")}
            />
          </div>
        </AssistantStepCard>
      ) : null}

      {step === 4 ? (
        <AssistantStepCard title="Step 4: Recommended next step" subtitle="Apply this recommendation in one click path.">
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">{recommendation}</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {source === "manual" ? (
              <Link href="/" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                Go to Input
              </Link>
            ) : (
              <Link href="/portfolios" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                Open Portfolios
              </Link>
            )}
            <Link href="/report" className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
              Open Report
            </Link>
            <Link href="/rebalance" className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
              Open Rebalance
            </Link>
          </div>
          <p className="mt-3 disclaimer">
            Educational tool only. Outputs are analytics and not financial advice or a recommendation to trade.
          </p>
        </AssistantStepCard>
      ) : null}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={prevStep}
          disabled={step === 1}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
        >
          Back
        </button>
        <button
          type="button"
          onClick={nextStep}
          disabled={step === 4}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </main>
  );
}
