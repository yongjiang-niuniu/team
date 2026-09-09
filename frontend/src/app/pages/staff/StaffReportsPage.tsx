import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Download, Loader2 } from 'lucide-react';

import { BackOfficeSelect } from '../../components/backoffice/BackOfficeSelect';
import { BackOfficeTable, BackOfficeTd, BackOfficeTh } from '../../components/backoffice/BackOfficeTable';
import { StatusBadge } from '../../components/backoffice/StatusBadge';
import { statusTone } from '../../components/backoffice/statusTone';
import { downloadCsv } from '../../lib/adminPortal';
import { getApiStyleErrorMessage } from '../../lib/httpErrors';
import { fetchStaffDeviceStats, type DeviceStats } from '../../lib/staffPortal';
import {
  fetchPaymentReportSummary,
  fetchPaymentReportTransactions,
  fetchReferralActivityReport,
  fetchReferralFees,
  fetchReferralSummary,
  type PaymentReportSummary,
  type PaymentReportTransaction,
  type ReferralActivityRecord,
  type ReferralFee,
  type ReferralSummary,
} from '../../lib/userPortal';

type StaffReportFilters = {
  from?: string;
  to?: string;
  status?: string;
  provider?: string;
  payment_kind?: string;
};

function SummaryCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">{label}</p>
          <p className="mt-2 text-3xl font-black tracking-tight text-slate-900">{value}</p>
        </div>
        <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-600">
          <BarChart3 className="h-6 w-6" />
        </div>
      </div>
      <p className="mt-3 text-sm font-medium text-slate-500">{detail}</p>
    </div>
  );
}

function formatMoney(value?: number | null, currency = 'GBP') {
  return `${currency} ${Number(value || 0).toFixed(2)}`;
}

function StatPills({ title, values }: { title: string; values?: Record<string, number> }) {
  const entries = Object.entries(values ?? {});
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-slate-400">{title}</p>
      {entries.length ? (
        <div className="flex flex-wrap gap-2">
          {entries.map(([key, value]) => (
            <span key={key} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black text-slate-600">
              {key}: {value}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-sm font-semibold text-slate-400">No records yet.</p>
      )}
    </div>
  );
}

export function StaffReportsPage() {
  const [filters, setFilters] = useState<StaffReportFilters>({});
  const [paymentSummary, setPaymentSummary] = useState<PaymentReportSummary | null>(null);
  const [transactions, setTransactions] = useState<PaymentReportTransaction[]>([]);
  const [referralSummary, setReferralSummary] = useState<ReferralSummary | null>(null);
  const [referralFees, setReferralFees] = useState<ReferralFee[]>([]);
  const [activity, setActivity] = useState<ReferralActivityRecord[]>([]);
  const [deviceStats, setDeviceStats] = useState<DeviceStats>({});
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let ignore = false;

    async function loadReports() {
      setIsLoading(true);
      try {
        const [payments, paymentItems, referrals, fees, referralActivity, stats] = await Promise.all([
          fetchPaymentReportSummary(filters),
          fetchPaymentReportTransactions(filters),
          fetchReferralSummary(filters),
          fetchReferralFees(filters),
          fetchReferralActivityReport(filters),
          fetchStaffDeviceStats(),
        ]);
        if (!ignore) {
          setPaymentSummary(payments);
          setTransactions(paymentItems);
          setReferralSummary(referrals);
          setReferralFees(fees);
          setActivity(referralActivity);
          setDeviceStats(stats);
          setErrorMessage('');
        }
      } catch (error: unknown) {
        if (!ignore) {
          setErrorMessage(getApiStyleErrorMessage(error, 'Could not load staff reports.'));
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    void loadReports();
    return () => {
      ignore = true;
    };
  }, [filters]);

  const reportCurrency = transactions.find((item) => item.currency)?.currency || 'GBP';
  const totalDeviceCount = deviceStats.totals?.devices ?? 0;
  const paidTransactions = paymentSummary?.counts_by_status?.paid ?? 0;
  const confirmedFees = referralSummary?.fee_amount_confirmed ?? 0;

  const latestRows = useMemo(() => transactions.slice(0, 12), [transactions]);

  const updateFilter = (field: keyof StaffReportFilters, value: string) => {
    setFilters((current) => ({ ...current, [field]: value || undefined }));
  };

  const exportPayments = () => {
    downloadCsv(
      `staff-payments-${new Date().toISOString().slice(0, 10)}.csv`,
      transactions.map((item) => ({
        id: item.id,
        retrieval_request_id: item.retrieval_request_id,
        device: item.device_name || item.device?.name,
        consumer_email: item.consumer_email,
        provider: item.provider,
        payment_kind: item.payment_kind,
        status: item.status,
        amount: item.amount,
        currency: item.currency,
        provider_payment_id: item.provider_payment_id,
        checkout_reference: item.checkout_reference,
        paid_at: item.paid_at,
        created_at: item.created_at,
      })),
    );
  };

  const exportReferralActivity = () => {
    downloadCsv(
      `staff-referrals-${new Date().toISOString().slice(0, 10)}.csv`,
      activity.map((item) => ({
        id: item.id,
        event_type: item.event_type,
        partner: item.partner?.name,
        referral_code: item.referral_code?.code,
        consumer_id: item.consumer_id,
        device_id: item.device_id,
        request_id: item.request_id,
        occurred_at: item.occurred_at,
        created_at: item.created_at,
      })),
    );
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-600">Staff reporting</p>
          <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">Operational reports</h2>
          <p className="mt-2 text-sm font-medium text-slate-500">
            Payments, device processing, referral activity, and partner fees in one staff workspace.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={exportPayments}
            disabled={!transactions.length}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            <Download className="h-4 w-4" />
            Payments CSV
          </button>
          <button
            type="button"
            onClick={exportReferralActivity}
            disabled={!activity.length}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <Download className="h-4 w-4" />
            Referrals CSV
          </button>
        </div>
      </section>

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
          <BackOfficeSelect value={filters.status || ''} onChange={(event) => updateFilter('status', event.target.value)} className="bg-slate-50">
            <option value="">All</option>
            <option value="paid">paid</option>
            <option value="cancelled">cancelled</option>
            <option value="pending">pending</option>
            <option value="confirmed">confirmed</option>
            <option value="opened">opened</option>
            <option value="redeemed">redeemed</option>
          </BackOfficeSelect>
        </label>
        <label className="space-y-1">
          <span className="text-xs font-black uppercase tracking-wide text-slate-400">Provider</span>
          <BackOfficeSelect value={filters.provider || ''} onChange={(event) => updateFilter('provider', event.target.value)} className="bg-slate-50">
            <option value="">All</option>
            <option value="stripe">stripe</option>
            <option value="paypal">paypal</option>
          </BackOfficeSelect>
        </label>
        <label className="space-y-1">
          <span className="text-xs font-black uppercase tracking-wide text-slate-400">Kind</span>
          <BackOfficeSelect value={filters.payment_kind || ''} onChange={(event) => updateFilter('payment_kind', event.target.value)} className="bg-slate-50">
            <option value="">All</option>
            <option value="initial_retrieval">initial_retrieval</option>
            <option value="extension">extension</option>
          </BackOfficeSelect>
        </label>
      </section>

      {errorMessage ? (
        <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      {isLoading ? (
        <div className="flex min-h-[30vh] items-center justify-center text-slate-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading staff reports...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
            <SummaryCard
              label="Payment total"
              value={formatMoney(paymentSummary?.total_amount, reportCurrency)}
              detail={`${paymentSummary?.total_transactions ?? 0} transactions, ${paidTransactions} paid`}
            />
            <SummaryCard
              label="Device records"
              value={String(totalDeviceCount)}
              detail={`${deviceStats.totals?.draft ?? 0} drafts, ${deviceStats.totals?.visible ?? 0} visible`}
            />
            <SummaryCard
              label="Referral fees"
              value={formatMoney(confirmedFees, 'GBP')}
              detail={`${referralFees.length} fee records in scope`}
            />
            <SummaryCard
              label="Referral activity"
              value={String(activity.length)}
              detail={`${referralSummary?.total_referral_codes ?? 0} issued codes`}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <StatPills title="Classification counts" values={deviceStats.classification} />
            <StatPills title="Processing status" values={deviceStats.processing_status} />
            <StatPills title="Payment providers" values={paymentSummary?.counts_by_provider} />
          </div>

          <BackOfficeTable>
            <thead>
              <tr>
                <BackOfficeTh>Payment</BackOfficeTh>
                <BackOfficeTh>Device</BackOfficeTh>
                <BackOfficeTh>Provider</BackOfficeTh>
                <BackOfficeTh>Status</BackOfficeTh>
                <BackOfficeTh>Amount</BackOfficeTh>
              </tr>
            </thead>
            <tbody>
              {latestRows.map((item) => (
                <tr key={item.id}>
                  <BackOfficeTd>#{item.id}</BackOfficeTd>
                  <BackOfficeTd>{item.device_name || item.device?.name || `Retrieval #${item.retrieval_request_id}`}</BackOfficeTd>
                  <BackOfficeTd>{item.provider || 'unknown'}</BackOfficeTd>
                  <BackOfficeTd>
                    <StatusBadge value={item.status || 'unknown'} tone={statusTone(item.status || 'unknown')} />
                  </BackOfficeTd>
                  <BackOfficeTd>{formatMoney(item.amount, item.currency || reportCurrency)}</BackOfficeTd>
                </tr>
              ))}
              {!latestRows.length ? (
                <tr>
                  <BackOfficeTd>No payment transactions found.</BackOfficeTd>
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
