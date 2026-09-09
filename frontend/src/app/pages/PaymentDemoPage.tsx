import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, CreditCard, ShieldCheck, XCircle } from 'lucide-react';

import { getApiStyleErrorMessage } from '../lib/httpErrors';
import { updateRetrievalPaymentStatus } from '../lib/retrieval';
import type { PaymentProvider } from '../lib/payment';

function getProvider(value: string | null): Exclude<PaymentProvider, 'pending'> | null {
  if (value === 'paypal' || value === 'stripe') {
    return value;
  }
  return null;
}

function providerLabel(provider: string | null) {
  if (provider === 'paypal') {
    return 'PayPal Sandbox';
  }
  if (provider === 'stripe') {
    return 'Stripe Sandbox';
  }
  return 'Demo Checkout';
}

export function PaymentDemoPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState<'paid' | 'cancelled' | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const provider = getProvider(searchParams.get('provider'));
  const amount = Number(searchParams.get('amount') || '10');
  const currency = searchParams.get('currency') || 'GBP';
  const deviceName = searchParams.get('device') || 'Retrieved device data';
  const paymentKind = searchParams.get('payment_kind') === 'extension' ? 'extension' : 'initial_retrieval';
  const retrievalRequestId = Number(searchParams.get('retrieval_request_id') || '');
  const checkoutReference = searchParams.get('session_id') || searchParams.get('reference') || '';
  const transactionId = Number(searchParams.get('transaction_id') || '');

  const demoReference = useMemo(() => {
    const seed = checkoutReference || `${retrievalRequestId || 'request'}_${transactionId || 'manual'}`;
    return provider ? `demo_${provider}_${seed}` : `demo_checkout_${seed}`;
  }, [checkoutReference, provider, retrievalRequestId, transactionId]);

  const finish = async (status: 'paid' | 'cancelled') => {
    if (!provider) {
      setErrorMessage('This demo checkout is missing a valid provider.');
      return;
    }
    if (!Number.isFinite(retrievalRequestId) || retrievalRequestId <= 0) {
      setErrorMessage('This demo checkout is missing a retrieval request id.');
      return;
    }

    setIsSubmitting(status);
    setErrorMessage('');
    try {
      await updateRetrievalPaymentStatus(retrievalRequestId, {
        status,
        provider,
        payment_kind: paymentKind,
        transaction_id: Number.isFinite(transactionId) && transactionId > 0 ? transactionId : null,
        checkout_reference: checkoutReference || null,
        provider_payment_id: status === 'paid' ? demoReference : `${demoReference}_cancelled`,
        amount,
        currency,
      });

      const resultParams = new URLSearchParams({
        provider,
        amount: String(amount),
        currency,
        device: deviceName,
        retrieval_request_id: String(retrievalRequestId),
        payment_kind: paymentKind,
        reference: status === 'paid' ? demoReference : `${demoReference}_cancelled`,
      });
      if (checkoutReference) {
        resultParams.set('session_id', checkoutReference);
      }
      if (Number.isFinite(transactionId) && transactionId > 0) {
        resultParams.set('transaction_id', String(transactionId));
      }

      navigate(`/app/payment/${status === 'paid' ? 'success' : 'cancel'}?${resultParams.toString()}`, {
        replace: true,
      });
    } catch (error: unknown) {
      setErrorMessage(getApiStyleErrorMessage(error, 'Could not update the demo payment status.'));
      setIsSubmitting(null);
    }
  };

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 pb-10">
      <section className="rounded-[2rem] border border-slate-100 bg-white p-8 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.06)]">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-600">
              Demo only, no real payment
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">
              {providerLabel(provider)}
            </h1>
            <p className="mt-3 max-w-2xl text-base font-medium leading-relaxed text-slate-500">
              This sandbox-style screen proves the payment workflow without contacting Stripe, PayPal,
              banks, cards, or live merchant accounts.
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3 text-emerald-700">
            <ShieldCheck className="h-7 w-7" />
          </div>
        </div>

        {errorMessage ? (
          <div className="mb-5 rounded-2xl border border-red-100 bg-red-50 px-5 py-4 text-sm font-semibold text-red-600">
            {errorMessage}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4">
            <p className="text-xs font-black uppercase tracking-widest text-slate-400">Device</p>
            <p className="mt-1 text-lg font-black text-slate-900">{deviceName}</p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4">
            <p className="text-xs font-black uppercase tracking-widest text-slate-400">Amount</p>
            <p className="mt-1 text-lg font-black text-slate-900">
              {currency} {amount.toFixed(2)}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4">
            <p className="text-xs font-black uppercase tracking-widest text-slate-400">Payment kind</p>
            <p className="mt-1 text-lg font-black text-slate-900">{paymentKind}</p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4">
            <p className="text-xs font-black uppercase tracking-widest text-slate-400">Demo reference</p>
            <p className="mt-1 break-all text-sm font-black text-slate-900">{demoReference}</p>
          </div>
        </div>

        <div className="mt-7 grid grid-cols-1 gap-3 md:grid-cols-2">
          <button
            type="button"
            onClick={() => void finish('paid')}
            disabled={Boolean(isSubmitting)}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-4 text-sm font-black text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-500 disabled:opacity-60"
          >
            {isSubmitting === 'paid' ? (
              <CreditCard className="h-5 w-5" />
            ) : (
              <CheckCircle2 className="h-5 w-5" />
            )}
            {isSubmitting === 'paid' ? 'Approving demo...' : 'Approve Demo Payment'}
          </button>
          <button
            type="button"
            onClick={() => void finish('cancelled')}
            disabled={Boolean(isSubmitting)}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-black text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <XCircle className="h-5 w-5" />
            {isSubmitting === 'cancelled' ? 'Cancelling demo...' : 'Cancel Demo Payment'}
          </button>
        </div>
      </section>

      <Link
        to="/app/security-vault"
        className="inline-flex w-fit items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Security Vault
      </Link>
    </div>
  );
}
