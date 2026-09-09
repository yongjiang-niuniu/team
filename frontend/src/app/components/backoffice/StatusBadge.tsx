import type { BackOfficeStatusTone } from "./statusTone";

type StatusBadgeProps = {
  value?: string | null;
  tone?: BackOfficeStatusTone;
};

const toneClasses = {
  slate: 'border-slate-200 bg-slate-50 text-slate-600',
  emerald: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  amber: 'border-amber-100 bg-amber-50 text-amber-700',
  blue: 'border-blue-100 bg-blue-50 text-blue-700',
  purple: 'border-purple-100 bg-purple-50 text-purple-700',
  rose: 'border-rose-100 bg-rose-50 text-rose-700',
};

export function StatusBadge({ value, tone = 'slate' }: StatusBadgeProps) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black uppercase tracking-wide ${toneClasses[tone]}`}>
      {value || 'unknown'}
    </span>
  );
}
