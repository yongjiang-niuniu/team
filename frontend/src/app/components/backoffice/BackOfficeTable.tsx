import type { ReactNode } from "react";

type BackOfficeTableProps = {
  children?: ReactNode;
};

export function BackOfficeTable({ children }: BackOfficeTableProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-sm">{children}</table>
      </div>
    </div>
  );
}

export function BackOfficeTh({ children }: BackOfficeTableProps) {
  return (
    <th className="border-b border-slate-100 bg-slate-50 px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-slate-400">
      {children}
    </th>
  );
}

export function BackOfficeTd({ children }: BackOfficeTableProps) {
  return <td className="border-b border-slate-50 px-5 py-4 align-middle">{children}</td>;
}
