import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  ClipboardList,
  Cpu,
  Eye,
  EyeOff,
  Link2,
  Loader2,
  NotebookPen,
  Shield,
  Workflow,
} from 'lucide-react';
import api from '../../api/axios';
import { getStoredUser, type AuthUser } from '../lib/auth';
import { getApiStyleErrorMessage } from '../lib/httpErrors';
import {
  fetchRetrievalRequestDetail,
  issueRetrievalDownloadLink,
  toPaymentSummary,
  updateRetrievalStatus,
  type RetrievalDownload,
  type RetrievalRequest,
} from '../lib/retrieval';
import { PaymentSummaryCard } from '../components/PaymentSummaryCard';
import {
  createWipeCertificate,
  createWipeJob,
  createStaffDevice,
  createStaffRequest,
  createReferralFee,
  fetchReferralActivity,
  fetchRewardPartners,
  fetchPaymentReportSummary,
  fetchPaymentReportTransactions,
  fetchReferralActivityReport,
  fetchWipeJobDetail,
  fetchWipeJobs,
  fetchReferralFees,
  fetchReferralSummary,
  formatDeviceTypeLabel,
  recordStaffReferralEvent,
  updateReferralFee,
  updateWipeJob,
  type PaymentReportSummary,
  type PaymentReportTransaction,
  type ReferralActivityRecord,
  type ReferralCode,
  type ReferralFee,
  type ReferralFeeStatus,
  type RewardPartner,
  type ReferralSummary,
  type WipeJob,
  type WipeJobStatus,
  type WipeJobType,
  type WipeJobVerificationStatus,
} from '../lib/userPortal';

type DeviceStats = {
  totals?: {
    devices?: number;
    visible?: number;
    hidden?: number;
    draft?: number;
    non_draft?: number;
  };
  processing_status?: Record<string, number>;
  workflow_status?: Record<string, number>;
  classification?: Record<string, number>;
};

type StaffRequest = {
  id: number;
  consumer_id: number;
  preferred_method: string;
  status: string;
  created_at?: string | null;
  device?: {
    id: number;
    name: string;
    device_type: string;
    classification: string;
    workflow_status: string;
  } | null;
};

type AdminUser = {
  id: number;
  email: string;
  full_name?: string | null;
  role: string;
  auth_provider?: string | null;
  created_at?: string | null;
};

type StaffDevice = {
  id: number;
  owner_id: number;
  name: string;
  device_type: string;
  classification: string;
  workflow_status: string;
  processing_status?: string | null;
  is_visible?: boolean;
  is_draft?: boolean;
  condition?: string | null;
  age_years?: number | null;
  demand?: string | null;
  notes?: string | null;
  owner_contacted?: boolean;
  contact_notes?: string | null;
};

const REQUEST_STATUS_OPTIONS = ['submitted', 'approved', 'rejected', 'completed'] as const;
const MANAGEABLE_ROLE_OPTIONS = ['consumer', 'staff'] as const;
const CLASSIFICATION_OPTIONS = ['current', 'recycle', 'rare', 'unwanted', 'unknown'] as const;
const PROCESSING_STATUS_OPTIONS = ['pending', 'processing', 'done', 'rejected'] as const;
const RETRIEVAL_STATUS_OPTIONS = ['pending', 'payment_pending', 'processing', 'ready', 'completed', 'expired', 'deleted'] as const;
const WIPE_JOB_STATUS_OPTIONS = ['queued', 'in_progress', 'completed', 'failed', 'cancelled'] as const;
const WIPE_JOB_VERIFICATION_OPTIONS = ['pending', 'verified', 'unverified', 'failed'] as const;
const WIPE_JOB_TYPE_OPTIONS = ['standard', 'secure_erase', 'factory_reset', 'manual'] as const;
const STAFF_REFERRAL_EVENT_OPTIONS = ['handin_confirmed', 'resale_confirmed', 'fee_recorded'] as const;
const REFERRAL_FEE_STATUS_OPTIONS = ['expected', 'pending', 'confirmed', 'paid', 'cancelled'] as const;
const REQUEST_METHOD_OPTIONS = ['dropoff', 'pickup'] as const;
const REQUEST_CATEGORY_OPTIONS = ['phone', 'laptop', 'tablet', 'console', 'other'] as const;
const REQUEST_CONDITION_OPTIONS = ['working', 'broken', 'unknown'] as const;
const REQUEST_DEMAND_OPTIONS = ['high', 'medium', 'low'] as const;
const REQUEST_STATUS_DRAFT_OPTIONS = ['submitted', 'approved'] as const;
const REQUEST_WORKFLOW_OPTIONS = ['pending', 'processing', 'completed'] as const;
const PAYMENT_REPORT_STATUS_OPTIONS = ['all', 'initiated', 'pending', 'paid', 'failed', 'cancelled', 'refunded'] as const;
const PAYMENT_REPORT_PROVIDER_OPTIONS = ['all', 'stripe', 'paypal'] as const;
const PAYMENT_REPORT_KIND_OPTIONS = ['all', 'initial_retrieval', 'extension'] as const;
const REWARD_PARTNER_FILTER_OPTIONS = ['all', 'current', 'rare'] as const;

function formatMoney(amount?: number | null, currency = 'GBP'): string {
  if (typeof amount !== 'number' || Number.isNaN(amount)) {
    return '-';
  }
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: currency || 'GBP',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDateTime(value?: string | null): string {
  if (!value) {
    return '-';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function StaffPortalPage() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => getStoredUser());
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [deviceStats, setDeviceStats] = useState<DeviceStats | null>(null);
  const [requests, setRequests] = useState<StaffRequest[]>([]);
  const [unknownRequests, setUnknownRequests] = useState<StaffRequest[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [devices, setDevices] = useState<StaffDevice[]>([]);
  const [unknownDevices, setUnknownDevices] = useState<StaffDevice[]>([]);
  const [updatingRequestId, setUpdatingRequestId] = useState<number | null>(null);
  const [updatingUserId, setUpdatingUserId] = useState<number | null>(null);
  const [updatingDeviceId, setUpdatingDeviceId] = useState<number | null>(null);
  const [retrievalLookupId, setRetrievalLookupId] = useState('');
  const [retrievalRecord, setRetrievalRecord] = useState<RetrievalRequest | null>(null);
  const [issuedDownload, setIssuedDownload] = useState<RetrievalDownload | null>(null);
  const [retrievalDraftStatus, setRetrievalDraftStatus] = useState('pending');
  const [retrievalDraftNote, setRetrievalDraftNote] = useState('');
  const [isLoadingRetrieval, setIsLoadingRetrieval] = useState(false);
  const [isSavingRetrieval, setIsSavingRetrieval] = useState(false);
  const [isIssuingDownload, setIsIssuingDownload] = useState(false);
  const [paymentReportSummary, setPaymentReportSummary] = useState<PaymentReportSummary | null>(null);
  const [paymentReportTransactions, setPaymentReportTransactions] = useState<PaymentReportTransaction[]>([]);
  const [paymentReportFromFilter, setPaymentReportFromFilter] = useState('');
  const [paymentReportToFilter, setPaymentReportToFilter] = useState('');
  const [paymentReportStatusFilter, setPaymentReportStatusFilter] = useState<string>('all');
  const [paymentReportProviderFilter, setPaymentReportProviderFilter] = useState<string>('all');
  const [paymentReportKindFilter, setPaymentReportKindFilter] = useState<string>('all');
  const [isLoadingPaymentReports, setIsLoadingPaymentReports] = useState(false);
  const [wipeJobs, setWipeJobs] = useState<WipeJob[]>([]);
  const [wipeJobLookupId, setWipeJobLookupId] = useState('');
  const [wipeJobRecord, setWipeJobRecord] = useState<WipeJob | null>(null);
  const [wipeJobDeviceId, setWipeJobDeviceId] = useState('');
  const [wipeJobRequestId, setWipeJobRequestId] = useState('');
  const [wipeJobDraftType, setWipeJobDraftType] = useState<WipeJobType>('standard');
  const [wipeJobDraftStatus, setWipeJobDraftStatus] = useState<WipeJobStatus>('queued');
  const [wipeJobDraftVerificationStatus, setWipeJobDraftVerificationStatus] = useState<WipeJobVerificationStatus>('pending');
  const [wipeJobDraftNotes, setWipeJobDraftNotes] = useState('');
  const [wipeCertificateReference, setWipeCertificateReference] = useState('');
  const [wipeCertificateUrl, setWipeCertificateUrl] = useState('');
  const [wipeCertificateStorageKey, setWipeCertificateStorageKey] = useState('');
  const [wipeCertificateExpiresAt, setWipeCertificateExpiresAt] = useState('');
  const [isLoadingWipeJobs, setIsLoadingWipeJobs] = useState(false);
  const [isLoadingWipeJobDetail, setIsLoadingWipeJobDetail] = useState(false);
  const [isCreatingWipeJob, setIsCreatingWipeJob] = useState(false);
  const [isUpdatingWipeJob, setIsUpdatingWipeJob] = useState(false);
  const [isCreatingWipeCertificate, setIsCreatingWipeCertificate] = useState(false);
  const [referralActivityCodeId, setReferralActivityCodeId] = useState('');
  const [referralActivityType, setReferralActivityType] = useState<(typeof STAFF_REFERRAL_EVENT_OPTIONS)[number]>('handin_confirmed');
  const [referralActivityReference, setReferralActivityReference] = useState('');
  const [referralActivityNotes, setReferralActivityNotes] = useState('');
  const [isRecordingReferralActivity, setIsRecordingReferralActivity] = useState(false);
  const [recordedReferral, setRecordedReferral] = useState<ReferralCode | null>(null);
  const [recordedReferralActivity, setRecordedReferralActivity] = useState<ReferralActivityRecord | null>(null);
  const [referralActivityList, setReferralActivityList] = useState<ReferralActivityRecord[]>([]);
  const [referralActivityReport, setReferralActivityReport] = useState<ReferralActivityRecord[]>([]);
  const [referralFees, setReferralFees] = useState<ReferralFee[]>([]);
  const [referralSummary, setReferralSummary] = useState<ReferralSummary | null>(null);
  const [rewardPartners, setRewardPartners] = useState<RewardPartner[]>([]);
  const [rewardPartnerFilter, setRewardPartnerFilter] = useState<string>('all');
  const [referralReportFromFilter, setReferralReportFromFilter] = useState('');
  const [referralReportToFilter, setReferralReportToFilter] = useState('');
  const [referralPartnerIdFilter, setReferralPartnerIdFilter] = useState('all');
  const [referralPartnerFilter, setReferralPartnerFilter] = useState('');
  const [referralFeeStatusFilter, setReferralFeeStatusFilter] = useState<string>('all');
  const [referralFeeCodeId, setReferralFeeCodeId] = useState('');
  const [referralFeeAmount, setReferralFeeAmount] = useState('');
  const [referralFeeCurrency, setReferralFeeCurrency] = useState('GBP');
  const [referralFeeReference, setReferralFeeReference] = useState('');
  const [referralFeeDueAt, setReferralFeeDueAt] = useState('');
  const [referralFeeActivityId, setReferralFeeActivityId] = useState('');
  const [referralFeeDraftStatus, setReferralFeeDraftStatus] = useState<ReferralFeeStatus>('expected');
  const [isLoadingReferralFees, setIsLoadingReferralFees] = useState(false);
  const [isLoadingReferralActivityList, setIsLoadingReferralActivityList] = useState(false);
  const [isLoadingRewardPartners, setIsLoadingRewardPartners] = useState(false);
  const [isCreatingReferralFee, setIsCreatingReferralFee] = useState(false);
  const [updatingReferralFeeId, setUpdatingReferralFeeId] = useState<number | null>(null);
  const [requestOwnerId, setRequestOwnerId] = useState('');
  const [requestOwnerEmail, setRequestOwnerEmail] = useState('');
  const [deviceOwnerId, setDeviceOwnerId] = useState('');
  const [deviceOwnerEmail, setDeviceOwnerEmail] = useState('');
  const [deviceNameDraft, setDeviceNameDraft] = useState('');
  const [deviceCategoryDraft, setDeviceCategoryDraft] = useState<(typeof REQUEST_CATEGORY_OPTIONS)[number]>('phone');
  const [deviceConditionDraft, setDeviceConditionDraft] = useState<(typeof REQUEST_CONDITION_OPTIONS)[number]>('working');
  const [deviceAgeYearsDraft, setDeviceAgeYearsDraft] = useState('');
  const [deviceDemandDraft, setDeviceDemandDraft] = useState<(typeof REQUEST_DEMAND_OPTIONS)[number]>('medium');
  const [deviceNotesDraft, setDeviceNotesDraft] = useState('');
  const [requestItemName, setRequestItemName] = useState('');
  const [requestCategory, setRequestCategory] = useState<(typeof REQUEST_CATEGORY_OPTIONS)[number]>('phone');
  const [requestCondition, setRequestCondition] = useState<(typeof REQUEST_CONDITION_OPTIONS)[number]>('working');
  const [requestMethod, setRequestMethod] = useState<(typeof REQUEST_METHOD_OPTIONS)[number]>('dropoff');
  const [requestPickupAddress, setRequestPickupAddress] = useState('');
  const [requestContactPhone, setRequestContactPhone] = useState('');
  const [requestScheduledTime, setRequestScheduledTime] = useState('');
  const [requestAgeYears, setRequestAgeYears] = useState('');
  const [requestDemand, setRequestDemand] = useState<(typeof REQUEST_DEMAND_OPTIONS)[number]>('medium');
  const [requestStaffNote, setRequestStaffNote] = useState('');
  const [requestDraftStatus, setRequestDraftStatus] = useState<(typeof REQUEST_STATUS_DRAFT_OPTIONS)[number]>('submitted');
  const [requestWorkflowStatus, setRequestWorkflowStatus] = useState<(typeof REQUEST_WORKFLOW_OPTIONS)[number]>('pending');
  const [isCreatingStaffDevice, setIsCreatingStaffDevice] = useState(false);
  const [isCreatingStaffRequest, setIsCreatingStaffRequest] = useState(false);
  const [unknownQueueDrafts, setUnknownQueueDrafts] = useState<
    Record<number, { classification: string; workflow_status: string }>
  >({});
  const [editingDeviceId, setEditingDeviceId] = useState<number | null>(null);
  const [editDeviceName, setEditDeviceName] = useState('');
  const [editDeviceCategory, setEditDeviceCategory] = useState<(typeof REQUEST_CATEGORY_OPTIONS)[number]>('phone');
  const [editDeviceCondition, setEditDeviceCondition] = useState<(typeof REQUEST_CONDITION_OPTIONS)[number]>('working');
  const [editDeviceAgeYears, setEditDeviceAgeYears] = useState('');
  const [editDeviceDemand, setEditDeviceDemand] = useState<(typeof REQUEST_DEMAND_OPTIONS)[number]>('medium');
  const [editDeviceWorkflowStatus, setEditDeviceWorkflowStatus] = useState<(typeof REQUEST_WORKFLOW_OPTIONS)[number]>('pending');
  const [editDeviceClassification, setEditDeviceClassification] = useState<(typeof CLASSIFICATION_OPTIONS)[number]>('unknown');
  const [editDeviceNotes, setEditDeviceNotes] = useState('');
  const [editDeviceOwnerContacted, setEditDeviceOwnerContacted] = useState(false);
  const [editDeviceContactNotes, setEditDeviceContactNotes] = useState('');

  const loadReferralFees = useCallback(async (nextFilters?: {
    from?: string;
    to?: string;
    partnerId?: string;
    partner?: string;
    status?: string;
  }) => {
    const fromFilter = nextFilters?.from ?? referralReportFromFilter;
    const toFilter = nextFilters?.to ?? referralReportToFilter;
    const partnerIdFilter = nextFilters?.partnerId ?? referralPartnerIdFilter;
    const partnerFilter = nextFilters?.partner ?? referralPartnerFilter;
    const statusFilter = nextFilters?.status ?? referralFeeStatusFilter;
    const status = statusFilter === 'all' ? null : statusFilter;
    const partnerId = partnerIdFilter === 'all' ? null : Number(partnerIdFilter);

    setIsLoadingReferralFees(true);
    try {
      const [fees, summary, activity] = await Promise.all([
        fetchReferralFees({
          from: fromFilter || null,
          to: toFilter || null,
          status,
          partner_id: partnerId,
          partner: partnerFilter || null,
        }),
        fetchReferralSummary({
          from: fromFilter || null,
          to: toFilter || null,
          status,
          partner_id: partnerId,
          partner: partnerFilter || null,
        }),
        fetchReferralActivityReport({
          from: fromFilter || null,
          to: toFilter || null,
          status,
          partner_id: partnerId,
          partner: partnerFilter || null,
        }),
      ]);
      setReferralFees(fees);
      setReferralSummary(summary);
      setReferralActivityReport(activity);
    } catch (error: unknown) {
      setErrorMessage(getApiStyleErrorMessage(error, 'Could not load referral fee data right now.'));
    } finally {
      setIsLoadingReferralFees(false);
    }
  }, [
    referralFeeStatusFilter,
    referralPartnerFilter,
    referralPartnerIdFilter,
    referralReportFromFilter,
    referralReportToFilter,
  ]);

  const loadRewardPartners = useCallback(async (nextFilter?: string) => {
    const filter = nextFilter ?? rewardPartnerFilter;
    setIsLoadingRewardPartners(true);
    try {
      const partners = await fetchRewardPartners(filter === 'all' ? null : filter);
      setRewardPartners(partners);
    } catch (error: unknown) {
      setErrorMessage(getApiStyleErrorMessage(error, 'Could not load reward partner data right now.'));
    } finally {
      setIsLoadingRewardPartners(false);
    }
  }, [rewardPartnerFilter]);

  const loadReferralActivityList = useCallback(async () => {
    setIsLoadingReferralActivityList(true);
    try {
      const activity = await fetchReferralActivity();
      setReferralActivityList(activity);
    } catch (error: unknown) {
      setErrorMessage(getApiStyleErrorMessage(error, 'Could not load referral activity list right now.'));
    } finally {
      setIsLoadingReferralActivityList(false);
    }
  }, []);

  const applyWipeJobToForm = useCallback((wipeJob: WipeJob | null) => {
    if (!wipeJob) {
      setWipeJobDeviceId('');
      setWipeJobRequestId('');
      setWipeJobDraftType('standard');
      setWipeJobDraftStatus('queued');
      setWipeJobDraftVerificationStatus('pending');
      setWipeJobDraftNotes('');
      return;
    }

    setWipeJobDeviceId(String(wipeJob.device_id || ''));
    setWipeJobRequestId(wipeJob.request_id ? String(wipeJob.request_id) : '');
    setWipeJobDraftType((wipeJob.wipe_type as WipeJobType) || 'standard');
    setWipeJobDraftStatus((wipeJob.status as WipeJobStatus) || 'queued');
    setWipeJobDraftVerificationStatus((wipeJob.verification_status as WipeJobVerificationStatus) || 'pending');
    setWipeJobDraftNotes(wipeJob.notes || '');
  }, []);

  const loadWipeJobs = useCallback(async () => {
    setIsLoadingWipeJobs(true);
    try {
      const jobs = await fetchWipeJobs();
      setWipeJobs(jobs);
    } catch (error: unknown) {
      setErrorMessage(getApiStyleErrorMessage(error, 'Could not load wipe job data right now.'));
    } finally {
      setIsLoadingWipeJobs(false);
    }
  }, []);

  const loadPaymentReports = useCallback(async (nextFilters?: {
    from?: string;
    to?: string;
    status?: string;
    provider?: string;
    paymentKind?: string;
  }) => {
    const fromFilter = nextFilters?.from ?? paymentReportFromFilter;
    const toFilter = nextFilters?.to ?? paymentReportToFilter;
    const statusFilter = nextFilters?.status ?? paymentReportStatusFilter;
    const providerFilter = nextFilters?.provider ?? paymentReportProviderFilter;
    const paymentKindFilter = nextFilters?.paymentKind ?? paymentReportKindFilter;

    setIsLoadingPaymentReports(true);
    try {
      const params = {
        from: fromFilter || null,
        to: toFilter || null,
        status: statusFilter === 'all' ? null : statusFilter,
        provider: providerFilter === 'all' ? null : providerFilter,
        payment_kind: paymentKindFilter === 'all' ? null : paymentKindFilter,
      };
      const [summary, transactions] = await Promise.all([
        fetchPaymentReportSummary(params),
        fetchPaymentReportTransactions(params),
      ]);
      setPaymentReportSummary(summary);
      setPaymentReportTransactions(transactions);
    } catch (error: unknown) {
      setErrorMessage(getApiStyleErrorMessage(error, 'Could not load payment report data right now.'));
    } finally {
      setIsLoadingPaymentReports(false);
    }
  }, [
    paymentReportFromFilter,
    paymentReportKindFilter,
    paymentReportProviderFilter,
    paymentReportStatusFilter,
    paymentReportToFilter,
  ]);

  const loadWipeJobRecord = useCallback(async (rawId?: string | number) => {
    const nextId = Number(rawId ?? wipeJobLookupId);
    if (!Number.isFinite(nextId) || nextId <= 0) {
      setErrorMessage('Please enter a valid wipe job ID.');
      return;
    }

    setIsLoadingWipeJobDetail(true);
    setErrorMessage('');
    try {
      const wipeJob = await fetchWipeJobDetail(nextId);
      setWipeJobLookupId(String(nextId));
      setWipeJobRecord(wipeJob);
      applyWipeJobToForm(wipeJob);
    } catch (error: unknown) {
      setErrorMessage(getApiStyleErrorMessage(error, 'Could not load that wipe job right now.'));
      setWipeJobRecord(null);
    } finally {
      setIsLoadingWipeJobDetail(false);
    }
  }, [applyWipeJobToForm, wipeJobLookupId]);

  const loadPortal = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');

    try {
      const meResponse = await api.get('/api/me');
      const nextUser = meResponse.data?.user ?? null;
      setCurrentUser(nextUser);

      const isAdmin = (nextUser?.role || '').toLowerCase() === 'admin';
      const responses = await Promise.all([
        api.get('/api/devices/statistics'),
        api.get('/api/requests'),
        api.get('/api/requests/unknown-queue'),
        api.get('/api/devices'),
        api.get('/api/devices/unknown-queue'),
        isAdmin ? api.get('/api/admin/users') : Promise.resolve({ data: { users: [] } }),
      ]);

      setDeviceStats(responses[0].data ?? null);
      setRequests(responses[1].data?.requests ?? []);
      setUnknownRequests(responses[2].data?.requests ?? []);
      setDevices(responses[3].data?.devices ?? []);
      const nextUnknownDevices = responses[4].data?.devices ?? [];
      setUnknownDevices(nextUnknownDevices);
      setUnknownQueueDrafts(
        nextUnknownDevices.reduce(
          (acc: Record<number, { classification: string; workflow_status: string }>, device: StaffDevice) => {
            acc[device.id] = {
              classification: device.classification && device.classification !== 'unknown' ? device.classification : 'current',
              workflow_status: (device.workflow_status || 'pending').toLowerCase(),
            };
            return acc;
          },
          {},
        ),
      );
      setUsers(responses[5].data?.users ?? []);
      await loadReferralFees({
        from: '',
        to: '',
        partnerId: 'all',
        partner: '',
        status: 'all',
      });
      await loadReferralActivityList();
      await loadRewardPartners('all');
      await loadPaymentReports({
        from: '',
        to: '',
        status: 'all',
        provider: 'all',
        paymentKind: 'all',
      });
      await loadWipeJobs();
    } catch (error: unknown) {
      setErrorMessage(getApiStyleErrorMessage(error, 'Could not load the staff portal right now.'));
    } finally {
      setIsLoading(false);
    }
  }, [
    loadPaymentReports,
    loadReferralActivityList,
    loadReferralFees,
    loadRewardPartners,
    loadWipeJobs,
  ]);

  useEffect(() => {
    void loadPortal();
  }, [loadPortal]);

  const refreshDeviceCollections = async () => {
    const [allDevicesResponse, unknownDevicesResponse, statsResponse] = await Promise.all([
      api.get('/api/devices'),
      api.get('/api/devices/unknown-queue'),
      api.get('/api/devices/statistics'),
    ]);

    setDevices(allDevicesResponse.data?.devices ?? []);
    setUnknownDevices(unknownDevicesResponse.data?.devices ?? []);
    setUnknownQueueDrafts((current) => {
      const next = { ...current };
      const items = unknownDevicesResponse.data?.devices ?? [];
      items.forEach((device: StaffDevice) => {
        next[device.id] = next[device.id] || {
          classification: device.classification && device.classification !== 'unknown' ? device.classification : 'current',
          workflow_status: (device.workflow_status || 'pending').toLowerCase(),
        };
      });
      return next;
    });
    setDeviceStats(statsResponse.data ?? null);
  };

  const refreshWipeJobCollections = async (focusWipeJobId?: number | null) => {
    await loadWipeJobs();
    if (focusWipeJobId) {
      await loadWipeJobRecord(focusWipeJobId);
    }
  };

  const handleRequestStatusChange = async (requestId: number, status: string) => {
    setUpdatingRequestId(requestId);
    setErrorMessage('');
    try {
      await api.patch(`/api/requests/${requestId}/status`, { status });
      setRequests((current) =>
        current.map((request) => (request.id === requestId ? { ...request, status } : request)),
      );
    } catch (error: unknown) {
      setErrorMessage(getApiStyleErrorMessage(error, 'Could not update this request status right now.'));
    } finally {
      setUpdatingRequestId(null);
    }
  };

  const handleUserRoleChange = async (userId: number, role: string) => {
    setUpdatingUserId(userId);
    setErrorMessage('');
    try {
      await api.patch(`/api/admin/users/${userId}/role`, { role });
      setUsers((current) =>
        current.map((user) => (user.id === userId ? { ...user, role } : user)),
      );
    } catch (error: unknown) {
      setErrorMessage(getApiStyleErrorMessage(error, 'Could not update this user role right now.'));
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleDevicePatch = async (
    deviceId: number,
    endpoint: string,
    payload: Record<string, unknown>,
    fallbackMessage: string,
  ) => {
    setUpdatingDeviceId(deviceId);
    setErrorMessage('');
    try {
      await api.patch(endpoint, payload);
      await refreshDeviceCollections();
    } catch (error: unknown) {
      setErrorMessage(getApiStyleErrorMessage(error, fallbackMessage));
    } finally {
      setUpdatingDeviceId(null);
    }
  };

  const handleResolveUnknownQueueItem = async (deviceId: number) => {
    const draft = unknownQueueDrafts[deviceId];
    if (!draft?.classification || draft.classification === 'unknown') {
      setErrorMessage('Please choose a non-unknown classification before resolving this queue item.');
      return;
    }

    setUpdatingDeviceId(deviceId);
    setErrorMessage('');
    try {
      await api.patch(`/api/devices/unknown-queue/${deviceId}`, {
        classification: draft.classification,
        workflow_status: draft.workflow_status,
      });
      await refreshDeviceCollections();
    } catch (error: unknown) {
      setErrorMessage(getApiStyleErrorMessage(error, 'Could not resolve this unknown queue item right now.'));
    } finally {
      setUpdatingDeviceId(null);
    }
  };

  const handleCreateStaffRequest = async () => {
    const trimmedOwnerId = requestOwnerId.trim();
    const trimmedOwnerEmail = requestOwnerEmail.trim();
    const trimmedItemName = requestItemName.trim();

    if (!trimmedOwnerId && !trimmedOwnerEmail) {
      setErrorMessage('Please enter an owner ID or owner email.');
      return;
    }

    if (!trimmedItemName) {
      setErrorMessage('Please enter an item name.');
      return;
    }

    let ownerId: number | null = null;
    if (trimmedOwnerId) {
      const parsedOwnerId = Number(trimmedOwnerId);
      if (!Number.isFinite(parsedOwnerId) || parsedOwnerId <= 0) {
        setErrorMessage('Please enter a valid owner ID.');
        return;
      }
      ownerId = parsedOwnerId;
    }

    let ageYears: number | null = null;
    if (requestAgeYears.trim()) {
      const parsedAge = Number(requestAgeYears);
      if (!Number.isFinite(parsedAge) || parsedAge < 0) {
        setErrorMessage('Please enter a valid device age.');
        return;
      }
      ageYears = parsedAge;
    }

    setIsCreatingStaffRequest(true);
    setErrorMessage('');
    try {
      const createdRequest = await createStaffRequest({
        owner_id: ownerId,
        owner_email: trimmedOwnerEmail || null,
        item_name: trimmedItemName,
        category: requestCategory,
        condition: requestCondition,
        preferred_method: requestMethod,
        pickup_address: requestMethod === 'pickup' ? requestPickupAddress || null : null,
        contact_phone: requestContactPhone || null,
        scheduled_time: requestScheduledTime || null,
        age_years: ageYears,
        demand: requestDemand,
        staff_note: requestStaffNote || null,
        status: requestDraftStatus,
        workflow_status: requestWorkflowStatus,
      });

      setRequestOwnerId('');
      setRequestOwnerEmail('');
      setRequestItemName('');
      setRequestCategory('phone');
      setRequestCondition('working');
      setRequestMethod('dropoff');
      setRequestPickupAddress('');
      setRequestContactPhone('');
      setRequestScheduledTime('');
      setRequestAgeYears('');
      setRequestDemand('medium');
      setRequestStaffNote('');
      setRequestDraftStatus('submitted');
      setRequestWorkflowStatus('pending');

      if (createdRequest) {
        setRequests((current) => [createdRequest as StaffRequest, ...current]);
      } else {
        const requestsResponse = await api.get('/api/requests');
        setRequests(requestsResponse.data?.requests ?? []);
      }
      await refreshDeviceCollections();
    } catch (error: unknown) {
      setErrorMessage(getApiStyleErrorMessage(error, 'Could not create this request for the owner right now.'));
    } finally {
      setIsCreatingStaffRequest(false);
    }
  };

  const handleCreateStaffDevice = async () => {
    const trimmedOwnerId = deviceOwnerId.trim();
    const trimmedOwnerEmail = deviceOwnerEmail.trim();
    const trimmedDeviceName = deviceNameDraft.trim();

    if (!trimmedOwnerId && !trimmedOwnerEmail) {
      setErrorMessage('Please enter an owner ID or owner email for the device.');
      return;
    }

    if (!trimmedDeviceName) {
      setErrorMessage('Please enter a device name.');
      return;
    }

    let ownerId: number | null = null;
    if (trimmedOwnerId) {
      const parsedOwnerId = Number(trimmedOwnerId);
      if (!Number.isFinite(parsedOwnerId) || parsedOwnerId <= 0) {
        setErrorMessage('Please enter a valid owner ID for the device.');
        return;
      }
      ownerId = parsedOwnerId;
    }

    let ageYears: number | null = null;
    if (deviceAgeYearsDraft.trim()) {
      const parsedAge = Number(deviceAgeYearsDraft);
      if (!Number.isFinite(parsedAge) || parsedAge < 0) {
        setErrorMessage('Please enter a valid device age.');
        return;
      }
      ageYears = parsedAge;
    }

    setIsCreatingStaffDevice(true);
    setErrorMessage('');
    try {
      const createdDevice = await createStaffDevice({
        owner_id: ownerId,
        owner_email: trimmedOwnerEmail || null,
        name: trimmedDeviceName,
        device_type: deviceCategoryDraft,
        condition: deviceConditionDraft,
        age_years: ageYears,
        demand: deviceDemandDraft,
        notes: deviceNotesDraft || null,
      });

      setDeviceOwnerId('');
      setDeviceOwnerEmail('');
      setDeviceNameDraft('');
      setDeviceCategoryDraft('phone');
      setDeviceConditionDraft('working');
      setDeviceAgeYearsDraft('');
      setDeviceDemandDraft('medium');
      setDeviceNotesDraft('');

      if (createdDevice) {
        setDevices((current) => [createdDevice as StaffDevice, ...current]);
      }
      await refreshDeviceCollections();
    } catch (error: unknown) {
      setErrorMessage(getApiStyleErrorMessage(error, 'Could not create this device right now.'));
    } finally {
      setIsCreatingStaffDevice(false);
    }
  };

  const applyDeviceToEditor = (device: StaffDevice) => {
    setEditingDeviceId(device.id);
    setEditDeviceName(device.name || '');
    setEditDeviceCategory((device.device_type as (typeof REQUEST_CATEGORY_OPTIONS)[number]) || 'phone');
    setEditDeviceCondition((device.condition as (typeof REQUEST_CONDITION_OPTIONS)[number]) || 'working');
    setEditDeviceAgeYears(device.age_years === null || device.age_years === undefined ? '' : String(device.age_years));
    setEditDeviceDemand((device.demand as (typeof REQUEST_DEMAND_OPTIONS)[number]) || 'medium');
    setEditDeviceWorkflowStatus((device.workflow_status as (typeof REQUEST_WORKFLOW_OPTIONS)[number]) || 'pending');
    setEditDeviceClassification((device.classification as (typeof CLASSIFICATION_OPTIONS)[number]) || 'unknown');
    setEditDeviceNotes(device.notes || '');
    setEditDeviceOwnerContacted(Boolean(device.owner_contacted));
    setEditDeviceContactNotes(device.contact_notes || '');
  };

  const resetDeviceEditor = () => {
    setEditingDeviceId(null);
    setEditDeviceName('');
    setEditDeviceCategory('phone');
    setEditDeviceCondition('working');
    setEditDeviceAgeYears('');
    setEditDeviceDemand('medium');
    setEditDeviceWorkflowStatus('pending');
    setEditDeviceClassification('unknown');
    setEditDeviceNotes('');
    setEditDeviceOwnerContacted(false);
    setEditDeviceContactNotes('');
  };

  const handleUpdateDevice = async () => {
    if (!editingDeviceId) {
      setErrorMessage('Please choose a device to edit first.');
      return;
    }

    const trimmedName = editDeviceName.trim();
    if (!trimmedName) {
      setErrorMessage('Please enter a device name.');
      return;
    }

    let ageYears: number | null = null;
    if (editDeviceAgeYears.trim()) {
      const parsedAge = Number(editDeviceAgeYears);
      if (!Number.isFinite(parsedAge) || parsedAge < 0) {
        setErrorMessage('Please enter a valid device age.');
        return;
      }
      ageYears = parsedAge;
    }

    setUpdatingDeviceId(editingDeviceId);
    setErrorMessage('');
    try {
      await api.patch(`/api/devices/${editingDeviceId}`, {
        name: trimmedName,
        device_type: editDeviceCategory,
        condition: editDeviceCondition,
        age_years: ageYears,
        demand: editDeviceDemand,
        workflow_status: editDeviceWorkflowStatus,
        classification: editDeviceClassification,
        notes: editDeviceNotes || null,
        owner_contacted: editDeviceOwnerContacted,
        contact_notes: editDeviceContactNotes || null,
      });
      await refreshDeviceCollections();
    } catch (error: unknown) {
      setErrorMessage(getApiStyleErrorMessage(error, 'Could not update this device right now.'));
    } finally {
      setUpdatingDeviceId(null);
    }
  };

  const loadRetrievalRecord = async (rawId?: string) => {
    const nextId = Number(rawId ?? retrievalLookupId);
    if (!Number.isFinite(nextId) || nextId <= 0) {
      setErrorMessage('Please enter a valid retrieval request ID.');
      return;
    }

    setIsLoadingRetrieval(true);
    setErrorMessage('');
    try {
      const record = await fetchRetrievalRequestDetail(nextId);
      setRetrievalRecord(record);
      setIssuedDownload(record?.download ?? null);
      setRetrievalDraftStatus(record?.retrieval_status || 'pending');
      setRetrievalDraftNote(record?.note || '');
    } catch (error: unknown) {
      setErrorMessage(getApiStyleErrorMessage(error, 'Could not load that retrieval request right now.'));
      setRetrievalRecord(null);
      setIssuedDownload(null);
    } finally {
      setIsLoadingRetrieval(false);
    }
  };

  const handleRetrievalStatusSave = async () => {
    if (!retrievalRecord) {
      return;
    }

    setIsSavingRetrieval(true);
    setErrorMessage('');
    try {
      const updated = await updateRetrievalStatus(retrievalRecord.id, {
        retrieval_status: retrievalDraftStatus,
        note: retrievalDraftNote || null,
      });
      setRetrievalRecord(updated);
      setIssuedDownload(updated.download ?? issuedDownload);
    } catch (error: unknown) {
      setErrorMessage(getApiStyleErrorMessage(error, 'Could not update this retrieval request right now.'));
    } finally {
      setIsSavingRetrieval(false);
    }
  };

  const handleIssueDownload = async () => {
    if (!retrievalRecord) {
      return;
    }

    setIsIssuingDownload(true);
    setErrorMessage('');
    try {
      const download = await issueRetrievalDownloadLink(retrievalRecord.id);
      setIssuedDownload(download);
      await loadRetrievalRecord(String(retrievalRecord.id));
    } catch (error: unknown) {
      setErrorMessage(getApiStyleErrorMessage(error, 'Could not issue a secure download link right now.'));
    } finally {
      setIsIssuingDownload(false);
    }
  };

  const handleCreateWipeJob = async () => {
    const deviceId = Number(wipeJobDeviceId);
    if (!Number.isFinite(deviceId) || deviceId <= 0) {
      setErrorMessage('Please enter a valid device ID for the wipe job.');
      return;
    }

    let requestId: number | null = null;
    if (wipeJobRequestId.trim()) {
      const parsedRequestId = Number(wipeJobRequestId);
      if (!Number.isFinite(parsedRequestId) || parsedRequestId <= 0) {
        setErrorMessage('Please enter a valid linked request ID.');
        return;
      }
      requestId = parsedRequestId;
    }

    setIsCreatingWipeJob(true);
    setErrorMessage('');
    try {
      const wipeJob = await createWipeJob(deviceId, {
        request_id: requestId,
        wipe_type: wipeJobDraftType,
        status: wipeJobDraftStatus,
        verification_status: wipeJobDraftVerificationStatus,
        notes: wipeJobDraftNotes || null,
      });
      setWipeJobLookupId(String(wipeJob.id));
      setWipeJobRecord(wipeJob);
      applyWipeJobToForm(wipeJob);
      await refreshWipeJobCollections(wipeJob.id);
    } catch (error: unknown) {
      setErrorMessage(getApiStyleErrorMessage(error, 'Could not create this wipe job right now.'));
    } finally {
      setIsCreatingWipeJob(false);
    }
  };

  const handleUpdateWipeJob = async () => {
    if (!wipeJobRecord) {
      setErrorMessage('Load a wipe job before trying to update it.');
      return;
    }

    setIsUpdatingWipeJob(true);
    setErrorMessage('');
    try {
      const updated = await updateWipeJob(wipeJobRecord.id, {
        wipe_type: wipeJobDraftType,
        status: wipeJobDraftStatus,
        verification_status: wipeJobDraftVerificationStatus,
        notes: wipeJobDraftNotes || null,
      });
      setWipeJobRecord(updated);
      applyWipeJobToForm(updated);
      await refreshWipeJobCollections(updated.id);
    } catch (error: unknown) {
      setErrorMessage(getApiStyleErrorMessage(error, 'Could not update this wipe job right now.'));
    } finally {
      setIsUpdatingWipeJob(false);
    }
  };

  const handleCreateWipeCertificate = async () => {
    if (!wipeJobRecord) {
      setErrorMessage('Load a wipe job before attaching a certificate.');
      return;
    }

    if (!wipeCertificateReference.trim() && !wipeCertificateUrl.trim() && !wipeCertificateStorageKey.trim()) {
      setErrorMessage('Please enter at least a certificate reference, URL, or storage key.');
      return;
    }

    setIsCreatingWipeCertificate(true);
    setErrorMessage('');
    try {
      await createWipeCertificate(wipeJobRecord.id, {
        certificate_reference: wipeCertificateReference || null,
        certificate_url: wipeCertificateUrl || null,
        storage_key: wipeCertificateStorageKey || null,
        expires_at: wipeCertificateExpiresAt || null,
      });
      setWipeCertificateReference('');
      setWipeCertificateUrl('');
      setWipeCertificateStorageKey('');
      setWipeCertificateExpiresAt('');
      await refreshWipeJobCollections(wipeJobRecord.id);
    } catch (error: unknown) {
      setErrorMessage(getApiStyleErrorMessage(error, 'Could not create this wipe certificate right now.'));
    } finally {
      setIsCreatingWipeCertificate(false);
    }
  };

  const handleRecordReferralActivity = async () => {
    const referralCodeId = Number(referralActivityCodeId);
    if (!Number.isFinite(referralCodeId) || referralCodeId <= 0) {
      setErrorMessage('Please enter a valid referral code ID.');
      return;
    }

    setIsRecordingReferralActivity(true);
    setErrorMessage('');
    try {
      const result = await recordStaffReferralEvent(referralCodeId, {
        event_type: referralActivityType,
        event_reference: referralActivityReference || null,
        notes: referralActivityNotes || null,
      });
      setRecordedReferral(result.referral);
      setRecordedReferralActivity(result.activity);
      await loadReferralFees();
      await loadReferralActivityList();
    } catch (error: unknown) {
      setErrorMessage(getApiStyleErrorMessage(error, 'Could not record this referral activity right now.'));
    } finally {
      setIsRecordingReferralActivity(false);
    }
  };

  const handleCreateReferralFee = async () => {
    const referralCodeId = Number(referralFeeCodeId);
    if (!Number.isFinite(referralCodeId) || referralCodeId <= 0) {
      setErrorMessage('Please enter a valid referral code ID for the fee.');
      return;
    }

    let feeAmount: number | null = null;
    if (referralFeeAmount.trim()) {
      const parsedAmount = Number(referralFeeAmount);
      if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
        setErrorMessage('Please enter a valid fee amount.');
        return;
      }
      feeAmount = parsedAmount;
    }

    let referralActivityId: number | null = null;
    if (referralFeeActivityId.trim()) {
      const parsedActivityId = Number(referralFeeActivityId);
      if (!Number.isFinite(parsedActivityId) || parsedActivityId <= 0) {
        setErrorMessage('Please enter a valid referral activity ID.');
        return;
      }
      referralActivityId = parsedActivityId;
    }

    setIsCreatingReferralFee(true);
    setErrorMessage('');
    try {
      await createReferralFee({
        referral_code_id: referralCodeId,
        status: referralFeeDraftStatus,
        fee_amount: feeAmount,
        currency: referralFeeCurrency || 'GBP',
        fee_reference: referralFeeReference || null,
        due_at: referralFeeDueAt || null,
        referral_activity_id: referralActivityId,
      });
      setReferralFeeCodeId('');
      setReferralFeeAmount('');
      setReferralFeeCurrency('GBP');
      setReferralFeeReference('');
      setReferralFeeDueAt('');
      setReferralFeeActivityId('');
      setReferralFeeDraftStatus('expected');
      await loadReferralFees();
    } catch (error: unknown) {
      setErrorMessage(getApiStyleErrorMessage(error, 'Could not create this referral fee right now.'));
    } finally {
      setIsCreatingReferralFee(false);
    }
  };

  const handleReferralFeeStatusChange = async (feeId: number, status: ReferralFeeStatus) => {
    setUpdatingReferralFeeId(feeId);
    setErrorMessage('');
    try {
      const updated = await updateReferralFee(feeId, { status });
      setReferralFees((current) =>
        current.map((fee) => (fee.id === feeId ? { ...fee, ...updated } : fee)),
      );
      await loadReferralFees();
    } catch (error: unknown) {
      setErrorMessage(getApiStyleErrorMessage(error, 'Could not update this referral fee right now.'));
    } finally {
      setUpdatingReferralFeeId(null);
    }
  };

  if (!currentUser && !isLoading) {
    return <Navigate to="/auth/login" replace />;
  }

  if (!isLoading && !['staff', 'admin'].includes((currentUser?.role || '').toLowerCase())) {
    return <Navigate to="/app/dashboard" replace />;
  }

  const statsCards = [
    {
      label: 'Tracked Devices',
      value: String(deviceStats?.totals?.devices ?? 0),
      icon: Cpu,
    },
    {
      label: 'Open Requests',
      value: String(requests.filter((request) => request.status !== 'completed').length),
      icon: ClipboardList,
    },
    {
      label: 'Unknown Queue',
      value: String(unknownDevices.length),
      icon: Workflow,
    },
  ];

  const referralSummaryCards = [
    {
      label: 'Tracked Fees',
      value: String(referralSummary?.total_referral_fees ?? 0),
    },
    {
      label: 'Confirmed Value',
      value: formatMoney(referralSummary?.fee_amount_confirmed ?? 0),
    },
    {
      label: 'Paid Value',
      value: formatMoney(referralSummary?.fee_amount_paid ?? 0),
    },
  ];

  const paymentSummaryCards = [
    {
      label: 'Transactions',
      value: String(paymentReportSummary?.total_transactions ?? 0),
    },
    {
      label: 'Paid Amount',
      value: formatMoney(paymentReportSummary?.paid_amount ?? 0),
    },
    {
      label: 'Pending Amount',
      value: formatMoney(paymentReportSummary?.pending_amount ?? 0),
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 p-8 md:p-10">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-black uppercase tracking-widest mb-4">
              <Shield className="w-4 h-4" />
              Staff Portal
            </div>
            <h1 className="text-4xl font-black tracking-tight text-slate-900 mb-2">Operations Console</h1>
            <p className="text-slate-500 font-medium text-lg">
              Review recycling activity, monitor device flow, and manage operational queues.
            </p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1">Signed In As</p>
            <p className="text-lg font-black text-slate-900">{currentUser?.full_name || currentUser?.email || 'Loading'}</p>
            <p className="text-sm font-bold text-emerald-600 uppercase">{currentUser?.role || 'staff'}</p>
          </div>
        </div>

        {errorMessage ? (
          <div className="rounded-3xl border border-red-100 bg-red-50 px-6 py-5 text-sm font-semibold text-red-600">
            {errorMessage}
          </div>
        ) : null}

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-36 rounded-[2rem] border border-slate-100 bg-white animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {statsCards.map((card, index) => {
              const Icon = card.icon;
              return (
                <motion.div
                  key={card.label}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * index }}
                  className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm"
                >
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
                    <Icon className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">{card.label}</p>
                  <p className="text-4xl font-black tracking-tight text-slate-900">{card.value}</p>
                </motion.div>
              );
            })}
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-[1.4fr,1fr] gap-6">
          <div className="rounded-[2.5rem] border border-slate-100 bg-white shadow-sm overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-50">
              <h2 className="text-2xl font-black tracking-tight text-slate-900">Recent Collection Requests</h2>
              <p className="text-slate-500 font-medium mt-1">Live queue for staff review and status updates.</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left">
                <thead>
                  <tr className="border-b border-slate-50">
                    <th className="px-8 py-4 text-xs font-black uppercase tracking-widest text-slate-400">Request</th>
                    <th className="px-8 py-4 text-xs font-black uppercase tracking-widest text-slate-400">Device</th>
                    <th className="px-8 py-4 text-xs font-black uppercase tracking-widest text-slate-400">Method</th>
                    <th className="px-8 py-4 text-xs font-black uppercase tracking-widest text-slate-400">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {requests.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-8 py-10 text-center text-slate-500 font-medium">
                        No staff-manageable requests yet.
                      </td>
                    </tr>
                  ) : (
                    requests.map((request) => (
                      <tr key={request.id}>
                        <td className="px-8 py-5">
                          <p className="font-black text-slate-900">EW-{request.id}</p>
                          <p className="text-sm font-medium text-slate-500">Consumer #{request.consumer_id}</p>
                        </td>
                        <td className="px-8 py-5">
                          <p className="font-bold text-slate-900">{request.device?.name || 'Pending device'}</p>
                          <p className="text-sm font-medium text-slate-500">
                            {(request.device?.device_type || 'unknown').toUpperCase()} / {(request.device?.classification || 'unknown').toUpperCase()}
                          </p>
                        </td>
                        <td className="px-8 py-5 text-sm font-bold text-slate-600">
                          {(request.preferred_method || 'unknown').toUpperCase()}
                        </td>
                        <td className="px-8 py-5">
                          <select
                            value={request.status}
                            onChange={(event) => void handleRequestStatusChange(request.id, event.target.value)}
                            disabled={updatingRequestId === request.id}
                            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700 disabled:opacity-60"
                          >
                            {REQUEST_STATUS_OPTIONS.map((option) => (
                              <option key={option} value={option}>
                                {option.toUpperCase()}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[2.5rem] border border-slate-100 bg-white shadow-sm overflow-hidden">
              <div className="px-8 py-6 border-b border-slate-50">
                <h2 className="text-2xl font-black tracking-tight text-slate-900">Device Overview</h2>
                <p className="text-slate-500 font-medium mt-1">Snapshot of the current processing pipeline.</p>
              </div>
              <div className="p-8 space-y-4">
                {Object.entries(deviceStats?.workflow_status || {}).map(([label, count]) => (
                  <div key={label} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                    <span className="text-sm font-bold uppercase tracking-wide text-slate-500">{label}</span>
                    <span className="text-lg font-black text-slate-900">{count}</span>
                  </div>
                ))}
                {Object.keys(deviceStats?.workflow_status || {}).length === 0 ? (
                  <p className="text-sm font-medium text-slate-500">No device statistics available yet.</p>
                ) : null}
              </div>
            </div>

            {(currentUser?.role || '').toLowerCase() === 'admin' ? (
              <div className="rounded-[2.5rem] border border-slate-100 bg-white shadow-sm overflow-hidden">
                <div className="px-8 py-6 border-b border-slate-50">
                  <h2 className="text-2xl font-black tracking-tight text-slate-900">User Roles</h2>
                  <p className="text-slate-500 font-medium mt-1">Admin-only controls for assigning staff access.</p>
                </div>
                <div className="p-6 space-y-3">
                  {users.length === 0 ? (
                    <p className="text-sm font-medium text-slate-500 px-2">No users available.</p>
                  ) : (
                    users.map((user) => (
                      <div key={user.id} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
                        <p className="font-bold text-slate-900">{user.full_name || user.email}</p>
                        <p className="text-sm font-medium text-slate-500 mb-3">{user.email}</p>
                        <select
                          value={user.role}
                          onChange={(event) => void handleUserRoleChange(user.id, event.target.value)}
                          disabled={updatingUserId === user.id || user.role === 'admin'}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 disabled:opacity-60"
                        >
                          {user.role === 'admin' ? <option value="admin">ADMIN</option> : null}
                          {MANAGEABLE_ROLE_OPTIONS.map((role) => (
                            <option key={role} value={role}>
                              {role.toUpperCase()}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-[2.5rem] border border-slate-100 bg-white shadow-sm overflow-hidden">
          <div className="px-8 py-6 border-b border-slate-50">
            <h2 className="text-2xl font-black tracking-tight text-slate-900">Retrieval Control</h2>
            <p className="text-slate-500 font-medium mt-1">Look up a retrieval request by ID, mark it ready, and issue a one-time download link.</p>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-[0.9fr,1.1fr] gap-6 p-8">
            <div className="space-y-4">
              <div className="rounded-3xl border border-slate-100 bg-slate-50 p-5">
                <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                  Retrieval Request ID
                </label>
                <div className="flex gap-3">
                  <input
                    value={retrievalLookupId}
                    onChange={(event) => setRetrievalLookupId(event.target.value)}
                    placeholder="e.g. 12"
                    className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900"
                  />
                  <button
                    type="button"
                    onClick={() => void loadRetrievalRecord()}
                    disabled={isLoadingRetrieval}
                    className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60"
                  >
                    {isLoadingRetrieval ? 'Loading...' : 'Load'}
                  </button>
                </div>
              </div>

              {retrievalRecord ? (
                <div className="space-y-4">
                  <div className="rounded-3xl border border-slate-100 bg-slate-50 p-5">
                    <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">Retrieval State</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm font-medium text-slate-600">
                      <p>ID: <span className="font-black text-slate-900">{retrievalRecord.id}</span></p>
                      <p>Owner: <span className="font-black text-slate-900">#{retrievalRecord.consumer_id}</span></p>
                      <p>Status: <span className="font-black text-slate-900">{retrievalRecord.status}</span></p>
                      <p>Payment: <span className="font-black text-slate-900">{retrievalRecord.payment_status || 'unpaid'}</span></p>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-slate-100 bg-white p-5 space-y-4">
                    <div>
                      <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                        Retrieval Status
                      </label>
                      <select
                        value={retrievalDraftStatus}
                        onChange={(event) => setRetrievalDraftStatus(event.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900"
                      >
                        {RETRIEVAL_STATUS_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option.toUpperCase()}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                        Staff Note
                      </label>
                      <textarea
                        value={retrievalDraftNote}
                        onChange={(event) => setRetrievalDraftNote(event.target.value)}
                        rows={4}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900"
                      />
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => void handleRetrievalStatusSave()}
                        disabled={isSavingRetrieval}
                        className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-60"
                      >
                        {isSavingRetrieval ? 'Saving...' : 'Save Retrieval Status'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleIssueDownload()}
                        disabled={isIssuingDownload}
                        className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                      >
                        {isIssuingDownload ? 'Issuing...' : 'Issue Download Link'}
                      </button>
                    </div>
                  </div>

                  {issuedDownload ? (
                    <div className="rounded-3xl border border-blue-100 bg-blue-50 p-5 text-sm text-blue-900">
                      <p className="font-black mb-2 flex items-center gap-2">
                        <Link2 className="w-4 h-4" />
                        Download Link Issued
                      </p>
                      <p className="font-medium break-all">Token: <span className="font-black">{issuedDownload.token}</span></p>
                      <p className="font-medium mt-2">URL: <span className="font-black">{issuedDownload.download_url}</span></p>
                      <p className="font-medium mt-2">Expires: <span className="font-black">{issuedDownload.expires_at || 'Pending'}</span></p>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center text-sm font-medium text-slate-500">
                  Load a retrieval request ID to manage secure delivery without waiting for a dedicated list endpoint.
                </div>
              )}
            </div>

            <div>
              {retrievalRecord ? (
                <PaymentSummaryCard
                  summary={toPaymentSummary(retrievalRecord)}
                  title="Retrieval Payment"
                  subtitle="This panel reflects the live retrieval and payment fields returned by the backend detail endpoint."
                />
              ) : (
                <div className="rounded-[2.5rem] border border-dashed border-slate-200 bg-slate-50 px-8 py-16 text-center">
                  <p className="text-lg font-black text-slate-900 mb-2">Retrieval Detail Preview</p>
                  <p className="text-sm font-medium text-slate-500">
                    Once you load a retrieval request, its payment state and secure-download readiness will appear here.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-[2.5rem] border border-slate-100 bg-white shadow-sm overflow-hidden">
          <div className="px-8 py-6 border-b border-slate-50">
            <h2 className="text-2xl font-black tracking-tight text-slate-900">Create Device For Owner</h2>
            <p className="text-slate-500 font-medium mt-1">Allow staff to create a device record directly for an existing owner via `/api/devices`.</p>
          </div>
          <div className="p-8 grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                    Owner ID
                  </label>
                  <input
                    value={deviceOwnerId}
                    onChange={(event) => setDeviceOwnerId(event.target.value)}
                    placeholder="e.g. 12"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                    Owner Email
                  </label>
                  <input
                    value={deviceOwnerEmail}
                    onChange={(event) => setDeviceOwnerEmail(event.target.value)}
                    placeholder="owner@example.com"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                  Device Name
                </label>
                <input
                  value={deviceNameDraft}
                  onChange={(event) => setDeviceNameDraft(event.target.value)}
                  placeholder="e.g. Staff Registered Laptop"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                    Category
                  </label>
                  <select
                    value={deviceCategoryDraft}
                    onChange={(event) => setDeviceCategoryDraft(event.target.value as (typeof REQUEST_CATEGORY_OPTIONS)[number])}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900"
                  >
                    {REQUEST_CATEGORY_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                    Condition
                  </label>
                  <select
                    value={deviceConditionDraft}
                    onChange={(event) => setDeviceConditionDraft(event.target.value as (typeof REQUEST_CONDITION_OPTIONS)[number])}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900"
                  >
                    {REQUEST_CONDITION_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                    Demand
                  </label>
                  <select
                    value={deviceDemandDraft}
                    onChange={(event) => setDeviceDemandDraft(event.target.value as (typeof REQUEST_DEMAND_OPTIONS)[number])}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900"
                  >
                    {REQUEST_DEMAND_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                  Device Age
                </label>
                <input
                  value={deviceAgeYearsDraft}
                  onChange={(event) => setDeviceAgeYearsDraft(event.target.value)}
                  placeholder="Optional years"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                  Notes
                </label>
                <textarea
                  value={deviceNotesDraft}
                  onChange={(event) => setDeviceNotesDraft(event.target.value)}
                  rows={5}
                  placeholder="Internal note for this owner device."
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900"
                />
              </div>

              <button
                type="button"
                onClick={() => void handleCreateStaffDevice()}
                disabled={isCreatingStaffDevice}
                className="w-full rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-60"
              >
                {isCreatingStaffDevice ? 'Creating Device...' : 'Create Device For Owner'}
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-[2.5rem] border border-slate-100 bg-white shadow-sm overflow-hidden">
          <div className="px-8 py-6 border-b border-slate-50">
            <h2 className="text-2xl font-black tracking-tight text-slate-900">Create Request For Owner</h2>
            <p className="text-slate-500 font-medium mt-1">Allow staff to submit a collection request on behalf of an existing owner.</p>
          </div>
          <div className="p-8 grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                    Owner ID
                  </label>
                  <input
                    value={requestOwnerId}
                    onChange={(event) => setRequestOwnerId(event.target.value)}
                    placeholder="e.g. 12"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                    Owner Email
                  </label>
                  <input
                    value={requestOwnerEmail}
                    onChange={(event) => setRequestOwnerEmail(event.target.value)}
                    placeholder="owner@example.com"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                  Item Name
                </label>
                <input
                  value={requestItemName}
                  onChange={(event) => setRequestItemName(event.target.value)}
                  placeholder="e.g. Staff Submitted Request"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                    Category
                  </label>
                  <select
                    value={requestCategory}
                    onChange={(event) => setRequestCategory(event.target.value as (typeof REQUEST_CATEGORY_OPTIONS)[number])}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900"
                  >
                    {REQUEST_CATEGORY_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                    Condition
                  </label>
                  <select
                    value={requestCondition}
                    onChange={(event) => setRequestCondition(event.target.value as (typeof REQUEST_CONDITION_OPTIONS)[number])}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900"
                  >
                    {REQUEST_CONDITION_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                    Method
                  </label>
                  <select
                    value={requestMethod}
                    onChange={(event) => setRequestMethod(event.target.value as (typeof REQUEST_METHOD_OPTIONS)[number])}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900"
                  >
                    {REQUEST_METHOD_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                    Device Age
                  </label>
                  <input
                    value={requestAgeYears}
                    onChange={(event) => setRequestAgeYears(event.target.value)}
                    placeholder="Optional years"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                    Demand
                  </label>
                  <select
                    value={requestDemand}
                    onChange={(event) => setRequestDemand(event.target.value as (typeof REQUEST_DEMAND_OPTIONS)[number])}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900"
                  >
                    {REQUEST_DEMAND_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                  Contact Phone
                </label>
                <input
                  value={requestContactPhone}
                  onChange={(event) => setRequestContactPhone(event.target.value)}
                  placeholder="Optional contact number"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                  Pickup Address
                </label>
                <textarea
                  value={requestPickupAddress}
                  onChange={(event) => setRequestPickupAddress(event.target.value)}
                  rows={3}
                  placeholder="Required when method is pickup"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                  Scheduled Time
                </label>
                <input
                  type="datetime-local"
                  value={requestScheduledTime}
                  onChange={(event) => setRequestScheduledTime(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                    Request Status
                  </label>
                  <select
                    value={requestDraftStatus}
                    onChange={(event) => setRequestDraftStatus(event.target.value as (typeof REQUEST_STATUS_DRAFT_OPTIONS)[number])}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900"
                  >
                    {REQUEST_STATUS_DRAFT_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                    Workflow Status
                  </label>
                  <select
                    value={requestWorkflowStatus}
                    onChange={(event) => setRequestWorkflowStatus(event.target.value as (typeof REQUEST_WORKFLOW_OPTIONS)[number])}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900"
                  >
                    {REQUEST_WORKFLOW_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                  Staff Note
                </label>
                <textarea
                  value={requestStaffNote}
                  onChange={(event) => setRequestStaffNote(event.target.value)}
                  rows={4}
                  placeholder="Internal note for this owner-submitted request"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900"
                />
              </div>

              <button
                type="button"
                onClick={() => void handleCreateStaffRequest()}
                disabled={isCreatingStaffRequest}
                className="w-full rounded-2xl bg-slate-900 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {isCreatingStaffRequest ? 'Creating Request...' : 'Create Request For Owner'}
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-[2.5rem] border border-slate-100 bg-white shadow-sm overflow-hidden">
          <div className="px-8 py-6 border-b border-slate-50">
            <h2 className="text-2xl font-black tracking-tight text-slate-900">Wipe Jobs & Certificates</h2>
            <p className="text-slate-500 font-medium mt-1">Create secure wipe jobs, track progress, and attach the delivery certificate once it is ready.</p>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-[1fr,1.05fr] gap-6 p-8">
            <div className="space-y-6">
              <div className="rounded-3xl border border-slate-100 bg-slate-50 p-5 space-y-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                    Existing Wipe Job ID
                  </label>
                  <div className="flex gap-3">
                    <input
                      value={wipeJobLookupId}
                      onChange={(event) => setWipeJobLookupId(event.target.value)}
                      placeholder="e.g. 4"
                      className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900"
                    />
                    <button
                      type="button"
                      onClick={() => void loadWipeJobRecord()}
                      disabled={isLoadingWipeJobDetail}
                      className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                    >
                      {isLoadingWipeJobDetail ? 'Loading...' : 'Load Job'}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                      Device ID
                    </label>
                    <input
                      value={wipeJobDeviceId}
                      onChange={(event) => setWipeJobDeviceId(event.target.value)}
                      placeholder="Required for new jobs"
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                      Linked Request ID
                    </label>
                    <input
                      value={wipeJobRequestId}
                      onChange={(event) => setWipeJobRequestId(event.target.value)}
                      placeholder="Optional"
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                      Wipe Type
                    </label>
                    <select
                      value={wipeJobDraftType}
                      onChange={(event) => setWipeJobDraftType(event.target.value as WipeJobType)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900"
                    >
                      {WIPE_JOB_TYPE_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                      Status
                    </label>
                    <select
                      value={wipeJobDraftStatus}
                      onChange={(event) => setWipeJobDraftStatus(event.target.value as WipeJobStatus)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900"
                    >
                      {WIPE_JOB_STATUS_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                      Verification
                    </label>
                    <select
                      value={wipeJobDraftVerificationStatus}
                      onChange={(event) => setWipeJobDraftVerificationStatus(event.target.value as WipeJobVerificationStatus)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900"
                    >
                      {WIPE_JOB_VERIFICATION_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                    Notes
                  </label>
                  <textarea
                    value={wipeJobDraftNotes}
                    onChange={(event) => setWipeJobDraftNotes(event.target.value)}
                    rows={4}
                    placeholder="Add queue or verification notes"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900"
                  />
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => void handleCreateWipeJob()}
                    disabled={isCreatingWipeJob}
                    className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60"
                  >
                    {isCreatingWipeJob ? 'Creating...' : 'Create Wipe Job'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleUpdateWipeJob()}
                    disabled={isUpdatingWipeJob || !wipeJobRecord}
                    className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-60"
                  >
                    {isUpdatingWipeJob ? 'Saving...' : 'Update Loaded Job'}
                  </button>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-100 bg-white p-5 space-y-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Attach Certificate</p>
                  <p className="text-sm font-medium text-slate-500">
                    {wipeJobRecord ? `Attach a certificate to wipe job #${wipeJobRecord.id}.` : 'Load a wipe job first to attach its certificate.'}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                      Reference
                    </label>
                    <input
                      value={wipeCertificateReference}
                      onChange={(event) => setWipeCertificateReference(event.target.value)}
                      placeholder="e.g. CERT-1001"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                      Expires At
                    </label>
                    <input
                      type="datetime-local"
                      value={wipeCertificateExpiresAt}
                      onChange={(event) => setWipeCertificateExpiresAt(event.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                    Certificate URL
                  </label>
                  <input
                    value={wipeCertificateUrl}
                    onChange={(event) => setWipeCertificateUrl(event.target.value)}
                    placeholder="https://..."
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                    Storage Key
                  </label>
                  <input
                    value={wipeCertificateStorageKey}
                    onChange={(event) => setWipeCertificateStorageKey(event.target.value)}
                    placeholder="wipe-certificates/CERT-1001.pdf"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => void handleCreateWipeCertificate()}
                  disabled={isCreatingWipeCertificate || !wipeJobRecord}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  {isCreatingWipeCertificate ? 'Attaching...' : 'Attach Certificate'}
                </button>
              </div>
            </div>

            <div className="space-y-6">
              {wipeJobRecord ? (
                <div className="rounded-[2.5rem] border border-slate-100 bg-white p-6 shadow-sm">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                      <Shield className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest text-slate-400">Loaded Wipe Job</p>
                      <h3 className="text-xl font-black text-slate-900">Job #{wipeJobRecord.id}</h3>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                      <p className="text-xs font-black uppercase tracking-widest text-slate-400">Device</p>
                      <p className="mt-1 text-sm font-bold text-slate-900">
                        #{wipeJobRecord.device_id} {wipeJobRecord.device?.name ? `· ${wipeJobRecord.device.name}` : ''}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                      <p className="text-xs font-black uppercase tracking-widest text-slate-400">Request</p>
                      <p className="mt-1 text-sm font-bold text-slate-900">
                        {wipeJobRecord.request_id ? `#${wipeJobRecord.request_id}` : 'Unlinked'}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                      <p className="text-xs font-black uppercase tracking-widest text-slate-400">Status</p>
                      <p className="mt-1 text-sm font-bold text-slate-900">{String(wipeJobRecord.status).toUpperCase()}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                      <p className="text-xs font-black uppercase tracking-widest text-slate-400">Verification</p>
                      <p className="mt-1 text-sm font-bold text-slate-900">
                        {String(wipeJobRecord.verification_status || 'pending').toUpperCase()}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                      <p className="text-xs font-black uppercase tracking-widest text-slate-400">Requested</p>
                      <p className="mt-1 text-sm font-bold text-slate-900">{formatDateTime(wipeJobRecord.requested_at)}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                      <p className="text-xs font-black uppercase tracking-widest text-slate-400">Completed</p>
                      <p className="mt-1 text-sm font-bold text-slate-900">{formatDateTime(wipeJobRecord.completed_at)}</p>
                    </div>
                  </div>

                  {wipeJobRecord.notes ? (
                    <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4 text-sm font-medium text-slate-600">
                      {wipeJobRecord.notes}
                    </div>
                  ) : null}

                  <div className="mt-6">
                    <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">Certificates</p>
                    {wipeJobRecord.certificates && wipeJobRecord.certificates.length > 0 ? (
                      <div className="space-y-3">
                        {wipeJobRecord.certificates.map((certificate) => (
                          <div key={certificate.id} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
                            <p className="font-bold text-slate-900">{certificate.certificate_reference || `Certificate #${certificate.id}`}</p>
                            <p className="text-sm font-medium text-slate-500">Issued {formatDateTime(certificate.issued_at)}</p>
                            {certificate.certificate_url ? (
                              <a
                                href={certificate.certificate_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-2 inline-flex items-center gap-2 text-sm font-bold text-emerald-700 hover:text-emerald-600"
                              >
                                <Link2 className="w-4 h-4" />
                                Open Certificate
                              </a>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-6 text-sm font-medium text-slate-500">
                        No certificate has been attached to this wipe job yet.
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-[2.5rem] border border-dashed border-slate-200 bg-slate-50 px-8 py-16 text-center">
                  <p className="text-lg font-black text-slate-900 mb-2">No Wipe Job Loaded</p>
                  <p className="text-sm font-medium text-slate-500">
                    Create a new wipe job for a device, or load an existing job by ID to manage its status and certificates.
                  </p>
                </div>
              )}

              <div className="rounded-3xl border border-slate-100 bg-white overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest text-slate-400">Recent Jobs</p>
                    <h3 className="text-lg font-black text-slate-900">Wipe Queue</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => void loadWipeJobs()}
                    disabled={isLoadingWipeJobs}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  >
                    {isLoadingWipeJobs ? 'Refreshing...' : 'Refresh'}
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left">
                    <thead>
                      <tr className="border-b border-slate-50">
                        <th className="px-5 py-4 text-xs font-black uppercase tracking-widest text-slate-400">Job</th>
                        <th className="px-5 py-4 text-xs font-black uppercase tracking-widest text-slate-400">Device</th>
                        <th className="px-5 py-4 text-xs font-black uppercase tracking-widest text-slate-400">Status</th>
                        <th className="px-5 py-4 text-xs font-black uppercase tracking-widest text-slate-400">Certificates</th>
                        <th className="px-5 py-4 text-xs font-black uppercase tracking-widest text-slate-400"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {isLoadingWipeJobs ? (
                        <tr>
                          <td colSpan={5} className="px-5 py-10 text-center text-sm font-medium text-slate-500">
                            Loading wipe jobs...
                          </td>
                        </tr>
                      ) : wipeJobs.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-5 py-10 text-center text-sm font-medium text-slate-500">
                            No wipe jobs have been created yet.
                          </td>
                        </tr>
                      ) : (
                        wipeJobs.map((job) => (
                          <tr key={job.id}>
                            <td className="px-5 py-4 align-top">
                              <p className="font-black text-slate-900">Job #{job.id}</p>
                              <p className="text-sm font-medium text-slate-500">{String(job.wipe_type).toUpperCase()}</p>
                            </td>
                            <td className="px-5 py-4 align-top">
                              <p className="font-bold text-slate-900">{job.device?.name || `Device #${job.device_id}`}</p>
                              <p className="text-sm font-medium text-slate-500">Request {job.request_id ? `#${job.request_id}` : 'Unlinked'}</p>
                            </td>
                            <td className="px-5 py-4 align-top">
                              <p className="font-bold text-slate-900">{String(job.status).toUpperCase()}</p>
                              <p className="text-sm font-medium text-slate-500">
                                {String(job.verification_status || 'pending').toUpperCase()}
                              </p>
                            </td>
                            <td className="px-5 py-4 align-top text-sm font-bold text-slate-700">
                              {job.certificate_count ?? job.certificates?.length ?? 0}
                            </td>
                            <td className="px-5 py-4 align-top text-right">
                              <button
                                type="button"
                                onClick={() => void loadWipeJobRecord(job.id)}
                                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800"
                              >
                                Open
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[2.5rem] border border-slate-100 bg-white shadow-sm overflow-hidden">
          <div className="px-8 py-6 border-b border-slate-50">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-2xl font-black tracking-tight text-slate-900">Referral Partners</h2>
                <p className="text-slate-500 font-medium mt-1">Staff/admin view of the live partner list returned by `/api/rewards/partners`.</p>
              </div>
              <div className="inline-flex flex-wrap gap-2 rounded-2xl bg-slate-100 p-1.5">
                {REWARD_PARTNER_FILTER_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => {
                      setRewardPartnerFilter(option);
                      void loadRewardPartners(option);
                    }}
                    className={`rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
                      rewardPartnerFilter === option
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {option === 'all' ? 'All' : option.charAt(0).toUpperCase() + option.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="p-8">
            <div className="rounded-3xl border border-slate-100 bg-white overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-50">
                    <th className="px-5 py-4 text-xs font-black uppercase tracking-widest text-slate-400">Partner</th>
                    <th className="px-5 py-4 text-xs font-black uppercase tracking-widest text-slate-400">Type</th>
                    <th className="px-5 py-4 text-xs font-black uppercase tracking-widest text-slate-400">Supported</th>
                    <th className="px-5 py-4 text-xs font-black uppercase tracking-widest text-slate-400">Status</th>
                    <th className="px-5 py-4 text-xs font-black uppercase tracking-widest text-slate-400">Link</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {isLoadingRewardPartners ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-10 text-center text-sm font-medium text-slate-500">
                        Loading reward partners...
                      </td>
                    </tr>
                  ) : rewardPartners.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-10 text-center text-sm font-medium text-slate-500">
                        No reward partners matched the current filter.
                      </td>
                    </tr>
                  ) : (
                    rewardPartners.map((partner) => (
                      <tr key={partner.id}>
                        <td className="px-5 py-4 align-top">
                          <p className="font-black text-slate-900">{partner.name}</p>
                          <p className="text-sm font-medium text-slate-500">Partner #{partner.id}</p>
                        </td>
                        <td className="px-5 py-4 align-top text-sm font-bold text-slate-700">
                          {String(partner.partner_type || 'partner').toUpperCase()}
                        </td>
                        <td className="px-5 py-4 align-top">
                          <div className="flex flex-wrap gap-2">
                            {partner.supported_classifications.map((classification) => (
                              <span
                                key={`${partner.id}-${classification}`}
                                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-600"
                              >
                                {classification.toUpperCase()}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-5 py-4 align-top text-sm font-bold text-slate-700">
                          {partner.active ? 'ACTIVE' : 'INACTIVE'}
                        </td>
                        <td className="px-5 py-4 align-top">
                          {partner.website_url ? (
                            <a
                              href={partner.website_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-sm font-bold text-slate-900 underline decoration-slate-300 underline-offset-4"
                            >
                              Visit site
                            </a>
                          ) : (
                            <span className="text-sm font-medium text-slate-400">No site</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="rounded-[2.5rem] border border-slate-100 bg-white shadow-sm overflow-hidden">
          <div className="px-8 py-6 border-b border-slate-50">
            <h2 className="text-2xl font-black tracking-tight text-slate-900">Referral Activity</h2>
            <p className="text-slate-500 font-medium mt-1">Record staff-side referral events against a referral code.</p>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-[0.9fr,1.1fr] gap-6 p-8">
            <div className="space-y-4">
              <div className="rounded-3xl border border-slate-100 bg-slate-50 p-5 space-y-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                    Referral Code ID
                  </label>
                  <input
                    value={referralActivityCodeId}
                    onChange={(event) => setReferralActivityCodeId(event.target.value)}
                    placeholder="e.g. 3"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                    Event Type
                  </label>
                  <select
                    value={referralActivityType}
                    onChange={(event) =>
                      setReferralActivityType(event.target.value as (typeof STAFF_REFERRAL_EVENT_OPTIONS)[number])
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900"
                  >
                    {STAFF_REFERRAL_EVENT_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                    Event Reference
                  </label>
                  <input
                    value={referralActivityReference}
                    onChange={(event) => setReferralActivityReference(event.target.value)}
                    placeholder="Optional checkout/order/in-store ref"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                    Notes
                  </label>
                  <textarea
                    value={referralActivityNotes}
                    onChange={(event) => setReferralActivityNotes(event.target.value)}
                    rows={4}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => void handleRecordReferralActivity()}
                  disabled={isRecordingReferralActivity}
                  className="w-full rounded-2xl bg-slate-900 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {isRecordingReferralActivity ? 'Recording...' : 'Record Staff Activity'}
                </button>
              </div>
            </div>

            <div>
              {recordedReferral ? (
                <div className="rounded-[2.5rem] border border-slate-100 bg-white p-6 shadow-sm">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                      <NotebookPen className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest text-slate-400">Recorded Activity</p>
                      <h3 className="text-xl font-black text-slate-900">{recordedReferral.code}</h3>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                      <p className="text-xs font-black uppercase tracking-widest text-slate-400">Referral Status</p>
                      <p className="mt-1 text-sm font-bold text-slate-900">{recordedReferral.status}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                      <p className="text-xs font-black uppercase tracking-widest text-slate-400">Latest Event</p>
                      <p className="mt-1 text-sm font-bold text-slate-900">{recordedReferralActivity?.event_type || 'Recorded'}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                      <p className="text-xs font-black uppercase tracking-widest text-slate-400">Reference</p>
                      <p className="mt-1 text-sm font-bold text-slate-900">{recordedReferralActivity?.event_reference || 'None'}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                      <p className="text-xs font-black uppercase tracking-widest text-slate-400">Occurred At</p>
                      <p className="mt-1 text-sm font-bold text-slate-900">{recordedReferralActivity?.occurred_at || 'Just now'}</p>
                    </div>
                  </div>

                  {recordedReferralActivity?.notes ? (
                    <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4 text-sm font-medium text-slate-600">
                      {recordedReferralActivity.notes}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="rounded-[2.5rem] border border-dashed border-slate-200 bg-slate-50 px-8 py-16 text-center">
                  <p className="text-lg font-black text-slate-900 mb-2">No Referral Activity Recorded Yet</p>
                  <p className="text-sm font-medium text-slate-500">
                    Submit a staff-side referral event to confirm hand-in, resale, or fee-recorded milestones.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="px-8 pb-8">
            <div className="rounded-3xl border border-slate-100 bg-white overflow-hidden mb-6">
              <div className="px-5 py-4 border-b border-slate-50">
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Direct Endpoint</p>
                <h3 className="text-lg font-black text-slate-900">Referral Activity List</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-50">
                      <th className="px-5 py-4 text-xs font-black uppercase tracking-widest text-slate-400">Event</th>
                      <th className="px-5 py-4 text-xs font-black uppercase tracking-widest text-slate-400">Referral</th>
                      <th className="px-5 py-4 text-xs font-black uppercase tracking-widest text-slate-400">Reference</th>
                      <th className="px-5 py-4 text-xs font-black uppercase tracking-widest text-slate-400">Occurred</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {isLoadingReferralActivityList ? (
                      <tr>
                        <td colSpan={4} className="px-5 py-10 text-center text-sm font-medium text-slate-500">
                          Loading referral activity list...
                        </td>
                      </tr>
                    ) : referralActivityList.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-5 py-10 text-center text-sm font-medium text-slate-500">
                          No referral activity records have been returned yet.
                        </td>
                      </tr>
                    ) : (
                      referralActivityList.map((activity) => (
                        <tr key={activity.id}>
                          <td className="px-5 py-4 align-top">
                            <p className="font-bold text-slate-900">{activity.event_type}</p>
                            <p className="text-sm font-medium text-slate-500">{activity.partner?.name || 'Unknown partner'}</p>
                          </td>
                          <td className="px-5 py-4 align-top text-sm font-bold text-slate-700">
                            {activity.referral_code?.code || activity.referral_code_id || '-'}
                          </td>
                          <td className="px-5 py-4 align-top text-sm font-medium text-slate-600">
                            {activity.event_reference || 'None'}
                          </td>
                          <td className="px-5 py-4 align-top text-sm font-medium text-slate-600">
                            {formatDateTime(activity.occurred_at || activity.created_at)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-100 bg-white overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-50">
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Report Feed</p>
                <h3 className="text-lg font-black text-slate-900">Referral Activity Report</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left">
                  <thead>
                    <tr className="border-b border-slate-50">
                      <th className="px-5 py-4 text-xs font-black uppercase tracking-widest text-slate-400">Event</th>
                      <th className="px-5 py-4 text-xs font-black uppercase tracking-widest text-slate-400">Referral</th>
                      <th className="px-5 py-4 text-xs font-black uppercase tracking-widest text-slate-400">Partner</th>
                      <th className="px-5 py-4 text-xs font-black uppercase tracking-widest text-slate-400">Device</th>
                      <th className="px-5 py-4 text-xs font-black uppercase tracking-widest text-slate-400">Occurred</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {isLoadingReferralFees ? (
                      <tr>
                        <td colSpan={5} className="px-5 py-10 text-center text-sm font-medium text-slate-500">
                          Loading referral activity...
                        </td>
                      </tr>
                    ) : referralActivityReport.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-5 py-10 text-center text-sm font-medium text-slate-500">
                          No referral activity was found for the current filter.
                        </td>
                      </tr>
                    ) : (
                      referralActivityReport.map((activity) => (
                        <tr key={activity.id}>
                          <td className="px-5 py-4 align-top">
                            <p className="font-black text-slate-900">{activity.event_type}</p>
                            <p className="text-sm font-medium text-slate-500">
                              Ref {activity.event_reference || 'None'}
                            </p>
                          </td>
                          <td className="px-5 py-4 align-top">
                            <p className="font-bold text-slate-900">
                              {activity.referral_code?.code || `#${activity.referral_code_id ?? '-'}`}
                            </p>
                            <p className="text-sm font-medium text-slate-500">
                              Request {activity.request_id ? `#${activity.request_id}` : 'Unlinked'}
                            </p>
                          </td>
                          <td className="px-5 py-4 align-top">
                            <p className="font-bold text-slate-900">{activity.partner?.name || 'Unknown partner'}</p>
                            <p className="text-sm font-medium text-slate-500">
                              Consumer #{activity.consumer_id ?? '-'}
                            </p>
                          </td>
                          <td className="px-5 py-4 align-top">
                            <p className="font-bold text-slate-900">
                              {activity.referral_code?.device?.name || `#${activity.device_id ?? '-'}`}
                            </p>
                            <p className="text-sm font-medium text-slate-500">
                              {(activity.referral_code?.device?.classification || 'unknown').toUpperCase()}
                            </p>
                          </td>
                          <td className="px-5 py-4 align-top">
                            <p className="font-bold text-slate-900">{formatDateTime(activity.occurred_at)}</p>
                            <p className="text-xs font-medium text-slate-400">
                              Created {formatDateTime(activity.created_at)}
                            </p>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[2.5rem] border border-slate-100 bg-white shadow-sm overflow-hidden">
          <div className="px-8 py-6 border-b border-slate-50">
            <h2 className="text-2xl font-black tracking-tight text-slate-900">Payment Reports</h2>
            <p className="text-slate-500 font-medium mt-1">Track retrieval payments across providers and review live transaction history.</p>
          </div>

          <div className="p-8 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {paymentSummaryCards.map((card) => (
                <div key={card.label} className="rounded-3xl border border-slate-100 bg-slate-50 px-5 py-5">
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400">{card.label}</p>
                  <p className="mt-2 text-3xl font-black tracking-tight text-slate-900">{card.value}</p>
                </div>
              ))}
            </div>

            <div className="rounded-3xl border border-slate-100 bg-slate-50 p-5">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                    From
                  </label>
                  <input
                    type="date"
                    value={paymentReportFromFilter}
                    onChange={(event) => {
                      const value = event.target.value;
                      setPaymentReportFromFilter(value);
                      void loadPaymentReports({ from: value });
                    }}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                    To
                  </label>
                  <input
                    type="date"
                    value={paymentReportToFilter}
                    onChange={(event) => {
                      const value = event.target.value;
                      setPaymentReportToFilter(value);
                      void loadPaymentReports({ to: value });
                    }}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                    Status
                  </label>
                  <select
                    value={paymentReportStatusFilter}
                    onChange={(event) => {
                      const value = event.target.value;
                      setPaymentReportStatusFilter(value);
                      void loadPaymentReports({ status: value });
                    }}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900"
                  >
                    {PAYMENT_REPORT_STATUS_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                    Provider
                  </label>
                  <select
                    value={paymentReportProviderFilter}
                    onChange={(event) => {
                      const value = event.target.value;
                      setPaymentReportProviderFilter(value);
                      void loadPaymentReports({ provider: value });
                    }}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900"
                  >
                    {PAYMENT_REPORT_PROVIDER_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                    Kind
                  </label>
                  <select
                    value={paymentReportKindFilter}
                    onChange={(event) => {
                      const value = event.target.value;
                      setPaymentReportKindFilter(value);
                      void loadPaymentReports({ paymentKind: value });
                    }}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900"
                  >
                    {PAYMENT_REPORT_KIND_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => void loadPaymentReports()}
                    disabled={isLoadingPaymentReports}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  >
                    {isLoadingPaymentReports ? 'Refreshing...' : 'Refresh Report'}
                  </button>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm font-medium text-slate-600">
                <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3">
                  Latest record: <span className="font-black text-slate-900">{formatDateTime(paymentReportSummary?.latest_created_at)}</span>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3">
                  Total amount: <span className="font-black text-slate-900">{formatMoney(paymentReportSummary?.total_amount ?? 0)}</span>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-100 bg-white overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-left">
                  <thead>
                    <tr className="border-b border-slate-50">
                      <th className="px-5 py-4 text-xs font-black uppercase tracking-widest text-slate-400">Transaction</th>
                      <th className="px-5 py-4 text-xs font-black uppercase tracking-widest text-slate-400">Owner</th>
                      <th className="px-5 py-4 text-xs font-black uppercase tracking-widest text-slate-400">Device</th>
                      <th className="px-5 py-4 text-xs font-black uppercase tracking-widest text-slate-400">Amount</th>
                      <th className="px-5 py-4 text-xs font-black uppercase tracking-widest text-slate-400">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {isLoadingPaymentReports ? (
                      <tr>
                        <td colSpan={5} className="px-5 py-10 text-center text-sm font-medium text-slate-500">
                          Loading payment transactions...
                        </td>
                      </tr>
                    ) : paymentReportTransactions.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-5 py-10 text-center text-sm font-medium text-slate-500">
                          No payment transactions matched the current filters.
                        </td>
                      </tr>
                    ) : (
                      paymentReportTransactions.map((transaction) => (
                        <tr key={transaction.id}>
                          <td className="px-5 py-4 align-top">
                            <p className="font-black text-slate-900">Txn #{transaction.id}</p>
                            <p className="text-sm font-medium text-slate-500">
                              {(transaction.provider || 'unknown').toUpperCase()} · {(transaction.payment_kind || 'unknown').toUpperCase()}
                            </p>
                            <p className="text-xs font-medium text-slate-400">
                              Ref {transaction.checkout_reference || transaction.provider_payment_id || 'None'}
                            </p>
                          </td>
                          <td className="px-5 py-4 align-top">
                            <p className="font-bold text-slate-900">
                              {transaction.consumer?.full_name || transaction.consumer_email || `#${transaction.consumer_id ?? '-'}`}
                            </p>
                            <p className="text-sm font-medium text-slate-500">
                              Retrieval #{transaction.retrieval_request?.id ?? transaction.retrieval_request_id ?? '-'}
                            </p>
                          </td>
                          <td className="px-5 py-4 align-top">
                            <p className="font-bold text-slate-900">
                              {transaction.device?.name || transaction.device_name || 'Unknown device'}
                            </p>
                            <p className="text-sm font-medium text-slate-500">
                              {(transaction.device?.classification || 'unknown').toUpperCase()}
                            </p>
                          </td>
                          <td className="px-5 py-4 align-top">
                            <p className="font-bold text-slate-900">{formatMoney(transaction.amount, transaction.currency || 'GBP')}</p>
                            <p className="text-xs font-medium text-slate-400">
                              Paid {formatDateTime(transaction.paid_at)}
                            </p>
                          </td>
                          <td className="px-5 py-4 align-top">
                            <p className="font-bold text-slate-900">{(transaction.status || 'unknown').toUpperCase()}</p>
                            <p className="text-xs font-medium text-slate-400">
                              Created {formatDateTime(transaction.created_at)}
                            </p>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[2.5rem] border border-slate-100 bg-white shadow-sm overflow-hidden">
          <div className="px-8 py-6 border-b border-slate-50">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-2xl font-black tracking-tight text-slate-900">Referral Fees</h2>
                <p className="text-slate-500 font-medium mt-1">Create, track, and update staff-managed referral fee records.</p>
              </div>
              <div className="grid w-full gap-4 lg:w-auto lg:grid-cols-5">
                <div className="w-full lg:w-56">
                  <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                    From
                  </label>
                  <input
                    type="date"
                    value={referralReportFromFilter}
                    onChange={(event) => {
                      const value = event.target.value;
                      setReferralReportFromFilter(value);
                      void loadReferralFees({ from: value });
                    }}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900"
                  />
                </div>
                <div className="w-full lg:w-56">
                  <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                    To
                  </label>
                  <input
                    type="date"
                    value={referralReportToFilter}
                    onChange={(event) => {
                      const value = event.target.value;
                      setReferralReportToFilter(value);
                      void loadReferralFees({ to: value });
                    }}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900"
                  />
                </div>
                <div className="w-full lg:w-56">
                  <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                    Partner
                  </label>
                  <select
                    value={referralPartnerIdFilter}
                    onChange={(event) => {
                      const value = event.target.value;
                      setReferralPartnerIdFilter(value);
                      void loadReferralFees({ partnerId: value });
                    }}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900"
                  >
                    <option value="all">ALL PARTNERS</option>
                    {rewardPartners.map((partner) => (
                      <option key={partner.id} value={String(partner.id)}>
                        {partner.name.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="w-full lg:w-56">
                  <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                    Partner Text
                  </label>
                  <input
                    value={referralPartnerFilter}
                    onChange={(event) => {
                      const value = event.target.value;
                      setReferralPartnerFilter(value);
                      void loadReferralFees({ partner: value });
                    }}
                    placeholder="e.g. cex"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900"
                  />
                </div>
                <div className="w-full lg:w-56">
                  <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                    Status Filter
                  </label>
                  <select
                    value={referralFeeStatusFilter}
                    onChange={(event) => {
                      const value = event.target.value;
                      setReferralFeeStatusFilter(value);
                      void loadReferralFees({ status: value });
                    }}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900"
                  >
                    <option value="all">ALL</option>
                    {REFERRAL_FEE_STATUS_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="p-8 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {referralSummaryCards.map((card) => (
                <div key={card.label} className="rounded-3xl border border-slate-100 bg-slate-50 px-5 py-5">
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400">{card.label}</p>
                  <p className="mt-2 text-3xl font-black tracking-tight text-slate-900">{card.value}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[0.95fr,1.05fr] gap-6">
              <div className="rounded-3xl border border-slate-100 bg-slate-50 p-5 space-y-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                    Referral Code ID
                  </label>
                  <input
                    value={referralFeeCodeId}
                    onChange={(event) => setReferralFeeCodeId(event.target.value)}
                    placeholder="e.g. 3"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                      Fee Status
                    </label>
                    <select
                      value={referralFeeDraftStatus}
                      onChange={(event) => setReferralFeeDraftStatus(event.target.value as ReferralFeeStatus)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900"
                    >
                      {REFERRAL_FEE_STATUS_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                      Fee Amount
                    </label>
                    <input
                      value={referralFeeAmount}
                      onChange={(event) => setReferralFeeAmount(event.target.value)}
                      placeholder="e.g. 35"
                      inputMode="numeric"
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                      Currency
                    </label>
                    <input
                      value={referralFeeCurrency}
                      onChange={(event) => setReferralFeeCurrency(event.target.value.toUpperCase())}
                      maxLength={3}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                      Due Date
                    </label>
                    <input
                      type="date"
                      value={referralFeeDueAt}
                      onChange={(event) => setReferralFeeDueAt(event.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                    Fee Reference
                  </label>
                  <input
                    value={referralFeeReference}
                    onChange={(event) => setReferralFeeReference(event.target.value)}
                    placeholder="Invoice / payment reference"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                    Referral Activity ID
                  </label>
                  <input
                    value={referralFeeActivityId}
                    onChange={(event) => setReferralFeeActivityId(event.target.value)}
                    placeholder="Optional related activity ID"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => void handleCreateReferralFee()}
                  disabled={isCreatingReferralFee}
                  className="w-full rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-60"
                >
                  {isCreatingReferralFee ? 'Creating...' : 'Create Referral Fee'}
                </button>
              </div>

              <div className="rounded-3xl border border-slate-100 bg-white overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[820px] text-left">
                    <thead>
                      <tr className="border-b border-slate-50">
                        <th className="px-5 py-4 text-xs font-black uppercase tracking-widest text-slate-400">Fee</th>
                        <th className="px-5 py-4 text-xs font-black uppercase tracking-widest text-slate-400">Partner</th>
                        <th className="px-5 py-4 text-xs font-black uppercase tracking-widest text-slate-400">Amount</th>
                        <th className="px-5 py-4 text-xs font-black uppercase tracking-widest text-slate-400">Due</th>
                        <th className="px-5 py-4 text-xs font-black uppercase tracking-widest text-slate-400">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {isLoadingReferralFees ? (
                        <tr>
                          <td colSpan={5} className="px-5 py-10 text-center text-sm font-medium text-slate-500">
                            Loading referral fees...
                          </td>
                        </tr>
                      ) : referralFees.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-5 py-10 text-center text-sm font-medium text-slate-500">
                            No referral fees found for the current filter.
                          </td>
                        </tr>
                      ) : (
                        referralFees.map((fee) => (
                          <tr key={fee.id}>
                            <td className="px-5 py-4 align-top">
                              <p className="font-black text-slate-900">Fee #{fee.id}</p>
                              <p className="text-sm font-medium text-slate-500">
                                Code {fee.referral_code?.code || `#${fee.referral_code_id ?? '-'}`}
                              </p>
                              <p className="text-xs font-medium text-slate-400">
                                Ref {fee.fee_reference || 'None'}
                              </p>
                            </td>
                            <td className="px-5 py-4 align-top">
                              <p className="font-bold text-slate-900">{fee.partner?.name || 'Unassigned partner'}</p>
                              <p className="text-sm font-medium text-slate-500">
                                {fee.device?.name || 'No linked device'}
                              </p>
                            </td>
                            <td className="px-5 py-4 align-top">
                              <p className="font-bold text-slate-900">{formatMoney(fee.fee_amount, fee.currency || 'GBP')}</p>
                              <p className="text-xs font-medium text-slate-400">
                                Created {formatDateTime(fee.created_at)}
                              </p>
                            </td>
                            <td className="px-5 py-4 align-top">
                              <p className="font-bold text-slate-900">{formatDateTime(fee.due_at)}</p>
                              <p className="text-xs font-medium text-slate-400">
                                Paid {formatDateTime(fee.paid_at)}
                              </p>
                            </td>
                            <td className="px-5 py-4 align-top">
                              <select
                                value={fee.status}
                                onChange={(event) =>
                                  void handleReferralFeeStatusChange(fee.id, event.target.value as ReferralFeeStatus)
                                }
                                disabled={updatingReferralFeeId === fee.id}
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700 disabled:opacity-60"
                              >
                                {REFERRAL_FEE_STATUS_OPTIONS.map((option) => (
                                  <option key={option} value={option}>
                                    {option.toUpperCase()}
                                  </option>
                                ))}
                              </select>
                              <p className="mt-2 text-xs font-medium text-slate-400">
                                Confirmed {formatDateTime(fee.confirmed_at)}
                              </p>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[2.5rem] border border-slate-100 bg-white shadow-sm overflow-hidden">
          <div className="px-8 py-6 border-b border-slate-50">
            <h2 className="text-2xl font-black tracking-tight text-slate-900">Device Inventory</h2>
            <p className="text-slate-500 font-medium mt-1">Full device list with classification and processing controls.</p>
          </div>
          <div className="p-8 border-b border-slate-50 bg-slate-50/50">
            <div className="grid grid-cols-1 xl:grid-cols-[1.1fr,0.9fr] gap-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1">Direct Patch</p>
                    <h3 className="text-lg font-black text-slate-900">Update Device Record</h3>
                  </div>
                  {editingDeviceId ? (
                    <button
                      type="button"
                      onClick={resetDeviceEditor}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                    >
                      Clear
                    </button>
                  ) : null}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                      Device Name
                    </label>
                    <input
                      value={editDeviceName}
                      onChange={(event) => setEditDeviceName(event.target.value)}
                      placeholder="Load a device from the list below"
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                      Category
                    </label>
                    <select
                      value={editDeviceCategory}
                      onChange={(event) => setEditDeviceCategory(event.target.value as (typeof REQUEST_CATEGORY_OPTIONS)[number])}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900"
                    >
                      {REQUEST_CATEGORY_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                      Condition
                    </label>
                    <select
                      value={editDeviceCondition}
                      onChange={(event) => setEditDeviceCondition(event.target.value as (typeof REQUEST_CONDITION_OPTIONS)[number])}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900"
                    >
                      {REQUEST_CONDITION_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                      Age
                    </label>
                    <input
                      value={editDeviceAgeYears}
                      onChange={(event) => setEditDeviceAgeYears(event.target.value)}
                      placeholder="Years"
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                      Demand
                    </label>
                    <select
                      value={editDeviceDemand}
                      onChange={(event) => setEditDeviceDemand(event.target.value as (typeof REQUEST_DEMAND_OPTIONS)[number])}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900"
                    >
                      {REQUEST_DEMAND_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                      Workflow
                    </label>
                    <select
                      value={editDeviceWorkflowStatus}
                      onChange={(event) => setEditDeviceWorkflowStatus(event.target.value as (typeof REQUEST_WORKFLOW_OPTIONS)[number])}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900"
                    >
                      {REQUEST_WORKFLOW_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                      Classification
                    </label>
                    <select
                      value={editDeviceClassification}
                      onChange={(event) => setEditDeviceClassification(event.target.value as (typeof CLASSIFICATION_OPTIONS)[number])}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900"
                    >
                      {CLASSIFICATION_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-end">
                    <label className="inline-flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 w-full">
                      <input
                        type="checkbox"
                        checked={editDeviceOwnerContacted}
                        onChange={(event) => setEditDeviceOwnerContacted(event.target.checked)}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      Owner contacted
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                    Notes
                  </label>
                  <textarea
                    value={editDeviceNotes}
                    onChange={(event) => setEditDeviceNotes(event.target.value)}
                    rows={3}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                    Contact Notes
                  </label>
                  <textarea
                    value={editDeviceContactNotes}
                    onChange={(event) => setEditDeviceContactNotes(event.target.value)}
                    rows={3}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => void handleUpdateDevice()}
                  disabled={!editingDeviceId || updatingDeviceId === editingDeviceId}
                  className="w-full rounded-2xl bg-slate-900 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {updatingDeviceId === editingDeviceId ? 'Updating Device...' : 'Update Loaded Device'}
                </button>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] text-left">
              <thead>
                <tr className="border-b border-slate-50">
                  <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-400">Device</th>
                  <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-400">Owner</th>
                  <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-400">Classification</th>
                  <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-400">Processing</th>
                  <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-400">Visibility</th>
                  <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-400">Draft</th>
                  <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-400"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {devices.map((device) => (
                  <tr key={device.id}>
                    <td className="px-6 py-5">
                      <p className="font-bold text-slate-900">{device.name}</p>
                      <p className="text-sm font-medium text-slate-500">
                        {formatDeviceTypeLabel(device.device_type)} / {(device.condition || 'unknown').toUpperCase()}
                      </p>
                    </td>
                    <td className="px-6 py-5 text-sm font-bold text-slate-600">#{device.owner_id}</td>
                    <td className="px-6 py-5">
                      <select
                        value={device.classification || 'unknown'}
                        onChange={(event) =>
                          void handleDevicePatch(
                            device.id,
                            `/api/devices/${device.id}/classification`,
                            { classification: event.target.value },
                            'Could not update this device classification right now.',
                          )
                        }
                        disabled={updatingDeviceId === device.id}
                        className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700 disabled:opacity-60"
                      >
                        {CLASSIFICATION_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option.toUpperCase()}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-5">
                      <select
                        value={(device.processing_status || device.workflow_status || 'pending').toLowerCase()}
                        onChange={(event) =>
                          void handleDevicePatch(
                            device.id,
                            `/api/devices/${device.id}/processing-status`,
                            { processing_status: event.target.value },
                            'Could not update this processing status right now.',
                          )
                        }
                        disabled={updatingDeviceId === device.id}
                        className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700 disabled:opacity-60"
                      >
                        {PROCESSING_STATUS_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option.toUpperCase()}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-5">
                      <button
                        type="button"
                        onClick={() =>
                          void handleDevicePatch(
                            device.id,
                            `/api/devices/${device.id}/visibility`,
                            { is_visible: !device.is_visible },
                            'Could not update device visibility right now.',
                          )
                        }
                        disabled={updatingDeviceId === device.id}
                        className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold ${
                          device.is_visible
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-100 text-slate-500'
                        } disabled:opacity-60`}
                      >
                        {device.is_visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        {device.is_visible ? 'Visible' : 'Hidden'}
                      </button>
                    </td>
                    <td className="px-6 py-5">
                      <button
                        type="button"
                        onClick={() =>
                          void handleDevicePatch(
                            device.id,
                            `/api/devices/${device.id}/draft`,
                            { is_draft: !device.is_draft },
                            'Could not update draft status right now.',
                          )
                        }
                        disabled={updatingDeviceId === device.id}
                        className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold ${
                          device.is_draft
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-blue-50 text-blue-700'
                        } disabled:opacity-60`}
                      >
                        {device.is_draft ? 'Draft' : 'Published'}
                      </button>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <button
                        type="button"
                        onClick={() => applyDeviceToEditor(device)}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-[2.5rem] border border-slate-100 bg-white shadow-sm overflow-hidden">
          <div className="px-8 py-6 border-b border-slate-50">
            <h2 className="text-2xl font-black tracking-tight text-slate-900">Unknown Devices Queue</h2>
            <p className="text-slate-500 font-medium mt-1">Quick triage for devices still waiting on a clear classification.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left">
              <thead>
                <tr className="border-b border-slate-50">
                  <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-400">Device</th>
                  <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-400">Demand</th>
                  <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-400">Age</th>
                  <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-400">Classification</th>
                  <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-400">Workflow</th>
                  <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-400"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {unknownDevices.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-8 py-10 text-center text-slate-500 font-medium">
                      No unknown devices in the queue right now.
                    </td>
                  </tr>
                ) : (
                  unknownDevices.map((device) => (
                    <tr key={device.id}>
                      <td className="px-6 py-5">
                        <p className="font-bold text-slate-900">{device.name}</p>
                        <p className="text-sm font-medium text-slate-500">{formatDeviceTypeLabel(device.device_type)}</p>
                      </td>
                      <td className="px-6 py-5 text-sm font-bold text-slate-600">{(device.demand || 'unknown').toUpperCase()}</td>
                      <td className="px-6 py-5 text-sm font-bold text-slate-600">{device.age_years ?? 'Unknown'}</td>
                      <td className="px-6 py-5">
                        <select
                          value={unknownQueueDrafts[device.id]?.classification || 'current'}
                          onChange={(event) =>
                            setUnknownQueueDrafts((current) => ({
                              ...current,
                              [device.id]: {
                                classification: event.target.value,
                                workflow_status: current[device.id]?.workflow_status || (device.workflow_status || 'pending').toLowerCase(),
                              },
                            }))
                          }
                          disabled={updatingDeviceId === device.id}
                          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700 disabled:opacity-60"
                        >
                          {CLASSIFICATION_OPTIONS.filter((option) => option !== 'unknown').map((option) => (
                            <option key={option} value={option}>
                              {option.toUpperCase()}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-6 py-5">
                        <select
                          value={unknownQueueDrafts[device.id]?.workflow_status || (device.workflow_status || 'pending').toLowerCase()}
                          onChange={(event) =>
                            setUnknownQueueDrafts((current) => ({
                              ...current,
                              [device.id]: {
                                classification: current[device.id]?.classification || 'current',
                                workflow_status: event.target.value,
                              },
                            }))
                          }
                          disabled={updatingDeviceId === device.id}
                          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700 disabled:opacity-60"
                        >
                          {REQUEST_WORKFLOW_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option.toUpperCase()}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <button
                          type="button"
                          onClick={() => void handleResolveUnknownQueueItem(device.id)}
                          disabled={updatingDeviceId === device.id}
                          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60"
                        >
                          {updatingDeviceId === device.id ? 'Saving...' : 'Resolve'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-[2.5rem] border border-slate-100 bg-white shadow-sm overflow-hidden">
          <div className="px-8 py-6 border-b border-slate-50">
            <h2 className="text-2xl font-black tracking-tight text-slate-900">Unknown Request Queue</h2>
            <p className="text-slate-500 font-medium mt-1">Requests whose linked device is still classified as unknown.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left">
              <thead>
                <tr className="border-b border-slate-50">
                  <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-400">Request</th>
                  <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-400">Owner</th>
                  <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-400">Device</th>
                  <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-400">Method</th>
                  <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-400">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {unknownRequests.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-8 py-10 text-center text-slate-500 font-medium">
                      No unknown requests in the queue right now.
                    </td>
                  </tr>
                ) : (
                  unknownRequests.map((request) => (
                    <tr key={request.id}>
                      <td className="px-6 py-5">
                        <p className="font-black text-slate-900">EW-{request.id}</p>
                        <p className="text-sm font-medium text-slate-500">{formatDateTime(request.created_at)}</p>
                      </td>
                      <td className="px-6 py-5 text-sm font-bold text-slate-600">#{request.consumer_id}</td>
                      <td className="px-6 py-5">
                        <p className="font-bold text-slate-900">{request.device?.name || 'Pending device'}</p>
                        <p className="text-sm font-medium text-slate-500">
                          {(request.device?.classification || 'unknown').toUpperCase()}
                        </p>
                      </td>
                      <td className="px-6 py-5 text-sm font-bold text-slate-600">
                        {(request.preferred_method || 'unknown').toUpperCase()}
                      </td>
                      <td className="px-6 py-5">
                        <select
                          value={request.status}
                          onChange={(event) => void handleRequestStatusChange(request.id, event.target.value)}
                          disabled={updatingRequestId === request.id}
                          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700 disabled:opacity-60"
                        >
                          {REQUEST_STATUS_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option.toUpperCase()}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {updatingRequestId !== null || updatingUserId !== null || updatingDeviceId !== null || updatingReferralFeeId !== null || isCreatingStaffRequest || isCreatingWipeJob || isUpdatingWipeJob || isCreatingWipeCertificate ? (
          <div className="fixed bottom-6 right-6 rounded-2xl bg-slate-900 text-white px-4 py-3 shadow-xl flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Saving changes...
          </div>
        ) : null}
      </div>
    </div>
  );
}
