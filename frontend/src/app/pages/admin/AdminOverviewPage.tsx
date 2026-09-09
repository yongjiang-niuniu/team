import { useEffect, useState } from "react";
import { Activity, ClipboardList, Cpu, Loader2, Users } from "lucide-react";

import { StatusBadge } from "../../components/backoffice/StatusBadge";
import { statusTone } from "../../components/backoffice/statusTone";
import { fetchAdminPing, fetchAdminUsers } from "../../lib/adminPortal";
import { getApiStyleErrorMessage } from "../../lib/httpErrors";
import { fetchStaffDashboardData, type DeviceStats } from "../../lib/staffPortal";
import { fetchHealthStatus, fetchReferralSummary, type HealthStatus, type ReferralSummary } from "../../lib/userPortal";

function SummaryCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Activity;
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

export function AdminOverviewPage() {
  const [stats, setStats] = useState<DeviceStats | null>(null);
  const [requestCount, setRequestCount] = useState(0);
  const [unknownCount, setUnknownCount] = useState(0);
  const [userTotal, setUserTotal] = useState(0);
  const [referralSummary, setReferralSummary] = useState<ReferralSummary | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [adminPing, setAdminPing] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let ignore = false;

    async function loadOverview() {
      setIsLoading(true);
      try {
        const [dashboardData, usersData, referralData, healthData, pingData] = await Promise.all([
          fetchStaffDashboardData(),
          fetchAdminUsers({ limit: 1 }),
          fetchReferralSummary(),
          fetchHealthStatus(),
          fetchAdminPing(),
        ]);

        if (!ignore) {
          setStats(dashboardData.stats);
          setRequestCount(dashboardData.requests.length);
          setUnknownCount(dashboardData.unknownDevices.length);
          setUserTotal(usersData.pagination.total);
          setReferralSummary(referralData);
          setHealth(healthData);
          setAdminPing(pingData.message || 'ok');
          setErrorMessage('');
        }
      } catch (error: unknown) {
        if (!ignore) {
          setErrorMessage(getApiStyleErrorMessage(error, 'Could not load admin overview.'));
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    void loadOverview();
    return () => {
      ignore = true;
    };
  }, []);

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-slate-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading admin overview...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section>
        <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-600">Admin console</p>
        <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">Global overview</h2>
        <p className="mt-2 text-sm font-medium text-slate-500">
          A compact read-only snapshot of users, operations, referrals, and service health.
        </p>
      </section>

      {errorMessage ? (
        <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        <SummaryCard label="Users" value={String(userTotal)} detail="Registered accounts across all roles" icon={Users} />
        <SummaryCard
          label="Devices"
          value={String(stats?.totals?.devices ?? 0)}
          detail={`${stats?.totals?.draft ?? 0} drafts, ${stats?.totals?.visible ?? 0} visible`}
          icon={Cpu}
        />
        <SummaryCard
          label="Requests"
          value={String(requestCount)}
          detail={`${unknownCount} devices still need classification`}
          icon={ClipboardList}
        />
        <SummaryCard
          label="Referral fees"
          value={`AUD ${Number(referralSummary?.fee_amount_total || 0).toFixed(2)}`}
          detail={`${referralSummary?.total_referral_fees ?? 0} fee records tracked`}
          icon={Activity}
        />
      </div>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-black text-slate-900">System access</h3>
          <div className="mt-4 flex flex-wrap gap-3">
            <StatusBadge value={`api ${health?.status || 'unknown'}`} tone={statusTone(health?.status)} />
            <StatusBadge value={`admin ${adminPing || 'unknown'}`} tone={statusTone(adminPing)} />
          </div>
          <p className="mt-4 text-sm font-medium text-slate-500">
            This confirms both general API health and admin-only authorization from the current session.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-black text-slate-900">Next admin actions</h3>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <a className="rounded-xl bg-slate-50 p-4 text-sm font-black text-slate-700 hover:bg-emerald-50 hover:text-emerald-700" href="/admin/users">
              Review users
            </a>
            <a className="rounded-xl bg-slate-50 p-4 text-sm font-black text-slate-700 hover:bg-emerald-50 hover:text-emerald-700" href="/admin/payments">
              Payments
            </a>
            <a className="rounded-xl bg-slate-50 p-4 text-sm font-black text-slate-700 hover:bg-emerald-50 hover:text-emerald-700" href="/admin/system">
              System
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
