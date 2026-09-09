import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import { BackOfficeTable, BackOfficeTd, BackOfficeTh } from "../../components/backoffice/BackOfficeTable";
import { BackOfficeSelect } from "../../components/backoffice/BackOfficeSelect";
import { StatusBadge } from "../../components/backoffice/StatusBadge";
import { statusTone } from "../../components/backoffice/statusTone";
import { getApiStyleErrorMessage } from "../../lib/httpErrors";
import { fetchStaffRequests, updateStaffRequestStatus } from "../../lib/staffPortal";
import { createStaffRequest, type PortalRequest } from "../../lib/userPortal";

const REQUEST_STATUS_OPTIONS = ['submitted', 'approved', 'rejected', 'completed'] as const;
const ACTIVE_STATUSES = new Set(['submitted', 'approved']);
const HISTORY_STATUSES = new Set(['rejected', 'completed']);
const DEVICE_TYPE_OPTIONS = ['phone', 'laptop', 'tablet', 'console', 'television', 'other'] as const;
const CONDITION_OPTIONS = ['working', 'damaged', 'broken', 'unknown'] as const;
const METHOD_OPTIONS = ['pickup', 'dropoff'] as const;

type StaffRequestForm = {
  ownerEmail: string;
  itemName: string;
  category: string;
  condition: string;
  preferredMethod: string;
  pickupAddress: string;
  contactPhone: string;
  ageYears: string;
  demand: string;
  staffNote: string;
};

const emptyStaffRequestForm: StaffRequestForm = {
  ownerEmail: '',
  itemName: '',
  category: 'phone',
  condition: 'unknown',
  preferredMethod: 'pickup',
  pickupAddress: '',
  contactPhone: '',
  ageYears: '',
  demand: '',
  staffNote: '',
};

export function StaffRequestsPage() {
  const [requests, setRequests] = useState<PortalRequest[]>([]);
  const [viewMode, setViewMode] = useState<'active' | 'history'>('active');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<StaffRequestForm>(emptyStaffRequestForm);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const loadRequests = async () => {
    setIsLoading(true);
    try {
      const items = await fetchStaffRequests();
      setRequests(items);
      setErrorMessage('');
    } catch (error: unknown) {
      setErrorMessage(getApiStyleErrorMessage(error, 'Could not load staff requests.'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadRequests();
  }, []);

  const filteredRequests = useMemo(() => {
    const q = search.trim().toLowerCase();
    return requests.filter((request) => {
      if (viewMode === 'active' && !ACTIVE_STATUSES.has(request.status)) {
        return false;
      }
      if (viewMode === 'history' && !HISTORY_STATUSES.has(request.status)) {
        return false;
      }
      if (statusFilter !== 'all' && request.status !== statusFilter) {
        return false;
      }
      if (!q) {
        return true;
      }
      return (
        String(request.id).includes(q) ||
        (request.device?.name || '').toLowerCase().includes(q) ||
        (request.device?.device_type || '').toLowerCase().includes(q) ||
        (request.consumer?.email || '').toLowerCase().includes(q) ||
        (request.consumer?.full_name || '').toLowerCase().includes(q) ||
        String(request.consumer_id).includes(q)
      );
    });
  }, [requests, search, statusFilter, viewMode]);

  const statusOptions = viewMode === 'active'
    ? REQUEST_STATUS_OPTIONS.filter((status) => ACTIVE_STATUSES.has(status))
    : REQUEST_STATUS_OPTIONS.filter((status) => HISTORY_STATUSES.has(status));

  const handleStatusChange = async (requestId: number, status: string) => {
    setUpdatingId(requestId);
    setErrorMessage('');
    try {
      await updateStaffRequestStatus(requestId, status);
      setSuccessMessage(
        HISTORY_STATUSES.has(status)
          ? `Request #${requestId} moved to history.`
          : `Request #${requestId} updated to ${status}.`,
      );
      await loadRequests();
    } catch (error: unknown) {
      setErrorMessage(getApiStyleErrorMessage(error, 'Could not update request status.'));
    } finally {
      setUpdatingId(null);
    }
  };

  const updateCreateForm = (field: keyof StaffRequestForm, value: string) => {
    setCreateForm((current) => ({ ...current, [field]: value }));
  };

  const submitStaffRequest = async () => {
    if (!createForm.itemName.trim()) {
      setErrorMessage('Device name is required.');
      return;
    }

    setUpdatingId(-1);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const created = await createStaffRequest({
        owner_email: createForm.ownerEmail.trim() || null,
        item_name: createForm.itemName.trim(),
        category: createForm.category,
        condition: createForm.condition,
        preferred_method: createForm.preferredMethod,
        pickup_address: createForm.pickupAddress.trim() || null,
        contact_phone: createForm.contactPhone.trim() || null,
        age_years: createForm.ageYears ? Number(createForm.ageYears) : null,
        demand: createForm.demand.trim() || null,
        staff_note: createForm.staffNote.trim() || null,
        status: 'submitted',
        workflow_status: 'pending',
      });
      setSuccessMessage(`Request #${created?.id ?? 'new'} was created.`);
      setCreateForm(emptyStaffRequestForm);
      setIsCreateOpen(false);
      await loadRequests();
    } catch (error: unknown) {
      setErrorMessage(getApiStyleErrorMessage(error, 'Could not create staff request.'));
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <section className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-600">Staff queue</p>
          <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">Collection requests</h2>
          <p className="mt-2 text-sm font-medium text-slate-500">
            Search and update customer collection requests from one focused queue.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-500"
          >
            Create staff request
          </button>
          <button
            type="button"
            onClick={() => void loadRequests()}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50"
          >
            Refresh
          </button>
        </div>
      </section>

      <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex rounded-2xl bg-slate-100 p-1">
          {(['active', 'history'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => {
                setViewMode(mode);
                setStatusFilter('all');
              }}
              className={[
                "rounded-xl px-4 py-2 text-sm font-black transition",
                viewMode === mode ? "bg-white text-emerald-700 shadow-sm" : "text-slate-500 hover:text-slate-800",
              ].join(" ")}
            >
              {mode === 'active' ? 'Active queue' : 'History'}
            </button>
          ))}
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search request, device, or owner..."
          className="min-w-[320px] flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium outline-none focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
        />
        <BackOfficeSelect
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-slate-50"
        >
          <option value="all">All statuses</option>
          {statusOptions.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </BackOfficeSelect>
      </section>

      {errorMessage ? (
        <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
          {errorMessage}
        </div>
      ) : null}
      {successMessage ? (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
          {successMessage}
        </div>
      ) : null}

      {isLoading ? (
        <div className="flex min-h-[30vh] items-center justify-center text-slate-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading requests...
        </div>
      ) : (
        <BackOfficeTable>
          <thead>
            <tr>
              <BackOfficeTh>Request</BackOfficeTh>
              <BackOfficeTh>Owner</BackOfficeTh>
              <BackOfficeTh>Device</BackOfficeTh>
              <BackOfficeTh>Method</BackOfficeTh>
              <BackOfficeTh>Status</BackOfficeTh>
              <BackOfficeTh>Action</BackOfficeTh>
            </tr>
          </thead>
          <tbody>
            {filteredRequests.map((request) => (
              <tr key={request.id}>
                <BackOfficeTd>
                  <span className="font-black text-slate-900">#{request.id}</span>
                </BackOfficeTd>
                <BackOfficeTd>
                  <div>
                    <p className="font-bold text-slate-900">
                      {request.consumer?.full_name || request.consumer?.email || `Consumer #${request.consumer_id}`}
                    </p>
                    <p className="text-xs font-bold text-slate-400">
                      {request.consumer?.email ? `#${request.consumer_id}` : 'Linked account'}
                    </p>
                  </div>
                </BackOfficeTd>
                <BackOfficeTd>
                  <div>
                    <p className="font-bold text-slate-900">{request.device?.name || 'Pending device'}</p>
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                      {request.device?.device_type || 'unknown'}
                    </p>
                  </div>
                </BackOfficeTd>
                <BackOfficeTd>
                  <StatusBadge value={request.preferred_method} tone={statusTone(request.preferred_method)} />
                </BackOfficeTd>
                <BackOfficeTd>
                  <StatusBadge value={request.status} tone={statusTone(request.status)} />
                </BackOfficeTd>
                <BackOfficeTd>
                  <BackOfficeSelect
                    value={request.status}
                    disabled={updatingId === request.id}
                    onChange={(e) => void handleStatusChange(request.id, e.target.value)}
                  >
                    {REQUEST_STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </BackOfficeSelect>
                </BackOfficeTd>
              </tr>
            ))}
            {!filteredRequests.length ? (
              <tr>
                <BackOfficeTd>No matching requests.</BackOfficeTd>
                <BackOfficeTd />
                <BackOfficeTd />
                <BackOfficeTd />
                <BackOfficeTd />
                <BackOfficeTd />
              </tr>
            ) : null}
          </tbody>
        </BackOfficeTable>
      )}

      {isCreateOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-6">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[2rem] border border-slate-200 bg-white p-6 shadow-2xl">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-600">
              Staff intake
            </p>
            <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-900">
              Create request and device details
            </h3>
            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              <input
                value={createForm.ownerEmail}
                onChange={(event) => updateCreateForm('ownerEmail', event.target.value)}
                placeholder="Owner email (optional)"
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium outline-none focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
              />
              <input
                value={createForm.itemName}
                onChange={(event) => updateCreateForm('itemName', event.target.value)}
                placeholder="Device name"
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium outline-none focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
              />
              <BackOfficeSelect
                value={createForm.category}
                onChange={(event) => updateCreateForm('category', event.target.value)}
                className="bg-slate-50 py-3"
              >
                {DEVICE_TYPE_OPTIONS.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </BackOfficeSelect>
              <BackOfficeSelect
                value={createForm.condition}
                onChange={(event) => updateCreateForm('condition', event.target.value)}
                className="bg-slate-50 py-3"
              >
                {CONDITION_OPTIONS.map((condition) => (
                  <option key={condition} value={condition}>
                    {condition}
                  </option>
                ))}
              </BackOfficeSelect>
              <BackOfficeSelect
                value={createForm.preferredMethod}
                onChange={(event) => updateCreateForm('preferredMethod', event.target.value)}
                className="bg-slate-50 py-3"
              >
                {METHOD_OPTIONS.map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </BackOfficeSelect>
              <input
                value={createForm.contactPhone}
                onChange={(event) => updateCreateForm('contactPhone', event.target.value)}
                placeholder="Contact phone"
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium outline-none focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
              />
              <input
                value={createForm.ageYears}
                onChange={(event) => updateCreateForm('ageYears', event.target.value)}
                placeholder="Age in years"
                type="number"
                min="0"
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium outline-none focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
              />
              <input
                value={createForm.demand}
                onChange={(event) => updateCreateForm('demand', event.target.value)}
                placeholder="Demand/value note"
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium outline-none focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
              />
              <textarea
                value={createForm.pickupAddress}
                onChange={(event) => updateCreateForm('pickupAddress', event.target.value)}
                placeholder="Pickup/dropoff address"
                rows={3}
                className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium outline-none focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
              />
              <textarea
                value={createForm.staffNote}
                onChange={(event) => updateCreateForm('staffNote', event.target.value)}
                placeholder="Staff note"
                rows={3}
                className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium outline-none focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
              />
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={updatingId === -1}
                onClick={() => setIsCreateOpen(false)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={updatingId === -1}
                onClick={() => void submitStaffRequest()}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-60"
              >
                {updatingId === -1 ? 'Creating...' : 'Create request'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

