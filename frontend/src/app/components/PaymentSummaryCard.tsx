import { AlertCircle, CheckCircle2, Clock3, CreditCard, ReceiptText } from 'lucide-react';
import { formatCurrencyAmount, formatPaymentProvider, formatPaymentStatus, type PaymentSummary } from '../lib/payment';

type PaymentSummaryCardProps = {
  summary: PaymentSummary;
  title?: string;
  subtitle?: string;
};

function statusStyles(status: PaymentSummary['status']) {
  switch (status) {
    case 'paid':
      return {
        badge: 'border-emerald-100 bg-emerald-50 text-emerald-700',
        iconBox: 'bg-emerald-100 text-emerald-700',
        Icon: CheckCircle2,
      };
    case 'cancelled':
      return {
        badge: 'border-red-100 bg-red-50 text-red-600',
        iconBox: 'bg-red-100 text-red-600',
        Icon: AlertCircle,
      };
    case 'processing':
      return {
        badge: 'border-blue-100 bg-blue-50 text-blue-700',
        iconBox: 'bg-blue-100 text-blue-700',
        Icon: Clock3,
      };
    case 'requires_payment':
      return {
        badge: 'border-amber-100 bg-amber-50 text-amber-700',
        iconBox: 'bg-amber-100 text-amber-700',
        Icon: CreditCard,
      };
    default:
      return {
        badge: 'border-slate-200 bg-slate-50 text-slate-600',
        iconBox: 'bg-slate-100 text-slate-600',
        Icon: ReceiptText,
      };
  }
}

export function PaymentSummaryCard({
  summary,
  title = 'Payment Overview',
  subtitle = 'Payment details will update here as your retrieval moves through checkout.',
}: PaymentSummaryCardProps) {
  const { badge, iconBox, Icon } = statusStyles(summary.status);
  const amount = summary.amount ?? summary.finalPrice ?? summary.quotedPrice ?? null;
  const paidAt = summary.paidAt
    ? new Date(summary.paidAt).toLocaleString('en-GB', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : 'Not available yet';

  return (
    <div className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${iconBox}`}>
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-slate-400">{title}</p>
            <h3 className="text-xl font-black text-slate-900">{summary.deviceName || 'Data retrieval payment'}</h3>
          </div>
        </div>
        <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold ${badge}`}>
          {formatPaymentStatus(summary.status)}
        </span>
      </div>

      <p className="mb-5 text-sm font-medium leading-relaxed text-slate-500">{subtitle}</p>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
          <p className="text-xs font-black uppercase tracking-widest text-slate-400">Provider</p>
          <p className="mt-1 text-sm font-bold text-slate-900">{formatPaymentProvider(summary.provider)}</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
          <p className="text-xs font-black uppercase tracking-widest text-slate-400">Amount</p>
          <p className="mt-1 text-sm font-bold text-slate-900">
            {formatCurrencyAmount(amount, summary.currency || 'GBP')}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
          <p className="text-xs font-black uppercase tracking-widest text-slate-400">Reference</p>
          <p
            className="mt-1 break-all text-sm font-bold text-slate-900"
            title={summary.reference || 'Awaiting reference'}
          >
            {summary.reference || 'Awaiting reference'}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
          <p className="text-xs font-black uppercase tracking-widest text-slate-400">Paid At</p>
          <p className="mt-1 text-sm font-bold text-slate-900">{paidAt}</p>
        </div>
      </div>

      {(summary.quotedPrice !== null && summary.quotedPrice !== undefined) ||
      (summary.finalPrice !== null && summary.finalPrice !== undefined) ||
      summary.note ? (
        <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
          <p className="mb-3 text-xs font-black uppercase tracking-widest text-slate-400">Request Details</p>
          <div className="space-y-2 text-sm font-medium text-slate-600">
            <p>
              Quoted price:
              <span className="ml-2 font-bold text-slate-900">
                {formatCurrencyAmount(summary.quotedPrice, summary.currency || 'GBP')}
              </span>
            </p>
            <p>
              Final price:
              <span className="ml-2 font-bold text-slate-900">
                {formatCurrencyAmount(summary.finalPrice, summary.currency || 'GBP')}
              </span>
            </p>
            {summary.note ? <p className="leading-relaxed text-slate-500">{summary.note}</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
