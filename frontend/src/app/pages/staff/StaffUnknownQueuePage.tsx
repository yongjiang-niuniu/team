import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { BackOfficeTable, BackOfficeTd, BackOfficeTh } from "../../components/backoffice/BackOfficeTable";
import { BackOfficeSelect } from "../../components/backoffice/BackOfficeSelect";
import { StatusBadge } from "../../components/backoffice/StatusBadge";
import { statusTone } from "../../components/backoffice/statusTone";
import { getApiStyleErrorMessage } from "../../lib/httpErrors";
import { fetchUnknownDevices, patchStaffDeviceField } from "../../lib/staffPortal";
import type { PortalDevice } from "../../lib/userPortal";

const CLASSIFICATION_OPTIONS = ['current', 'recycle', 'rare', 'unwanted', 'unknown'] as const;

export function StaffUnknownQueuePage() {
  const [devices, setDevices] = useState<PortalDevice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const loadDevices = async () => {
    setIsLoading(true);
    try {
      const items = await fetchUnknownDevices();
      setDevices(items);
      setErrorMessage('');
    } catch (error: unknown) {
      setErrorMessage(getApiStyleErrorMessage(error, 'Could not load unknown device queue.'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadDevices();
  }, []);

  const handleClassify = async (deviceId: number, classification: string) => {
    setUpdatingId(deviceId);
    setErrorMessage('');
    try {
      await patchStaffDeviceField(deviceId, 'classification', classification);
      await loadDevices();
    } catch (error: unknown) {
      setErrorMessage(getApiStyleErrorMessage(error, 'Could not resolve unknown device.'));
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <section className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-600">Staff triage</p>
          <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">Unknown queue</h2>
          <p className="mt-2 text-sm font-medium text-slate-500">
            Resolve devices that need staff classification before the workflow can continue.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadDevices()}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50"
        >
          Refresh
        </button>
      </section>

      {errorMessage ? (
        <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      {isLoading ? (
        <div className="flex min-h-[30vh] items-center justify-center text-slate-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading unknown queue...
        </div>
      ) : (
        <BackOfficeTable>
          <thead>
            <tr>
              <BackOfficeTh>Device</BackOfficeTh>
              <BackOfficeTh>Owner</BackOfficeTh>
              <BackOfficeTh>Workflow</BackOfficeTh>
              <BackOfficeTh>Classify as</BackOfficeTh>
            </tr>
          </thead>
          <tbody>
            {devices.map((device) => (
              <tr key={device.id}>
                <BackOfficeTd>
                  <div>
                    <p className="font-black text-slate-900">{device.name}</p>
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                      #{device.id} · {device.device_type} · {device.condition}
                    </p>
                  </div>
                </BackOfficeTd>
                <BackOfficeTd>Owner #{device.owner_id}</BackOfficeTd>
                <BackOfficeTd>
                  <StatusBadge value={device.workflow_status} tone={statusTone(device.workflow_status)} />
                </BackOfficeTd>
                <BackOfficeTd>
                  <BackOfficeSelect
                    value={device.classification}
                    disabled={updatingId === device.id}
                    onChange={(e) => void handleClassify(device.id, e.target.value)}
                  >
                    {CLASSIFICATION_OPTIONS.map((classification) => (
                      <option key={classification} value={classification}>
                        {classification}
                      </option>
                    ))}
                  </BackOfficeSelect>
                </BackOfficeTd>
              </tr>
            ))}
            {!devices.length ? (
              <tr>
                <BackOfficeTd>No unknown devices are waiting.</BackOfficeTd>
                <BackOfficeTd />
                <BackOfficeTd />
                <BackOfficeTd />
              </tr>
            ) : null}
          </tbody>
        </BackOfficeTable>
      )}
    </div>
  );
}

