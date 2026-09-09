import { Navigate, Outlet, useLocation } from "react-router-dom";

import { getStoredUser, isAuthenticated } from "../lib/auth";

type RequireRoleProps = {
  roles: string[];
};

export function RequireRole({ roles }: RequireRoleProps) {
  const location = useLocation();
  const currentUser = getStoredUser();
  const currentRole = (currentUser?.role || "").toLowerCase();

  if (!isAuthenticated()) {
    return <Navigate to="/auth/login" replace state={{ from: location }} />;
  }

  if (!roles.includes(currentRole)) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8 font-sans">
        <div className="max-w-md rounded-[2rem] border border-slate-100 bg-white p-8 text-center shadow-[0_24px_48px_-20px_rgba(15,23,42,0.18)]">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-600 mb-3">
            Access restricted
          </p>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 mb-3">
            This workspace is not available for your account
          </h1>
          <p className="text-sm font-medium leading-6 text-slate-500">
            Please sign in with a staff or administrator account, or return to the customer portal.
          </p>
          <a
            href="/app/dashboard"
            className="mt-6 inline-flex rounded-2xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-slate-800"
          >
            Back to customer portal
          </a>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
