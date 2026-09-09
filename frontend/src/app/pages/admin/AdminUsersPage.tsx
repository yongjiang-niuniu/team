import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

import { BackOfficeTable, BackOfficeTd, BackOfficeTh } from "../../components/backoffice/BackOfficeTable";
import { BackOfficeSelect } from "../../components/backoffice/BackOfficeSelect";
import { StatusBadge } from "../../components/backoffice/StatusBadge";
import { statusTone } from "../../components/backoffice/statusTone";
import { fetchAdminUsers, updateAdminUserRole, type AdminUser } from "../../lib/adminPortal";
import { getApiStyleErrorMessage } from "../../lib/httpErrors";

const ROLE_FILTERS = ['all', 'consumer', 'staff', 'admin'] as const;
const EDITABLE_ROLES = ['consumer', 'staff', 'admin'] as const;
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
type EditableRole = (typeof EDITABLE_ROLES)[number];
type PendingRoleChange = {
  user: AdminUser;
  nextRole: EditableRole;
};

export function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [roleFilter, setRoleFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(25);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingRole, setIsSavingRole] = useState(false);
  const [pendingRoleChange, setPendingRoleChange] = useState<PendingRoleChange | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchAdminUsers({
        q: search.trim(),
        role: roleFilter === 'all' ? undefined : roleFilter,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });
      setUsers(data.users);
      setTotal(data.pagination.total);
      setErrorMessage('');
    } catch (error: unknown) {
      setErrorMessage(getApiStyleErrorMessage(error, 'Could not load users.'));
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, roleFilter, search]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const pageEnd = Math.min(total, page * pageSize);

  const requestRoleChange = (user: AdminUser, role: string) => {
    if (role === user.role || !EDITABLE_ROLES.includes(role as EditableRole)) {
      return;
    }

    setPendingRoleChange({ user, nextRole: role as EditableRole });
  };

  const confirmRoleChange = async () => {
    if (!pendingRoleChange) {
      return;
    }

    setIsSavingRole(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      await updateAdminUserRole(pendingRoleChange.user.id, pendingRoleChange.nextRole);
      setSuccessMessage(
        `${pendingRoleChange.user.email} was updated to ${pendingRoleChange.nextRole}.`,
      );
      setPendingRoleChange(null);
      await loadUsers();
    } catch (error: unknown) {
      setErrorMessage(getApiStyleErrorMessage(error, 'Could not update user role.'));
    } finally {
      setIsSavingRole(false);
    }
  };

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadUsers();
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [loadUsers]);

  useEffect(() => {
    setPage(1);
  }, [roleFilter, search, pageSize]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  return (
    <div className="space-y-6">
      <section>
        <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-600">Admin users</p>
        <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">Users & roles</h2>
        <p className="mt-2 text-sm font-medium text-slate-500">
          Manage account roles with an explicit confirmation step before any permission change is saved.
        </p>
      </section>

      <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by email..."
          className="min-w-[320px] flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium outline-none focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
        />
        <BackOfficeSelect
          value={roleFilter}
          onChange={(event) => setRoleFilter(event.target.value)}
          className="bg-slate-50"
        >
          {ROLE_FILTERS.map((role) => (
            <option key={role} value={role}>
              {role === 'all' ? 'All roles' : role}
            </option>
          ))}
        </BackOfficeSelect>
        <BackOfficeSelect
          value={pageSize}
          onChange={(event) => setPageSize(Number(event.target.value) as (typeof PAGE_SIZE_OPTIONS)[number])}
          className="bg-slate-50"
          aria-label="Users per page"
        >
          {PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>
              {size} / page
            </option>
          ))}
        </BackOfficeSelect>
        <p className="text-sm font-bold text-slate-400">{total} total</p>
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
          Loading users...
        </div>
      ) : (
        <>
          <BackOfficeTable>
            <thead>
              <tr>
                <BackOfficeTh>User</BackOfficeTh>
                <BackOfficeTh>Role</BackOfficeTh>
                <BackOfficeTh>Auth</BackOfficeTh>
                <BackOfficeTh>Created</BackOfficeTh>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <BackOfficeTd>
                    <div>
                      <p className="font-black text-slate-900">{user.full_name || user.email}</p>
                      <p className="text-xs font-bold text-slate-400">{user.email}</p>
                    </div>
                  </BackOfficeTd>
                  <BackOfficeTd>
                    <div className="flex items-center gap-3">
                      <StatusBadge value={user.role} tone={statusTone(user.role)} />
                      <BackOfficeSelect
                        value={user.role}
                        disabled={isSavingRole}
                        onChange={(event) => requestRoleChange(user, event.target.value)}
                      >
                        {EDITABLE_ROLES.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </BackOfficeSelect>
                    </div>
                  </BackOfficeTd>
                  <BackOfficeTd>
                    <StatusBadge value={user.auth_provider || 'local'} />
                  </BackOfficeTd>
                  <BackOfficeTd>
                    {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'unknown'}
                  </BackOfficeTd>
                </tr>
              ))}
              {!users.length ? (
                <tr>
                  <BackOfficeTd>No users found.</BackOfficeTd>
                  <BackOfficeTd />
                  <BackOfficeTd />
                  <BackOfficeTd />
                </tr>
              ) : null}
            </tbody>
          </BackOfficeTable>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-bold text-slate-500">
              Showing {pageStart}-{pageEnd} of {total}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </button>
              <span className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-black text-slate-700">
                Page {page} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={page >= totalPages}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </>
      )}

      {pendingRoleChange ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-6">
          <div className="w-full max-w-md rounded-[2rem] border border-slate-200 bg-white p-6 shadow-2xl">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-600">
              Confirm role change
            </p>
            <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-900">
              Update user permissions?
            </h3>
            <p className="mt-3 text-sm font-medium leading-6 text-slate-500">
              This will change <span className="font-black text-slate-900">{pendingRoleChange.user.email}</span> from{' '}
              <span className="font-black text-slate-900">{pendingRoleChange.user.role}</span> to{' '}
              <span className="font-black text-slate-900">{pendingRoleChange.nextRole}</span>.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={isSavingRole}
                onClick={() => setPendingRoleChange(null)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSavingRole}
                onClick={() => void confirmRoleChange()}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-60"
              >
                {isSavingRole ? 'Updating...' : 'Confirm update'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
