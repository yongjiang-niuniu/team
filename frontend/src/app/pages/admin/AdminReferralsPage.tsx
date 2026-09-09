import { useEffect, useState } from "react";
import { Loader2, QrCode } from "lucide-react";

import { BackOfficeTable, BackOfficeTd, BackOfficeTh } from "../../components/backoffice/BackOfficeTable";
import { BackOfficeSelect } from "../../components/backoffice/BackOfficeSelect";
import { StatusBadge } from "../../components/backoffice/StatusBadge";
import { statusTone } from "../../components/backoffice/statusTone";
import { downloadCsv, fetchReferralReportFees, type ReportFilters } from "../../lib/adminPortal";
import { getApiStyleErrorMessage } from "../../lib/httpErrors";
import {
  fetchReferralSummary,
  fetchRewardPartners,
  type ReferralFee,
  type ReferralSummary,
  type RewardPartner,
} from "../../lib/userPortal";

function ReferralMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">{label}</p>
          <p className="mt-2 text-3xl font-black tracking-tight text-slate-900">{value}</p>
        </div>
        <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-600">
          <QrCode className="h-6 w-6" />
        </div>
      </div>
      <p className="mt-3 text-sm font-medium text-slate-500">{detail}</p>
    </div>
  );
}

export function AdminReferralsPage() {
  const [summary, setSummary] = useState<ReferralSummary | null>(null);
  const [fees, setFees] = useState<ReferralFee[]>([]);
  const [partners, setPartners] = useState<RewardPartner[]>([]);
  const [filters, setFilters] = useState<ReportFilters>({});
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let ignore = false;

    async function loadReferrals() {
      setIsLoading(true);
      try {
        const [summaryData, feeData, partnerData] = await Promise.all([
          fetchReferralSummary(filters),
          fetchReferralReportFees(filters) as Promise<ReferralFee[]>,
          fetchRewardPartners(),
        ]);
        if (!ignore) {
          setSummary(summaryData);
          setFees(feeData);
          setPartners(partnerData);
          setErrorMessage('');
        }
      } catch (error: unknown) {
        if (!ignore) {
          setErrorMessage(getApiStyleErrorMessage(error, 'Could not load referral ledger.'));
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    void loadReferrals();
    return () => {
      ignore = true;
    };
  }, [filters]);

  const updateFilter = (field: keyof ReportFilters, value: string) => {
    setFilters((current) => ({ ...current, [field]: value || undefined }));
  };

  const exportFees = () => {
    downloadCsv(
      `referral-fees-${new Date().toISOString().slice(0, 10)}.csv`,
      fees.map((fee) => ({
        id: fee.id,
        partner: fee.partner?.name || fee.partner_id,
        referral_code: fee.referral_code?.code || fee.referral_code_id,
        status: fee.status,
        amount: fee.fee_amount,
        currency: fee.currency,
        created_at: fee.created_at,
        paid_at: fee.paid_at,
      })),
    );
  };

  return (
    <div className="space-y-6">
      <section>
        <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-600">Admin referrals</p>
        <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">Referral ledger</h2>
        <p className="mt-2 text-sm font-medium text-slate-500">
          Read-only partner fee ledger and referral performance summary.
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
            <option value="expected">expected</option>
            <option value="pending">pending</option>
            <option value="confirmed">confirmed</option>
            <option value="paid">paid</option>
            <option value="cancelled">cancelled</option>
          </BackOfficeSelect>
        </label>
        <button
          type="button"
          onClick={exportFees}
          disabled={!fees.length}
          className="ml-auto rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60"
        >
          Export CSV
        </button>
      </section>

      {isLoading ? (
        <div className="flex min-h-[30vh] items-center justify-center text-slate-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading referral ledger...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <ReferralMetric
              label="Referral codes"
              value={String(summary?.total_referral_codes ?? 0)}
              detail="Issued referral codes"
            />
            <ReferralMetric
              label="Fee records"
              value={String(summary?.total_referral_fees ?? fees.length)}
              detail="Partner fee ledger rows"
            />
            <ReferralMetric
              label="Paid"
              value={`GBP ${Number(summary?.fee_amount_paid || 0).toFixed(2)}`}
              detail={`Confirmed GBP ${Number(summary?.fee_amount_confirmed || 0).toFixed(2)}`}
            />
          </div>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-black text-slate-900">Partner configuration</h3>
                <p className="mt-1 text-sm font-medium text-slate-500">
                  Current resale/referral partner records used for current and rare devices.
                </p>
              </div>
              <StatusBadge value={`${partners.length} partners`} tone="emerald" />
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-2">
              {partners.map((partner) => (
                <div key={partner.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-black text-slate-900">{partner.name}</p>
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                        {partner.partner_type} · {partner.supported_classifications.join(', ') || 'no classifications'}
                      </p>
                    </div>
                    <StatusBadge value={partner.active ? 'active' : 'inactive'} tone={statusTone(partner.active ? 'active' : 'inactive')} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {partner.website_url ? (
                      <a
                        href={partner.website_url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 hover:bg-slate-100"
                      >
                        Website
                      </a>
                    ) : null}
                    {partner.referral_landing_url ? (
                      <a
                        href={partner.referral_landing_url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-black text-white hover:bg-slate-800"
                      >
                        Referral page
                      </a>
                    ) : null}
                  </div>
                </div>
              ))}
              {!partners.length ? (
                <div className="rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm font-semibold text-amber-700">
                  No referral partners are configured yet. Backend write endpoints are needed before admins can add or edit partners here.
                </div>
              ) : null}
            </div>
          </section>

          <BackOfficeTable>
            <thead>
              <tr>
                <BackOfficeTh>Fee</BackOfficeTh>
                <BackOfficeTh>Partner</BackOfficeTh>
                <BackOfficeTh>Referral</BackOfficeTh>
                <BackOfficeTh>Amount</BackOfficeTh>
                <BackOfficeTh>Status</BackOfficeTh>
              </tr>
            </thead>
            <tbody>
              {fees.map((fee) => (
                <tr key={fee.id}>
                  <BackOfficeTd>#{fee.id}</BackOfficeTd>
                  <BackOfficeTd>{fee.partner?.name || `Partner #${fee.partner_id || 'n/a'}`}</BackOfficeTd>
                  <BackOfficeTd>{fee.referral_code?.code || `#${fee.referral_code_id || 'n/a'}`}</BackOfficeTd>
                  <BackOfficeTd>
                    {fee.currency || 'GBP'} {Number(fee.fee_amount || 0).toFixed(2)}
                  </BackOfficeTd>
                  <BackOfficeTd>
                    <StatusBadge value={fee.status} tone={statusTone(fee.status)} />
                  </BackOfficeTd>
                </tr>
              ))}
              {!fees.length ? (
                <tr>
                  <BackOfficeTd>No referral fees found.</BackOfficeTd>
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
