import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import { BackOfficeTable, BackOfficeTd, BackOfficeTh } from "../../components/backoffice/BackOfficeTable";
import { BackOfficeSelect } from "../../components/backoffice/BackOfficeSelect";
import { StatusBadge } from "../../components/backoffice/StatusBadge";
import { statusTone } from "../../components/backoffice/statusTone";
import { getApiStyleErrorMessage } from "../../lib/httpErrors";
import { createWipeCertificate, fetchWipeJobs, patchWipeJob, type WipeJob } from "../../lib/staffPortal";

const WIPE_STATUS_OPTIONS = ['queued', 'in_progress', 'completed', 'failed', 'cancelled'] as const;
const VERIFICATION_STATUS_OPTIONS = ['pending', 'verified', 'rejected'] as const;

export function StaffWipeJobsPage() {
  const [jobs, setJobs] = useState<WipeJob[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [certificateJob, setCertificateJob] = useState<WipeJob | null>(null);
  const [certificateReference, setCertificateReference] = useState('');
  const [certificateUrl, setCertificateUrl] = useState('');
  const [storageKey, setStorageKey] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const loadJobs = useCallback(async () => {
    setIsLoading(true);
    try {
      const items = await fetchWipeJobs(statusFilter === 'all' ? undefined : { status: statusFilter });
      setJobs(items);
      setErrorMessage('');
    } catch (error: unknown) {
      setErrorMessage(getApiStyleErrorMessage(error, 'Could not load wipe jobs.'));
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  const visibleJobs = useMemo(() => jobs, [jobs]);

  const updateJob = async (
    wipeJobId: number,
    payload: Partial<Pick<WipeJob, 'status' | 'verification_status'>>,
  ) => {
    setUpdatingId(wipeJobId);
    setErrorMessage('');
    try {
      await patchWipeJob(wipeJobId, payload);
      await loadJobs();
    } catch (error: unknown) {
      setErrorMessage(getApiStyleErrorMessage(error, 'Could not update wipe job.'));
    } finally {
      setUpdatingId(null);
    }
  };

  const openCertificatePanel = (job: WipeJob) => {
    setCertificateJob(job);
    setCertificateReference(`WIPE-${job.id}`);
    setCertificateUrl('');
    setStorageKey('');
    setErrorMessage('');
    setSuccessMessage('');
  };

  const saveCertificate = async () => {
    if (!certificateJob) {
      return;
    }

    setUpdatingId(certificateJob.id);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      await createWipeCertificate(certificateJob.id, {
        certificate_reference: certificateReference.trim() || null,
        certificate_url: certificateUrl.trim() || null,
        storage_key: storageKey.trim() || null,
      });
      setSuccessMessage(`Certificate added for wipe job #${certificateJob.id}.`);
      setCertificateJob(null);
      await loadJobs();
    } catch (error: unknown) {
      setErrorMessage(getApiStyleErrorMessage(error, 'Could not create wipe certificate.'));
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <section className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-600">Staff security</p>
          <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">Wipe jobs</h2>
          <p className="mt-2 text-sm font-medium text-slate-500">
            Track data-destruction jobs, update status, and monitor certificate verification.
          </p>
        </div>
        <BackOfficeSelect
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All statuses</option>
          {WIPE_STATUS_OPTIONS.map((status) => (
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
          Loading wipe jobs...
        </div>
      ) : (
        <BackOfficeTable>
          <thead>
            <tr>
              <BackOfficeTh>Job</BackOfficeTh>
              <BackOfficeTh>Device</BackOfficeTh>
              <BackOfficeTh>Type</BackOfficeTh>
              <BackOfficeTh>Status</BackOfficeTh>
              <BackOfficeTh>Verification</BackOfficeTh>
              <BackOfficeTh>Certificates</BackOfficeTh>
            </tr>
          </thead>
          <tbody>
            {visibleJobs.map((job) => (
              <tr key={job.id}>
                <BackOfficeTd>
                  <div>
                    <p className="font-black text-slate-900">#{job.id}</p>
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                      Staff #{job.assigned_staff_id || 'unassigned'}
                    </p>
                  </div>
                </BackOfficeTd>
                <BackOfficeTd>{job.device?.name || `Device #${job.device_id}`}</BackOfficeTd>
                <BackOfficeTd>
                  <StatusBadge value={job.wipe_type || 'standard'} />
                </BackOfficeTd>
                <BackOfficeTd>
                  <BackOfficeSelect
                    value={job.status}
                    disabled={updatingId === job.id}
                    onChange={(e) => void updateJob(job.id, { status: e.target.value })}
                  >
                    {WIPE_STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </BackOfficeSelect>
                </BackOfficeTd>
                <BackOfficeTd>
                  <BackOfficeSelect
                    value={job.verification_status || 'pending'}
                    disabled={updatingId === job.id}
                    onChange={(e) => void updateJob(job.id, { verification_status: e.target.value })}
                  >
                    {VERIFICATION_STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </BackOfficeSelect>
                </BackOfficeTd>
                <BackOfficeTd>
                  <div className="flex items-center gap-3">
                    <StatusBadge value={`${job.certificate_count ?? 0} files`} tone={statusTone(job.verification_status)} />
                    <button
                      type="button"
                      onClick={() => openCertificatePanel(job)}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 hover:bg-emerald-50 hover:text-emerald-700"
                    >
                      Add
                    </button>
                  </div>
                </BackOfficeTd>
              </tr>
            ))}
            {!visibleJobs.length ? (
              <tr>
                <BackOfficeTd>No wipe jobs found.</BackOfficeTd>
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

      {certificateJob ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-6">
          <div className="w-full max-w-lg rounded-[2rem] border border-slate-200 bg-white p-6 shadow-2xl">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-600">
              Wipe certificate
            </p>
            <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-900">
              Add certificate for job #{certificateJob.id}
            </h3>
            <div className="mt-5 space-y-3">
              <input
                value={certificateReference}
                onChange={(event) => setCertificateReference(event.target.value)}
                placeholder="Certificate reference"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium outline-none focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
              />
              <input
                value={certificateUrl}
                onChange={(event) => setCertificateUrl(event.target.value)}
                placeholder="Certificate URL"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium outline-none focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
              />
              <input
                value={storageKey}
                onChange={(event) => setStorageKey(event.target.value)}
                placeholder="Storage key"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium outline-none focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
              />
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={updatingId === certificateJob.id}
                onClick={() => setCertificateJob(null)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={updatingId === certificateJob.id}
                onClick={() => void saveCertificate()}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-60"
              >
                {updatingId === certificateJob.id ? 'Saving...' : 'Save certificate'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
