import { useEffect, useState } from "react";
import { AlertTriangle, ClipboardList, Cpu, Loader2, ShieldCheck } from "lucide-react";

import { getApiStyleErrorMessage } from "../../lib/httpErrors";
import { fetchStaffDashboardData, type DeviceStats } from "../../lib/staffPortal";
import type { PortalDevice, PortalRequest } from "../../lib/userPortal";
import { BackOfficeTable, BackOfficeTd, BackOfficeTh } from "../../components/backoffice/BackOfficeTable";
import { StatusBadge } from "../../components/backoffice/StatusBadge";
import { statusTone } from "../../components/backoffice/statusTone";

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof ClipboardList;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">{label}</p>
          <p className="mt-2 text-3xl font-black tracking-tight text-slate-900">{value}</p>
        </div>
        <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-600">
          <Icon className="h-6 w-6" />
        </div>
      </div>
      <p className="mt-3 text-sm font-medium text-slate-500">{detail}</p>
    </div>
  );
}

export function StaffOverviewPage() {
  const [stats, setStats] = useState<DeviceStats | null>(null);
  const [requests, setRequests] = useState<PortalRequest[]>([]);
  const [unknownDevices, setUnknownDevices] = useState<PortalDevice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let ignore = false;

    async function load() {
      setIsLoading(true);
      try {
        const data = await fetchStaffDashboardData();
        if (!ignore) {
          setStats(data.stats);
          setRequests(data.requests);
          setUnknownDevices(data.unknownDevices);
          setErrorMessage('');
        }
      } catch (error: unknown) {
        if (!ignore) {
          setErrorMessage(getApiStyleErrorMessage(error, 'Could not load staff overview.'));
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    void load();
    return () => {
      ignore = true;
    };
  }, []);

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-slate-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading staff overview...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section>
        <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-600">Staff workspace</p>
        <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">Operational overview</h2>
        <p className="mt-2 text-sm font-medium text-slate-500">
          A compact daily view for live requests, device workload, and items that need staff attention.
        </p>
      </section>

      {errorMessage ? (
        <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <MetricCard
          label="Tracked devices"
          value={String(stats?.totals?.devices ?? 0)}
          detail={`${stats?.totals?.visible ?? 0} visible, ${stats?.totals?.hidden ?? 0} hidden`}
          icon={Cpu}
        />
        <MetricCard
          label="Open requests"
          value={String(requests.filter((request) => request.status !== 'completed').length)}
          detail={`${requests.length} total collection requests`}
          icon={ClipboardList}
        />
        <MetricCard
          label="Unknown queue"
          value={String(unknownDevices.length)}
          detail="Devices waiting for classification"
          icon={AlertTriangle}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 2xl:grid-cols-2">
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black text-slate-900">Recent requests</h3>
            <a href="/staff/requests" className="text-sm font-bold text-emerald-600 hover:text-emerald-700">
              View all
            </a>
          </div>
          <BackOfficeTable>
            <thead>
              <tr>
                <BackOfficeTh>Request</BackOfficeTh>
                <BackOfficeTh>Device</BackOfficeTh>
                <BackOfficeTh>Status</BackOfficeTh>
                <BackOfficeTh>Method</BackOfficeTh>
              </tr>
            </thead>
            <tbody>
              {requests.slice(0, 6).map((request) => (
                <tr key={request.id}>
                  <BackOfficeTd>#{request.id}</BackOfficeTd>
                  <BackOfficeTd>{request.device?.name || 'Pending device'}</BackOfficeTd>
                  <BackOfficeTd>
                    <StatusBadge value={request.status} tone={statusTone(request.status)} />
                  </BackOfficeTd>
                  <BackOfficeTd>{request.preferred_method}</BackOfficeTd>
                </tr>
              ))}
            </tbody>
          </BackOfficeTable>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black text-slate-900">Attention needed</h3>
            <a href="/staff/unknown-queue" className="text-sm font-bold text-emerald-600 hover:text-emerald-700">
              Resolve queue
            </a>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            {unknownDevices.length ? (
              <div className="space-y-3">
                {unknownDevices.slice(0, 6).map((device) => (
                  <div key={device.id} className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
                    <div>
                      <p className="font-black text-slate-900">{device.name}</p>
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                        {device.device_type} · #{device.id}
                      </p>
                    </div>
                    <StatusBadge value={device.classification} tone={statusTone(device.classification)} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-xl bg-emerald-50 p-4 text-emerald-700">
                <ShieldCheck className="h-5 w-5" />
                <p className="text-sm font-bold">No unknown devices are waiting right now.</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

