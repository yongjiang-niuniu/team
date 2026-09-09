import api from '../../api/axios';
import type { PortalDevice, PortalRequest } from './userPortal';

export type DeviceStats = {
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

export async function fetchStaffDashboardData(): Promise<{
  stats: DeviceStats;
  requests: PortalRequest[];
  devices: PortalDevice[];
  unknownDevices: PortalDevice[];
}> {
  const [statsResponse, requestsResponse, devicesResponse, unknownResponse] = await Promise.all([
    api.get('/api/devices/statistics'),
    api.get('/api/requests'),
    api.get('/api/devices'),
    api.get('/api/devices/unknown-queue'),
  ]);

  return {
    stats: statsResponse.data ?? {},
    requests: requestsResponse.data?.requests ?? [],
    devices: devicesResponse.data?.devices ?? [],
    unknownDevices: unknownResponse.data?.devices ?? [],
  };
}

export async function fetchStaffRequests(): Promise<PortalRequest[]> {
  const response = await api.get('/api/requests');
  return response.data?.requests ?? [];
}

export async function fetchStaffDeviceStats(): Promise<DeviceStats> {
  const response = await api.get('/api/devices/statistics');
  return response.data ?? {};
}

export async function createDraftFromStaffRequest(requestId: number): Promise<PortalDevice | null> {
  const response = await api.post(`/api/requests/${requestId}/staff-draft`);
  return response.data?.device ?? null;
}

export async function updateStaffRequestStatus(
  requestId: number,
  status: string,
): Promise<PortalRequest | null> {
  const response = await api.patch(`/api/requests/${requestId}/status`, { status });
  return response.data?.request ?? null;
}

export async function fetchStaffDevices(): Promise<PortalDevice[]> {
  const response = await api.get('/api/devices');
  return response.data?.devices ?? [];
}

export async function fetchUnknownDevices(): Promise<PortalDevice[]> {
  const response = await api.get('/api/devices/unknown-queue');
  return response.data?.devices ?? [];
}

export async function patchStaffDevice(
  deviceId: number,
  payload: Partial<PortalDevice>,
): Promise<PortalDevice | null> {
  const response = await api.patch(`/api/devices/${deviceId}`, payload);
  return response.data?.device ?? null;
}

export async function patchStaffDeviceField(
  deviceId: number,
  field: 'classification' | 'processing-status' | 'visibility' | 'draft',
  value: string | boolean,
): Promise<PortalDevice | null> {
  const payload =
    field === 'processing-status'
      ? { processing_status: value }
      : field === 'visibility'
        ? { is_visible: value }
        : field === 'draft'
          ? { is_draft: value }
          : { classification: value };
  const response = await api.patch(`/api/devices/${deviceId}/${field}`, payload);
  return response.data?.device ?? null;
}

export type WipeJob = {
  id: number;
  device_id: number;
  request_id?: number | null;
  consumer_id?: number | null;
  assigned_staff_id?: number | null;
  wipe_type?: string | null;
  status: string;
  verification_status?: string | null;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  device?: {
    id: number;
    name: string;
    device_type?: string | null;
    classification?: string | null;
  } | null;
  certificate_count?: number | null;
};

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

export async function fetchWipeJobs(params?: {
  status?: string | null;
  verification_status?: string | null;
}): Promise<WipeJob[]> {
  const response = await api.get('/api/devices/wipe-jobs', { params });
  return response.data?.wipe_jobs ?? [];
}

export async function patchWipeJob(
  wipeJobId: number,
  payload: Partial<Pick<WipeJob, 'status' | 'verification_status' | 'notes' | 'assigned_staff_id'>>,
): Promise<WipeJob | null> {
  const response = await api.patch(`/api/devices/wipe-jobs/${wipeJobId}`, payload);
  return response.data?.wipe_job ?? null;
}

export async function createWipeCertificate(
  wipeJobId: number,
  payload: {
    certificate_reference?: string | null;
    certificate_url?: string | null;
    storage_key?: string | null;
  },
): Promise<WipeCertificate | null> {
  const response = await api.post(`/api/devices/wipe-jobs/${wipeJobId}/certificates`, payload);
  return response.data?.wipe_certificate ?? null;
}
