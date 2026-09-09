import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  CheckCircle2,
  Clock,
  CreditCard,
  Download,
  HardDrive,
  Lock,
  ShieldCheck,
  ShieldOff,
  Smartphone,
} from 'lucide-react';
import { PaymentSummaryCard } from '../components/PaymentSummaryCard';
import { getApiStyleErrorMessage } from '../lib/httpErrors';
import { buildArchivePaymentSummary, formatCurrencyAmount } from '../lib/payment';
import {
  createRetrievalRequest,
  fetchRetrievalRequestDetail,
  fetchMyRetrievalRequests,
  initiateRetrievalCheckout,
  initiateRetrievalExtensionCheckout,
  type RetrievalCheckoutResponse,
  type RetrievalRequest,
} from '../lib/retrieval';
import {
  fetchMyDevices,
  downloadVaultArchivePackage,
  fetchMyVaultArchives,
  formatDeviceTypeLabel,
  type PortalDevice,
  type VaultArchive,
} from '../lib/userPortal';

function formatDateTime(value?: string | null): string {
  if (!value) {
    return 'Not set';
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

function describeLifecycle(archive: VaultArchive): string {
  if (archive.deleted_at) {
    return `Deleted on ${formatDateTime(archive.deleted_at)}.`;
  }
  if (archive.extended_until) {
    return `Extended until ${formatDateTime(archive.extended_until)}.`;
  }
  if (archive.storage_expires_at) {
    return `Stored until ${formatDateTime(archive.storage_expires_at)}.`;
  }
  if (archive.download?.expires_at) {
    return `Download link expires ${formatDateTime(archive.download.expires_at)}.`;
  }
  return 'Retention dates will appear here once staff prepare your archive.';
}

function formatRetrievalStageLabel(value?: string | null): string {
  const normalized = (value || '').trim().toLowerCase();
  switch (normalized) {
    case 'paid':
      return 'Paid';
    case 'payment_pending':
      return 'Payment Pending';
    case 'processing':
      return 'Processing';
    case 'ready':
      return 'Ready';
    case 'completed':
      return 'Completed';
    case 'expired':
      return 'Expired';
    case 'deleted':
      return 'Deleted';
    default:
      return normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : 'Pending';
  }
}

function formatDeviceName(device: PortalDevice): string {
  const fallback = formatDeviceTypeLabel(device.device_type);
  const rawName = (device.name || fallback).trim();
  const normalizedName = rawName
    .replace(/[_-]+/g, ' ')
    .replace(/\s*#\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return normalizedName
    .split(' ')
    .map((part) => {
      if (/^iphone$/i.test(part)) return 'iPhone';
      if (/^ipad$/i.test(part)) return 'iPad';
      if (/^macbook$/i.test(part)) return 'MacBook';
      return part ? part.charAt(0).toUpperCase() + part.slice(1) : part;
    })
    .join(' ');
}

function formatConditionLabel(condition?: string | null): string {
  const normalized = (condition || '').trim().toLowerCase();
  switch (normalized) {
    case 'new':
      return 'New condition';
    case 'good':
      return 'Good condition';
    case 'fair':
      return 'Fair condition';
    case 'poor':
      return 'Needs repair';
    case 'broken':
      return 'Not working';
    default:
      return 'Condition to be checked';
  }
}

function formatClassificationHint(classification?: string | null): string {
  switch ((classification || '').trim().toLowerCase()) {
    case 'current':
      return 'Current model';
    case 'rare':
      return 'May have resale value';
    case 'recycle':
      return 'Ready for recycling';
    default:
      return 'Awaiting review';
  }
}

function canStartInitialRetrievalCheckout(request: RetrievalRequest): boolean {
  const paymentStatus = (request.payment_status || '').trim().toLowerCase();
  const retrievalStatus = (request.retrieval_status || request.status || '').trim().toLowerCase();
  return ['unpaid', 'failed', 'cancelled', ''].includes(paymentStatus) && ['pending', 'payment_pending'].includes(retrievalStatus);
}

function canStartArchiveInitialCheckout(archive: VaultArchive): boolean {
  const paymentStatus = (archive.payment_status || '').trim().toLowerCase();
  const retrievalStatus = (archive.retrieval_status || archive.status || '').trim().toLowerCase();
  return ['unpaid', 'failed', 'cancelled', ''].includes(paymentStatus) && ['pending', 'locked', 'payment_pending'].includes(retrievalStatus);
}

function canStartArchiveExtensionCheckout(archive: VaultArchive): boolean {
  const paymentStatus = (archive.payment_status || '').trim().toLowerCase();
  const retrievalStatus = (archive.retrieval_status || archive.status || '').trim().toLowerCase();
  const hasRetentionWindow = Boolean(archive.storage_expires_at || archive.extended_until);
  return paymentStatus === 'paid' && !['deleted', 'erased', 'expired'].includes(retrievalStatus) && hasRetentionWindow;
}

function archiveCheckoutKey(archiveId: number): string {
  return `archive:${archiveId}`;
}

function requestCheckoutKey(requestId: number): string {
  return `request:${requestId}`;
}

export function SecurityVaultPage() {
  const [archives, setArchives] = useState<VaultArchive[]>([]);
  const [devices, setDevices] = useState<PortalDevice[]>([]);
  const [retrievalRequests, setRetrievalRequests] = useState<RetrievalRequest[]>([]);
  const [selectedRetrievalDetail, setSelectedRetrievalDetail] = useState<RetrievalRequest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [newRetrievalDeviceId, setNewRetrievalDeviceId] = useState('');
  const [newRetrievalNote, setNewRetrievalNote] = useState('');
  const [creatingRetrieval, setCreatingRetrieval] = useState(false);
  const [downloadingArchiveId, setDownloadingArchiveId] = useState<number | null>(null);
  const [initiatingCheckoutId, setInitiatingCheckoutId] = useState<string | null>(null);
  const [loadingRetrievalDetailId, setLoadingRetrievalDetailId] = useState<number | null>(null);
  const [checkoutDrafts, setCheckoutDrafts] = useState<Record<string, RetrievalCheckoutResponse>>({});

  const loadArchives = async () => {
    setIsLoading(true);
    try {
      const [archiveItems, retrievalItems, deviceItems] = await Promise.all([
        fetchMyVaultArchives(),
        fetchMyRetrievalRequests(),
        fetchMyDevices(),
      ]);
      setArchives(archiveItems);
      setRetrievalRequests(retrievalItems);
      setDevices(deviceItems);
      setNewRetrievalDeviceId((current) => {
        if (current && deviceItems.some((device) => String(device.id) === current)) {
          return current;
        }
        return deviceItems.length > 0 ? String(deviceItems[0].id) : '';
      });
      setErrorMessage('');
    } catch (error: unknown) {
      setErrorMessage(
        getApiStyleErrorMessage(error, 'Could not load your vault archives.'),
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadArchives();
  }, []);

  const handleLoadRetrievalDetail = async (retrievalRequestId: number) => {
    setLoadingRetrievalDetailId(retrievalRequestId);
    setErrorMessage('');
    try {
      const detail = await fetchRetrievalRequestDetail(retrievalRequestId);
      setSelectedRetrievalDetail(detail);
    } catch (error: unknown) {
      setErrorMessage(
        getApiStyleErrorMessage(error, 'Could not load this retrieval request right now.'),
      );
    } finally {
      setLoadingRetrievalDetailId(null);
    }
  };

  const handleCreateRetrievalRequest = async () => {
    const deviceId = Number(newRetrievalDeviceId);
    if (!Number.isInteger(deviceId) || deviceId <= 0) {
      setErrorMessage('Please choose one of your devices before creating a retrieval request.');
      return;
    }

    setCreatingRetrieval(true);
    setErrorMessage('');
    try {
      const retrievalRequest = await createRetrievalRequest(deviceId, newRetrievalNote.trim() || null);
      setNewRetrievalNote('');
      await loadArchives();
      if (retrievalRequest?.id) {
        await handleLoadRetrievalDetail(retrievalRequest.id);
      }
    } catch (error: unknown) {
      setErrorMessage(
        getApiStyleErrorMessage(error, 'Could not create a retrieval request right now.'),
      );
    } finally {
      setCreatingRetrieval(false);
    }
  };

  const handleSecureDownload = async (archive: VaultArchive) => {
    setDownloadingArchiveId(archive.id);
    setErrorMessage('');

    try {
      await downloadVaultArchivePackage(archive);
      await loadArchives();
    } catch (error: unknown) {
      setErrorMessage(
        getApiStyleErrorMessage(error, 'Could not download this vault archive right now.'),
      );
    } finally {
      setDownloadingArchiveId(null);
    }
  };

  const handleCheckout = async (
    archive: VaultArchive,
    provider: 'paypal' | 'stripe',
    mode: 'initial' | 'extension',
  ) => {
    const checkoutKey = archiveCheckoutKey(archive.id);
    setInitiatingCheckoutId(checkoutKey);
    setErrorMessage('');

    try {
      const response =
        mode === 'extension'
          ? await initiateRetrievalExtensionCheckout(archive.id, {
              provider,
              amount: archive.final_price ?? archive.quoted_price ?? undefined,
              currency: 'GBP',
            })
          : await initiateRetrievalCheckout(archive.id, {
              provider,
              amount: archive.final_price ?? archive.quoted_price ?? undefined,
              currency: 'GBP',
            });

      setCheckoutDrafts((current) => ({
        ...current,
        [checkoutKey]: response,
      }));
      await loadArchives();
    } catch (error: unknown) {
      setErrorMessage(
        getApiStyleErrorMessage(
          error,
          mode === 'extension'
            ? 'Could not start the extension checkout right now.'
            : 'Could not start the payment checkout right now.',
        ),
      );
    } finally {
      setInitiatingCheckoutId(null);
    }
  };

  const handleRetrievalRequestCheckout = async (
    request: RetrievalRequest,
    provider: 'paypal' | 'stripe',
  ) => {
    const checkoutKey = requestCheckoutKey(request.id);
    setInitiatingCheckoutId(checkoutKey);
    setErrorMessage('');

    try {
      const response = await initiateRetrievalCheckout(request.id, {
        provider,
        amount: request.final_price ?? request.quoted_price ?? undefined,
        currency: 'GBP',
      });

      setCheckoutDrafts((current) => ({
        ...current,
        [checkoutKey]: response,
      }));
      await loadArchives();
      await handleLoadRetrievalDetail(request.id);
    } catch (error: unknown) {
      setErrorMessage(
        getApiStyleErrorMessage(error, 'Could not start the payment checkout right now.'),
      );
    } finally {
      setInitiatingCheckoutId(null);
    }
  };

  const archiveCards = archives.map((archive, index) => {
    const status = (archive.status || '').toLowerCase();
    const isActive = status === 'active';
    const isLocked = status === 'pending' || status === 'locked';
    const isErased = status === 'deleted' || status === 'erased';
    const isExtended = Boolean(archive.extended_until);
    const checkoutKey = archiveCheckoutKey(archive.id);
    const checkoutDraft = checkoutDrafts[checkoutKey];
    const canInitialCheckout = canStartArchiveInitialCheckout(archive);
    const canExtensionCheckout = canStartArchiveExtensionCheckout(archive);

    const label = isErased
      ? 'Deleted'
      : isLocked
        ? 'Locked'
        : isExtended
          ? 'Extended'
          : isActive
            ? 'Active'
            : 'Archived';
    const icon = isErased ? ShieldOff : isLocked ? Lock : ShieldCheck;
    const iconBoxClass = isErased
      ? 'bg-slate-200/60 text-slate-400'
      : isLocked
        ? 'bg-amber-50 text-amber-600'
        : 'bg-emerald-50 text-emerald-600';
    const badgeClass = isErased
      ? 'bg-slate-200 text-slate-500 border-slate-300'
      : isLocked
        ? 'bg-amber-50 text-amber-600 border-amber-100'
        : 'bg-emerald-50 text-emerald-600 border-emerald-100';

    const CardIcon = icon;
    const deviceName = archive.device?.name || `Archive ${archive.id}`;
    const paymentSummary = buildArchivePaymentSummary(archive);
    const archiveDate = archive.created_at
      ? new Date(archive.created_at).toLocaleDateString('en-GB', {
          month: 'short',
          day: '2-digit',
          year: 'numeric',
        })
      : 'Pending';

    return (
      <motion.div
        key={archive.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 + index * 0.08 }}
        className={`rounded-[2.5rem] border overflow-hidden flex flex-col h-full ${
          isErased
            ? 'bg-slate-50 border-slate-200 opacity-75'
            : 'bg-white shadow-[0_32px_64px_-16px_rgba(0,0,0,0.06)] border-slate-100/50'
        }`}
      >
        <div className="p-8 pb-6 flex-grow">
          <div className="flex items-start justify-between mb-6">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${iconBoxClass}`}>
              <CardIcon className="w-8 h-8" />
            </div>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${badgeClass}`}>
              <CardIcon className="w-3.5 h-3.5" /> {label}
            </span>
          </div>

          <h3 className="text-xl font-black text-slate-900 mb-2">{deviceName}</h3>
          <div className="flex items-center gap-2 text-sm font-bold text-slate-500 mb-4">
            <Clock className="w-4 h-4" /> Created {archiveDate}
          </div>

          <div className="p-4 rounded-2xl border mb-3 bg-slate-50 border-slate-100">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-bold text-slate-400 uppercase">Retrieval Status</span>
              <span className="text-sm font-black text-slate-700">
                {(archive.retrieval_status || archive.status || 'pending').toUpperCase()}
              </span>
            </div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-bold text-slate-400 uppercase">Payment</span>
              <span className="text-sm font-black text-slate-700">
                {(archive.payment_status || 'unpaid').toUpperCase()}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-400 uppercase">Final Price</span>
              <span className="text-sm font-black text-slate-700">
                {formatCurrencyAmount(archive.final_price ?? archive.quoted_price ?? null)}
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4 text-sm font-medium text-slate-500">
            <p className="mb-2 text-xs font-black uppercase tracking-widest text-slate-400">Lifecycle</p>
            <p>{describeLifecycle(archive)}</p>
          </div>

          {archive.note ? (
            <div className="mt-4 rounded-2xl border border-slate-100 bg-white px-4 py-3 text-sm font-medium text-slate-500">
              {archive.note}
            </div>
          ) : null}

          <div className="mt-4">
            <PaymentSummaryCard
              summary={paymentSummary}
              title="Payment Status"
              subtitle="Payment and retention details will stay up to date as your archive is prepared."
            />
          </div>
        </div>

        <div className="p-6 pt-0 mt-auto space-y-3">
          {isActive && archive.download ? (
            <button
              type="button"
              onClick={() => void handleSecureDownload(archive)}
              disabled={downloadingArchiveId === archive.id}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-400 disabled:cursor-not-allowed text-white rounded-2xl font-bold transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2"
            >
              <Download className="w-5 h-5" />
              {downloadingArchiveId === archive.id ? 'Preparing Download...' : 'Secure Download'}
            </button>
          ) : null}

          {canInitialCheckout ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => void handleCheckout(archive, 'paypal', 'initial')}
                  disabled={initiatingCheckoutId === checkoutKey}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-[#003087] py-3 text-sm font-bold text-white transition-colors hover:bg-[#002266] disabled:opacity-60"
                >
                  <CreditCard className="w-4 h-4" />
                  {initiatingCheckoutId === checkoutKey ? 'Starting...' : 'PayPal'}
                </button>
                <button
                  type="button"
                  onClick={() => void handleCheckout(archive, 'stripe', 'initial')}
                  disabled={initiatingCheckoutId === checkoutKey}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-[#635BFF] py-3 text-sm font-bold text-white transition-colors hover:bg-[#4B44D4] disabled:opacity-60"
                >
                  <CreditCard className="w-4 h-4" />
                  {initiatingCheckoutId === checkoutKey ? 'Starting...' : 'Stripe'}
                </button>
              </div>
            </div>
          ) : null}

          {canExtensionCheckout ? (
            <button
              type="button"
              onClick={() => void handleCheckout(archive, 'stripe', 'extension')}
              disabled={initiatingCheckoutId === checkoutKey}
              className="w-full rounded-2xl border border-slate-200 bg-white py-3 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
            >
              {initiatingCheckoutId === checkoutKey ? 'Preparing Extension...' : 'Extend Retention'}
            </button>
          ) : null}

          {checkoutDraft ? (
            <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-4 text-sm text-blue-900">
              <p className="font-black mb-2">Checkout Created</p>
              <p className="font-medium mb-3">
                Reference: <span className="font-black">{checkoutDraft.checkout.checkout_reference || 'Pending'}</span>
              </p>
              <div className="grid grid-cols-2 gap-3">
                <a
                  href={checkoutDraft.checkout.success_url}
                  className="rounded-xl bg-emerald-600 px-3 py-2 text-center font-bold text-white hover:bg-emerald-500"
                >
                  Continue Payment
                </a>
                <a
                  href={checkoutDraft.checkout.cancel_url}
                  className="rounded-xl bg-white px-3 py-2 text-center font-bold text-slate-700 hover:bg-slate-50"
                >
                  Cancel Payment
                </a>
              </div>
            </div>
          ) : null}
        </div>
      </motion.div>
    );
  });

  const retrievalRequestCards = retrievalRequests.map((request, index) => {
    const checkoutKey = requestCheckoutKey(request.id);
    const checkoutDraft = checkoutDrafts[checkoutKey];
    const canCheckout = canStartInitialRetrievalCheckout(request);

    const paymentSummary = buildArchivePaymentSummary({
      id: request.id,
      device_id: request.device_id,
      consumer_id: request.consumer_id,
      status: request.status,
      retrieval_status: request.retrieval_status,
      quoted_price: request.quoted_price ?? null,
      final_price: request.final_price ?? null,
      payment_provider: request.payment_provider ?? null,
      payment_status: request.payment_status ?? null,
      payment_reference: request.payment_reference ?? null,
      storage_expires_at: request.storage_expires_at ?? null,
      extended_until: request.extended_until ?? null,
      deleted_at: request.deleted_at ?? null,
      assigned_staff_id: request.assigned_staff_id ?? null,
      note: request.note ?? null,
      created_at: request.created_at ?? null,
      download: request.download
        ? {
            retrieval_request_id: request.download.retrieval_request_id,
            token: request.download.token,
            download_url: request.download.download_url,
            issued_at: request.download.issued_at ?? null,
            created_at: request.download.created_at ?? null,
            expires_at: request.download.expires_at ?? null,
            revoked_at: request.download.revoked_at ?? null,
            consumed_at: request.download.consumed_at ?? null,
          }
        : null,
      device: request.device
        ? {
            id: request.device.id,
            name: request.device.name,
            device_type: request.device.device_type,
            condition: request.device.condition ?? 'unknown',
            classification: request.device.classification ?? 'unknown',
            workflow_status: request.device.workflow_status ?? 'pending',
            created_at: request.device.created_at ?? null,
          }
        : null,
    });

    return (
      <motion.div
        key={request.id}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 + index * 0.05 }}
        className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm"
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1">Retrieval Request</p>
            <h3 className="text-xl font-black text-slate-900">#{request.id}</h3>
          </div>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-600">
            {formatRetrievalStageLabel(request.retrieval_status || request.status)}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
            <p className="text-xs font-black uppercase tracking-widest text-slate-400">Device</p>
            <p className="mt-1 text-sm font-bold text-slate-900">{request.device?.name || `Device #${request.device_id}`}</p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
            <p className="text-xs font-black uppercase tracking-widest text-slate-400">Payment</p>
            <p className="mt-1 text-sm font-bold text-slate-900">{(request.payment_status || 'unpaid').toUpperCase()}</p>
          </div>
        </div>

        <PaymentSummaryCard
          summary={paymentSummary}
          title="Retrieval Status"
          subtitle="Payment details will appear here once a checkout is started."
        />

        <button
          type="button"
          onClick={() => void handleLoadRetrievalDetail(request.id)}
          disabled={loadingRetrievalDetailId === request.id}
          className="mt-4 w-full rounded-2xl border border-slate-200 bg-white py-3 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
        >
          {loadingRetrievalDetailId === request.id ? 'Loading Detail...' : 'View Retrieval Detail'}
        </button>

        {canCheckout ? (
          <div className="mt-3 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => void handleRetrievalRequestCheckout(request, 'paypal')}
                disabled={initiatingCheckoutId === checkoutKey}
                className="flex items-center justify-center gap-2 rounded-2xl bg-[#003087] py-3 text-sm font-bold text-white transition-colors hover:bg-[#002266] disabled:opacity-60"
              >
                <CreditCard className="w-4 h-4" />
                {initiatingCheckoutId === checkoutKey ? 'Starting...' : 'PayPal'}
              </button>
              <button
                type="button"
                onClick={() => void handleRetrievalRequestCheckout(request, 'stripe')}
                disabled={initiatingCheckoutId === checkoutKey}
                className="flex items-center justify-center gap-2 rounded-2xl bg-[#635BFF] py-3 text-sm font-bold text-white transition-colors hover:bg-[#4B44D4] disabled:opacity-60"
              >
                <CreditCard className="w-4 h-4" />
                {initiatingCheckoutId === checkoutKey ? 'Starting...' : 'Stripe'}
              </button>
            </div>
            <p className="text-xs font-medium text-slate-500">
              Choose a payment option to continue preparing this archive.
            </p>
          </div>
        ) : null}

        {checkoutDraft ? (
          <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-4 text-sm text-blue-900">
            <p className="font-black mb-2">Checkout Created</p>
            <p className="font-medium mb-3">
              Reference: <span className="font-black">{checkoutDraft.checkout.checkout_reference || 'Pending'}</span>
            </p>
            <div className="grid grid-cols-2 gap-3">
              <a
                href={checkoutDraft.checkout.success_url}
                className="rounded-xl bg-emerald-600 px-3 py-2 text-center font-bold text-white hover:bg-emerald-500"
              >
                Continue Payment
              </a>
              <a
                href={checkoutDraft.checkout.cancel_url}
                className="rounded-xl bg-white px-3 py-2 text-center font-bold text-slate-700 hover:bg-slate-50"
              >
                Cancel Payment
              </a>
            </div>
          </div>
        ) : null}
      </motion.div>
    );
  });

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-emerald-100 text-emerald-600 rounded-2xl">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Security Vault</h1>
          </div>
          <p className="text-slate-500 font-medium text-lg max-w-2xl">
            Request a secure archive, follow its retention dates, and download it once the team releases it.
          </p>
        </div>
      </div>

      {!isLoading ? (
        <section className="rounded-[2.5rem] border border-slate-100 bg-white p-8 shadow-sm">
          <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">New Archive Request</p>
              <h2 className="text-2xl font-black text-slate-900">Request Your Secure Archive</h2>
              <p className="mt-3 text-slate-500 font-medium leading-relaxed">
                Choose the device whose saved data you want returned. The team will prepare the archive and keep you updated here.
              </p>

              <div className="mt-6 rounded-[2rem] border border-emerald-100 bg-emerald-50/60 px-5 py-5">
                <p className="text-xs font-black uppercase tracking-widest text-emerald-700">What Happens Next</p>
                <div className="mt-4 space-y-3 text-sm font-medium text-slate-600">
                  <div className="flex gap-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <p>Staff confirm the device and prepare the archive.</p>
                  </div>
                  <div className="flex gap-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <p>You complete payment if it is required for this retrieval.</p>
                  </div>
                  <div className="flex gap-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <p>Your secure download appears in the vault when it is ready.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-5">
              <fieldset className="space-y-3" disabled={creatingRetrieval}>
                <legend className="mb-2 block text-xs font-black uppercase tracking-widest text-slate-400">
                  Choose a Device
                </legend>

                {devices.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-5 text-sm font-medium text-slate-500">
                    No devices are available for archive retrieval yet.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {devices.map((device) => {
                      const isSelected = String(device.id) === newRetrievalDeviceId;

                      return (
                        <button
                          key={device.id}
                          type="button"
                          onClick={() => setNewRetrievalDeviceId(String(device.id))}
                          aria-pressed={isSelected}
                          className={`group flex min-h-28 w-full items-start gap-3 rounded-2xl border px-4 py-4 text-left transition-all ${
                            isSelected
                              ? 'border-emerald-300 bg-emerald-50 shadow-sm ring-4 ring-emerald-500/10'
                              : 'border-slate-200 bg-white hover:border-emerald-200 hover:bg-emerald-50/40'
                          } disabled:cursor-not-allowed disabled:opacity-60`}
                          disabled={creatingRetrieval}
                        >
                          <span
                            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                              isSelected ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            <Smartphone className="h-5 w-5" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-black text-slate-900">
                              {formatDeviceName(device)}
                            </span>
                            <span className="mt-1 block text-xs font-medium text-slate-500">
                              {formatDeviceTypeLabel(device.device_type)} - {formatConditionLabel(device.condition)}
                            </span>
                            <span className="mt-3 flex flex-wrap gap-2">
                              <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600">
                                {formatClassificationHint(device.classification)}
                              </span>
                              {isSelected ? (
                                <span className="rounded-full border border-emerald-200 bg-white px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                                  Selected
                                </span>
                              ) : null}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </fieldset>

              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Selected Device</p>
                <p className="mt-2 text-sm font-medium text-slate-600">
                  {(() => {
                    const selectedDevice = devices.find((device) => String(device.id) === newRetrievalDeviceId);
                    return selectedDevice
                      ? `${formatDeviceName(selectedDevice)} is listed as ${formatClassificationHint(
                          selectedDevice.classification,
                        ).toLowerCase()}.`
                      : 'Choose a device above to continue.';
                  })()}
                </p>
              </div>

              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-widest text-slate-400">Note For Staff</span>
                <textarea
                  value={newRetrievalNote}
                  onChange={(event) => setNewRetrievalNote(event.target.value)}
                  rows={3}
                  placeholder="Add anything staff should know before preparing your archive."
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-emerald-400"
                  disabled={creatingRetrieval}
                />
              </label>

              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <button
                  type="button"
                  onClick={() => void handleCreateRetrievalRequest()}
                  disabled={creatingRetrieval || devices.length === 0}
                  className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-300"
                >
                  {creatingRetrieval ? 'Sending Request...' : 'Request Archive'}
                </button>
                <p className="text-sm font-medium text-slate-500">
                  {devices.length === 1 ? '1 device available' : `${devices.length} devices available`}
                </p>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {!isLoading && retrievalRequestCards.length > 0 ? (
        <section className="space-y-5">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">My Archives</p>
            <h2 className="text-2xl font-black text-slate-900">Archive Requests</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">{retrievalRequestCards}</div>

          {selectedRetrievalDetail ? (
            <div className="rounded-[2.5rem] border border-slate-100 bg-white p-8 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-5">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Retrieval Detail</p>
                  <h3 className="text-2xl font-black text-slate-900">Request #{selectedRetrievalDetail.id}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedRetrievalDetail(null)}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                >
                  Close Detail
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
                <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400">Device</p>
                  <p className="mt-1 text-sm font-bold text-slate-900">
                    {selectedRetrievalDetail.device?.name || `#${selectedRetrievalDetail.device_id}`}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400">Status</p>
                  <p className="mt-1 text-sm font-bold text-slate-900">
                    {(selectedRetrievalDetail.status || 'pending').toUpperCase()}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400">Retrieval</p>
                  <p className="mt-1 text-sm font-bold text-slate-900">
                    {formatRetrievalStageLabel(selectedRetrievalDetail.retrieval_status)}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400">Payment</p>
                  <p className="mt-1 text-sm font-bold text-slate-900">
                    {(selectedRetrievalDetail.payment_status || 'unpaid').toUpperCase()}
                  </p>
                </div>
              </div>

              <PaymentSummaryCard
                summary={buildArchivePaymentSummary({
                  id: selectedRetrievalDetail.id,
                  device_id: selectedRetrievalDetail.device_id,
                  consumer_id: selectedRetrievalDetail.consumer_id,
                  status: selectedRetrievalDetail.status,
                  retrieval_status: selectedRetrievalDetail.retrieval_status,
                  quoted_price: selectedRetrievalDetail.quoted_price ?? null,
                  final_price: selectedRetrievalDetail.final_price ?? null,
                  payment_provider: selectedRetrievalDetail.payment_provider ?? null,
                  payment_status: selectedRetrievalDetail.payment_status ?? null,
                  payment_reference: selectedRetrievalDetail.payment_reference ?? null,
                  storage_expires_at: selectedRetrievalDetail.storage_expires_at ?? null,
                  extended_until: selectedRetrievalDetail.extended_until ?? null,
                  deleted_at: selectedRetrievalDetail.deleted_at ?? null,
                  assigned_staff_id: selectedRetrievalDetail.assigned_staff_id ?? null,
                  note: selectedRetrievalDetail.note ?? null,
                  created_at: selectedRetrievalDetail.created_at ?? null,
                  download: selectedRetrievalDetail.download
                    ? {
                        retrieval_request_id: selectedRetrievalDetail.download.retrieval_request_id,
                        token: selectedRetrievalDetail.download.token,
                        download_url: selectedRetrievalDetail.download.download_url,
                        issued_at: selectedRetrievalDetail.download.issued_at ?? null,
                        created_at: selectedRetrievalDetail.download.created_at ?? null,
                        expires_at: selectedRetrievalDetail.download.expires_at ?? null,
                        revoked_at: selectedRetrievalDetail.download.revoked_at ?? null,
                        consumed_at: selectedRetrievalDetail.download.consumed_at ?? null,
                      }
                    : null,
                  device: selectedRetrievalDetail.device
                    ? {
                        id: selectedRetrievalDetail.device.id,
                        name: selectedRetrievalDetail.device.name,
                        device_type: selectedRetrievalDetail.device.device_type,
                        condition: selectedRetrievalDetail.device.condition ?? 'unknown',
                        classification: selectedRetrievalDetail.device.classification ?? 'unknown',
                        workflow_status: selectedRetrievalDetail.device.workflow_status ?? 'pending',
                        created_at: selectedRetrievalDetail.device.created_at ?? null,
                      }
                    : null,
                })}
                title="Retrieval Detail"
                subtitle="The latest payment and archive readiness information for this request."
              />
            </div>
          ) : null}
        </section>
      ) : null}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-[360px] rounded-[2.5rem] border border-slate-100 bg-white animate-pulse" />
          ))}
        </div>
      ) : errorMessage ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[2.5rem] border border-red-100 bg-red-50 px-10 py-12 text-center text-red-600"
        >
          <p className="text-lg font-black mb-2">Vault Unavailable</p>
          <p className="font-medium">{errorMessage}</p>
        </motion.div>
      ) : archiveCards.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{archiveCards}</div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[2.5rem] border border-dashed border-slate-200 bg-slate-50/60 px-10 py-16 text-center"
        >
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-white shadow-sm">
            <HardDrive className="h-9 w-9 text-slate-400" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 mb-2">No Vault Archives Yet</h2>
          <p className="text-slate-500 font-medium max-w-xl mx-auto">
            Choose paid data retrieval during a recycling request and your secure archive will appear here once it has been created.
          </p>
        </motion.div>
      )}
    </div>
  );
}
