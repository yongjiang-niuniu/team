import { useEffect, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";

import { StatusBadge } from "../../components/backoffice/StatusBadge";
import { statusTone } from "../../components/backoffice/statusTone";
import { fetchAdminPing } from "../../lib/adminPortal";
import { getApiStyleErrorMessage } from "../../lib/httpErrors";
import { fetchHealthStatus, type HealthStatus } from "../../lib/userPortal";

export function AdminSystemPage() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [adminPing, setAdminPing] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let ignore = false;

    async function loadSystem() {
      setIsLoading(true);
      try {
        const [healthData, pingData] = await Promise.all([fetchHealthStatus(), fetchAdminPing()]);
        if (!ignore) {
          setHealth(healthData);
          setAdminPing(pingData.message || 'ok');
          setErrorMessage('');
        }
      } catch (error: unknown) {
        if (!ignore) {
          setErrorMessage(getApiStyleErrorMessage(error, 'Could not load system status.'));
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    void loadSystem();
    return () => {
      ignore = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <section>
        <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-600">Admin system</p>
        <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">System health</h2>
        <p className="mt-2 text-sm font-medium text-slate-500">
          Basic API and admin authorization diagnostics for the back-office portal.
        </p>
      </section>

      {errorMessage ? (
        <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      {isLoading ? (
        <div className="flex min-h-[30vh] items-center justify-center text-slate-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading system status...
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-900">API health</h3>
              <StatusBadge value={health?.status || 'unknown'} tone={statusTone(health?.status)} />
            </div>
            <p className="mt-3 text-sm font-medium text-slate-500">
              Service: {health?.service || 'unknown'}
            </p>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-900">Admin guard</h3>
              <StatusBadge value={adminPing || 'unknown'} tone={statusTone(adminPing)} />
            </div>
            <p className="mt-3 text-sm font-medium text-slate-500">
              Confirms the current account can access admin-only endpoints.
            </p>
          </section>

          <section className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
            <ShieldCheck className="h-6 w-6 text-emerald-600" />
            <h3 className="mt-3 text-lg font-black text-emerald-900">Scoped controls</h3>
            <p className="mt-2 text-sm font-semibold leading-6 text-emerald-800">
              Destructive admin controls are intentionally not enabled yet. User role edits should be added after a
              separate confirmation.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}
