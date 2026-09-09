import type { VaultArchive } from './userPortal';

export type PaymentProvider = 'paypal' | 'stripe' | 'pending';
export type PaymentStatus =
  | 'not_started'
  | 'requires_payment'
  | 'processing'
  | 'paid'
  | 'cancelled';

export type PaymentSummary = {
  provider?: PaymentProvider | null;
  status: PaymentStatus;
  reference?: string | null;
  checkoutSessionId?: string | null;
  amount?: number | null;
  currency?: string | null;
  paidAt?: string | null;
  quotedPrice?: number | null;
  finalPrice?: number | null;
  deviceName?: string | null;
  note?: string | null;
};

export function formatCurrencyAmount(amount?: number | null, currency = 'GBP'): string {
  if (amount === null || amount === undefined) {
    return 'Pending';
  }

  try {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export function formatPaymentProvider(provider?: PaymentProvider | null): string {
  switch ((provider || '').toLowerCase()) {
    case 'paypal':
      return 'PayPal';
    case 'stripe':
      return 'Stripe';
    default:
      return 'Not selected';
  }
}

export function formatPaymentStatus(status: PaymentStatus): string {
  switch (status) {
    case 'requires_payment':
      return 'Payment required';
    case 'processing':
      return 'Processing';
    case 'paid':
      return 'Paid';
    case 'cancelled':
      return 'Cancelled';
    default:
      return 'Not started';
  }
}

export function buildArchivePaymentSummary(archive: VaultArchive): PaymentSummary {
  const normalizedStatus = (archive.status || '').trim().toLowerCase();
  const normalizedPaymentStatus = (archive.payment_status || '').trim().toLowerCase();
  const isPaid = normalizedPaymentStatus === 'paid' || (normalizedStatus === 'active' && Boolean(archive.download));
  const isProcessing =
    normalizedPaymentStatus === 'initiated' ||
    normalizedPaymentStatus === 'pending' ||
    (normalizedStatus === 'active' && !archive.download);
  const requiresPayment =
    normalizedPaymentStatus === 'unpaid' ||
    normalizedStatus === 'pending' ||
    normalizedStatus === 'locked';
  const isCancelled =
    normalizedPaymentStatus === 'cancelled' ||
    normalizedPaymentStatus === 'failed' ||
    normalizedPaymentStatus === 'refunded';

  let status: PaymentStatus = 'not_started';
  if (isPaid) {
    status = 'paid';
  } else if (isCancelled) {
    status = 'cancelled';
  } else if (isProcessing) {
    status = 'processing';
  } else if (requiresPayment) {
    status = 'requires_payment';
  }

  return {
    provider:
      archive.payment_provider === 'paypal' || archive.payment_provider === 'stripe'
        ? archive.payment_provider
        : null,
    status,
    reference: archive.payment_reference ?? null,
    amount: archive.final_price ?? archive.quoted_price ?? null,
    currency: 'GBP',
    paidAt: archive.download?.issued_at ?? archive.download?.created_at ?? null,
    quotedPrice: archive.quoted_price ?? null,
    finalPrice: archive.final_price ?? null,
    deviceName: archive.device?.name ?? null,
    note: archive.note ?? null,
  };
}
