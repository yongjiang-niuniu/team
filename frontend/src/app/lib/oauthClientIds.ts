import {
  PUBLIC_GITHUB_OAUTH_CLIENT_ID,
  PUBLIC_GOOGLE_OAUTH_CLIENT_ID,
} from '../../config/oauthPublicDefaults';

function firstNonEmpty(...candidates: Array<string | undefined>): string {
  for (const c of candidates) {
    const t = (c ?? '').trim();
    if (t) return t;
  }
  return '';
}

/** Env wins over repo defaults so forks can override without editing source. */
export function getGoogleClientId(): string {
  return firstNonEmpty(import.meta.env.VITE_GOOGLE_CLIENT_ID, PUBLIC_GOOGLE_OAUTH_CLIENT_ID);
}

export function getGithubClientId(): string {
  return firstNonEmpty(import.meta.env.VITE_GITHUB_CLIENT_ID, PUBLIC_GITHUB_OAUTH_CLIENT_ID);
}
