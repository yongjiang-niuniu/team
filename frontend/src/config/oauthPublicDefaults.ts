/**
 * Public OAuth client IDs for local development (same values as in Google Cloud / GitHub OAuth App).
 * They are not secrets; the browser exposes them anyway. Teammates can clone without frontend/.env.
 * Override with VITE_GOOGLE_CLIENT_ID / VITE_GITHUB_CLIENT_ID when needed.
 */
export const PUBLIC_GOOGLE_OAUTH_CLIENT_ID =
  '769969676598-6cv5av98siji0l2o2cc5qlif4nsktj4g.apps.googleusercontent.com';

export const PUBLIC_GITHUB_OAUTH_CLIENT_ID = 'Ov23lilAV4Nmq1HC8k6N';
