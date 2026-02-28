type AssistantStepCardProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
};

export default function AssistantStepCard({ title, subtitle, children }: AssistantStepCardProps) {
  return (
    <section className="card-surface p-5">
      <h2 className="text-base font-semibold text-slate-800">{title}</h2>
      {subtitle ? <p className="mt-1 text-xs text-slate-500">{subtitle}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}
