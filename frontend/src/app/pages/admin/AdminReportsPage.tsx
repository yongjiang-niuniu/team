import { useEffect, useState } from "react";
import { BarChart3, Loader2 } from "lucide-react";

import { BackOfficeTable, BackOfficeTd, BackOfficeTh } from "../../components/backoffice/BackOfficeTable";
import { BackOfficeSelect } from "../../components/backoffice/BackOfficeSelect";
import { StatusBadge } from "../../components/backoffice/StatusBadge";
import { statusTone } from "../../components/backoffice/statusTone";
import {
  downloadCsv,
  fetchPaymentReportSummary,
  fetchReferralReportActivity,
  type PaymentReportSummary,
  type ReportFilters,
  type ReferralReportActivity,
} from "../../lib/adminPortal";
import { getApiStyleErrorMessage } from "../../lib/httpErrors";
import { fetchReferralSummary, type ReferralSummary } from "../../lib/userPortal";

function ReportCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
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

export function AdminReportsPage() {
  const [paymentSummary, setPaymentSummary] = useState<PaymentReportSummary | null>(null);
  const [referralSummary, setReferralSummary] = useState<ReferralSummary | null>(null);
  const [activity, setActivity] = useState<ReferralReportActivity[]>([]);
  const [filters, setFilters] = useState<ReportFilters>({});
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let ignore = false;

    async function loadReports() {
      setIsLoading(true);
      try {
        const [paymentData, referralData, activityData] = await Promise.all([
          fetchPaymentReportSummary(filters),
          fetchReferralSummary(filters),
          fetchReferralReportActivity(filters),
        ]);
        if (!ignore) {
          setPaymentSummary(paymentData);
          setReferralSummary(referralData);
          setActivity(activityData);
          setErrorMessage('');
        }
      } catch (error: unknown) {
        if (!ignore) {
          setErrorMessage(getApiStyleErrorMessage(error, 'Could not load reports.'));
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

  const updateFilter = (field: keyof ReportFilters, value: string) => {
    setFilters((current) => ({ ...current, [field]: value || undefined }));
  };

  const exportActivity = () => {
    downloadCsv(
      `referral-activity-${new Date().toISOString().slice(0, 10)}.csv`,
      activity.map((item) => ({
        id: item.id,
        event_type: item.event_type,
        status: item.status,
        partner_id: item.partner_id,
        referral_code_id: item.referral_code_id,
        event_reference: item.event_reference,
        created_at: item.created_at,
      })),
    );
  };

  return (
    <div className="space-y-6">
      <section>
        <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-600">Admin reporting</p>
        <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">Reports</h2>
        <p className="mt-2 text-sm font-medium text-slate-500">
          High-level finance and referral reporting. Filters and export controls can be added after this baseline.
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
            <option value="opened">opened</option>
            <option value="redeemed">redeemed</option>
            <option value="handin_confirmed">handin_confirmed</option>
            <option value="resale_confirmed">resale_confirmed</option>
            <option value="fee_recorded">fee_recorded</option>
          </BackOfficeSelect>
        </label>
        <button
          type="button"
          onClick={exportActivity}
          disabled={!activity.length}
          className="ml-auto rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60"
        >
          Export CSV
        </button>
      </section>

      {isLoading ? (
        <div className="flex min-h-[30vh] items-center justify-center text-slate-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading reports...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <ReportCard
              label="Payment volume"
              value={`GBP ${Number(paymentSummary?.total_amount ?? paymentSummary?.amount_total ?? 0).toFixed(2)}`}
              detail={`${paymentSummary?.total_transactions ?? 0} transactions`}
            />
            <ReportCard
              label="Referral volume"
              value={`GBP ${Number(referralSummary?.fee_amount_total || 0).toFixed(2)}`}
              detail={`${referralSummary?.total_referral_codes ?? 0} referral codes`}
            />
            <ReportCard
              label="Referral activity"
              value={String(activity.length)}
              detail="Activity records in report scope"
            />
          </div>

          <BackOfficeTable>
            <thead>
              <tr>
                <BackOfficeTh>Activity</BackOfficeTh>
                <BackOfficeTh>Type</BackOfficeTh>
                <BackOfficeTh>Partner</BackOfficeTh>
                <BackOfficeTh>Status</BackOfficeTh>
                <BackOfficeTh>Created</BackOfficeTh>
              </tr>
            </thead>
            <tbody>
              {activity.slice(0, 20).map((item) => (
                <tr key={item.id}>
                  <BackOfficeTd>#{item.id}</BackOfficeTd>
                  <BackOfficeTd>{item.event_type || 'activity'}</BackOfficeTd>
                  <BackOfficeTd>{item.partner_id ? `Partner #${item.partner_id}` : 'n/a'}</BackOfficeTd>
                  <BackOfficeTd>
                    <StatusBadge value={item.status || item.event_type} tone={statusTone(item.status || item.event_type)} />
                  </BackOfficeTd>
                  <BackOfficeTd>
                    {item.created_at ? new Date(item.created_at).toLocaleDateString() : 'unknown'}
                  </BackOfficeTd>
                </tr>
              ))}
              {!activity.length ? (
                <tr>
                  <BackOfficeTd>No referral activity found.</BackOfficeTd>
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
