import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import { BackOfficeTable, BackOfficeTd, BackOfficeTh } from "../../components/backoffice/BackOfficeTable";
import { BackOfficeSelect } from "../../components/backoffice/BackOfficeSelect";
import { StatusBadge } from "../../components/backoffice/StatusBadge";
import { statusTone } from "../../components/backoffice/statusTone";
import { getApiStyleErrorMessage } from "../../lib/httpErrors";
import { fetchStaffDevices, patchStaffDeviceField } from "../../lib/staffPortal";
import {
  fetchRewardPartners,
  issueReferralCode,
  type PortalDevice,
  type ReferralCode,
  type RewardPartner,
} from "../../lib/userPortal";

const CLASSIFICATION_OPTIONS = ['current', 'recycle', 'rare', 'unwanted', 'unknown'] as const;
const PROCESSING_STATUS_OPTIONS = ['pending', 'processing', 'done', 'rejected'] as const;

export function StaffDevicesPage() {
  const [devices, setDevices] = useState<PortalDevice[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [referralDevice, setReferralDevice] = useState<PortalDevice | null>(null);
  const [partners, setPartners] = useState<RewardPartner[]>([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState('');
  const [issuedReferral, setIssuedReferral] = useState<ReferralCode | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const loadDevices = async () => {
    setIsLoading(true);
    try {
      const items = await fetchStaffDevices();
      setDevices(items);
      setErrorMessage('');
    } catch (error: unknown) {
      setErrorMessage(getApiStyleErrorMessage(error, 'Could not load devices.'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadDevices();
  }, []);

  const filteredDevices = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) {
      return devices;
    }
    return devices.filter((device) =>
      [
        device.id,
        device.name,
        device.device_type,
        device.condition,
        device.classification,
        device.workflow_status,
        device.processing_status,
      ]
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [devices, search]);

  const handleDeviceField = async (
    deviceId: number,
    field: 'classification' | 'processing-status' | 'visibility' | 'draft',
    value: string | boolean,
  ) => {
    setUpdatingId(deviceId);
    setErrorMessage('');
    try {
      await patchStaffDeviceField(deviceId, field, value);
      await loadDevices();
    } catch (error: unknown) {
      setErrorMessage(getApiStyleErrorMessage(error, 'Could not update device.'));
    } finally {
      setUpdatingId(null);
    }
  };

  const openReferralPanel = async (device: PortalDevice) => {
    setReferralDevice(device);
    setIssuedReferral(null);
    setSelectedPartnerId('');
    setErrorMessage('');
    setSuccessMessage('');
    setUpdatingId(device.id);
    try {
      const items = await fetchRewardPartners(device.classification);
      setPartners(items);
      setSelectedPartnerId(items[0]?.id ? String(items[0].id) : '');
    } catch (error: unknown) {
      setPartners([]);
      setErrorMessage(getApiStyleErrorMessage(error, 'Could not load referral partners.'));
    } finally {
      setUpdatingId(null);
    }
  };

  const createReferral = async () => {
    if (!referralDevice) {
      return;
    }

    setUpdatingId(referralDevice.id);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const referral = await issueReferralCode({
        device_id: referralDevice.id,
        partner_id: selectedPartnerId ? Number(selectedPartnerId) : null,
      });
      setIssuedReferral(referral);
      setSuccessMessage(`Referral code ${referral.code} created for ${referralDevice.name}.`);
    } catch (error: unknown) {
      setErrorMessage(getApiStyleErrorMessage(error, 'Could not create referral code.'));
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <section className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-600">Staff inventory</p>
          <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">Device management</h2>
          <p className="mt-2 text-sm font-medium text-slate-500">
            Classify devices, update processing state, and control whether records are visible or draft.
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

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search devices..."
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
      />

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
          Loading devices...
        </div>
      ) : (
        <BackOfficeTable>
          <thead>
            <tr>
              <BackOfficeTh>Device</BackOfficeTh>
              <BackOfficeTh>Owner</BackOfficeTh>
              <BackOfficeTh>Classification</BackOfficeTh>
              <BackOfficeTh>Processing</BackOfficeTh>
              <BackOfficeTh>Visibility</BackOfficeTh>
              <BackOfficeTh>Draft</BackOfficeTh>
              <BackOfficeTh>Referral</BackOfficeTh>
            </tr>
          </thead>
          <tbody>
            {filteredDevices.map((device) => (
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
                  <BackOfficeSelect
                    value={device.classification}
                    disabled={updatingId === device.id}
                    onChange={(e) => void handleDeviceField(device.id, 'classification', e.target.value)}
                  >
                    {CLASSIFICATION_OPTIONS.map((classification) => (
                      <option key={classification} value={classification}>
                        {classification}
                      </option>
                    ))}
                  </BackOfficeSelect>
                </BackOfficeTd>
                <BackOfficeTd>
                  <BackOfficeSelect
                    value={device.processing_status || 'pending'}
                    disabled={updatingId === device.id}
                    onChange={(e) => void handleDeviceField(device.id, 'processing-status', e.target.value)}
                  >
                    {PROCESSING_STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </BackOfficeSelect>
                </BackOfficeTd>
                <BackOfficeTd>
                  <button
                    type="button"
                    disabled={updatingId === device.id}
                    onClick={() => void handleDeviceField(device.id, 'visibility', !device.is_visible)}
                  >
                    <StatusBadge
                      value={device.is_visible ? 'visible' : 'hidden'}
                      tone={statusTone(device.is_visible ? 'visible' : 'hidden')}
                    />
                  </button>
                </BackOfficeTd>
                <BackOfficeTd>
                  <button
                    type="button"
                    disabled={updatingId === device.id}
                    onClick={() => void handleDeviceField(device.id, 'draft', !device.is_draft)}
                  >
                    <StatusBadge value={device.is_draft ? 'draft' : 'published'} />
                  </button>
                </BackOfficeTd>
                <BackOfficeTd>
                  {device.classification === 'current' || device.classification === 'rare' ? (
                    <button
                      type="button"
                      disabled={updatingId === device.id}
                      onClick={() => void openReferralPanel(device)}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-60"
                    >
                      Partners
                    </button>
                  ) : (
                    <span className="text-xs font-bold text-slate-400">n/a</span>
                  )}
                </BackOfficeTd>
              </tr>
            ))}
          </tbody>
        </BackOfficeTable>
      )}

      {referralDevice ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-6">
          <div className="w-full max-w-xl rounded-[2rem] border border-slate-200 bg-white p-6 shadow-2xl">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-600">
              Referral partners
            </p>
            <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-900">
              {referralDevice.name}
            </h3>
            <p className="mt-2 text-sm font-medium text-slate-500">
              Use this for current or rare devices that can be handed in or resold through a third party.
            </p>

            <div className="mt-5 space-y-3">
              <BackOfficeSelect
                value={selectedPartnerId}
                onChange={(event) => setSelectedPartnerId(event.target.value)}
                className="w-full bg-slate-50 py-3"
              >
                <option value="">No partner selected</option>
                {partners.map((partner) => (
                  <option key={partner.id} value={partner.id}>
                    {partner.name} ({partner.partner_type})
                  </option>
                ))}
              </BackOfficeSelect>

              {partners.map((partner) => (
                <div key={partner.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-black text-slate-900">{partner.name}</p>
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                        {partner.partner_type}
                      </p>
                    </div>
                    {(partner.referral_landing_url || partner.website_url) ? (
                      <a
                        href={partner.referral_landing_url || partner.website_url || '#'}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-black text-white hover:bg-slate-800"
                      >
                        Open
                      </a>
                    ) : null}
                  </div>
                </div>
              ))}

              {!partners.length ? (
                <div className="rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm font-semibold text-amber-700">
                  No partners are configured for this classification yet.
                </div>
              ) : null}

              {issuedReferral ? (
                <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
                  Referral code: <span className="font-black">{issuedReferral.code}</span>
                  {issuedReferral.qr_payload ? (
                    <p className="mt-2 break-all text-xs">QR payload: {issuedReferral.qr_payload}</p>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={updatingId === referralDevice.id}
                onClick={() => setReferralDevice(null)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
              >
                Close
              </button>
              <button
                type="button"
                disabled={updatingId === referralDevice.id}
                onClick={() => void createReferral()}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-60"
              >
                {updatingId === referralDevice.id ? 'Creating...' : 'Create referral code'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

