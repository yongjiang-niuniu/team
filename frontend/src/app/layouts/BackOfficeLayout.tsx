import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  BarChart3,
  ClipboardList,
  Cpu,
  FileText,
  LayoutDashboard,
  LifeBuoy,
  Lock,
  LogOut,
  QrCode,
  Recycle,
  Shield,
  Users,
} from "lucide-react";

import {
  clearAuthSession,
  getDisplayName,
  getRoleLabel,
  getStoredUser,
} from "../lib/auth";

const staffLinks = [
  { to: "/staff", label: "Staff Overview", icon: LayoutDashboard },
  { to: "/staff/requests", label: "Requests", icon: ClipboardList },
  { to: "/staff/devices", label: "Devices", icon: Cpu },
  { to: "/staff/retrieval", label: "Retrieval", icon: Lock },
  { to: "/staff/wipe-jobs", label: "Wipe Jobs", icon: Shield },
  { to: "/staff/referrals", label: "Referrals", icon: QrCode },
  { to: "/staff/reports", label: "Reports", icon: BarChart3 },
  { to: "/staff/workspace", label: "Legacy Workspace", icon: LifeBuoy },
];

const adminLinks = [
  { to: "/admin", label: "Admin Overview", icon: BarChart3 },
  { to: "/admin/users", label: "Users & Roles", icon: Users },
  { to: "/admin/payments", label: "Payments", icon: FileText },
  { to: "/admin/referrals", label: "Referral Ledger", icon: QrCode },
  { to: "/admin/reports", label: "Reports", icon: BarChart3 },
  { to: "/admin/system", label: "System", icon: Shield },
];

function BackOfficeNavLink({
  to,
  label,
  icon: Icon,
}: {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
}) {
  return (
    <NavLink
      to={to}
      end={to === "/staff" || to === "/admin"}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition-colors ${
          isActive
            ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
            : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
        }`
      }
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </NavLink>
  );
}

export function BackOfficeLayout() {
  const navigate = useNavigate();
  const currentUser = getStoredUser();
  const displayName = getDisplayName(currentUser);
  const roleLabel = getRoleLabel(currentUser?.role);
  const isAdmin = (currentUser?.role || "").toLowerCase() === "admin";

  const handleLogout = () => {
    clearAuthSession();
    navigate("/auth/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-900">
      <div className="flex min-h-screen">
        <aside className="w-72 shrink-0 border-r border-slate-200 bg-white">
          <div className="flex h-20 items-center gap-3 border-b border-slate-100 px-6">
            <div className="rounded-xl bg-emerald-600 p-2 shadow-lg shadow-emerald-600/20">
              <Recycle className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-base font-black uppercase tracking-tight">eWaste Hub</p>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
                Back Office
              </p>
            </div>
          </div>

          <nav className="space-y-7 px-4 py-6">
            <section>
              <p className="mb-2 px-3 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
                Staff
              </p>
              <div className="space-y-1">
                {staffLinks.map((item) => (
                  <BackOfficeNavLink key={item.to} {...item} />
                ))}
              </div>
            </section>

            {isAdmin ? (
              <section>
                <p className="mb-2 px-3 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
                  Admin
                </p>
                <div className="space-y-1">
                  {adminLinks.map((item) => (
                    <BackOfficeNavLink key={item.to} {...item} />
                  ))}
                </div>
              </section>
            ) : null}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-20 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-8">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-600">
                Operations console
              </p>
              <h1 className="text-xl font-black tracking-tight text-slate-900">
                Admin & Staff Portal
              </h1>
            </div>

            <div className="flex items-center gap-4">
              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-2 text-right">
                <p className="text-sm font-black text-slate-900">{displayName}</p>
                <p className="text-xs font-bold text-slate-400">{roleLabel}</p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-500 transition-colors hover:border-red-100 hover:bg-red-50 hover:text-red-600"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          </header>

          <main className="min-w-0 flex-1 overflow-y-auto p-8">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
