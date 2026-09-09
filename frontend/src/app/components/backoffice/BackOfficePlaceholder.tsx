import type { ReactNode } from "react";

type BackOfficePlaceholderProps = {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
};

export function BackOfficePlaceholder({
  eyebrow,
  title,
  description,
  children,
}: BackOfficePlaceholderProps) {
  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-[0_20px_40px_-24px_rgba(15,23,42,0.25)]">
        <p className="mb-2 text-xs font-black uppercase tracking-[0.24em] text-emerald-600">
          {eyebrow}
        </p>
        <h2 className="text-3xl font-black tracking-tight text-slate-900">{title}</h2>
        <p className="mt-3 max-w-3xl text-sm font-medium leading-6 text-slate-500">
          {description}
        </p>
      </section>

      {children ? (
        <section className="rounded-[2rem] border border-dashed border-slate-200 bg-white/80 p-7">
          {children}
        </section>
      ) : null}
    </div>
  );
}
