import type { SelectHTMLAttributes } from "react";

type BackOfficeSelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export function BackOfficeSelect({ className = "", children, ...props }: BackOfficeSelectProps) {
  return (
    <select
      {...props}
      className={[
        "rounded-2xl border border-slate-200 bg-white px-4 py-2.5 pr-10 text-sm font-bold text-slate-700 shadow-sm outline-none transition",
        "focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10",
        "disabled:cursor-not-allowed disabled:opacity-60",
        className,
      ].join(" ")}
    >
      {children}
    </select>
  );
}
