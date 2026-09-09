import { ExternalLink, QrCode, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';

import { getReferralCredentialPath, getReferralCredentialUrl } from '../lib/referrals';
import type { ReferralCode } from '../lib/userPortal';

type Props = {
  referral: ReferralCode | null;
  onClose: () => void;
};

export function ReferralQrDialog({ referral, onClose }: Props) {
  if (!referral) {
    return null;
  }

  const qrUrl = getReferralCredentialUrl(referral.id);
  const credentialPath = getReferralCredentialPath(referral.id);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/50 px-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        className="w-full max-w-md overflow-hidden rounded-[2rem] border border-slate-100 bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-emerald-600">Partner QR Voucher</p>
            <h2 className="mt-1 text-2xl font-black text-slate-900">{referral.code}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close QR voucher"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-6">
          <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-5 shadow-inner">
            <div className="rounded-[1.5rem] bg-white p-5 shadow-sm">
              <QRCodeSVG
                value={qrUrl}
                size={224}
                level="H"
                includeMargin
                className="mx-auto h-auto w-full max-w-[224px]"
              />
            </div>
          </div>

          <div className="mt-5 space-y-3">
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3">
              <p className="text-sm font-black text-emerald-900">{referral.partner?.name || 'Partner store'}</p>
              <p className="mt-1 text-sm font-medium text-emerald-800">
                {referral.bonus_label || referral.voucher_label || 'Show this QR code in store to continue.'}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">Scan URL</p>
              <p className="mt-1 break-all text-xs font-medium text-slate-600">{qrUrl}</p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Link
              to={credentialPath}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-emerald-500"
            >
              <QrCode className="h-4 w-4" />
              Open Voucher
            </Link>
            <a
              href={qrUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
            >
              <ExternalLink className="h-4 w-4" />
              New Tab
            </a>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
