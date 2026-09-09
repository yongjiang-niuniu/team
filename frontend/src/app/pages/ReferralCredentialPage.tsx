import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, ExternalLink, Loader2, QrCode, ShieldCheck, Store } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

import { getApiStyleErrorMessage } from '../lib/httpErrors';
import { getReferralCredentialUrl } from '../lib/referrals';
import {
  fetchReferralDetail,
  recordReferralOpen,
  recordReferralRedeem,
  type ReferralCode,
} from '../lib/userPortal';

function formatDate(value?: string | null): string {
  if (!value) {
    return 'Not available';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function isTerminal(status?: string | null): boolean {
  return ['redeemed', 'handin_confirmed', 'resale_confirmed'].includes((status || '').toLowerCase());
}

export function ReferralCredentialPage() {
  const { referralId } = useParams();
  const [referral, setReferral] = useState<ReferralCode | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActing, setIsActing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    let ignore = false;

    async function loadReferral() {
      const id = Number(referralId);
      if (!Number.isInteger(id) || id <= 0) {
        setErrorMessage('Invalid referral voucher.');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage('');
      try {
        const detail = await fetchReferralDetail(id);
        if (!ignore && detail) {
          setReferral(detail);
        }

        const opened = await recordReferralOpen(id, {
          source: 'qr_credential_page',
          event_reference: 'credential_page',
        });
        if (!ignore && opened) {
          setReferral(opened);
        }
      } catch (error: unknown) {
        if (!ignore) {
          setErrorMessage(getApiStyleErrorMessage(error, 'Could not load this referral voucher.'));
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    void loadReferral();
    return () => {
      ignore = true;
    };
  }, [referralId]);

  const handleRedeem = async () => {
    if (!referral) return;

    setIsActing(true);
    setErrorMessage('');
    setStatusMessage('');
    try {
      const updated = await recordReferralRedeem(referral.id, {
        channel: 'qr_credential_page',
        event_reference: 'credential_page',
      });
      setReferral(updated);
      setStatusMessage('Voucher redeemed successfully.');
    } catch (error: unknown) {
      setErrorMessage(getApiStyleErrorMessage(error, 'Could not redeem this voucher right now.'));
    } finally {
      setIsActing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-xl items-center justify-center text-slate-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading referral voucher...
      </div>
    );
  }

  if (errorMessage || !referral) {
    return (
      <div className="mx-auto max-w-xl rounded-[2rem] border border-red-100 bg-red-50 px-8 py-10 text-center text-red-600">
        <p className="text-lg font-black">Referral Unavailable</p>
        <p className="mt-2 font-medium">{errorMessage || 'Referral voucher was not found.'}</p>
        <Link to="/app/rewards" className="mt-5 inline-flex rounded-2xl bg-white px-5 py-3 text-sm font-bold text-red-600">
          Back to Rewards
        </Link>
      </div>
    );
  }

  const credentialUrl = getReferralCredentialUrl(referral.id);
  const redeemed = isTerminal(referral.status);

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-10">
      <section className="overflow-hidden rounded-[2.5rem] border border-slate-100 bg-white shadow-[0_32px_64px_-16px_rgba(0,0,0,0.08)]">
        <div className="bg-emerald-600 px-8 py-7 text-white">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-emerald-100">eWaste Hub Voucher</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight">{referral.code}</h1>
            </div>
            <div className="rounded-2xl bg-white/15 p-3">
              <QrCode className="h-7 w-7" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 p-8 md:grid-cols-[260px_1fr]">
          <div className="rounded-[2rem] border border-slate-100 bg-slate-50 p-5">
            <div className="rounded-[1.5rem] bg-white p-4 shadow-sm">
              <QRCodeSVG value={credentialUrl} size={210} level="H" marginSize={4} className="h-auto w-full" />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                <Store className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Partner</p>
                <p className="text-lg font-black text-slate-900">{referral.partner?.name || 'Partner store'}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4">
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">Status</p>
              <p className="mt-1 text-lg font-black text-slate-900">{referral.status.toUpperCase()}</p>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4">
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">Bonus</p>
              <p className="mt-1 text-sm font-bold text-slate-700">
                {referral.bonus_label || referral.voucher_label || 'Partner bonus pending'}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3">
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Issued</p>
                <p className="mt-1 text-sm font-bold text-slate-700">{formatDate(referral.issued_at)}</p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3">
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Device</p>
                <p className="mt-1 text-sm font-bold text-slate-700">{referral.device?.name || 'Linked device'}</p>
              </div>
            </div>

            {statusMessage ? (
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                {statusMessage}
              </div>
            ) : null}
            {errorMessage ? (
              <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
                {errorMessage}
              </div>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => void handleRedeem()}
                disabled={redeemed || isActing}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-300"
              >
                {isActing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {redeemed ? 'Already Redeemed' : isActing ? 'Redeeming...' : 'Mark Redeemed'}
              </button>
              {referral.partner?.website_url ? (
                <a
                  href={referral.partner.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
                >
                  <ExternalLink className="h-4 w-4" />
                  Partner Site
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <div className="rounded-2xl border border-slate-100 bg-white px-5 py-4 text-sm font-medium text-slate-500">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          <p>
            This QR identifies the eWaste Hub referral and records partner hand-in activity for your voucher.
          </p>
        </div>
      </div>
    </div>
  );
}
