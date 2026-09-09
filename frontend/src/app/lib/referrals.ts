export function getReferralCredentialPath(referralId: number | string): string {
  return `/app/rewards/referrals/${referralId}`;
}

export function getReferralCredentialUrl(referralId: number | string): string {
  const path = getReferralCredentialPath(referralId);
  if (typeof window === 'undefined') {
    return path;
  }
  return `${window.location.origin}${path}`;
}
