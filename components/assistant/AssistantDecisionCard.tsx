import { cn } from "../../lib/utils";

type AssistantDecisionCardProps = {
  title: string;
  description: string;
  selected?: boolean;
  onClick?: () => void;
};

export default function AssistantDecisionCard({
  title,
  description,
  selected = false,
  onClick,
}: AssistantDecisionCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "card-surface w-full p-4 text-left transition-colors",
        selected ? "border-blue-300 bg-blue-50" : "hover:bg-slate-50",
      )}
    >
      <div className="text-sm font-semibold text-slate-800">{title}</div>
      <div className="mt-1 text-xs leading-relaxed text-slate-600">{description}</div>
    </button>
  );
}
