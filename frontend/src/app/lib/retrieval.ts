import api from '../../api/axios';
import type { PaymentProvider, PaymentStatus, PaymentSummary } from './payment';

export type RetrievalPaymentKind = 'initial_retrieval' | 'extension';

export type RetrievalPaymentTransaction = {
  id: number;
  provider?: string | null;
  payment_kind?: RetrievalPaymentKind | string | null;
  status?: string | null;
  amount?: number | null;
  currency?: string | null;
  provider_payment_id?: string | null;
  checkout_reference?: string | null;
  paid_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type RetrievalCheckout = {
  provider: string;
  payment_kind: RetrievalPaymentKind | string;
  transaction_id: number;
  checkout_reference?: string | null;
  amount?: number | null;
  currency?: string | null;
  integration_mode?: 'provider' | 'stub' | string;
  provider_configured?: boolean;
  success_url: string;
  cancel_url: string;
};

export type RetrievalDownload = {
  id?: number;
  retrieval_request_id: number;
  token: string;
  download_url: string;
  issued_at?: string | null;
  created_at?: string | null;
  expires_at?: string | null;
  revoked_at?: string | null;
  consumed_at?: string | null;
};

export type RetrievalDevice = {
  id: number;
  name: string;
  device_type: string;
  condition?: string | null;
  classification?: string | null;
  workflow_status?: string | null;
  created_at?: string | null;
};

export type RetrievalRequest = {
  id: number;
  device_id: number;
  consumer_id: number;
  owner_id?: number;
  status: string;
  retrieval_status?: string | null;
  quoted_price?: number | null;
  final_price?: number | null;
  payment_provider?: string | null;
  payment_status?: string | null;
  payment_reference?: string | null;
  storage_expires_at?: string | null;
  extended_until?: string | null;
  deleted_at?: string | null;
  assigned_staff_id?: number | null;
  note?: string | null;
  requested_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  device?: RetrievalDevice | null;
  download?: RetrievalDownload | null;
};

export type RetrievalCheckoutResponse = {
  message?: string;
  retrieval_request: RetrievalRequest;
  payment_transaction: RetrievalPaymentTransaction;
  checkout: RetrievalCheckout;
};

export type RetrievalPaymentStatusResponse = {
  message?: string;
  retrieval_request: RetrievalRequest;
  payment_transaction: RetrievalPaymentTransaction;
};

type CheckoutPayload = {
  provider: Exclude<PaymentProvider, 'pending'>;
  amount?: number | null;
  currency?: string | null;
  payment_kind?: RetrievalPaymentKind;
};

type PaymentStatusPayload = {
  status: 'initiated' | 'pending' | 'paid' | 'failed' | 'cancelled' | 'refunded';
  provider?: Exclude<PaymentProvider, 'pending'> | null;
  payment_kind?: RetrievalPaymentKind;
  transaction_id?: number | null;
  checkout_reference?: string | null;
  provider_payment_id?: string | null;
  amount?: number | null;
  currency?: string | null;
  error_code?: string | null;
  error_message?: string | null;
  occurred_at?: string | null;
};

type RetrievalStatusPayload = {
  status?: string | null;
  retrieval_status?: string | null;
  note?: string | null;
  assigned_staff_id?: number | null;
};

function normalizeProvider(provider?: string | null): PaymentProvider | null {
  if (provider === 'paypal' || provider === 'stripe') {
    return provider;
  }
  return null;
}

export function toPaymentSummary(
  retrievalRequest: RetrievalRequest,
  paymentTransaction?: RetrievalPaymentTransaction | null,
): PaymentSummary {
  const rawPaymentStatus = (
    paymentTransaction?.status ||
    retrievalRequest.payment_status ||
    ''
  )
    .trim()
    .toLowerCase();

  let status: PaymentStatus = 'not_started';
  if (rawPaymentStatus === 'paid') {
    status = 'paid';
  } else if (rawPaymentStatus === 'initiated' || rawPaymentStatus === 'pending') {
    status = 'processing';
  } else if (rawPaymentStatus === 'cancelled' || rawPaymentStatus === 'failed' || rawPaymentStatus === 'refunded') {
    status = 'cancelled';
  } else if (rawPaymentStatus === 'unpaid' || rawPaymentStatus === '') {
    status = 'requires_payment';
  }

  return {
    provider: normalizeProvider(paymentTransaction?.provider || retrievalRequest.payment_provider),
    status,
    reference:
      paymentTransaction?.provider_payment_id ||
      paymentTransaction?.checkout_reference ||
      retrievalRequest.payment_reference ||
      null,
    checkoutSessionId: paymentTransaction?.checkout_reference || null,
    amount:
      paymentTransaction?.amount ??
      retrievalRequest.final_price ??
      retrievalRequest.quoted_price ??
      null,
    currency: paymentTransaction?.currency || 'GBP',
    paidAt: paymentTransaction?.paid_at || null,
    quotedPrice: retrievalRequest.quoted_price ?? null,
    finalPrice: retrievalRequest.final_price ?? null,
    deviceName: retrievalRequest.device?.name || null,
    note: retrievalRequest.note ?? null,
  };
}

export async function fetchMyRetrievalRequests(): Promise<RetrievalRequest[]> {
  const response = await api.get('/api/retrieval-requests/mine');
  return response.data?.retrieval_requests ?? [];
}

export async function fetchRetrievalRequestDetail(retrievalRequestId: number): Promise<RetrievalRequest | null> {
  const response = await api.get(`/api/retrieval-requests/${retrievalRequestId}`);
  return response.data?.retrieval_request ?? null;
}

export async function createRetrievalRequest(deviceId: number, note?: string | null): Promise<RetrievalRequest> {
  const response = await api.post('/api/retrieval-requests', {
    device_id: deviceId,
    note: note || null,
  });
  return response.data?.retrieval_request;
}

export async function initiateRetrievalCheckout(
  retrievalRequestId: number,
  payload: CheckoutPayload,
): Promise<RetrievalCheckoutResponse> {
  const response = await api.post(`/api/retrieval-requests/${retrievalRequestId}/checkout`, payload);
  return response.data;
}

export async function initiateRetrievalExtensionCheckout(
  retrievalRequestId: number,
  payload: Omit<CheckoutPayload, 'payment_kind'>,
): Promise<RetrievalCheckoutResponse> {
  const response = await api.post(`/api/retrieval-requests/${retrievalRequestId}/extension-checkout`, payload);
  return response.data;
}

export async function updateRetrievalPaymentStatus(
  retrievalRequestId: number,
  payload: PaymentStatusPayload,
): Promise<RetrievalPaymentStatusResponse> {
  const response = await api.post(`/api/retrieval-requests/${retrievalRequestId}/payment-status`, payload);
  return response.data;
}

export async function updateRetrievalStatus(
  retrievalRequestId: number,
  payload: RetrievalStatusPayload,
): Promise<RetrievalRequest> {
  const response = await api.patch(`/api/retrieval-requests/${retrievalRequestId}/status`, payload);
  return response.data?.retrieval_request;
}

export async function issueRetrievalDownloadLink(retrievalRequestId: number): Promise<RetrievalDownload> {
  const response = await api.post(`/api/retrieval-requests/${retrievalRequestId}/issue-download-link`);
  return response.data?.download;
}
