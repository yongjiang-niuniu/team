import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import { BackOfficeTable, BackOfficeTd, BackOfficeTh } from "../../components/backoffice/BackOfficeTable";
import { BackOfficeSelect } from "../../components/backoffice/BackOfficeSelect";
import { StatusBadge } from "../../components/backoffice/StatusBadge";
import { statusTone } from "../../components/backoffice/statusTone";
import { getApiStyleErrorMessage } from "../../lib/httpErrors";
import {
  createReferralFee,
  fetchReferralByCode,
  fetchReferralFees,
  recordStaffReferralEvent,
  updateReferralFee,
  type ReferralCode,
  type ReferralFee,
} from "../../lib/userPortal";

const FEE_STATUS_OPTIONS = ['expected', 'pending', 'confirmed', 'paid', 'cancelled'] as const;
const EVENT_TYPE_OPTIONS = ['handin_confirmed', 'resale_confirmed', 'fee_recorded'] as const;

export function StaffReferralsPage() {
  const [fees, setFees] = useState<ReferralFee[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [referralCode, setReferralCode] = useState('');
  const [selectedReferral, setSelectedReferral] = useState<ReferralCode | null>(null);
  const [eventType, setEventType] = useState<(typeof EVENT_TYPE_OPTIONS)[number]>('handin_confirmed');
  const [eventReference, setEventReference] = useState('');
  const [feeAmount, setFeeAmount] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const loadFees = useCallback(async () => {
    setIsLoading(true);
    try {
      const items = await fetchReferralFees(statusFilter === 'all' ? undefined : { status: statusFilter });
      setFees(items);
      setErrorMessage('');
    } catch (error: unknown) {
      setErrorMessage(getApiStyleErrorMessage(error, 'Could not load referral fees.'));
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void loadFees();
  }, [loadFees]);

  const totalExpected = useMemo(
    () => fees.reduce((sum, fee) => sum + Number(fee.fee_amount || 0), 0),
    [fees],
  );

  const lookupReferral = async () => {
    if (!referralCode.trim()) {
      setErrorMessage('Enter a referral code.');
      return;
    }
    setIsSaving(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const referral = await fetchReferralByCode(referralCode.trim());
      setSelectedReferral(referral);
      if (!referral) {
        setErrorMessage('Referral code was not found.');
      }
    } catch (error: unknown) {
      setSelectedReferral(null);
      setErrorMessage(getApiStyleErrorMessage(error, 'Could not find referral code.'));
    } finally {
      setIsSaving(false);
    }
  };

  const recordEvent = async () => {
    if (!selectedReferral) return;
    setIsSaving(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      await recordStaffReferralEvent(selectedReferral.id, {
        event_type: eventType,
        event_reference: eventReference || null,
      });
      setSuccessMessage('Referral event recorded.');
    } catch (error: unknown) {
      setErrorMessage(getApiStyleErrorMessage(error, 'Could not record referral event.'));
    } finally {
      setIsSaving(false);
    }
  };

  const createFee = async () => {
    if (!selectedReferral) return;
    setIsSaving(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      await createReferralFee({
        referral_code_id: selectedReferral.id,
        status: 'expected',
        fee_amount: feeAmount ? Number(feeAmount) : null,
        currency: 'GBP',
        fee_reference: eventReference || null,
      });
      setSuccessMessage('Referral fee created.');
      setFeeAmount('');
      await loadFees();
    } catch (error: unknown) {
      setErrorMessage(getApiStyleErrorMessage(error, 'Could not create referral fee.'));
    } finally {
      setIsSaving(false);
    }
  };

  const updateFeeStatus = async (feeId: number, status: string) => {
    setIsSaving(true);
    setErrorMessage('');
    try {
      await updateReferralFee(feeId, { status });
      await loadFees();
    } catch (error: unknown) {
      setErrorMessage(getApiStyleErrorMessage(error, 'Could not update referral fee.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <section>
        <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-600">Staff rewards</p>
        <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">Referral activity</h2>
        <p className="mt-2 text-sm font-medium text-slate-500">
          Look up referral codes, record staff-confirmed events, and manage expected partner fees.
        </p>
      </section>

      {errorMessage ? (
        <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
          {errorMessage}
        </div>
      ) : null}
      {successMessage ? (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
          {successMessage}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[420px_1fr]">
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-black text-slate-900">Record referral event</h3>
          <div className="flex gap-2">
            <input
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value)}
              placeholder="Referral code"
              className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium"
            />
            <button
              type="button"
              onClick={() => void lookupReferral()}
              disabled={isSaving}
              className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
            >
              Lookup
            </button>
          </div>

          {selectedReferral ? (
            <div className="space-y-4 rounded-xl bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-black text-slate-900">{selectedReferral.code}</p>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    {selectedReferral.partner?.name || 'No partner'} · Device #{selectedReferral.device_id || 'n/a'}
                  </p>
                </div>
                <StatusBadge value={selectedReferral.status} tone={statusTone(selectedReferral.status)} />
              </div>

              <BackOfficeSelect
                value={eventType}
                onChange={(e) => setEventType(e.target.value as (typeof EVENT_TYPE_OPTIONS)[number])}
                className="w-full"
              >
                {EVENT_TYPE_OPTIONS.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </BackOfficeSelect>
              <input
                value={eventReference}
                onChange={(e) => setEventReference(e.target.value)}
                placeholder="Event / fee reference"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium"
              />
              <input
                value={feeAmount}
                onChange={(e) => setFeeAmount(e.target.value)}
                placeholder="Fee amount (optional)"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void recordEvent()}
                  disabled={isSaving}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                >
                  Record event
                </button>
                <button
                  type="button"
                  onClick={() => void createFee()}
                  disabled={isSaving}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 disabled:opacity-60"
                >
                  Create fee
                </button>
              </div>
            </div>
          ) : null}
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-black text-slate-900">Referral fees</h3>
              <p className="text-sm font-medium text-slate-500">Visible total: GBP {totalExpected.toFixed(2)}</p>
            </div>
            <BackOfficeSelect
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All statuses</option>
              {FEE_STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </BackOfficeSelect>
          </div>

          {isLoading ? (
            <div className="flex min-h-[30vh] items-center justify-center text-slate-500">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Loading referral fees...
            </div>
          ) : (
            <BackOfficeTable>
              <thead>
                <tr>
                  <BackOfficeTh>Fee</BackOfficeTh>
                  <BackOfficeTh>Partner</BackOfficeTh>
                  <BackOfficeTh>Amount</BackOfficeTh>
                  <BackOfficeTh>Status</BackOfficeTh>
                </tr>
              </thead>
              <tbody>
                {fees.map((fee) => (
                  <tr key={fee.id}>
                    <BackOfficeTd>
                      <span className="font-black text-slate-900">#{fee.id}</span>
                    </BackOfficeTd>
                    <BackOfficeTd>Partner #{fee.partner_id || 'n/a'}</BackOfficeTd>
                    <BackOfficeTd>
                      {fee.currency || 'GBP'} {Number(fee.fee_amount || 0).toFixed(2)}
                    </BackOfficeTd>
                    <BackOfficeTd>
                      <BackOfficeSelect
                        value={fee.status}
                        disabled={isSaving}
                        onChange={(e) => void updateFeeStatus(fee.id, e.target.value)}
                      >
                        {FEE_STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </BackOfficeSelect>
                    </BackOfficeTd>
                  </tr>
                ))}
                {!fees.length ? (
                  <tr>
                    <BackOfficeTd>No referral fees found.</BackOfficeTd>
                    <BackOfficeTd />
                    <BackOfficeTd />
                    <BackOfficeTd />
                  </tr>
                ) : null}
              </tbody>
            </BackOfficeTable>
          )}
        </section>
      </div>
    </div>
  );
}
