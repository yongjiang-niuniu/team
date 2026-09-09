import { useCallback, useEffect, useState } from 'react';
import type { ChangeEvent, ElementType, FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Smartphone,
  Laptop,
  Gamepad2,
  Cpu,
  Clock,
  Calendar,
  Filter,
  Download,
  ExternalLink,
  QrCode,
  CreditCard,
  X,
  Leaf,
  CheckCircle2,
  TrendingUp,
  AlertTriangle,
  ShieldCheck,
  Sparkles,
  Loader2,
  ChevronRight,
  Pencil,
  Trash2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ReferralQrDialog } from '../components/ReferralQrDialog';
import {
  deleteMyDevice,
  downloadVaultArchivePackage,
  fetchDeviceDetail,
  fetchMyDevices,
  fetchMyRequests,
  fetchMyVaultArchives,
  fetchRequestDetail,
  formatDeviceTypeLabel,
  formatPreferredMethodLabel,
  formatRequestStatusLabel,
  issueReferralCode,
  type PortalDevice,
  type PortalRequest,
  type ReferralCode,
  type VaultArchive,
  updateMyDevice,
} from '../lib/userPortal';
import { getApiStyleErrorMessage } from '../lib/httpErrors';

type DeviceStatus = 'Unknown' | 'Current' | 'Recycle' | 'Rare';

type RequestItem = {
  id: string;
  requestId: number;
  deviceId: number | null;
  name: string;
  category: string;
  date: string;
  status: DeviceStatus;
  serviceType: string;
  icon: ElementType;
  valueUrl?: string;
  request: PortalRequest;
  archive: VaultArchive | null;
};

type DeviceFormState = {
  name: string;
  device_type: string;
  condition: string;
  age_years: string;
  demand: string;
};

const ICONS_BY_TYPE: Record<string, ElementType> = {
  phone: Smartphone,
  laptop: Laptop,
  tablet: Cpu,
  console: Gamepad2,
  other: Cpu,
};

const STATUS_STYLES: Record<DeviceStatus, string> = {
  Unknown: 'bg-amber-50 text-amber-600 border-amber-100',
  Current: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  Recycle: 'bg-blue-50 text-blue-600 border-blue-100',
  Rare: 'bg-purple-50 text-purple-600 border-purple-100',
};

const FILTER_CATEGORY_OPTIONS = ['Phone', 'Laptop', 'Tablet', 'Console', 'Other'] as const;
const FILTER_STATUS_OPTIONS: DeviceStatus[] = ['Unknown', 'Current', 'Recycle', 'Rare'];
const DEVICE_TYPE_OPTIONS = ['phone', 'laptop', 'tablet', 'console', 'other'] as const;
const CONDITION_OPTIONS = ['working', 'broken', 'unknown'] as const;
const DEMAND_OPTIONS = ['high', 'medium', 'low', 'unknown'] as const;
const PAGE_SIZE = 5;

function downloadCsv(filename: string, rows: Array<Record<string, unknown>>) {
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

function toDeviceFormState(device: PortalDevice | null): DeviceFormState {
  return {
    name: device?.name || '',
    device_type: device?.device_type || 'phone',
    condition: device?.condition || 'working',
    age_years: device?.age_years === null || device?.age_years === undefined ? '' : String(device.age_years),
    demand: device?.demand || 'unknown',
  };
}

export function DashboardPage() {
  const [searchParams] = useSearchParams();
  const [selectedDevice, setSelectedDevice] = useState<RequestItem | null>(null);
  const [selectedRequestDetail, setSelectedRequestDetail] = useState<PortalRequest | null>(null);
  const [selectedDeviceDetail, setSelectedDeviceDetail] = useState<PortalDevice | null>(null);
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [devices, setDevices] = useState<PortalDevice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [downloadingRequestId, setDownloadingRequestId] = useState<string | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isEditingDevice, setIsEditingDevice] = useState(false);
  const [isSavingDevice, setIsSavingDevice] = useState(false);
  const [deletingDeviceId, setDeletingDeviceId] = useState<number | null>(null);
  const [issuingReferralRequestId, setIssuingReferralRequestId] = useState<number | null>(null);
  const [selectedReferral, setSelectedReferral] = useState<ReferralCode | null>(null);
  const [deviceForm, setDeviceForm] = useState<DeviceFormState>(toDeviceFormState(null));
  const [filter, setFilter] = useState({ category: '', status: '' });
  const [draftFilter, setDraftFilter] = useState({ category: '', status: '' });
  const [showFilter, setShowFilter] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (showFilter) {
      const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.overflow = 'hidden';
      document.body.style.paddingRight = `${scrollBarWidth}px`;
    } else {
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
    }

    return () => {
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
    };
  }, [showFilter]);

  const buildRequestItems = useCallback((items: PortalRequest[], archives: VaultArchive[]): RequestItem[] => {
    const archiveByDeviceId = new Map<number, VaultArchive>();
    for (const archive of archives) {
      if (typeof archive.device_id === 'number') {
        archiveByDeviceId.set(archive.device_id, archive);
      }
    }

    return items.map((request) => {
      const device = request.device;
      const deviceType = (device?.device_type || '').toLowerCase();
      const icon = ICONS_BY_TYPE[deviceType] || Cpu;
      const createdAt = request.created_at || device?.created_at;
      const archive = device?.id ? archiveByDeviceId.get(device.id) || null : null;

      return {
        id: `EW-${request.id}`,
        requestId: request.id,
        deviceId: device?.id ?? null,
        name: device?.name || 'Pending Device',
        category: formatDeviceTypeLabel(device?.device_type),
        date: createdAt
          ? new Date(createdAt).toLocaleDateString('en-GB', {
              month: 'short',
              day: '2-digit',
              year: 'numeric',
            })
          : 'Pending',
        status: formatRequestStatusLabel(device?.classification),
        serviceType: formatPreferredMethodLabel(request.preferred_method),
        icon,
        valueUrl: device?.name
          ? `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(device.name)}`
          : undefined,
        request,
        archive,
      };
    });
  }, []);

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    try {
      const [items, archives, userDevices] = await Promise.all([
        fetchMyRequests(),
        fetchMyVaultArchives(),
        fetchMyDevices(),
      ]);
      setRequests(buildRequestItems(items, archives));
      setDevices(userDevices);
      setErrorMessage('');
    } catch (error: unknown) {
      setErrorMessage(getApiStyleErrorMessage(error, 'Could not load your requests.'));
    } finally {
      setIsLoading(false);
    }
  }, [buildRequestItems]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    let ignore = false;

    async function loadSelectionDetails() {
      if (!selectedDevice) {
        setSelectedRequestDetail(null);
        setSelectedDeviceDetail(null);
        setIsEditingDevice(false);
        setDeviceForm(toDeviceFormState(null));
        return;
      }

      setIsDetailLoading(true);
      try {
        const [requestDetail, deviceDetail] = await Promise.all([
          fetchRequestDetail(selectedDevice.requestId),
          selectedDevice.deviceId ? fetchDeviceDetail(selectedDevice.deviceId) : Promise.resolve(null),
        ]);

        if (!ignore) {
          setSelectedRequestDetail(requestDetail);
          setSelectedDeviceDetail(deviceDetail);
          setDeviceForm(toDeviceFormState(deviceDetail));
        }
      } catch (error: unknown) {
        if (!ignore) {
          setErrorMessage(getApiStyleErrorMessage(error, 'Could not load the latest device details.'));
        }
      } finally {
        if (!ignore) {
          setIsDetailLoading(false);
        }
      }
    }

    void loadSelectionDetails();
    return () => {
      ignore = true;
    };
  }, [selectedDevice]);

  const handleDashboardDownload = async (requestItem: RequestItem) => {
    if (!requestItem.archive) {
      setErrorMessage('No secure vault archive is available for this request yet.');
      return;
    }

    setDownloadingRequestId(requestItem.id);
    setErrorMessage('');
    try {
      await downloadVaultArchivePackage(requestItem.archive);
    } catch (error: unknown) {
      setErrorMessage(
        getApiStyleErrorMessage(error, 'Could not download this data package right now.'),
      );
    } finally {
      setDownloadingRequestId(null);
    }
  };

  const handleDeviceFormChange =
    (field: keyof DeviceFormState) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setDeviceForm((current) => ({ ...current, [field]: event.target.value }));
    };

  const handleEditSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedDeviceDetail) {
      return;
    }

    setIsSavingDevice(true);
    setErrorMessage('');
    try {
      const updatedDevice = await updateMyDevice(selectedDeviceDetail.id, {
        name: deviceForm.name.trim(),
        device_type: deviceForm.device_type,
        condition: deviceForm.condition,
        age_years: deviceForm.age_years === '' ? null : Number(deviceForm.age_years),
        demand: deviceForm.demand,
      });

      if (updatedDevice) {
        setSelectedDeviceDetail(updatedDevice);
        setRequests((current) =>
          current.map((item) =>
            item.deviceId === updatedDevice.id
              ? {
                  ...item,
                  name: updatedDevice.name,
                  category: formatDeviceTypeLabel(updatedDevice.device_type),
                  status: formatRequestStatusLabel(updatedDevice.classification),
                  request: item.request.device
                    ? {
                        ...item.request,
                        device: {
                          ...item.request.device,
                          ...updatedDevice,
                        },
                      }
                    : item.request,
                }
              : item,
          ),
        );
        setDevices((current) =>
          current.map((device) => (device.id === updatedDevice.id ? { ...device, ...updatedDevice } : device)),
        );
      }

      setIsEditingDevice(false);
    } catch (error: unknown) {
      setErrorMessage(getApiStyleErrorMessage(error, 'Could not save your device changes.'));
    } finally {
      setIsSavingDevice(false);
    }
  };

  const handleDeleteDevice = async (deviceId: number) => {
    setDeletingDeviceId(deviceId);
    setErrorMessage('');
    try {
      await deleteMyDevice(deviceId);
      setDevices((current) => current.filter((device) => device.id !== deviceId));
      setRequests((current) => current.filter((item) => item.deviceId !== deviceId));
      if (selectedDevice?.deviceId === deviceId) {
        setSelectedDevice(null);
      }
    } catch (error: unknown) {
      setErrorMessage(getApiStyleErrorMessage(error, 'Could not delete this device right now.'));
    } finally {
      setDeletingDeviceId(null);
    }
  };

  const handleGenerateReferralQr = async (requestItem: RequestItem) => {
    if (!requestItem.deviceId) {
      setErrorMessage('This request does not have a saved device yet.');
      return;
    }

    setIssuingReferralRequestId(requestItem.requestId);
    setErrorMessage('');
    try {
      const referral = await issueReferralCode({
        device_id: requestItem.deviceId,
        request_id: requestItem.requestId,
      });
      setSelectedReferral(referral);
    } catch (error: unknown) {
      setErrorMessage(getApiStyleErrorMessage(error, 'Could not generate a trade-in QR code right now.'));
    } finally {
      setIssuingReferralRequestId(null);
    }
  };

  const handleExport = () => {
    downloadCsv(
      `ewaste-requests-${new Date().toISOString().slice(0, 10)}.csv`,
      filteredRequests.map((request) => ({
        request_id: request.id,
        device: request.name,
        category: request.category,
        status: request.status,
        service: request.serviceType,
        submitted: request.date,
        workflow: request.request.device?.workflow_status,
      })),
    );
  };

  const searchQuery = (searchParams.get('q') || '').trim().toLowerCase();
  const filteredRequests = requests.filter((request) => {
    if (filter.category && request.category !== filter.category) {
      return false;
    }
    if (filter.status && request.status !== filter.status) {
      return false;
    }
    if (searchQuery) {
      const searchable = [
        request.id,
        request.name,
        request.category,
        request.status,
        request.serviceType,
        request.request.device?.workflow_status,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!searchable.includes(searchQuery)) {
        return false;
      }
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / PAGE_SIZE));
  const pagedRequests = filteredRequests.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    setCurrentPage(1);
  }, [filter.category, filter.status, searchQuery]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const stats = [
    {
      label: 'Requests Submitted',
      value: String(requests.length),
      subtext: 'Devices tracked in your account',
    },
    {
      label: 'Classified Devices',
      value: String(requests.filter((request) => request.status !== 'Unknown').length),
      subtext: 'Requests with a system result',
    },
    {
      label: 'Pickup Requests',
      value: String(requests.filter((request) => request.request.preferred_method === 'pickup').length),
      subtext: 'Courier collections requested',
    },
  ];

  const latestDevices = devices.slice(0, 6);
  const selectedRequest = selectedRequestDetail || selectedDevice?.request || null;
  const modalDevice = selectedDeviceDetail || selectedRequest?.device || null;
  const modalStatus = formatRequestStatusLabel(modalDevice?.classification);
  const isDevicePending = (modalDevice?.workflow_status || 'pending').toLowerCase() === 'pending';

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 mb-2 tracking-tight">My Recycling Requests</h1>
          <p className="text-slate-500 font-medium text-lg">Track and manage your electronic waste submissions.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            className="flex items-center gap-2 px-5 py-3 bg-white border border-slate-200 rounded-2xl font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
            onClick={() => {
              setDraftFilter(filter);
              setShowFilter(true);
            }}
          >
            <Filter className="w-4 h-4" />
            Filter
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={!filteredRequests.length}
            className="flex items-center gap-2 px-5 py-3 bg-white border border-slate-200 rounded-2xl font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-40 rounded-[2rem] border border-slate-100 bg-white animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-center relative overflow-hidden"
            >
              {index === 0 ? (
                <div className="absolute -top-4 -right-4 p-8 opacity-[0.03] pointer-events-none">
                  <Leaf className="w-32 h-32 text-emerald-900" />
                </div>
              ) : null}
              <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2 relative z-10">{stat.label}</p>
              <div className="flex flex-col gap-1 relative z-10">
                <h3 className="text-4xl font-black text-slate-900 tracking-tighter">{stat.value}</h3>
                <span className="text-sm font-bold text-slate-500 mt-1">{stat.subtext}</span>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <div className="bg-white rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.06)] border border-slate-100/50 overflow-hidden">
        <div className="px-8 py-6 border-b border-slate-50 flex items-center justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">My Devices</p>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Your latest submitted devices</h2>
          </div>
          <span className="inline-flex items-center px-3 py-1 bg-slate-50 text-slate-600 border border-slate-100 rounded-full text-xs font-bold">
            {devices.length} Total
          </span>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-8">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-40 rounded-[2rem] bg-slate-50 animate-pulse" />
            ))}
          </div>
        ) : devices.length === 0 ? (
          <div className="px-8 py-12 text-center">
            <p className="text-xl font-black text-slate-900 mb-2">No Devices Yet</p>
            <p className="text-slate-500 font-medium">Submit your first device request and it will appear here for quick tracking.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-8">
            {latestDevices.map((device, index) => {
              const deviceType = (device.device_type || '').toLowerCase();
              const Icon = ICONS_BY_TYPE[deviceType] || Cpu;
              const statusLabel = formatRequestStatusLabel(device.classification);
              return (
                <motion.div
                  key={device.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * index }}
                  className="rounded-[2rem] border border-slate-100 bg-slate-50/80 p-6 hover:bg-white hover:shadow-sm transition-all"
                >
                  <div className="flex items-start justify-between gap-3 mb-5">
                    <div className="w-12 h-12 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-slate-500 shadow-sm">
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold border ${STATUS_STYLES[statusLabel]}`}>
                      {statusLabel}
                    </span>
                  </div>

                  <h3 className="text-lg font-black text-slate-900 mb-1">{device.name}</h3>
                  <p className="text-sm font-bold text-slate-500 mb-4">
                    {formatDeviceTypeLabel(device.device_type)} / {(device.condition || 'unknown').toUpperCase()}
                  </p>

                  <div className="space-y-2 text-sm font-medium text-slate-500">
                    <p>
                      Workflow:
                      <span className="ml-2 font-bold text-slate-900">{device.workflow_status || 'pending'}</span>
                    </p>
                    <p>
                      Market demand:
                      <span className="ml-2 font-bold text-slate-900">{device.demand || 'unknown'}</span>
                    </p>
                    <p>
                      Device age:
                      <span className="ml-2 font-bold text-slate-900">{device.age_years ?? 'Unknown'}</span>
                    </p>
                  </div>

                  <div className="mt-5 flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const linkedRequest = requests.find((request) => request.deviceId === device.id);
                        if (linkedRequest) {
                          setSelectedDevice(linkedRequest);
                        }
                      }}
                      className="flex-1 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-700 border border-slate-200 hover:bg-slate-50"
                    >
                      View
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const linkedRequest = requests.find((request) => request.deviceId === device.id);
                        if (linkedRequest) {
                          setSelectedDevice(linkedRequest);
                          setIsEditingDevice(true);
                        }
                      }}
                      disabled={!isDevicePending && selectedDeviceDetail?.id === device.id}
                      className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-300"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeleteDevice(device.id)}
                      disabled={deletingDeviceId === device.id || (device.workflow_status || '').toLowerCase() !== 'pending'}
                      className="rounded-xl bg-red-50 px-4 py-2.5 text-sm font-bold text-red-600 hover:bg-red-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.06)] border border-slate-100/50 overflow-hidden">
        {isLoading ? (
          <div className="p-8">
            <div className="h-8 w-40 rounded-xl bg-slate-100 animate-pulse mb-6" />
            <div className="space-y-4">
              {[0, 1, 2].map((item) => (
                <div key={item} className="h-16 rounded-2xl bg-slate-50 animate-pulse" />
              ))}
            </div>
          </div>
        ) : errorMessage ? (
          <div className="p-8">
            <div className="rounded-3xl border border-red-100 bg-red-50 px-6 py-5 text-sm font-semibold text-red-600">
              {errorMessage}
            </div>
          </div>
        ) : requests.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-xl font-black text-slate-900 mb-2">No Requests Yet</p>
            <p className="text-slate-500 font-medium">Submit your first device to start tracking its recycling journey.</p>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-xl font-black text-slate-900 mb-2">No Matching Results</p>
            <p className="text-slate-500 font-medium">No requests match the selected filter. Try a different category or status.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="border-b border-slate-50">
                  <th className="px-8 py-6 text-xs font-bold uppercase tracking-wider text-slate-400">Device Item</th>
                  <th className="px-8 py-6 text-xs font-bold uppercase tracking-wider text-slate-400">Category</th>
                  <th className="px-8 py-6 text-xs font-bold uppercase tracking-wider text-slate-400">Date Submitted</th>
                  <th className="px-8 py-6 text-xs font-bold uppercase tracking-wider text-slate-400">Service</th>
                  <th className="px-8 py-6 text-xs font-bold uppercase tracking-wider text-slate-400">Status</th>
                  <th className="px-8 py-6 text-xs font-bold uppercase tracking-wider text-slate-400 text-right">Quick Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {pagedRequests.map((request, index) => (
                  <motion.tr
                    key={request.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 + index * 0.05 }}
                    onClick={() => setSelectedDevice(request)}
                    className="group hover:bg-slate-50/50 transition-colors cursor-pointer"
                  >
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-white group-hover:shadow-sm transition-all border border-transparent group-hover:border-slate-100">
                          <request.icon className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 leading-tight">{request.name}</p>
                          <p className="text-xs font-bold text-slate-400 tracking-wider uppercase mt-1">ID: {request.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className="text-sm font-bold text-slate-600">{request.category}</span>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2 text-sm font-bold text-slate-500">
                        <Calendar className="w-4 h-4 opacity-50" />
                        {request.date}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className="inline-flex items-center px-3 py-1 bg-slate-50 text-slate-600 border border-slate-100 rounded-lg text-xs font-bold">
                        {request.serviceType}
                      </span>
                    </td>
                    <td className="px-8 py-6">
                      <span className={`inline-flex items-center px-4 py-1.5 rounded-full text-xs font-bold border ${STATUS_STYLES[request.status]}`}>
                        {request.status}
                      </span>
                      {request.status === 'Recycle' ? (
                        <div className="flex items-center gap-1.5 mt-2 text-xs font-medium text-slate-500">
                          <Clock className="w-3.5 h-3.5" />
                          Cloud storage expires in 89 days
                        </div>
                      ) : null}
                    </td>
                    <td className="px-8 py-6 text-right">
                      {request.archive?.download ? (
                        <div className="flex flex-col items-end gap-1.5">
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleDashboardDownload(request);
                            }}
                            disabled={downloadingRequestId === request.id}
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 disabled:cursor-not-allowed text-white rounded-xl text-sm font-bold transition-colors shadow-sm"
                          >
                            <Download className="w-4 h-4" />
                            {downloadingRequestId === request.id ? 'Preparing...' : 'Download Data'}
                          </button>
                          <span className="text-[10px] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-md border border-red-100">
                            Expires in 45 days
                          </span>
                        </div>
                      ) : request.serviceType !== 'Retrieval (Paid)' && request.status === 'Current' ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleGenerateReferralQr(request);
                          }}
                          disabled={issuingReferralRequestId === request.requestId}
                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-bold transition-colors shadow-sm"
                        >
                          <QrCode className="w-4 h-4" />
                          {issuingReferralRequestId === request.requestId ? 'Issuing...' : 'Get Trade-in QRCode'}
                        </button>
                      ) : null}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="px-8 py-6 border-t border-slate-50 flex items-center justify-between">
          <p className="text-sm font-bold text-slate-400">
            Showing {filteredRequests.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0} to {Math.min(currentPage * PAGE_SIZE, filteredRequests.length)} of {filteredRequests.length} requests
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={currentPage <= 1}
              className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-500 hover:bg-slate-50 disabled:text-slate-300 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="px-3 py-2 text-xs font-black uppercase tracking-widest text-slate-400">
              {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              disabled={currentPage >= totalPages}
              className="px-4 py-2 rounded-xl border border-emerald-100 bg-emerald-50 text-sm font-bold text-emerald-600 hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {selectedDevice ? (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedDevice(null)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-[2.5rem] shadow-2xl z-50 overflow-hidden"
            >
              <div className="p-8 md:p-10">
                <div className="flex items-start justify-between mb-8">
                  <div className="flex items-center gap-5">
                    <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-600">
                      <selectedDevice.icon className="w-8 h-8" />
                    </div>
                    <div>
                      <h2 className="text-3xl font-black text-slate-900 mb-1 tracking-tight">{modalDevice?.name || selectedDevice.name}</h2>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-slate-400 uppercase tracking-wider">ID: {selectedDevice.id}</span>
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${STATUS_STYLES[modalStatus]}`}>
                          {modalStatus}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedDevice(null)}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                {isDetailLoading ? (
                  <div className="rounded-3xl border border-slate-100 bg-slate-50 px-6 py-10 text-center text-slate-500 font-medium">
                    Loading latest device details...
                  </div>
                ) : isEditingDevice && modalDevice ? (
                  <form onSubmit={handleEditSubmit} className="space-y-6">
                    <div className="rounded-3xl border border-slate-100 bg-slate-50 px-5 py-4 text-sm font-semibold text-slate-600">
                      You can edit this device because it is still in the <strong>pending</strong> workflow.
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <label className="space-y-2 text-sm font-bold text-slate-600">
                        <span>Device Name</span>
                        <input
                          value={deviceForm.name}
                          onChange={handleDeviceFormChange('name')}
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900"
                          required
                        />
                      </label>
                      <label className="space-y-2 text-sm font-bold text-slate-600">
                        <span>Device Type</span>
                        <select
                          value={deviceForm.device_type}
                          onChange={handleDeviceFormChange('device_type')}
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900"
                        >
                          {DEVICE_TYPE_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {formatDeviceTypeLabel(option)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-2 text-sm font-bold text-slate-600">
                        <span>Condition</span>
                        <select
                          value={deviceForm.condition}
                          onChange={handleDeviceFormChange('condition')}
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900"
                        >
                          {CONDITION_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option.toUpperCase()}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-2 text-sm font-bold text-slate-600">
                        <span>Age (Years)</span>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={deviceForm.age_years}
                          onChange={handleDeviceFormChange('age_years')}
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900"
                        />
                      </label>
                      <label className="space-y-2 text-sm font-bold text-slate-600 md:col-span-2">
                        <span>Demand</span>
                        <select
                          value={deviceForm.demand}
                          onChange={handleDeviceFormChange('demand')}
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900"
                        >
                          {DEMAND_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option.toUpperCase()}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <button
                        type="submit"
                        disabled={isSavingDevice}
                        className="rounded-2xl bg-emerald-600 px-5 py-3 font-bold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-300"
                      >
                        {isSavingDevice ? 'Saving...' : 'Save Changes'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEditingDevice(false)}
                        className="rounded-2xl border border-slate-200 px-5 py-3 font-bold text-slate-600 hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="mb-8 flex items-center gap-4 p-4 bg-emerald-50/50 border border-emerald-100 rounded-2xl">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                        <ShieldCheck className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-sm font-bold text-slate-900">Workflow: {(modalDevice?.workflow_status || 'pending').toUpperCase()}</h4>
                        <p className="text-xs font-medium text-slate-500">
                          Collection method: {formatPreferredMethodLabel(selectedRequest?.preferred_method)}
                        </p>
                      </div>
                      {modalDevice && isDevicePending ? (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setIsEditingDevice(true)}
                            className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-slate-700 border border-slate-200 hover:bg-slate-50"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteDevice(modalDevice.id)}
                            disabled={deletingDeviceId === modalDevice.id}
                            className="rounded-xl bg-red-50 px-4 py-2 text-sm font-bold text-red-600 border border-red-100 hover:bg-red-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                          >
                            {deletingDeviceId === modalDevice.id ? 'Deleting...' : 'Delete'}
                          </button>
                        </div>
                      ) : null}
                    </div>

                    {modalStatus === 'Current' ? (
                      <div className="space-y-6">
                        <div className="p-6 rounded-3xl bg-slate-50 border border-slate-100">
                          <div className="flex items-center gap-2 mb-4">
                            <TrendingUp className="w-5 h-5 text-slate-400" />
                            <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Market Insight</h3>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="p-5 bg-white rounded-2xl shadow-sm border border-slate-100/50">
                              <p className="text-xs font-bold text-slate-400 mb-1">CeX Estimate</p>
                              <p className="text-2xl font-black text-slate-900">GBP 185.00</p>
                            </div>
                            <div className="p-5 bg-white rounded-2xl shadow-sm border border-slate-100/50">
                              <p className="text-xs font-bold text-slate-400 mb-1">eBay Estimate</p>
                              <p className="text-2xl font-black text-slate-900">GBP 210.00</p>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col gap-3">
                          <button
                            type="button"
                            onClick={() => void handleGenerateReferralQr(selectedDevice)}
                            disabled={issuingReferralRequestId === selectedDevice.requestId}
                            className="relative w-full overflow-hidden group bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-300 disabled:cursor-not-allowed text-white rounded-2xl p-6 transition-all shadow-xl shadow-emerald-600/20 flex flex-col items-center justify-center gap-2"
                          >
                            <div className="flex items-center gap-2 text-lg font-black tracking-tight z-10">
                              <QrCode className="w-5 h-5" />
                              {issuingReferralRequestId === selectedDevice.requestId ? 'Issuing Trade-in QR Code...' : 'Generate Trade-in QR Code'}
                            </div>
                            <p className="text-emerald-100 text-sm font-medium z-10">Includes Referral ID for eWaste Hub & your Bonus Voucher</p>
                            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none group-hover:scale-110 transition-transform">
                              <QrCode className="w-32 h-32" />
                            </div>
                          </button>

                          <a
                            href={selectedDevice.valueUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2 w-full py-4 bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 rounded-2xl font-bold transition-colors border border-slate-200"
                          >
                            View live details on third-party site
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </div>
                      </div>
                    ) : null}

                    {modalStatus === 'Recycle' ? (
                      <div className="space-y-6">
                        <div className="p-6 rounded-3xl bg-blue-50/50 border border-blue-100">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-blue-100 text-blue-600 rounded-xl">
                              <Leaf className="w-5 h-5" />
                            </div>
                            <h3 className="font-black text-slate-900 text-lg">Processing Plan</h3>
                          </div>
                          <p className="text-slate-600 font-medium pl-12">Ethical UK-based disposal & data cleansing.</p>
                        </div>

                        {selectedDevice.serviceType === 'Retrieval (Paid)' ? (
                          <div className="p-6 rounded-3xl border border-slate-200 bg-white relative overflow-hidden shadow-sm">
                            <div className="absolute -top-4 -right-4 p-6 opacity-[0.03] pointer-events-none">
                              <CreditCard className="w-40 h-40" />
                            </div>
                            <h3 className="text-lg font-black text-slate-900 mb-4">Payment Required</h3>
                            <div className="flex items-end justify-between mb-6">
                              <div>
                                <p className="text-sm font-bold text-slate-500 mb-1">Data Retrieval Fee</p>
                                <p className="text-4xl font-black tracking-tighter">GBP 10.00</p>
                              </div>
                            </div>

                            <div className="flex flex-col gap-3 mb-6 relative z-10">
                              <a
                                href="/app/security-vault"
                                className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold transition-colors shadow-sm flex items-center justify-center gap-2"
                              >
                                <CreditCard className="w-5 h-5" /> Continue in Security Vault
                              </a>
                            </div>

                            <div className="flex items-start gap-3 p-4 bg-red-50 text-red-700 rounded-xl border border-red-100 relative z-10">
                              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                              <p className="text-sm font-bold leading-tight">Data retrieval links are valid for 3 months only. Data will be deleted after 6 months.</p>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {modalStatus === 'Rare' ? (
                      <div className="space-y-6">
                        <div className="p-8 rounded-3xl bg-purple-50 border border-purple-100 text-center relative overflow-hidden">
                          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-10 pointer-events-none">
                            <Sparkles className="w-48 h-48 text-purple-600" />
                          </div>
                          <div className="relative z-10">
                            <div className="w-16 h-16 bg-purple-200 text-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                              <Sparkles className="w-8 h-8" />
                            </div>
                            <h3 className="text-2xl font-black text-purple-900 mb-2 tracking-tight">Rare Item Detected!</h3>
                            <p className="text-purple-700 font-medium max-w-sm mx-auto">
                              This item has special collectable value. We recommend consulting specialized marketplaces for the best return.
                            </p>
                          </div>
                        </div>

                        <div className="grid gap-3">
                          <a href={selectedDevice.valueUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-4 bg-white border border-slate-200 hover:border-purple-300 hover:shadow-md hover:shadow-purple-100 transition-all rounded-2xl group">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-600 group-hover:bg-purple-50 group-hover:text-purple-600 transition-colors">
                                <ExternalLink className="w-5 h-5" />
                              </div>
                              <span className="font-bold text-slate-900">Search on eBay</span>
                            </div>
                            <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-purple-600" />
                          </a>
                        </div>
                      </div>
                    ) : null}

                    {modalStatus === 'Unknown' ? (
                      <div className="space-y-8">
                        <div className="p-6 rounded-3xl bg-amber-50 border border-amber-100 relative overflow-hidden">
                          <div className="absolute right-0 top-0 opacity-5 pointer-events-none p-4">
                            <Cpu className="w-32 h-32 text-amber-900" />
                          </div>
                          <p className="text-amber-800 font-bold relative z-10 leading-relaxed max-w-[90%]">
                            Our experts are currently identifying your device to ensure accurate valuation and security handling.
                          </p>
                        </div>

                        <div className="relative pt-4 pb-8 px-4">
                          <div className="absolute top-9 left-12 right-12 h-1 bg-slate-100 rounded-full z-0" />
                          <div className="absolute top-9 left-12 w-1/2 h-1 bg-amber-400 rounded-full z-0" />

                          <div className="relative z-10 flex justify-between">
                            <div className="flex flex-col items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-sm border-[4px] border-white box-content">
                                <CheckCircle2 className="w-5 h-5" />
                              </div>
                              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">Submitted</span>
                            </div>

                            <div className="flex flex-col items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-amber-400 text-white flex items-center justify-center shadow-sm border-[4px] border-white box-content">
                                <Loader2 className="w-5 h-5 animate-spin" />
                              </div>
                              <span className="text-xs font-bold text-amber-600 uppercase tracking-wider text-center max-w-[100px] leading-tight">Identifying...</span>
                            </div>

                            <div className="flex flex-col items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center shadow-sm border-[4px] border-white box-content">
                                <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                              </div>
                              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Result</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>

      {showFilter ? (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-2xl shadow-xl w-80 space-y-4">
            <h2 className="text-lg font-bold">Filter Requests</h2>

            <select
              value={draftFilter.category}
              className="w-full border p-2 rounded-lg"
              onChange={(event) =>
                setDraftFilter((current) => ({
                  ...current,
                  category: event.target.value,
                }))
              }
            >
              <option value="">All Categories</option>
              {FILTER_CATEGORY_OPTIONS.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>

            <select
              value={draftFilter.status}
              className="w-full border p-2 rounded-lg"
              onChange={(event) =>
                setDraftFilter((current) => ({
                  ...current,
                  status: event.target.value,
                }))
              }
            >
              <option value="">All Status</option>
              {FILTER_STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>

            <div className="flex justify-between">
              <button
                onClick={() => {
                  setDraftFilter(filter);
                  setShowFilter(false);
                }}
                className="px-4 py-2 bg-gray-200 rounded-lg"
              >
                Cancel
              </button>

              <button
                onClick={() => {
                  setFilter(draftFilter);
                  setShowFilter(false);
                }}
                className="px-4 py-2 bg-green-500 text-white rounded-lg"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ReferralQrDialog referral={selectedReferral} onClose={() => setSelectedReferral(null)} />
    </div>
  );
}
