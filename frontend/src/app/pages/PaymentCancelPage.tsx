import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import { PaymentSummaryCard } from '../components/PaymentSummaryCard';
import { getApiStyleErrorMessage } from '../lib/httpErrors';
import {
  toPaymentSummary,
  updateRetrievalPaymentStatus,
  type RetrievalPaymentTransaction,
  type RetrievalRequest,
} from '../lib/retrieval';
import type { PaymentSummary, PaymentProvider } from '../lib/payment';

function getProvider(value: string | null): Exclude<PaymentProvider, 'pending'> | null {
  if (value === 'paypal' || value === 'stripe') {
    return value;
  }
  return null;
}

export function PaymentCancelPage() {
  const [searchParams] = useSearchParams();
  const [isSyncing, setIsSyncing] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [summary, setSummary] = useState<PaymentSummary>({
    provider: getProvider(searchParams.get('provider')),
    status: 'cancelled',
    amount: Number(searchParams.get('amount') || '10'),
    currency: searchParams.get('currency') || 'GBP',
    deviceName: searchParams.get('device') || 'Retrieved device data',
    note: 'Synchronising the cancelled checkout result with the backend retrieval record.',
  });

  useEffect(() => {
    let ignore = false;

    async function syncPayment() {
      const retrievalRequestId = Number(searchParams.get('retrieval_request_id') || '');
      const provider = getProvider(searchParams.get('provider'));
      const reference = searchParams.get('reference') || null;
      const sessionId = searchParams.get('session_id') || null;
      const transactionId = Number(searchParams.get('transaction_id') || '');
      const paymentKind = searchParams.get('payment_kind') === 'extension' ? 'extension' : 'initial_retrieval';

      if (!Number.isFinite(retrievalRequestId) || retrievalRequestId <= 0) {
        if (!ignore) {
          setIsSyncing(false);
          setSummary((current) => ({
            ...current,
            note: 'No retrieval request id was supplied, so this page is showing the cancellation state only.',
          }));
        }
        return;
      }

      try {
        const response = await updateRetrievalPaymentStatus(retrievalRequestId, {
          status: 'cancelled',
          provider,
          payment_kind: paymentKind,
          transaction_id: Number.isFinite(transactionId) && transactionId > 0 ? transactionId : null,
          checkout_reference: sessionId || reference,
          provider_payment_id: reference || sessionId,
          amount: Number(searchParams.get('amount') || '10'),
          currency: searchParams.get('currency') || 'GBP',
        });

        if (!ignore) {
          const retrievalRequest = response.retrieval_request as RetrievalRequest;
          const paymentTransaction = response.payment_transaction as RetrievalPaymentTransaction;
          setSummary({
            ...toPaymentSummary(retrievalRequest, paymentTransaction),
            status: 'cancelled',
            note: 'Cancellation status has been written back to the retrieval request.',
          });
          setErrorMessage('');
          setIsSyncing(false);
        }
      } catch (error: unknown) {
        if (!ignore) {
          setErrorMessage(
            getApiStyleErrorMessage(error, 'Could not record the cancellation with the backend.'),
          );
          setSummary((current) => ({
            ...current,
            note: 'The cancel page loaded, but the backend status update still needs attention.',
          }));
          setIsSyncing(false);
        }
      }
    }

    void syncPayment();

    return () => {
      ignore = true;
    };
  }, [searchParams]);

  const retryLink = '/app/security-vault';

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 pb-10">
      <div className="rounded-[2.5rem] border border-amber-100 bg-white p-8 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.06)]">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-[1.5rem] bg-amber-100">
          <RotateCcw className="h-10 w-10 text-amber-600" />
        </div>
        <h1 className="mb-3 text-3xl font-black tracking-tight text-slate-900">Payment Cancelled</h1>
        <p className="max-w-2xl text-base font-medium leading-relaxed text-slate-500">
          {isSyncing
            ? 'We are recording the cancelled retrieval checkout with the backend now.'
            : 'The cancellation page is now connected to the backend payment-status endpoint.'}
        </p>
      </div>

      {errorMessage ? (
        <div className="rounded-3xl border border-red-100 bg-red-50 px-6 py-5 text-sm font-semibold text-red-600">
          {errorMessage}
        </div>
      ) : null}

      <PaymentSummaryCard
        summary={summary}
        title="Cancelled Result"
        subtitle={
          isSyncing
            ? 'Writing the cancellation result back to /api/retrieval-requests/:id/payment-status.'
            : 'Users can now return here from the demo checkout and leave the retrieval request in a cancelled state.'
        }
      />

      <div className="flex flex-wrap gap-3">
        <Link
          to={retryLink}
          className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 font-bold text-white hover:bg-slate-800"
        >
          Retry from Security Vault
        </Link>
        <Link
          to="/app/security-vault"
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 font-bold text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Security Vault
        </Link>
      </div>
    </div>
  );
}
