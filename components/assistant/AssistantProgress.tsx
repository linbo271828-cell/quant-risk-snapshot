type AssistantProgressProps = {
  step: number;
  total: number;
  label: string;
};

export default function AssistantProgress({ step, total, label }: AssistantProgressProps) {
  const pct = Math.max(0, Math.min(100, Math.round((step / total) * 100)));
  return (
    <div className="card-surface p-4">
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>{label}</span>
        <span>
          Step {step}/{total}
        </span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-slate-100">
        <div className="h-2 rounded-full bg-blue-600" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
