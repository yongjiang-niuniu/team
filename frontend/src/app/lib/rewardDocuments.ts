import type { ReferralCode, RewardVoucher } from './userPortal';
import { getReferralCredentialUrl } from './referrals';

function absoluteUrl(value: string): string {
  if (typeof window === 'undefined') {
    return value;
  }

  try {
    return new URL(value, window.location.origin).toString();
  } catch {
    return new URL('/', window.location.origin).toString();
  }
}

function formatDateTime(value?: string | null): string {
  if (!value) {
    return 'Not available';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function normalizeCurrencyLabel(value?: string | null): string {
  const label = (value || 'Bonus pending').trim();
  return label.replace(/^拢/, 'GBP ').replace(/^£/, 'GBP ');
}

function fileSafe(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'ewaste-referral-voucher'
  );
}

export function buildReferralLandingUrl(referral: ReferralCode | null | undefined): string {
  if (!referral) {
    return absoluteUrl('/app/rewards');
  }

  const fallback = `/api/rewards/referrals/code/${encodeURIComponent(referral.code)}`;
  const base =
    referral.qr_target_url ||
    referral.partner?.referral_landing_url ||
    referral.partner?.website_url ||
    fallback;

  let url: URL;
  try {
    url = new URL(base, typeof window === 'undefined' ? 'http://127.0.0.1:5173' : window.location.origin);
  } catch {
    url = new URL(fallback, typeof window === 'undefined' ? 'http://127.0.0.1:5173' : window.location.origin);
  }

  url.searchParams.set('ewh_ref', referral.code);
  url.searchParams.set('ewh_referral_id', String(referral.id));
  url.searchParams.set('ewh_source', 'ewaste_hub');
  if (referral.classification_snapshot) {
    url.searchParams.set('ewh_classification', referral.classification_snapshot);
  }

  return url.toString();
}

export function buildReferralQrText(
  referral: ReferralCode | null | undefined,
  voucher: RewardVoucher,
): string {
  if (referral) {
    return getReferralCredentialUrl(referral.id);
  }

  return JSON.stringify({
    source: 'eWaste Hub',
    partner: voucher.partner,
    code: voucher.code,
    voucher: voucher.title,
    bonus: voucher.value_label,
  });
}

export async function createReferralQrDataUrl(
  referral: ReferralCode | null | undefined,
  voucher: RewardVoucher,
  width = 360,
): Promise<string> {
  const QRCode = await import('qrcode');
  return QRCode.toDataURL(buildReferralQrText(referral, voucher), {
    errorCorrectionLevel: 'M',
    margin: 1,
    width,
    color: {
      dark: '#1f2937',
      light: '#ffffff',
    },
  });
}

export async function downloadReferralVoucherPdf(
  voucher: RewardVoucher,
  referral: ReferralCode,
): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const qrDataUrl = await createReferralQrDataUrl(referral, voucher, 520);
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 42;
  const contentWidth = pageWidth - margin * 2;
  const partnerName = referral.partner?.name || voucher.partner;
  const deviceName = voucher.device?.name || referral.device?.name || voucher.title || 'Device';
  const classification = referral.classification_snapshot || voucher.device?.classification || 'current/rare';
  const landingUrl = buildReferralLandingUrl(referral);

  doc.setFillColor(5, 150, 105);
  doc.roundedRect(margin, 38, contentWidth, 92, 18, 18, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('eWaste Hub', margin + 24, 76);
  doc.setFontSize(13);
  doc.text('Demo partner referral voucher', margin + 24, 102);
  doc.setFontSize(11);
  doc.text(`Referral code: ${voucher.code}`, pageWidth - margin - 210, 76);
  doc.text(`Status: ${referral.status.toUpperCase()}`, pageWidth - margin - 210, 102);

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(19);
  doc.text(deviceName, margin, 172);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(71, 85, 105);
  doc.text('Show this voucher when handing in the device. The QR includes the eWaste Hub referral code.', margin, 194, {
    maxWidth: 310,
  });

  doc.addImage(qrDataUrl, 'PNG', pageWidth - margin - 150, 158, 150, 150);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(10);
  doc.text('SCAN TO OPEN PARTNER REFERRAL', pageWidth - margin - 150, 324);

  const rows = [
    ['Partner', partnerName],
    ['Voucher', voucher.title || referral.voucher_label || 'Trade-in Bonus'],
    ['Bonus', normalizeCurrencyLabel(referral.bonus_label || voucher.value_label)],
    ['Classification', classification.toUpperCase()],
    ['Issued', formatDateTime(referral.issued_at || voucher.created_at)],
    ['Partner URL', landingUrl],
  ];

  let y = 358;
  rows.forEach(([label, value]) => {
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, y - 16, contentWidth, 42, 8, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.setFontSize(9);
    doc.text(label.toUpperCase(), margin + 16, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(10);
    doc.text(String(value), margin + 138, y, { maxWidth: contentWidth - 154 });
    y += 52;
  });

  doc.setDrawColor(209, 250, 229);
  doc.setLineWidth(1);
  doc.roundedRect(margin, y + 8, contentWidth, 94, 12, 12, 'S');
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(5, 150, 105);
  doc.setFontSize(11);
  doc.text('Brief alignment', margin + 16, y + 34);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.setFontSize(10);
  doc.text(
    [
      'Current and rare devices can be handed in or resold through third parties.',
      'The QR identifies eWaste Hub and carries the referral code for partner fee reporting.',
      'Data wiping remains the partner-backed hand-in responsibility for this resale flow.',
    ],
    margin + 16,
    y + 56,
    { maxWidth: contentWidth - 32, lineHeightFactor: 1.35 },
  );

  doc.save(`${fileSafe(voucher.code)}-demo-voucher.pdf`);
}
