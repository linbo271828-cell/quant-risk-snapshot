import Link from "next/link";

type EmptyStateCardProps = {
  title: string;
  description: string;
  ctaLabel?: string;
  ctaHref?: string;
};

export default function EmptyStateCard({ title, description, ctaLabel, ctaHref }: EmptyStateCardProps) {
  return (
    <div className="card-surface p-6 text-center">
      <h2 className="text-base font-semibold text-slate-800">{title}</h2>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
      {ctaLabel && ctaHref ? (
        <Link
          href={ctaHref}
          className="mt-4 inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          {ctaLabel}
        </Link>
      ) : null}
    </div>
  );
}
