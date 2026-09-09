import api from '../../api/axios';

export type PortalDevice = {
  id: number;
  owner_id: number;
  name: string;
  device_type: string;
  condition: string;
  age_years?: number | null;
  demand?: string | null;
  classification: string;
  workflow_status: string;
  processing_status?: string | null;
  is_visible?: boolean;
  is_draft?: boolean;
  owner_contacted?: boolean;
  contact_notes?: string | null;
  notes?: string | null;
  created_at?: string | null;
};

export type PortalRequest = {
  id: number;
  consumer_id: number;
  device_id: number;
  preferred_method: string;
  status: string;
  pickup_address?: string | null;
  contact_phone?: string | null;
  scheduled_time?: string | null;
  assigned_staff_id?: number | null;
  staff_note?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  device: PortalDevice | null;
  consumer?: {
    id: number;
    email?: string | null;
    role?: string | null;
    full_name?: string | null;
  } | null;
};

export type VaultArchive = {
  id: number;
  device_id: number;
  consumer_id: number;
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
  created_at?: string | null;
  download?: {
    retrieval_request_id: number;
    token: string;
    download_url: string;
    issued_at?: string | null;
    created_at?: string | null;
    expires_at?: string | null;
    revoked_at?: string | null;
    consumed_at?: string | null;
  } | null;
  device: {
    id: number;
    name: string;
    device_type: string;
    condition: string;
    classification: string;
    workflow_status: string;
    created_at?: string | null;
  } | null;
};

export type RewardVoucher = {
  id: number;
  consumer_id: number;
  device_id?: number | null;
  request_id?: number | null;
  partner: string;
  title: string;
  value_label: string;
  code: string;
  status: string;
  created_at?: string | null;
  device: {
    id: number;
    name: string;
    device_type: string;
    classification: string;
  } | null;
};

export type RewardPartner = {
  id: number;
  name: string;
  partner_type: string;
  website_url?: string | null;
  referral_landing_url?: string | null;
  active: boolean;
  supported_classifications: string[];
  created_at?: string | null;
  updated_at?: string | null;
};

export type ReferralCode = {
  id: number;
  code: string;
  partner_id?: number | null;
  consumer_id?: number | null;
  device_id?: number | null;
  request_id?: number | null;
  classification_snapshot?: string | null;
  qr_payload?: string | null;
  qr_target_url?: string | null;
  voucher_label?: string | null;
  bonus_label?: string | null;
  status: string;
  issued_at?: string | null;
  redeemed_at?: string | null;
  expires_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  partner?: RewardPartner | null;
  device?: {
    id: number;
    name: string;
    device_type: string;
    classification: string;
  } | null;
};

export type ReferralActivityRecord = {
  id: number;
  partner_id?: number | null;
  referral_code_id?: number | null;
  consumer_id?: number | null;
  device_id?: number | null;
  request_id?: number | null;
  event_type: string;
  event_reference?: string | null;
  metadata_json?: string | null;
  notes?: string | null;
  occurred_at?: string | null;
  created_at?: string | null;
  partner?: RewardPartner | null;
  referral_code?: ReferralCode | null;
};

export type ReferralFeeStatus = 'expected' | 'pending' | 'confirmed' | 'paid' | 'cancelled';

export type ReferralFee = {
  id: number;
  partner_id?: number | null;
  referral_code_id?: number | null;
  referral_activity_id?: number | null;
  consumer_id?: number | null;
  device_id?: number | null;
  request_id?: number | null;
  status: ReferralFeeStatus | string;
  fee_amount?: number | null;
  currency?: string | null;
  fee_reference?: string | null;
  due_at?: string | null;
  confirmed_at?: string | null;
  paid_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  partner?: RewardPartner | null;
  referral_code?: ReferralCode | null;
  request?: PortalRequest | null;
  device?: PortalDevice | null;
};

export type ReferralSummary = {
  total_referral_codes?: number;
  total_referral_fees?: number;
  fee_amount_total?: number;
  fee_amount_confirmed?: number;
  fee_amount_paid?: number;
  counts_by_fee_status?: Record<string, number>;
  counts_by_activity_event_type?: Record<string, number>;
  counts_by_partner?: Record<string, number>;
};

export type PaymentReportSummary = {
  total_transactions?: number;
  total_amount?: number;
  counts_by_status?: Record<string, number>;
  counts_by_provider?: Record<string, number>;
  counts_by_payment_kind?: Record<string, number>;
  paid_amount?: number;
  pending_amount?: number;
  initiated_amount?: number;
  latest_created_at?: string | null;
};

export type PaymentReportTransaction = {
  id: number;
  retrieval_request_id?: number | null;
  consumer_id?: number | null;
  provider?: string | null;
  payment_kind?: string | null;
  status?: string | null;
  amount?: number | null;
  currency?: string | null;
  provider_payment_id?: string | null;
  checkout_reference?: string | null;
  initiated_at?: string | null;
  paid_at?: string | null;
  failed_at?: string | null;
  cancelled_at?: string | null;
  refunded_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  retrieval_request?: {
    id: number;
    device_id?: number | null;
    consumer_id?: number | null;
    status?: string | null;
    retrieval_status?: string | null;
    payment_status?: string | null;
  } | null;
  consumer?: {
    id: number;
    email?: string | null;
    full_name?: string | null;
    role?: string | null;
  } | null;
  consumer_email?: string | null;
  device_name?: string | null;
  device?: {
    id: number;
    name?: string | null;
    device_type?: string | null;
    classification?: string | null;
    workflow_status?: string | null;
  } | null;
};

export type WipeJobStatus = 'queued' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
export type WipeJobVerificationStatus = 'pending' | 'verified' | 'unverified' | 'failed';
export type WipeJobType = 'standard' | 'secure_erase' | 'factory_reset' | 'manual';

export type WipeCertificate = {
  id: number;
  wipe_job_id: number;
  certificate_reference?: string | null;
  certificate_url?: string | null;
  storage_key?: string | null;
  issued_at?: string | null;
  expires_at?: string | null;
  created_at?: string | null;
};

export type WipeJob = {
  id: number;
  device_id: number;
  request_id?: number | null;
  consumer_id?: number | null;
  assigned_staff_id?: number | null;
  wipe_type: WipeJobType | string;
  status: WipeJobStatus | string;
  requested_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  failed_at?: string | null;
  cancelled_at?: string | null;
  verification_status?: WipeJobVerificationStatus | string | null;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  device?: PortalDevice | null;
  request?: PortalRequest | null;
  certificates?: WipeCertificate[];
  certificate_count?: number | null;
};

export type HealthStatus = {
  status?: string;
  service?: string;
};

export async function fetchMyRequests(): Promise<PortalRequest[]> {
  const response = await api.get('/api/requests/mine');
  return response.data?.requests ?? [];
}

export async function createStaffRequest(payload: {
  owner_id?: number | null;
  owner_email?: string | null;
  item_name: string;
  category: string;
  condition: string;
  preferred_method: string;
  pickup_address?: string | null;
  contact_phone?: string | null;
  scheduled_time?: string | null;
  age_years?: number | null;
  demand?: string | null;
  staff_note?: string | null;
  status?: string | null;
  workflow_status?: string | null;
  assigned_staff_id?: number | null;
}): Promise<PortalRequest | null> {
  const response = await api.post('/api/requests', payload);
  return response.data?.request ?? null;
}

export async function createStaffDevice(payload: {
  owner_id?: number | null;
  owner_email?: string | null;
  name: string;
  device_type: string;
  condition: string;
  age_years?: number | null;
  demand?: string | null;
  notes?: string | null;
}): Promise<PortalDevice | null> {
  const response = await api.post('/api/devices', payload);
  return response.data?.device ?? null;
}

export async function fetchRequestDetail(requestId: number): Promise<PortalRequest | null> {
  const response = await api.get(`/api/requests/${requestId}`);
  return response.data?.request ?? null;
}

export async function fetchMyDevices(): Promise<PortalDevice[]> {
  const response = await api.get('/api/devices/mine');
  return response.data?.devices ?? [];
}

export async function fetchDeviceDetail(deviceId: number): Promise<PortalDevice | null> {
  const response = await api.get(`/api/devices/${deviceId}`);
  return response.data?.device ?? null;
}

export async function updateMyDevice(
  deviceId: number,
  payload: Partial<Pick<PortalDevice, 'name' | 'device_type' | 'condition' | 'age_years' | 'demand'>>,
): Promise<PortalDevice | null> {
  const response = await api.patch(`/api/devices/${deviceId}/mine`, payload);
  return response.data?.device ?? null;
}

export async function deleteMyDevice(deviceId: number): Promise<void> {
  await api.delete(`/api/devices/${deviceId}`);
}

export async function fetchMyVaultArchives(): Promise<VaultArchive[]> {
  const response = await api.get('/api/vault/mine');
  return response.data?.archives ?? [];
}

export async function fetchMyRewards(): Promise<RewardVoucher[]> {
  const response = await api.get('/api/rewards/mine');
  return response.data?.rewards ?? [];
}

export async function fetchRewardPartners(classification?: string | null): Promise<RewardPartner[]> {
  const response = await api.get('/api/rewards/partners', {
    params: classification ? { classification } : undefined,
  });
  return response.data?.partners ?? [];
}

export async function issueReferralCode(payload: {
  device_id: number;
  request_id?: number | null;
  partner_id?: number | null;
}): Promise<ReferralCode> {
  const response = await api.post('/api/rewards/referrals', payload);
  return response.data?.referral;
}

export async function fetchReferralDetail(referralCodeId: number): Promise<ReferralCode | null> {
  const response = await api.get(`/api/rewards/referrals/${referralCodeId}`);
  return response.data?.referral ?? null;
}

export async function fetchReferralByCode(code: string): Promise<ReferralCode | null> {
  const response = await api.get(`/api/rewards/referrals/code/${encodeURIComponent(code)}`);
  return response.data?.referral ?? null;
}

export async function recordReferralOpen(referralCodeId: number, payload?: {
  source?: string;
  event_reference?: string | null;
}): Promise<ReferralCode> {
  const response = await api.post(`/api/rewards/referrals/${referralCodeId}/open`, payload ?? {});
  return response.data?.referral;
}

export async function recordReferralRedeem(referralCodeId: number, payload?: {
  channel?: string;
  event_reference?: string | null;
  notes?: string | null;
}): Promise<ReferralCode> {
  const response = await api.post(`/api/rewards/referrals/${referralCodeId}/redeem`, payload ?? {});
  return response.data?.referral;
}

export async function recordStaffReferralEvent(
  referralCodeId: number,
  payload: {
    event_type: 'handin_confirmed' | 'resale_confirmed' | 'fee_recorded';
    event_reference?: string | null;
    notes?: string | null;
  },
): Promise<{ referral: ReferralCode; activity: ReferralActivityRecord | null }> {
  const response = await api.post(`/api/rewards/referrals/${referralCodeId}/events`, payload);
  return {
    referral: response.data?.referral,
    activity: response.data?.activity ?? null,
  };
}

export async function fetchReferralActivity(params?: {
  event_type?: string | null;
  referral_code_id?: number | null;
}): Promise<ReferralActivityRecord[]> {
  const response = await api.get('/api/rewards/referral-activity', {
    params: {
      event_type: params?.event_type || undefined,
      referral_code_id: params?.referral_code_id ?? undefined,
    },
  });
  return response.data?.referral_activity ?? [];
}

export async function fetchReferralFees(params?: {
  from?: string | null;
  to?: string | null;
  status?: string | null;
  partner_id?: number | null;
  partner?: string | null;
}): Promise<ReferralFee[]> {
  const response = await api.get('/api/reports/referrals/fees', {
    params: {
      from: params?.from || undefined,
      to: params?.to || undefined,
      status: params?.status || undefined,
      partner_id: params?.partner_id ?? undefined,
      partner: params?.partner || undefined,
    },
  });
  return response.data?.referral_fees ?? [];
}

export async function fetchReferralSummary(params?: {
  from?: string | null;
  to?: string | null;
  status?: string | null;
  partner_id?: number | null;
  partner?: string | null;
}): Promise<ReferralSummary> {
  const response = await api.get('/api/reports/referrals/summary', {
    params: {
      from: params?.from || undefined,
      to: params?.to || undefined,
      status: params?.status || undefined,
      partner_id: params?.partner_id ?? undefined,
      partner: params?.partner || undefined,
    },
  });
  return response.data ?? {};
}

export async function fetchReferralActivityReport(params?: {
  from?: string | null;
  to?: string | null;
  status?: string | null;
  partner_id?: number | null;
  partner?: string | null;
}): Promise<ReferralActivityRecord[]> {
  const response = await api.get('/api/reports/referrals/activity', {
    params: {
      from: params?.from || undefined,
      to: params?.to || undefined,
      status: params?.status || undefined,
      partner_id: params?.partner_id ?? undefined,
      partner: params?.partner || undefined,
    },
  });
  return response.data?.referral_activity ?? [];
}

export async function fetchPaymentReportSummary(params?: {
  from?: string | null;
  to?: string | null;
  status?: string | null;
  provider?: string | null;
  payment_kind?: string | null;
}): Promise<PaymentReportSummary> {
  const response = await api.get('/api/reports/payments/summary', {
    params: {
      from: params?.from || undefined,
      to: params?.to || undefined,
      status: params?.status || undefined,
      provider: params?.provider || undefined,
      payment_kind: params?.payment_kind || undefined,
    },
  });
  return response.data ?? {};
}

export async function fetchPaymentReportTransactions(params?: {
  from?: string | null;
  to?: string | null;
  status?: string | null;
  provider?: string | null;
  payment_kind?: string | null;
}): Promise<PaymentReportTransaction[]> {
  const response = await api.get('/api/reports/payments/transactions', {
    params: {
      from: params?.from || undefined,
      to: params?.to || undefined,
      status: params?.status || undefined,
      provider: params?.provider || undefined,
      payment_kind: params?.payment_kind || undefined,
    },
  });
  return response.data?.transactions ?? [];
}

export async function createReferralFee(payload: {
  referral_code_id: number;
  status?: ReferralFeeStatus | string;
  fee_amount?: number | null;
  currency?: string | null;
  fee_reference?: string | null;
  due_at?: string | null;
  referral_activity_id?: number | null;
}): Promise<ReferralFee> {
  const response = await api.post('/api/rewards/referral-fees', payload);
  return response.data?.referral_fee;
}

export async function updateReferralFee(
  referralFeeId: number,
  payload: {
    status?: ReferralFeeStatus | string;
    fee_amount?: number | null;
    currency?: string | null;
    fee_reference?: string | null;
    due_at?: string | null;
  },
): Promise<ReferralFee> {
  const response = await api.patch(`/api/rewards/referral-fees/${referralFeeId}`, payload);
  return response.data?.referral_fee;
}

export async function fetchWipeJobs(params?: {
  device_id?: number | null;
  request_id?: number | null;
  assigned_staff_id?: number | null;
  status?: WipeJobStatus | string | null;
  verification_status?: WipeJobVerificationStatus | string | null;
}): Promise<WipeJob[]> {
  const response = await api.get('/api/devices/wipe-jobs', {
    params: {
      device_id: params?.device_id ?? undefined,
      request_id: params?.request_id ?? undefined,
      assigned_staff_id: params?.assigned_staff_id ?? undefined,
      status: params?.status || undefined,
      verification_status: params?.verification_status || undefined,
    },
  });
  return response.data?.wipe_jobs ?? [];
}

export async function fetchWipeJobDetail(wipeJobId: number): Promise<WipeJob | null> {
  const response = await api.get(`/api/devices/wipe-jobs/${wipeJobId}`);
  return response.data?.wipe_job ?? null;
}

export async function createWipeJob(
  deviceId: number,
  payload?: {
    request_id?: number | null;
    consumer_id?: number | null;
    assigned_staff_id?: number | null;
    wipe_type?: WipeJobType | string | null;
    status?: WipeJobStatus | string | null;
    verification_status?: WipeJobVerificationStatus | string | null;
    notes?: string | null;
  },
): Promise<WipeJob> {
  const response = await api.post(`/api/devices/${deviceId}/wipe-jobs`, payload ?? {});
  return response.data?.wipe_job;
}

export async function updateWipeJob(
  wipeJobId: number,
  payload: {
    assigned_staff_id?: number | null;
    request_id?: number | null;
    consumer_id?: number | null;
    wipe_type?: WipeJobType | string | null;
    status?: WipeJobStatus | string | null;
    verification_status?: WipeJobVerificationStatus | string | null;
    notes?: string | null;
  },
): Promise<WipeJob> {
  const response = await api.patch(`/api/devices/wipe-jobs/${wipeJobId}`, payload);
  return response.data?.wipe_job;
}

export async function fetchWipeCertificates(wipeJobId: number): Promise<WipeCertificate[]> {
  const response = await api.get(`/api/devices/wipe-jobs/${wipeJobId}/certificates`);
  return response.data?.wipe_certificates ?? [];
}

export async function createWipeCertificate(
  wipeJobId: number,
  payload: {
    certificate_reference?: string | null;
    certificate_url?: string | null;
    storage_key?: string | null;
    issued_at?: string | null;
    expires_at?: string | null;
  },
): Promise<WipeCertificate> {
  const response = await api.post(`/api/devices/wipe-jobs/${wipeJobId}/certificates`, payload);
  return response.data?.wipe_certificate;
}

export async function downloadVaultArchivePackage(archive: VaultArchive): Promise<void> {
  const downloadUrl = archive.download?.download_url;
  if (!downloadUrl) {
    throw new Error('This archive is not ready for secure download yet.');
  }

  const response = await api.get(downloadUrl);
  const payload = response.data?.download ?? response.data;
  const deviceName = (archive.device?.name || `archive-${archive.id}`)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || `archive-${archive.id}`;
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  });
  const blobUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = `${deviceName}-vault-package.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(blobUrl);
}

export async function fetchHealthStatus(): Promise<HealthStatus> {
  const response = await api.get('/api/health');
  return response.data ?? {};
}

export function formatDeviceTypeLabel(deviceType: string | undefined): string {
  const value = (deviceType || '').trim().toLowerCase();
  switch (value) {
    case 'phone':
      return 'Phone';
    case 'laptop':
      return 'Laptop';
    case 'tablet':
      return 'Tablet';
    case 'console':
      return 'Console';
    case 'other':
      return 'Other';
    default:
      return value ? value.charAt(0).toUpperCase() + value.slice(1) : 'Unknown';
  }
}

export function formatRequestStatusLabel(classification: string | undefined): 'Unknown' | 'Current' | 'Recycle' | 'Rare' {
  switch ((classification || '').trim().toLowerCase()) {
    case 'current':
      return 'Current';
    case 'recycle':
      return 'Recycle';
    case 'rare':
      return 'Rare';
    default:
      return 'Unknown';
  }
}

export function formatPreferredMethodLabel(method: string | undefined): string {
  switch ((method || '').trim().toLowerCase()) {
    case 'pickup':
      return 'Free Pickup';
    case 'dropoff':
      return 'Dropoff';
    default:
      return 'Collection';
  }
}
