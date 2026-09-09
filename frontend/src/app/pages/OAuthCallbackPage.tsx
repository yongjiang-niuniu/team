import { useEffect } from 'react';
import { LoaderCircle, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { clearAuthSession, setAccessToken, setStoredUser } from '../lib/auth';

const DEFAULT_REDIRECT = '/app/new-request';

function sanitizeNextPath(nextPath: string | null) {
  if (!nextPath || !nextPath.startsWith('/') || nextPath.startsWith('//')) {
    return DEFAULT_REDIRECT;
  }

  return nextPath;
}

function buildLoginErrorPath(message: string) {
  return `/auth/login?oauth_error=${encodeURIComponent(message)}`;
}

export function OAuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    let isActive = true;

    const completeOAuthLogin = async () => {
      const hash = window.location.hash.startsWith('#')
        ? window.location.hash.slice(1)
        : window.location.hash;
      const params = new URLSearchParams(hash);
      const accessToken = (params.get('access_token') || '').trim();
      const error = (params.get('error') || '').trim();
      const nextPath = sanitizeNextPath(params.get('next'));

      if (error) {
        clearAuthSession();
        navigate(buildLoginErrorPath(error), { replace: true });
        return;
      }

      if (!accessToken) {
        clearAuthSession();
        navigate(buildLoginErrorPath('GitHub sign-in did not complete.'), { replace: true });
        return;
      }

      try {
        setAccessToken(accessToken);
        const response = await api.get('/api/me');

        if (!isActive) {
          return;
        }

        if (response.data?.user) {
          setStoredUser(response.data.user);
        }

        navigate(nextPath, { replace: true });
      } catch (error: unknown) {
        if (!isActive) {
          return;
        }

        clearAuthSession();
        const err = error as { response?: { data?: { error?: string; message?: string } }; message?: string };
        const errorMessage =
          err.response?.data?.error ||
          err.response?.data?.message ||
          err.message ||
          'GitHub sign-in failed. Please try again.';
        navigate(buildLoginErrorPath(errorMessage), { replace: true });
      }
    };

    void completeOAuthLogin();

    return () => {
      isActive = false;
    };
  }, [navigate]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
      <div className="w-full max-w-md rounded-[2rem] border border-slate-100 bg-white p-10 text-center shadow-[0_32px_64px_-16px_rgba(0,0,0,0.08)]">
        <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600">
          <ShieldCheck className="size-7" />
        </div>
        <h1 className="text-2xl font-black tracking-tight text-slate-900">Completing sign-in</h1>
        <p className="mt-3 text-sm font-medium text-slate-500">
          We are verifying your GitHub account and restoring your eWaste Hub session.
        </p>
        <div className="mt-6 flex items-center justify-center gap-2 text-sm font-semibold text-slate-600">
          <LoaderCircle className="size-4 animate-spin" />
          Redirecting...
        </div>
      </div>
    </div>
  );
}
