import { useEffect, useState } from "react";
import { CreditCard, Loader2 } from "lucide-react";

import { BackOfficeTable, BackOfficeTd, BackOfficeTh } from "../../components/backoffice/BackOfficeTable";
import { BackOfficeSelect } from "../../components/backoffice/BackOfficeSelect";
import { StatusBadge } from "../../components/backoffice/StatusBadge";
import { statusTone } from "../../components/backoffice/statusTone";
import {
  downloadCsv,
  fetchPaymentReportSummary,
  fetchPaymentReportTransactions,
  type ReportFilters,
  type PaymentReportSummary,
  type PaymentReportTransaction,
} from "../../lib/adminPortal";
import { getApiStyleErrorMessage } from "../../lib/httpErrors";

function MoneyCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">{label}</p>
          <p className="mt-2 text-3xl font-black tracking-tight text-slate-900">{value}</p>
        </div>
        <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-600">
          <CreditCard className="h-6 w-6" />
        </div>
      </div>
      <p className="mt-3 text-sm font-medium text-slate-500">{detail}</p>
    </div>
  );
}

export function AdminPaymentsPage() {
  const [summary, setSummary] = useState<PaymentReportSummary | null>(null);
  const [transactions, setTransactions] = useState<PaymentReportTransaction[]>([]);
  const [filters, setFilters] = useState<ReportFilters>({});
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let ignore = false;

    async function loadPayments() {
      setIsLoading(true);
      try {
        const [summaryData, transactionData] = await Promise.all([
          fetchPaymentReportSummary(filters),
          fetchPaymentReportTransactions(filters),
        ]);
        if (!ignore) {
          setSummary(summaryData);
          setTransactions(transactionData);
          setErrorMessage('');
        }
      } catch (error: unknown) {
        if (!ignore) {
          setErrorMessage(getApiStyleErrorMessage(error, 'Could not load payment reports.'));
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    void loadPayments();
    return () => {
      ignore = true;
    };
  }, [filters]);

  const updateFilter = (field: keyof ReportFilters, value: string) => {
    setFilters((current) => ({ ...current, [field]: value || undefined }));
  };

  const exportTransactions = () => {
    downloadCsv(
      `payment-transactions-${new Date().toISOString().slice(0, 10)}.csv`,
      transactions.map((transaction) => ({
        id: transaction.id,
        provider: transaction.provider,
        status: transaction.status,
        payment_kind: transaction.payment_kind,
        amount: transaction.amount,
        currency: transaction.currency,
        created_at: transaction.created_at,
        paid_at: transaction.paid_at,
      })),
    );
  };

  return (
    <div className="space-y-6">
      <section>
        <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-600">Admin finance</p>
        <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">Payments</h2>
        <p className="mt-2 text-sm font-medium text-slate-500">
          Read-only payment summary and transaction visibility for administrators.
        </p>
      </section>

      {errorMessage ? (
        <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      <section className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="space-y-1">
          <span className="text-xs font-black uppercase tracking-wide text-slate-400">From</span>
          <input
            type="date"
            value={filters.from || ''}
            onChange={(event) => updateFilter('from', event.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-600"
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-black uppercase tracking-wide text-slate-400">To</span>
          <input
            type="date"
            value={filters.to || ''}
            onChange={(event) => updateFilter('to', event.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-600"
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-black uppercase tracking-wide text-slate-400">Status</span>
          <BackOfficeSelect
            value={filters.status || ''}
            onChange={(event) => updateFilter('status', event.target.value)}
            className="bg-slate-50"
          >
            <option value="">All</option>
            <option value="paid">paid</option>
            <option value="pending">pending</option>
            <option value="initiated">initiated</option>
            <option value="failed">failed</option>
            <option value="cancelled">cancelled</option>
            <option value="refunded">refunded</option>
          </BackOfficeSelect>
        </label>
        <button
          type="button"
          onClick={exportTransactions}
          disabled={!transactions.length}
          className="ml-auto rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60"
        >
          Export CSV
        </button>
      </section>

      {isLoading ? (
        <div className="flex min-h-[30vh] items-center justify-center text-slate-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading payments...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <MoneyCard
              label="Transactions"
              value={String(summary?.total_transactions ?? transactions.length)}
              detail="All payment report rows in scope"
            />
            <MoneyCard
              label="Gross amount"
              value={`AUD ${Number(summary?.total_amount ?? summary?.amount_total ?? 0).toFixed(2)}`}
              detail="Total reported amount"
            />
            <MoneyCard
              label="Paid amount"
              value={`AUD ${Number(summary?.paid_amount ?? summary?.amount_paid ?? 0).toFixed(2)}`}
              detail="Total paid amount"
            />
          </div>

          <BackOfficeTable>
            <thead>
              <tr>
                <BackOfficeTh>ID</BackOfficeTh>
                <BackOfficeTh>Provider</BackOfficeTh>
                <BackOfficeTh>Kind</BackOfficeTh>
                <BackOfficeTh>Amount</BackOfficeTh>
                <BackOfficeTh>Status</BackOfficeTh>
                <BackOfficeTh>Created</BackOfficeTh>
              </tr>
            </thead>
            <tbody>
              {transactions.map((transaction) => (
                <tr key={transaction.id}>
                  <BackOfficeTd>#{transaction.id}</BackOfficeTd>
                  <BackOfficeTd>{transaction.provider || 'unknown'}</BackOfficeTd>
                  <BackOfficeTd>{transaction.payment_kind || 'payment'}</BackOfficeTd>
                  <BackOfficeTd>
                    {transaction.currency || 'AUD'} {Number(transaction.amount || 0).toFixed(2)}
                  </BackOfficeTd>
                  <BackOfficeTd>
                    <StatusBadge value={transaction.status} tone={statusTone(transaction.status)} />
                  </BackOfficeTd>
                  <BackOfficeTd>
                    {transaction.created_at ? new Date(transaction.created_at).toLocaleDateString() : 'unknown'}
                  </BackOfficeTd>
                </tr>
              ))}
              {!transactions.length ? (
                <tr>
                  <BackOfficeTd>No payment transactions found.</BackOfficeTd>
                  <BackOfficeTd />
                  <BackOfficeTd />
                  <BackOfficeTd />
                  <BackOfficeTd />
                  <BackOfficeTd />
                </tr>
              ) : null}
            </tbody>
          </BackOfficeTable>
        </>
      )}
    </div>
  );
}
