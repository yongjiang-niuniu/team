import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, Download, ExternalLink, FileText, Gift, Loader2, ShieldCheck, Store, Tags } from 'lucide-react';
import { getApiStyleErrorMessage } from '../lib/httpErrors';
import {
  buildReferralLandingUrl,
  createReferralQrDataUrl,
  downloadReferralVoucherPdf,
} from '../lib/rewardDocuments';
import { getReferralCredentialUrl } from '../lib/referrals';
import {
  fetchReferralDetail,
  fetchReferralByCode,
  fetchMyRequests,
  fetchMyRewards,
  fetchRewardPartners,
  issueReferralCode,
  type PortalRequest,
  type ReferralCode,
  recordReferralOpen,
  recordReferralRedeem,
  type RewardPartner,
  type RewardVoucher,
} from '../lib/userPortal';

const CARD_STYLES = [
  { color: 'bg-emerald-600', lightColor: 'text-emerald-100', iconBg: 'bg-emerald-500' },
  { color: 'bg-slate-900', lightColor: 'text-slate-400', iconBg: 'bg-slate-800' },
  { color: 'bg-blue-700', lightColor: 'text-blue-100', iconBg: 'bg-blue-600' },
];

const PARTNER_FILTERS = [
  { id: 'all', label: 'All Partners' },
  { id: 'current', label: 'Current' },
  { id: 'rare', label: 'Rare' },
] as const;

function formatPartnerType(value: string | undefined): string {
  switch ((value || '').trim().toLowerCase()) {
    case 'resale':
      return 'Resale';
    case 'marketplace':
      return 'Marketplace';
    default:
      return value ? value.charAt(0).toUpperCase() + value.slice(1) : 'Partner';
  }
}

function formatRewardDate(value?: string | null): string {
  if (!value) {
    return 'Not available';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function isReferralTerminal(status: string | undefined): boolean {
  return ['redeemed', 'handin_confirmed', 'resale_confirmed'].includes((status || '').trim().toLowerCase());
}

function ReferralQrImage({
  referral,
  voucher,
  className,
}: {
  referral: ReferralCode | null | undefined;
  voucher: RewardVoucher;
  className?: string;
}) {
  const [qrDataUrl, setQrDataUrl] = useState('');

  useEffect(() => {
    let ignore = false;

    async function renderQr() {
      try {
        const dataUrl = await createReferralQrDataUrl(referral, voucher);
        if (!ignore) {
          setQrDataUrl(dataUrl);
        }
      } catch {
        if (!ignore) {
          setQrDataUrl('');
        }
      }
    }

    void renderQr();

    return () => {
      ignore = true;
    };
  }, [referral, voucher]);

  if (!qrDataUrl) {
    return (
      <div className={`${className || ''} flex items-center justify-center bg-slate-100 text-slate-400`}>
        <Loader2 className="h-10 w-10 animate-spin" />
      </div>
    );
  }

  return <img src={qrDataUrl} alt={`QR code for ${voucher.code}`} className={className} />;
}

export function RewardsPage() {
  const [rewards, setRewards] = useState<RewardVoucher[]>([]);
  const [requests, setRequests] = useState<PortalRequest[]>([]);
  const [partners, setPartners] = useState<RewardPartner[]>([]);
  const [partnerFilter, setPartnerFilter] = useState<(typeof PARTNER_FILTERS)[number]['id']>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isPartnerLoading, setIsPartnerLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [partnerErrorMessage, setPartnerErrorMessage] = useState('');
  const [issuingPartnerId, setIssuingPartnerId] = useState<number | null>(null);
  const [selectedRequestByPartner, setSelectedRequestByPartner] = useState<Record<number, string>>({});
  const [issuedReferralByPartner, setIssuedReferralByPartner] = useState<Record<number, ReferralCode>>({});
  const [referralByVoucherCode, setReferralByVoucherCode] = useState<Record<string, ReferralCode>>({});
  const [actingReferralId, setActingReferralId] = useState<number | null>(null);
  const [pdfDownloadingCode, setPdfDownloadingCode] = useState<string | null>(null);
  const [selectedReferralDetail, setSelectedReferralDetail] = useState<ReferralCode | null>(null);
  const [loadingReferralDetailId, setLoadingReferralDetailId] = useState<number | null>(null);

  useEffect(() => {
    let ignore = false;

    async function loadRewards() {
      try {
        const [rewardItems, requestItems] = await Promise.all([
          fetchMyRewards(),
          fetchMyRequests(),
        ]);
        if (!ignore) {
          setRewards(rewardItems);
          setRequests(requestItems);
          setErrorMessage('');
          setIsLoading(false);
        }

        const embeddedReferralByCode: Record<string, ReferralCode> = {};
        rewardItems.forEach((item) => {
          if (item.code && item.referral_code) {
            embeddedReferralByCode[item.code] = item.referral_code;
          }
        });

        const uniqueCodes = [
          ...new Set(
            rewardItems
              .map((item) => item.code)
              .filter((code) => Boolean(code) && !embeddedReferralByCode[code]),
          ),
        ];
        const detailResults = await Promise.allSettled(uniqueCodes.map((code) => fetchReferralByCode(code)));
        if (!ignore) {
          const nextMap: Record<string, ReferralCode> = { ...embeddedReferralByCode };
          detailResults.forEach((result, index) => {
            if (result.status === 'fulfilled' && result.value) {
              nextMap[uniqueCodes[index]] = result.value;
            }
          });
          setReferralByVoucherCode(nextMap);
        }
      } catch (error: unknown) {
        if (!ignore) {
          setErrorMessage(getApiStyleErrorMessage(error, 'Could not load your rewards.'));
          setIsLoading(false);
        }
      }
    }

    void loadRewards();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;

    async function loadPartners() {
      setIsPartnerLoading(true);
      try {
        const items = await fetchRewardPartners(partnerFilter === 'all' ? null : partnerFilter);
        if (!ignore) {
          setPartners(items);
          setPartnerErrorMessage('');
          setIsPartnerLoading(false);
        }
      } catch (error: unknown) {
        if (!ignore) {
          setPartnerErrorMessage(getApiStyleErrorMessage(error, 'Could not load the partner list.'));
          setIsPartnerLoading(false);
        }
      }
    }

    void loadPartners();

    return () => {
      ignore = true;
    };
  }, [partnerFilter]);

  const eligibleRequestsForPartner = (partner: RewardPartner) =>
    requests.filter((request) => {
      const classification = (request.device?.classification || '').trim().toLowerCase();
      return Boolean(
        request.device?.id &&
          classification &&
          partner.supported_classifications.some((item) => item.toLowerCase() === classification),
      );
    });

  const handleIssueReferral = async (partner: RewardPartner) => {
    const selectedRequestId = Number(selectedRequestByPartner[partner.id] || '');
    const requestRecord = eligibleRequestsForPartner(partner).find((item) => item.id === selectedRequestId);
    const deviceId = requestRecord?.device?.id;

    if (!requestRecord || !deviceId) {
      setPartnerErrorMessage('Please select an eligible request before issuing a referral code.');
      return;
    }

    setIssuingPartnerId(partner.id);
    setPartnerErrorMessage('');
    setStatusMessage('');
    try {
      const referral = await issueReferralCode({
        partner_id: partner.id,
        request_id: requestRecord.id,
        device_id: deviceId,
      });
      setIssuedReferralByPartner((current) => ({
        ...current,
        [partner.id]: referral,
      }));

      const nextRewards = await fetchMyRewards();
      setRewards(nextRewards);
      setReferralByVoucherCode((current) => ({
        ...current,
        [referral.code]: referral,
      }));
      setStatusMessage(`Referral code ${referral.code} is ready for ${partner.name}.`);
    } catch (error: unknown) {
      setPartnerErrorMessage(getApiStyleErrorMessage(error, 'Could not issue a referral code right now.'));
    } finally {
      setIssuingPartnerId(null);
    }
  };

  const handleReferralOpen = async (voucherCode: string) => {
    const referral = referralByVoucherCode[voucherCode];
    if (!referral) {
      setErrorMessage('No referral record is linked to this voucher yet.');
      return;
    }

    window.open(buildReferralLandingUrl(referral), '_blank', 'noopener,noreferrer');
    setActingReferralId(referral.id);
    setErrorMessage('');
    setStatusMessage('');
    try {
      const updatedReferral = await recordReferralOpen(referral.id, {
        source: 'owner_rewards_page',
      });
      setReferralByVoucherCode((current) => ({
        ...current,
        [voucherCode]: updatedReferral,
      }));
      if (selectedReferralDetail?.id === updatedReferral.id) {
        setSelectedReferralDetail(updatedReferral);
      }
      setStatusMessage(`Opened partner referral ${updatedReferral.code}.`);
    } catch (error: unknown) {
      setErrorMessage(getApiStyleErrorMessage(error, 'Could not record the referral open event right now.'));
    } finally {
      setActingReferralId(null);
    }
  };

  const handleReferralRedeem = async (voucherCode: string) => {
    const referral = referralByVoucherCode[voucherCode];
    if (!referral) {
      setErrorMessage('No referral record is linked to this voucher yet.');
      return;
    }

    setActingReferralId(referral.id);
    setErrorMessage('');
    setStatusMessage('');
    try {
      const updatedReferral = await recordReferralRedeem(referral.id, {
        channel: 'owner_rewards_page',
      });
      setReferralByVoucherCode((current) => ({
        ...current,
        [voucherCode]: updatedReferral,
      }));
      if (selectedReferralDetail?.id === updatedReferral.id) {
        setSelectedReferralDetail(updatedReferral);
      }
      setStatusMessage(`Referral ${updatedReferral.code} is marked as redeemed for partner hand-in.`);
    } catch (error: unknown) {
      setErrorMessage(getApiStyleErrorMessage(error, 'Could not redeem this referral right now.'));
    } finally {
      setActingReferralId(null);
    }
  };

  const handleLoadReferralDetail = async (referralCodeId: number) => {
    setLoadingReferralDetailId(referralCodeId);
    setErrorMessage('');
    try {
      const referral = await fetchReferralDetail(referralCodeId);
      setSelectedReferralDetail(referral);
      if (referral?.code) {
        setReferralByVoucherCode((current) => ({
          ...current,
          [referral.code]: referral,
        }));
      }
    } catch (error: unknown) {
      setErrorMessage(getApiStyleErrorMessage(error, 'Could not load this referral detail right now.'));
    } finally {
      setLoadingReferralDetailId(null);
    }
  };

  const handleDownloadPdf = async (voucher: RewardVoucher, referral: ReferralCode | null | undefined) => {
    if (!referral) {
      setErrorMessage('No referral record is linked to this voucher yet.');
      return;
    }

    setPdfDownloadingCode(voucher.code);
    setErrorMessage('');
    setStatusMessage('');
    try {
      await downloadReferralVoucherPdf(voucher, referral);
      setStatusMessage(`Downloaded demo PDF voucher for ${voucher.code}.`);
    } catch (error: unknown) {
      setErrorMessage(getApiStyleErrorMessage(error, 'Could not generate the demo PDF voucher right now.'));
    } finally {
      setPdfDownloadingCode(null);
    }
  };

  const selectedReferralVoucher = selectedReferralDetail
    ? rewards.find((voucher) => voucher.code === selectedReferralDetail.code)
    : null;

  return (
    <div className="max-w-6xl mx-auto space-y-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-emerald-100 text-emerald-600 rounded-2xl">
              <Gift className="w-6 h-6" />
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Rewards & Partners</h1>
          </div>
          <p className="text-slate-500 font-medium text-lg max-w-3xl">
            Browse eligible referral partners and keep your issued vouchers in one place.
          </p>
        </div>
      </div>

      {statusMessage ? (
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4 text-emerald-700">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          <p className="text-sm font-bold">{statusMessage}</p>
        </div>
      ) : null}

      <section className="space-y-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Referral Partners</p>
            <h2 className="text-2xl font-black text-slate-900">Partner List</h2>
          </div>
          <div className="inline-flex flex-wrap gap-2 rounded-2xl bg-slate-100 p-1.5">
            {PARTNER_FILTERS.map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => setPartnerFilter(filter.id)}
                className={`rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
                  partnerFilter === filter.id
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {partnerErrorMessage ? (
          <div className="rounded-[2rem] border border-red-100 bg-red-50 px-8 py-6 text-center text-red-600">
            <p className="text-lg font-black mb-2">Partner List Unavailable</p>
            <p className="font-medium">{partnerErrorMessage}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {isPartnerLoading
              ? [0, 1, 2].map((item) => (
                  <div key={item} className="h-[260px] rounded-[2rem] border border-slate-100 bg-white animate-pulse" />
                ))
              : partners.map((partner, index) => (
                  <motion.article
                    key={partner.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.06 }}
                    className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-4 mb-5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                          <Store className="h-7 w-7" />
                        </div>
                        <div>
                          <p className="text-xs font-black uppercase tracking-widest text-slate-400">Partner</p>
                          <h3 className="text-xl font-black text-slate-900">{partner.name}</h3>
                        </div>
                      </div>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-600">
                        {formatPartnerType(partner.partner_type)}
                      </span>
                    </div>

                    <div className="space-y-3 mb-6">
                      <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                        <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1">Supported</p>
                        <div className="flex flex-wrap gap-2">
                          {partner.supported_classifications.map((classification) => (
                            <span
                              key={classification}
                              className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-700 border border-slate-200"
                            >
                              {classification.toUpperCase()}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                        <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1">Referral Entry</p>
                        <p className="text-sm font-medium text-slate-600 break-all">
                          {partner.referral_landing_url || partner.website_url || 'No landing page configured yet.'}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3">
                        <p className="text-xs font-black uppercase tracking-widest text-emerald-700 mb-1">Demo Value Guidance</p>
                        <p className="text-sm font-black text-slate-900">
                          {partner.demo_estimated_value || 'Demo estimate pending'}
                        </p>
                        {partner.demo_value_source ? (
                          <p className="mt-1 text-xs font-bold text-slate-500">{partner.demo_value_source}</p>
                        ) : null}
                        {partner.demo_hand_in_locations?.length ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {partner.demo_hand_in_locations.slice(0, 3).map((location) => (
                              <span
                                key={location}
                                className="rounded-full border border-emerald-100 bg-white px-3 py-1 text-xs font-bold text-emerald-700"
                              >
                                {location}
                              </span>
                            ))}
                          </div>
                        ) : null}
                        {partner.demo_wiping_guarantee ? (
                          <p className="mt-3 text-xs font-semibold leading-relaxed text-slate-600">
                            {partner.demo_wiping_guarantee}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    {eligibleRequestsForPartner(partner).length > 0 ? (
                      <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-4 mb-4">
                        <p className="text-xs font-black uppercase tracking-widest text-emerald-700 mb-2">Issue Referral Code</p>
                        <select
                          value={selectedRequestByPartner[partner.id] || ''}
                          onChange={(event) =>
                            setSelectedRequestByPartner((current) => ({
                              ...current,
                              [partner.id]: event.target.value,
                            }))
                          }
                          className="w-full rounded-xl border border-emerald-100 bg-white px-3 py-3 text-sm font-bold text-slate-900 mb-3"
                        >
                          <option value="">Select an eligible request</option>
                          {eligibleRequestsForPartner(partner).map((request) => (
                            <option key={request.id} value={request.id}>
                              EW-{request.id} · {request.device?.name || 'Device'} · {(request.device?.classification || 'unknown').toUpperCase()}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => void handleIssueReferral(partner)}
                          disabled={issuingPartnerId === partner.id}
                          className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-60"
                        >
                          {issuingPartnerId === partner.id ? 'Issuing...' : 'Issue Referral Code'}
                        </button>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 mb-4 text-sm font-medium text-slate-500">
                        No eligible current or rare requests are available for this partner yet.
                      </div>
                    )}

                    {issuedReferralByPartner[partner.id] ? (
                      <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-4 mb-4">
                        <p className="text-xs font-black uppercase tracking-widest text-blue-700 mb-2">Latest Referral Code</p>
                        <p className="text-lg font-black text-slate-900">{issuedReferralByPartner[partner.id].code}</p>
                        <p className="text-sm font-medium text-slate-600 mt-1">
                          Status: <span className="font-black">{issuedReferralByPartner[partner.id].status}</span>
                        </p>
                        {issuedReferralByPartner[partner.id].bonus_label ? (
                          <p className="text-sm font-medium text-slate-600 mt-1">
                            Bonus: <span className="font-black">{issuedReferralByPartner[partner.id].bonus_label}</span>
                          </p>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => void handleLoadReferralDetail(issuedReferralByPartner[partner.id].id)}
                          disabled={loadingReferralDetailId === issuedReferralByPartner[partner.id].id}
                          className="mt-3 w-full rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                        >
                          {loadingReferralDetailId === issuedReferralByPartner[partner.id].id ? 'Loading Detail...' : 'View Referral Detail'}
                        </button>
                      </div>
                    ) : null}

                    <div className="flex flex-wrap gap-3">
                      {partner.website_url ? (
                        <a
                          href={partner.website_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800"
                        >
                          <ExternalLink className="w-4 h-4" />
                          Visit Website
                        </a>
                      ) : null}
                      {partner.referral_landing_url ? (
                        <a
                          href={partner.partner_detail_url || partner.referral_landing_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
                        >
                          <Tags className="w-4 h-4" />
                          Partner Detail
                        </a>
                      ) : null}
                    </div>
                  </motion.article>
                ))}

            {!isPartnerLoading && !partners.length ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="md:col-span-2 xl:col-span-3 rounded-[2rem] border border-dashed border-slate-200 bg-slate-50 px-8 py-12 text-center"
              >
                <p className="text-xl font-black text-slate-900 mb-2">No Partners Available</p>
                <p className="text-slate-500 font-medium">
                  No active reward partners matched the current filter.
                </p>
              </motion.div>
            ) : null}
          </div>
        )}
      </section>

      <section className="space-y-5">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Issued Rewards</p>
          <h2 className="text-2xl font-black text-slate-900">My Rewards</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 items-start">
          {isLoading &&
            [0, 1, 2].map((item) => (
              <div key={item} className="w-full max-w-md mx-auto h-[500px] rounded-[2.5rem] border border-slate-100 bg-white animate-pulse" />
            ))}

          {!isLoading && errorMessage && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              className="md:col-span-2 lg:col-span-3 rounded-[2.5rem] border border-red-100 bg-red-50 px-10 py-12 text-center text-red-600"
            >
              <p className="text-lg font-black mb-2">Rewards Unavailable</p>
              <p className="font-medium">{errorMessage}</p>
            </motion.div>
          )}

          {!isLoading && !errorMessage && rewards.map((voucher, index) => {
            const style = CARD_STYLES[index % CARD_STYLES.length];
            const linkedReferral = referralByVoucherCode[voucher.code];
            const referralStatus = (linkedReferral?.status || '').trim().toLowerCase();
            const canOpen = Boolean(linkedReferral) && !isReferralTerminal(referralStatus);
            const canRedeem = Boolean(linkedReferral) && !isReferralTerminal(referralStatus);
            return (
              <motion.div
                key={voucher.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.15, type: 'spring', stiffness: 100 }}
                className="w-full max-w-md mx-auto relative group"
              >
                <div className="relative rounded-[2.5rem] overflow-hidden shadow-2xl shadow-slate-200/50 bg-white border border-slate-100 transition-transform duration-300 hover:-translate-y-2">
                  <div className={`${style.color} p-8 text-white flex justify-between items-center`}>
                    <div className="flex items-center gap-4">
                      <div className={`w-14 h-14 ${style.iconBg} rounded-2xl flex items-center justify-center shadow-inner`}>
                        <Store className="w-7 h-7 text-white" />
                      </div>
                      <div>
                        <p className={`${style.lightColor} text-xs font-bold uppercase tracking-widest mb-0.5`}>
                          Partner
                        </p>
                        <h3 className="text-xl font-black tracking-tight">{voucher.partner}</h3>
                      </div>
                    </div>
                  </div>

                  <div className="relative h-10 bg-white flex items-center w-full">
                    <div className="absolute -left-5 w-10 h-10 bg-slate-50 rounded-full border-r border-slate-100 shadow-inner"></div>
                    <div className="w-full border-t-[3px] border-dashed border-slate-200 mx-8"></div>
                    <div className="absolute -right-5 w-10 h-10 bg-slate-50 rounded-full border-l border-slate-100 shadow-inner"></div>
                  </div>

                  <div className="bg-white p-8 pt-2 flex flex-col items-center text-center pb-10">
                    <div className="mb-8">
                      <h4 className="text-2xl font-black text-slate-900 mb-1">{voucher.device?.name || voucher.title}</h4>
                      <p className="text-slate-500 font-bold">
                        Estimated Value: <span className="text-slate-900 text-lg">{voucher.value_label}</span>
                      </p>
                    </div>

                    <div className="relative h-56 w-56 bg-white rounded-[2rem] border-2 border-slate-100 mb-6 group-hover:border-emerald-200 transition-colors shadow-sm overflow-hidden">
                      <div className="absolute top-4 left-4 w-6 h-6 border-t-4 border-l-4 border-emerald-500 rounded-tl-xl"></div>
                      <div className="absolute top-4 right-4 w-6 h-6 border-t-4 border-r-4 border-emerald-500 rounded-tr-xl"></div>
                      <div className="absolute bottom-4 left-4 w-6 h-6 border-b-4 border-l-4 border-emerald-500 rounded-bl-xl"></div>
                      <div className="absolute bottom-4 right-4 w-6 h-6 border-b-4 border-r-4 border-emerald-500 rounded-br-xl"></div>

                      <ReferralQrImage
                        referral={linkedReferral}
                        voucher={voucher}
                        className="h-full w-full object-contain p-8"
                      />
                    </div>

                    <div className="space-y-3">
                      <p className="text-sm font-bold text-slate-500 px-4 leading-relaxed">
                        Show this code in-store to claim your bonus.
                      </p>
                      <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-xl">
                        <ShieldCheck className="w-4 h-4" />
                        <span className="text-xs font-black uppercase tracking-wider">
                          Partner ID: {voucher.code}
                        </span>
                      </div>
                      {linkedReferral ? (
                        <div className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4 text-left">
                          <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Referral Status</p>
                          <p className="text-sm font-bold text-slate-900 mb-1">{linkedReferral.status.toUpperCase()}</p>
                          <p className="text-xs font-bold text-slate-500 mb-2">
                            Issued {formatRewardDate(linkedReferral.issued_at || voucher.created_at)}
                          </p>
                          {linkedReferral.bonus_label ? (
                            <p className="text-sm font-medium text-slate-600 mb-3">
                              Bonus: <span className="font-black">{linkedReferral.bonus_label}</span>
                            </p>
                          ) : null}
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => void handleReferralOpen(voucher.code)}
                              disabled={!canOpen || actingReferralId === linkedReferral.id}
                              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                            >
                              <ExternalLink className="h-4 w-4" />
                              {actingReferralId === linkedReferral.id ? 'Saving...' : 'Open Partner'}
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleReferralRedeem(voucher.code)}
                              disabled={!canRedeem || actingReferralId === linkedReferral.id}
                              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-60"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              {actingReferralId === linkedReferral.id ? 'Saving...' : 'Redeem'}
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleLoadReferralDetail(linkedReferral.id)}
                              disabled={loadingReferralDetailId === linkedReferral.id}
                              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                            >
                              <FileText className="h-4 w-4" />
                              {loadingReferralDetailId === linkedReferral.id ? 'Loading...' : 'Detail'}
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDownloadPdf(voucher, linkedReferral)}
                              disabled={pdfDownloadingCode === voucher.code}
                              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm font-bold text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
                            >
                              <Download className="h-4 w-4" />
                              {pdfDownloadingCode === voucher.code ? 'Preparing...' : 'PDF'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="w-full rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-left text-sm font-medium text-slate-500">
                          No linked referral record has been loaded for this voucher yet.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className={`h-3 w-full ${style.color} opacity-20`}></div>
                </div>

                <div className="absolute -bottom-4 left-4 right-4 h-10 bg-slate-200/50 rounded-3xl -z-10 blur-xl"></div>
              </motion.div>
            );
          })}

          {!isLoading && !errorMessage && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45, type: 'spring', stiffness: 100 }}
              className="w-full max-w-md mx-auto h-full min-h-[500px]"
            >
              <div className="h-full rounded-[2.5rem] border-3 border-dashed border-slate-200 bg-slate-50/50 flex flex-col items-center justify-center p-8 text-center hover:bg-slate-50 hover:border-slate-300 transition-colors">
                <div className="w-20 h-20 bg-white rounded-3xl shadow-sm border border-slate-100 flex items-center justify-center mb-6">
                  <Gift className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-xl font-black text-slate-700 mb-2">{rewards.length > 0 ? 'More Rewards' : 'No Rewards Yet'}</h3>
                <p className="text-slate-500 font-medium">
                  {rewards.length > 0
                    ? 'Recycle more devices to unlock additional partner vouchers and bonuses.'
                    : 'Trade-in-ready and rare classified devices will unlock partner rewards here automatically.'}
                </p>
              </div>
            </motion.div>
          )}
        </div>
      </section>

      {selectedReferralDetail ? (
        <section className="space-y-5">
          <div className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm">
            <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Referral Detail</p>
                <h2 className="text-2xl font-black text-slate-900">{selectedReferralDetail.code}</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <a
                  href={buildReferralLandingUrl(selectedReferralDetail)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open Partner
                </a>
                {selectedReferralVoucher ? (
                  <button
                    type="button"
                    onClick={() => void handleDownloadPdf(selectedReferralVoucher, selectedReferralDetail)}
                    disabled={pdfDownloadingCode === selectedReferralVoucher.code}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-60"
                  >
                    <Download className="h-4 w-4" />
                    {pdfDownloadingCode === selectedReferralVoucher.code ? 'Preparing...' : 'Download PDF'}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setSelectedReferralDetail(null)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                >
                  Close Detail
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Status</p>
                <p className="mt-1 text-sm font-bold text-slate-900">{selectedReferralDetail.status.toUpperCase()}</p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Partner</p>
                <p className="mt-1 text-sm font-bold text-slate-900">{selectedReferralDetail.partner?.name || 'Unassigned'}</p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Issued At</p>
                <p className="mt-1 text-sm font-bold text-slate-900">{formatRewardDate(selectedReferralDetail.issued_at)}</p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Redeemed At</p>
                <p className="mt-1 text-sm font-bold text-slate-900">{formatRewardDate(selectedReferralDetail.redeemed_at)}</p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              {selectedReferralVoucher ? (
                <div className="rounded-2xl border border-slate-100 bg-white px-4 py-4">
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">Scan Voucher</p>
                  <ReferralQrImage
                    referral={selectedReferralDetail}
                    voucher={selectedReferralVoucher}
                    className="mx-auto h-56 w-56 object-contain rounded-2xl border border-slate-100 bg-white p-4"
                  />
                </div>
              ) : null}
              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
                <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">QR Payload</p>
                <p className="text-sm font-medium break-all text-slate-600">
                  {selectedReferralDetail.qr_payload || 'No QR payload returned.'}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
                <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">QR Target</p>
                <p className="text-sm font-medium break-all text-slate-600">
                  {getReferralCredentialUrl(selectedReferralDetail.id)}
                </p>
              </div>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
