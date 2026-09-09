import api from '../../api/axios';

export type AdminUser = {
  id: number;
  email: string;
  full_name?: string | null;
  auth_provider?: string | null;
  role: string;
  created_at?: string | null;
};

export async function fetchAdminUsers(params?: {
  q?: string;
  role?: string;
  limit?: number;
  offset?: number;
}): Promise<{
  users: AdminUser[];
  pagination: { total: number; limit: number; offset: number };
}> {
  const response = await api.get('/api/admin/users', {
    params: {
      q: params?.q || undefined,
      role: params?.role || undefined,
      limit: params?.limit ?? 100,
      offset: params?.offset ?? 0,
    },
  });

  return {
    users: response.data?.users ?? [],
    pagination: response.data?.pagination ?? { total: 0, limit: params?.limit ?? 100, offset: 0 },
  };
}

export async function updateAdminUserRole(userId: number, role: 'consumer' | 'staff' | 'admin'): Promise<AdminUser> {
  const response = await api.patch(`/api/admin/users/${userId}/role`, { role });
  return response.data?.user;
}

export async function fetchAdminPing(): Promise<{ message?: string; role_required?: string }> {
  const response = await api.get('/api/admin/ping');
  return response.data ?? {};
}

export type PaymentReportSummary = {
  total_transactions?: number;
  total_amount?: number;
  amount_total?: number;
  paid_amount?: number;
  amount_paid?: number;
  pending_amount?: number;
  initiated_amount?: number;
  counts_by_status?: Record<string, number>;
  counts_by_provider?: Record<string, number>;
  counts_by_payment_kind?: Record<string, number>;
  latest_created_at?: string | null;
};

export type PaymentReportTransaction = {
  id: number;
  provider?: string | null;
  status?: string | null;
  amount?: number | null;
  currency?: string | null;
  payment_kind?: string | null;
  provider_payment_id?: string | null;
  checkout_reference?: string | null;
  created_at?: string | null;
  paid_at?: string | null;
};

export type ReferralReportActivity = {
  id: number;
  event_type?: string | null;
  status?: string | null;
  partner_id?: number | null;
  referral_code_id?: number | null;
  event_reference?: string | null;
  created_at?: string | null;
};

export type ReportFilters = {
  from?: string;
  to?: string;
  status?: string;
};

function reportParams(filters?: ReportFilters) {
  return {
    from: filters?.from || undefined,
    to: filters?.to || undefined,
    status: filters?.status || undefined,
  };
}

export async function fetchPaymentReportSummary(filters?: ReportFilters): Promise<PaymentReportSummary> {
  const response = await api.get('/api/reports/payments/summary', {
    params: reportParams(filters),
  });
  return response.data ?? {};
}

export async function fetchPaymentReportTransactions(filters?: ReportFilters): Promise<PaymentReportTransaction[]> {
  const response = await api.get('/api/reports/payments/transactions', {
    params: reportParams(filters),
  });
  return response.data?.transactions ?? [];
}

export async function fetchReferralReportFees(filters?: ReportFilters) {
  const response = await api.get('/api/reports/referrals/fees', {
    params: reportParams(filters),
  });
  return response.data?.referral_fees ?? [];
}

export async function fetchReferralReportActivity(filters?: ReportFilters): Promise<ReferralReportActivity[]> {
  const response = await api.get('/api/reports/referrals/activity', {
    params: reportParams(filters),
  });
  return response.data?.referral_activity ?? [];
}

export function downloadCsv(filename: string, rows: Array<Record<string, unknown>>) {
  const headers = Array.from(rows.reduce((set, row) => {
    Object.keys(row).forEach((key) => set.add(key));
    return set;
  }, new Set<string>()));
  const escapeValue = (value: unknown) => {
    const text = value === null || value === undefined ? '' : String(value);
    return `"${text.replace(/"/g, '""')}"`;
  };
  const body = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => escapeValue(row[header])).join(',')),
  ].join('\n');
  const blob = new Blob([body], { type: 'text/csv;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
