/**
 * Normalize unknown catch values from axios/fetch into a user-visible string.
 */
export function getApiStyleErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null) {
    const e = error as {
      response?: { data?: { error?: string; message?: string } };
      message?: string;
    };
    const fromBody = e.response?.data?.error ?? e.response?.data?.message;
    if (typeof fromBody === 'string' && fromBody.trim()) return fromBody;
    if (typeof e.message === 'string' && e.message.trim()) return e.message;
  }
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}
