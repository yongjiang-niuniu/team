import { useState } from "react";
import { Download, Loader2, Search } from "lucide-react";

import { BackOfficeSelect } from "../../components/backoffice/BackOfficeSelect";
import { PaymentSummaryCard } from "../../components/PaymentSummaryCard";
import { StatusBadge } from "../../components/backoffice/StatusBadge";
import { statusTone } from "../../components/backoffice/statusTone";
import { getApiStyleErrorMessage } from "../../lib/httpErrors";
import {
  fetchRetrievalRequestDetail,
  issueRetrievalDownloadLink,
  toPaymentSummary,
  updateRetrievalStatus,
  type RetrievalDownload,
  type RetrievalRequest,
} from "../../lib/retrieval";

const RETRIEVAL_STATUS_OPTIONS = ['pending', 'payment_pending', 'processing', 'ready', 'completed', 'expired', 'deleted'] as const;

export function StaffRetrievalPage() {
  const [lookupId, setLookupId] = useState('');
  const [record, setRecord] = useState<RetrievalRequest | null>(null);
  const [download, setDownload] = useState<RetrievalDownload | null>(null);
  const [draftStatus, setDraftStatus] = useState('pending');
  const [draftNote, setDraftNote] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isIssuing, setIsIssuing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const loadRecord = async () => {
    const id = Number(lookupId);
    if (!Number.isInteger(id) || id <= 0) {
      setErrorMessage('Enter a valid retrieval request ID.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    setDownload(null);
    try {
      const item = await fetchRetrievalRequestDetail(id);
      setRecord(item);
      setDraftStatus(item?.retrieval_status || item?.status || 'pending');
      setDraftNote(item?.note || '');
    } catch (error: unknown) {
      setRecord(null);
      setErrorMessage(getApiStyleErrorMessage(error, 'Could not load retrieval request.'));
    } finally {
      setIsLoading(false);
    }
  };

  const saveStatus = async () => {
    if (!record) return;
    setIsSaving(true);
    setErrorMessage('');
    try {
      const updated = await updateRetrievalStatus(record.id, {
        retrieval_status: draftStatus,
        note: draftNote,
      });
      setRecord(updated);
    } catch (error: unknown) {
      setErrorMessage(getApiStyleErrorMessage(error, 'Could not update retrieval request.'));
    } finally {
      setIsSaving(false);
    }
  };

  const issueDownload = async () => {
    if (!record) return;
    setIsIssuing(true);
    setErrorMessage('');
    try {
      const issued = await issueRetrievalDownloadLink(record.id);
      setDownload(issued);
    } catch (error: unknown) {
      setErrorMessage(getApiStyleErrorMessage(error, 'Could not issue download link.'));
    } finally {
      setIsIssuing(false);
    }
  };

  return (
    <div className="space-y-6">
      <section>
        <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-600">Staff retrieval</p>
        <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">Data retrieval operations</h2>
        <p className="mt-2 text-sm font-medium text-slate-500">
          Look up a paid retrieval request, update workflow status, and issue secure download links.
        </p>
      </section>

      <section className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <input
          value={lookupId}
          onChange={(e) => setLookupId(e.target.value)}
          placeholder="Retrieval request ID"
          className="min-w-[260px] rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium outline-none focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
        />
        <button
          type="button"
          onClick={() => void loadRecord()}
          disabled={isLoading}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Look up
        </button>
      </section>

      {errorMessage ? (
        <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      {record ? (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_360px]">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Retrieval #{record.id}</p>
                <h3 className="mt-2 text-2xl font-black text-slate-900">
                  {record.device?.name || `Device #${record.device_id}`}
                </h3>
              </div>
              <StatusBadge value={record.retrieval_status || record.status} tone={statusTone(record.retrieval_status || record.status)} />
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-wide text-slate-400">Consumer</p>
                <p className="mt-1 font-bold text-slate-900">#{record.consumer_id}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-wide text-slate-400">Payment</p>
                <p className="mt-1 font-bold text-slate-900">{record.payment_status || 'unpaid'}</p>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4">
              <label className="space-y-2">
                <span className="text-xs font-black uppercase tracking-wide text-slate-400">Retrieval status</span>
                <BackOfficeSelect
                  value={draftStatus}
                  onChange={(e) => setDraftStatus(e.target.value)}
                  className="w-full bg-slate-50 py-3"
                >
                  {RETRIEVAL_STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </BackOfficeSelect>
              </label>

              <label className="space-y-2">
                <span className="text-xs font-black uppercase tracking-wide text-slate-400">Staff note</span>
                <textarea
                  value={draftNote}
                  onChange={(e) => setDraftNote(e.target.value)}
                  rows={4}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700"
                  placeholder="Add a retrieval note for staff/customer context..."
                />
              </label>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void saveStatus()}
                disabled={isSaving}
                className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-60"
              >
                {isSaving ? 'Saving...' : 'Save retrieval status'}
              </button>
              <button
                type="button"
                onClick={() => void issueDownload()}
                disabled={isIssuing}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
              >
                <Download className="h-4 w-4" />
                {isIssuing ? 'Issuing...' : 'Issue download link'}
              </button>
            </div>

            {download ? (
              <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
                Download link issued: <span className="break-all">{download.download_url}</span>
              </div>
            ) : null}
          </section>

          <PaymentSummaryCard summary={toPaymentSummary(record)} />
        </div>
      ) : null}
    </div>
  );
}
