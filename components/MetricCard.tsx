import { cn } from "../lib/utils";

type MetricCardProps = {
  label: string;
  value: string;
  subtitle?: string;
  className?: string;
};

export default function MetricCard({ label, value, subtitle, className }: MetricCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200 bg-white p-4 shadow-sm",
        className,
      )}
    >
      <p className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
      {subtitle ? <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">{subtitle}</p> : null}
    </div>
  );
}
