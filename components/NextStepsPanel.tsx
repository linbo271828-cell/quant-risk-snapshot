type NextStep = {
  id: string;
  label: string;
  actionHint: string;
};

export default function NextStepsPanel({ steps }: { steps: NextStep[] }) {
  return (
    <section className="card-surface p-5">
      <h2 className="section-title">What should I do next?</h2>
      <p className="section-subtitle">These actions will help you get to meaningful results quickly.</p>
      {steps.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">Great progress. You have already completed core workflow steps.</p>
      ) : (
        <ol className="mt-3 space-y-2">
          {steps.map((step, idx) => (
            <li key={step.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="text-sm font-semibold text-slate-800">
                {idx + 1}. {step.label}
              </div>
              <div className="mt-1 text-xs text-slate-600">{step.actionHint}</div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
