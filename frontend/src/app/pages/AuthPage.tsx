import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Mail, Lock, User, Recycle, ShieldCheck, Zap, TrendingUp, ArrowRight, Github, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import { AuthToast, type AuthToastVariant } from '../components/AuthToast';
import { clearAuthSession, setAccessToken, setStoredUser } from '../lib/auth';
import { getGithubClientId, getGoogleClientId } from '../lib/oauthClientIds';
import api from '../../api/axios';

const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
type DemoSocialProvider = 'facebook' | 'instagram';

const demoSocialProfiles: Record<
  DemoSocialProvider,
  {
    id: number;
    email: string;
    full_name: string;
    auth_provider: DemoSocialProvider;
    role: string;
  }
> = {
  facebook: {
    id: 9001,
    email: 'facebook.demo@ewastehub.local',
    full_name: 'Facebook Demo User',
    auth_provider: 'facebook',
    role: 'consumer',
  },
  instagram: {
    id: 9002,
    email: 'instagram.demo@ewastehub.local',
    full_name: 'Instagram Demo User',
    auth_provider: 'instagram',
    role: 'consumer',
  },
};

type DemoSocialAccount = {
  name: string;
  email: string;
  initial: string;
};

const demoSocialAccounts: Record<DemoSocialProvider, DemoSocialAccount[]> = {
  facebook: [
    { name: 'Yaqqun Ma', email: 'yma125@sheffield.ac.uk', initial: 'Y' },
    { name: 'Brinda Elsaed', email: 'elsaedbrinda738@gmail.com', initial: 'B' },
    { name: 'Yaqqun Ma', email: 'mayaqun83@gmail.com', initial: 'Y' },
  ],
  instagram: [
    { name: 'Yaqqun Ma', email: 'yma125@sheffield.ac.uk', initial: 'Y' },
    { name: 'Brinda Elsaed', email: 'elsaedbrinda738@gmail.com', initial: 'B' },
    { name: 'Yaqqun Ma', email: 'mayaqun83@gmail.com', initial: 'Y' },
  ],
};

const demoSocialTheme: Record<
  DemoSocialProvider,
  {
    label: string;
    accentText: string;
    avatarClass: string;
    primaryButtonClass: string;
    primaryButtonDisabledClass: string;
    hoverClass: string;
  }
> = {
  facebook: {
    label: 'Facebook',
    accentText: 'text-blue-700',
    avatarClass: 'bg-blue-600 text-white',
    primaryButtonClass: 'bg-blue-600 text-white shadow-blue-600/20 hover:bg-blue-700',
    primaryButtonDisabledClass: 'disabled:bg-blue-400',
    hoverClass: 'hover:bg-blue-50',
  },
  instagram: {
    label: 'Instagram',
    accentText: 'text-pink-700',
    avatarClass: 'bg-linear-to-br from-amber-400 via-pink-500 to-purple-600 text-white',
    primaryButtonClass: 'bg-linear-to-r from-pink-500 to-purple-600 text-white shadow-pink-600/20 hover:from-pink-600 hover:to-purple-700',
    primaryButtonDisabledClass: 'disabled:from-pink-300 disabled:to-purple-300',
    hoverClass: 'hover:bg-pink-50',
  },
};

const authHeroCards = [
  {
    title: 'Best Market Prices',
    summary: 'We offer top dollar for your old devices based on live market data.',
    detailLabel: 'Value route',
    detail:
      'Current and rare devices can be routed to resale partners, helping owners find value before electronics lose demand.',
    context:
      'Staff can compare partner options, issue a referral code for the owner, and keep resale value visible before the device is recycled.',
    icon: TrendingUp,
    tone: 'emerald',
  },
  {
    title: 'Secure Data Wipe',
    summary: 'Military-grade data destruction on every single device we process.',
    detailLabel: 'Protection flow',
    detail:
      'Staff track wipe jobs and certificates, so devices can be reused or recycled only after data protection is handled.',
    context:
      'Every device can carry its wipe status, certificate reference, and verification notes so reuse is held back until protection is complete.',
    icon: ShieldCheck,
    tone: 'sky',
  },
  {
    title: 'Instant Payout',
    summary: 'Receive payment within 24 hours of device inspection.',
    detailLabel: 'Reward tracking',
    detail:
      'Partner referral rewards and sandbox retrieval payments keep the process transparent from submission to completion.',
    context:
      'Referral activity, payment status, and report exports stay connected, giving staff and admins a clearer trail from hand-in to payout.',
    icon: Zap,
    tone: 'amber',
  },
];

const heroToneClasses = {
  emerald: 'bg-emerald-400/20 text-emerald-400 border-emerald-300/20',
  sky: 'bg-sky-400/20 text-sky-400 border-sky-300/20',
  amber: 'bg-amber-400/20 text-amber-400 border-amber-300/20',
};

const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </svg>
);

const FacebookIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#1877F2"
      d="M24 12.073C24 5.404 18.627 0 12 0S0 5.404 0 12.073C0 18.099 4.388 23.094 10.125 24v-8.438H7.078v-3.49h3.047V9.41c0-3.022 1.792-4.693 4.533-4.693 1.313 0 2.686.235 2.686.235v2.969h-1.514c-1.491 0-1.956.931-1.956 1.887v2.264h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.099 24 12.073z"
    />
  </svg>
);

const InstagramIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
    <defs>
      <linearGradient id="instagram-gradient" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#F58529" />
        <stop offset="35%" stopColor="#FEDA77" />
        <stop offset="65%" stopColor="#DD2A7B" />
        <stop offset="100%" stopColor="#8134AF" />
      </linearGradient>
    </defs>
    <path
      fill="url(#instagram-gradient)"
      d="M7.75 2h8.5A5.75 5.75 0 0 1 22 7.75v8.5A5.75 5.75 0 0 1 16.25 22h-8.5A5.75 5.75 0 0 1 2 16.25v-8.5A5.75 5.75 0 0 1 7.75 2zm0 1.8A3.95 3.95 0 0 0 3.8 7.75v8.5a3.95 3.95 0 0 0 3.95 3.95h8.5a3.95 3.95 0 0 0 3.95-3.95v-8.5a3.95 3.95 0 0 0-3.95-3.95h-8.5zm8.95 1.35a1.1 1.1 0 1 1 0 2.2 1.1 1.1 0 0 1 0-2.2zM12 6.6A5.4 5.4 0 1 1 6.6 12 5.4 5.4 0 0 1 12 6.6zm0 1.8A3.6 3.6 0 1 0 15.6 12 3.6 3.6 0 0 0 12 8.4z"
    />
  </svg>
);

export function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [forgotEmail, setForgotEmail] = useState('');
  const [toast, setToast] = useState<{ message: string; variant: AuthToastVariant } | null>(null);
  const [activeHeroCard, setActiveHeroCard] = useState<string | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSigningIn, setIsGoogleSigningIn] = useState(false);
  const [socialSigningIn, setSocialSigningIn] = useState<DemoSocialProvider | null>(null);
  const [demoSocialDialog, setDemoSocialDialog] = useState<{
    provider: DemoSocialProvider;
    step: 'choose' | 'confirm';
    account: DemoSocialAccount;
  } | null>(null);
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const googleInitializedRef = useRef(false);
  const googleResetTimeoutRef = useRef<number | null>(null);
  const [isGoogleReady, setIsGoogleReady] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const redirectTarget = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || '/app/new-request';

  const googleClientId = getGoogleClientId();
  const githubClientId = getGithubClientId();
  const backendBaseUrl = String(api.defaults.baseURL || '').replace(/\/$/, '');

  const dismissToast = useCallback(() => setToast(null), []);

  const showToast = useCallback((message: string, variant: AuthToastVariant = 'error') => {
    setToast({ message, variant });
  }, []);

  useEffect(() => {
    setIsLogin(location.pathname !== '/auth/register');
    setIsForgotPassword(false);
    const params = new URLSearchParams(location.search);
    const oauthError = params.get('oauth_error');
    if (!oauthError) return;
    const onceKey = `ewaste_oauth_toast_${location.search}`;
    if (sessionStorage.getItem(onceKey)) return;
    sessionStorage.setItem(onceKey, '1');
    showToast(decodeURIComponent(oauthError.replace(/\+/g, ' ')), 'error');
    navigate({ pathname: location.pathname, search: '' }, { replace: true });
  }, [location.pathname, location.search, navigate, showToast]);

  const resetFormState = () => {
    setPassword('');
    setTermsAccepted(false);
  };

  const clearGoogleResetTimeout = useCallback(() => {
    if (googleResetTimeoutRef.current !== null) {
      window.clearTimeout(googleResetTimeoutRef.current);
      googleResetTimeoutRef.current = null;
    }
  }, []);

  const scheduleGoogleReset = useCallback(
    (delayMs: number) => {
      clearGoogleResetTimeout();
      googleResetTimeoutRef.current = window.setTimeout(() => {
        setIsGoogleSigningIn(false);
        googleResetTimeoutRef.current = null;
      }, delayMs);
    },
    [clearGoogleResetTimeout],
  );

  const goToLogin = () => {
    dismissToast();
    resetFormState();
    setIsLogin(true);
    setIsAdmin(false);
    navigate('/auth/login');
  };

  const goToRegister = () => {
    dismissToast();
    resetFormState();
    setIsLogin(false);
    setIsAdmin(false);
    navigate('/auth/register');
  };

  const validateLoginFields = (): string | null => {
    const em = email.trim();
    if (!em) return 'Please enter your email address.';
    if (!EMAIL_OK.test(em)) return 'Please enter a valid email address (include an @).';
    if (!password) return 'Please enter your password.';
    return null;
  };

  const validateRegisterFields = (): string | null => {
    if (!fullName.trim()) return 'Please enter your full name.';
    const em = email.trim();
    if (!em) return 'Please enter your email address.';
    if (!EMAIL_OK.test(em)) return 'Please enter a valid email address (include an @).';
    if (!password) return 'Please choose a password.';
    if (password.length < 6) return 'Password must be at least 6 characters.';
    if (!termsAccepted) return 'Please accept the Terms of Service and Data Handling Policy to continue.';
    return null;
  };

  const handleAuth = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    dismissToast();

    if (isLogin) {
      const loginErr = validateLoginFields();
      if (loginErr) {
        showToast(loginErr, 'error');
        return;
      }
    } else {
      const regErr = validateRegisterFields();
      if (regErr) {
        showToast(regErr, 'error');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      if (isLogin) {
        const response = await api.post('/api/auth/login', {
          email,
          password,
        });

        const token = response.data.access_token;
        if (token) {
          setAccessToken(token);
          if (response.data.user) {
            setStoredUser(response.data.user);
          }
          if (isAdmin) {
            const role = response.data.user?.role;
            if (role !== 'admin' && role !== 'staff') {
              showToast('This account does not have staff access.', 'error');
              clearAuthSession();
              return;
            }
            navigate('/staff');
          } else {
            navigate(redirectTarget);
          }
        }
      } else {
        const response = await api.post('/api/auth/register', {
          full_name: fullName.trim(),
          email,
          password,
        });

        if (response.status === 200 || response.status === 201) {
          showToast('Welcome to eWaste Hub — your account is ready. Sign in below.', 'success');
          setFullName('');
          setPassword('');
          setTermsAccepted(false);
          window.setTimeout(() => {
            setIsLogin(true);
            navigate('/auth/login', { replace: true });
          }, 2600);
        }
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string; message?: string } }; message?: string };
      const errorMsg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        err.message ||
        'Request failed. Please try again later.';
      showToast(errorMsg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleCredential = useCallback(
    async (credential: string) => {
      clearGoogleResetTimeout();
      dismissToast();
      setIsGoogleSigningIn(true);
      try {
        const response = await api.post('/api/auth/google', { credential });
        const token = response.data.access_token;
        if (token) {
          setAccessToken(token);
          if (response.data.user) {
            setStoredUser(response.data.user);
          }
          navigate(redirectTarget);
        }
      } catch (error: unknown) {
        const err = error as { response?: { data?: { error?: string; message?: string } }; message?: string };
        const errorMsg =
          err.response?.data?.error ||
          err.response?.data?.message ||
          err.message ||
          'Google sign-in failed. Please try again later.';
        showToast(errorMsg, 'error');
      } finally {
        clearGoogleResetTimeout();
        setIsGoogleSigningIn(false);
      }
    },
    [clearGoogleResetTimeout, dismissToast, navigate, redirectTarget, showToast],
  );

  const handleGoogleSignIn = () => {
    dismissToast();

    if (!googleClientId) {
      showToast('Google sign-in is not configured yet.', 'error');
      return;
    }

    if (!window.google?.accounts?.id || !googleInitializedRef.current) {
      showToast('Google sign-in is still loading. Please try again.', 'info');
      return;
    }

    setIsGoogleSigningIn(true);
    const googleTrigger = googleButtonRef.current?.querySelector<HTMLElement>('div[role="button"], iframe');
    if (!googleTrigger) {
      setIsGoogleSigningIn(false);
      showToast('Google sign-in button is not ready yet. Please try again.', 'error');
      return;
    }

    googleTrigger.click();
    // If the popup is closed without selecting an account, recover automatically.
    scheduleGoogleReset(10000);
  };

  const handleGitHubSignIn = () => {
    dismissToast();

    if (!githubClientId) {
      showToast('GitHub sign-in is not configured yet.', 'error');
      return;
    }

    if (!backendBaseUrl) {
      showToast('Backend address is unavailable.', 'error');
      return;
    }

    const loginUrl = `${backendBaseUrl}/api/auth/github/login?next=${encodeURIComponent(redirectTarget)}`;
    window.location.assign(loginUrl);
  };

  const handleFacebookSignIn = () => {
    dismissToast();
    setDemoSocialDialog({
      provider: 'facebook',
      step: 'choose',
      account: demoSocialAccounts.facebook[0],
    });
  };

  const handleInstagramSignIn = () => {
    dismissToast();
    setDemoSocialDialog({
      provider: 'instagram',
      step: 'choose',
      account: demoSocialAccounts.instagram[0],
    });
  };

  const completeDemoSocialSignIn = (provider: DemoSocialProvider, account?: { name: string; email: string }) => {
    dismissToast();
    setSocialSigningIn(provider);

    window.setTimeout(() => {
      const baseProfile = demoSocialProfiles[provider];
      setAccessToken(`demo-social:${provider}:${Date.now()}`);
      setStoredUser({
        ...baseProfile,
        email: account?.email ?? baseProfile.email,
        full_name: account?.name ?? baseProfile.full_name,
        created_at: new Date().toISOString(),
      });
      setSocialSigningIn(null);
      setDemoSocialDialog(null);
      navigate(redirectTarget);
    }, 250);
  };

  const continueDemoSocial = () => {
    if (!demoSocialDialog) return;
    completeDemoSocialSignIn(demoSocialDialog.provider, {
      name: demoSocialDialog.account.name,
      email: demoSocialDialog.account.email,
    });
  };

  useEffect(() => {
    if (!isGoogleSigningIn) return;

    const handleWindowReturn = () => {
      if (!document.hidden) {
        scheduleGoogleReset(800);
      }
    };

    window.addEventListener('focus', handleWindowReturn);
    document.addEventListener('visibilitychange', handleWindowReturn);

    return () => {
      window.removeEventListener('focus', handleWindowReturn);
      document.removeEventListener('visibilitychange', handleWindowReturn);
    };
  }, [isGoogleSigningIn, scheduleGoogleReset]);

  useEffect(() => {
    if (isAdmin) {
      googleInitializedRef.current = false;
      setIsGoogleReady(false);
      clearGoogleResetTimeout();
      setIsGoogleSigningIn(false);
      return;
    }
    if (!googleClientId || googleInitializedRef.current) return;

    const initGoogle = () => {
      if (!window.google?.accounts?.id || !googleButtonRef.current) return false;
      if (googleInitializedRef.current) return true;
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: (response) => handleGoogleCredential(response.credential),
      });
      googleButtonRef.current.innerHTML = '';
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: 'outline',
        size: 'large',
        type: 'standard',
        text: 'signin_with',
        width: 280,
      });
      googleInitializedRef.current = true;
      setIsGoogleReady(true);
      return true;
    };

    if (window.google?.accounts?.id) {
      initGoogle();
      return;
    }

    const checkInterval = setInterval(() => {
      if (initGoogle()) clearInterval(checkInterval);
    }, 100);
    return () => {
      clearInterval(checkInterval);
      clearGoogleResetTimeout();
    };
  }, [googleClientId, isAdmin, handleGoogleCredential, clearGoogleResetTimeout]);

  const handleForgotPassword = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const em = forgotEmail.trim();
    if (!em) {
      showToast('Please enter your email address.', 'error');
      return;
    }
    if (!EMAIL_OK.test(em)) {
      showToast('Please enter a valid email address (include an @).', 'error');
      return;
    }
    showToast(`If this email is registered, a reset link will be sent to ${em}.`, 'info');
    setForgotEmail('');
    setIsForgotPassword(false);
  };

  return (
    <div className="h-[100dvh] flex flex-col md:flex-row bg-white overflow-hidden font-sans">
      <div className="relative w-full md:w-1/2 lg:w-[55%] h-32 md:h-full overflow-hidden shrink-0">
        <ImageWithFallback
          src="https://images.unsplash.com/photo-1693596936248-8fab255a3de1?auto=format&fit=crop&q=80"
          alt="Refurbished high-end electronics"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" />

        <div className="absolute inset-0 flex flex-col justify-center md:justify-between p-6 md:p-10 lg:p-16 text-white z-10">
          <motion.button
            type="button"
            onClick={() => navigate('/')}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            whileHover={{ y: -2, scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="group flex items-center justify-center md:justify-start gap-3 rounded-2xl text-left transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-300/30"
            aria-label="Go to eWaste Hub home page"
          >
            <div className="bg-emerald-500 p-2 md:p-2.5 rounded-xl shadow-lg shadow-emerald-500/20 transition-all group-hover:bg-emerald-400 group-hover:shadow-emerald-400/40 group-hover:ring-4 group-hover:ring-emerald-300/20">
              <Recycle className="w-6 h-6 md:w-8 md:h-8 text-white" />
            </div>
            <span className="text-xl md:text-2xl font-black tracking-tighter uppercase transition-colors group-hover:text-emerald-100">
              eWaste Hub
            </span>
            <span className="hidden rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-black text-emerald-100 opacity-0 transition-opacity group-hover:opacity-100 lg:inline-flex">
              Home
            </span>
          </motion.button>

          <div className="hidden md:block max-w-xl">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-4xl md:text-6xl font-bold mb-6 leading-[1.1]"
            >
              Give your tech a second life. <span className="text-emerald-400">Get paid.</span>
            </motion.h1>
            
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-12 overflow-visible"
            >
              {authHeroCards.map((card) => {
                const Icon = card.icon;
                const isActive = activeHeroCard === card.title;
                return (
                  <motion.div
                    key={card.title}
                    onMouseEnter={() => setActiveHeroCard(card.title)}
                    onMouseLeave={() => setActiveHeroCard(null)}
                    onFocus={() => setActiveHeroCard(card.title)}
                    onBlur={() => setActiveHeroCard(null)}
                    tabIndex={0}
                    role="button"
                    aria-expanded={isActive}
                    animate={{
                      y: isActive ? -8 : 0,
                      scale: isActive ? 1.03 : 1,
                      zIndex: isActive ? 50 : 1,
                    }}
                    transition={{ type: 'spring', stiffness: 360, damping: 28 }}
                    className="group relative min-h-[11.5rem] overflow-visible rounded-2xl border border-white/10 bg-white/10 p-4 shadow-xl shadow-black/10 backdrop-blur-md transition-colors cursor-pointer hover:border-white/25 hover:bg-white/15 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-300/20"
                  >
                    <div
                      className={`flex items-start gap-4 transition-all duration-200 ${
                        isActive ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
                      }`}
                    >
                      <div className={`p-2 rounded-lg border ${heroToneClasses[card.tone as keyof typeof heroToneClasses]}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-white mb-1">{card.title}</h3>
                        <p className="text-sm text-slate-200">{card.summary}</p>
                      </div>
                    </div>

                    <AnimatePresence>
                      {isActive ? (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.94 }}
                          transition={{ duration: 0.2 }}
                          className="absolute left-1/2 top-1/2 z-10 flex h-80 w-80 -translate-x-1/2 -translate-y-1/2 flex-col justify-between overflow-hidden rounded-[2rem] border-2 border-white/30 bg-gradient-to-br from-slate-800/95 via-slate-900/95 to-emerald-950/95 p-6 shadow-2xl shadow-black/45 ring-1 ring-emerald-200/20 backdrop-blur-2xl"
                        >
                          <div className="flex items-start gap-4">
                            <div className={`p-2 rounded-xl border ${heroToneClasses[card.tone as keyof typeof heroToneClasses]}`}>
                              <Icon className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-200/90">
                                {card.detailLabel}
                              </p>
                              <p className="mt-3 text-sm font-black leading-6 text-white">{card.detail}</p>
                            </div>
                          </div>
                          <div className="mt-4 border-t border-white/15 pt-4">
                            <p className="text-xs font-black uppercase tracking-[0.18em] text-white/55">
                              Extra context
                            </p>
                            <p className="mt-2 text-xs font-semibold leading-5 text-slate-100/90">{card.context}</p>
                          </div>
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </motion.div>
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="hidden md:block text-slate-300 text-sm font-medium"
          >
            Join 50,000+ users making the planet greener.
          </motion.p>
        </div>
      </div>

      <div className="flex-1 w-full md:w-1/2 lg:w-[45%] h-[calc(100dvh-8rem)] md:h-full overflow-y-auto flex flex-col p-6 md:p-12 lg:p-20 bg-[radial-gradient(circle_at_top_left,rgba(52,211,153,0.18),transparent_34%),linear-gradient(135deg,#f8fafc_0%,#ecfdf5_48%,#eef2f7_100%)] relative">
        <div className="pointer-events-none absolute right-10 top-10 h-48 w-48 rounded-full bg-emerald-300/20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-12 left-8 h-56 w-56 rounded-full bg-slate-400/10 blur-3xl" />
        {toast ? (
          <AuthToast message={toast.message} variant={toast.variant} onDismiss={dismissToast} />
        ) : null}
        <motion.div layout className="w-full max-w-md relative z-10 m-auto">
          <AnimatePresence mode="popLayout">
            {isForgotPassword ? (
              <motion.div
                key="forgot"
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
                className="bg-white/90 p-8 md:p-10 rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(15,23,42,0.16)] border border-emerald-100/70 backdrop-blur-xl flex flex-col w-full"
              >
                <div className="text-center mb-8">
                  <h2 className="text-3xl font-black text-slate-900 mb-3 tracking-tight">
                    Reset Password
                  </h2>
                  <p className="text-slate-500 font-medium">
                    Enter your email to receive a secure reset link.
                  </p>
                </div>

                <form className="space-y-6" noValidate onSubmit={handleForgotPassword}>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">Email Address</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-emerald-600 transition-colors">
                        <Mail className="h-5 w-5" />
                      </div>
                      <input
                        type="email"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        className="block w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-hidden focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 focus:bg-white transition-all text-slate-900 font-medium placeholder:text-slate-400 placeholder:font-normal"
                        placeholder="you@email.com"
                        autoComplete="email"
                        inputMode="email"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full flex items-center justify-center gap-2 py-4.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-2xl shadow-xl shadow-emerald-500/20 active:scale-[0.98] transition-all"
                  >
                    <Mail className="w-5 h-5" />
                    Send Reset Link
                  </button>
                </form>

                <div className="mt-8 text-center">
                  <button
                    type="button"
                    onClick={() => setIsForgotPassword(false)}
                    className="font-bold text-slate-400 hover:text-slate-600 transition-colors inline-flex items-center gap-1.5"
                  >
                    <ArrowRight className="w-4 h-4 rotate-180" />
                    Back to login
                  </button>
                </div>
              </motion.div>
            ) : isLogin ? (
              <motion.div
                key="login"
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
                className="bg-white/90 p-8 md:p-10 rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(15,23,42,0.16)] border border-emerald-100/70 backdrop-blur-xl flex flex-col w-full"
              >
                <motion.div layout className="text-center mb-8">
                  <h2 className="text-3xl font-black text-slate-900 mb-3 tracking-tight flex items-center justify-center gap-3">
                    <AnimatePresence mode="popLayout">
                      {isAdmin && (
                        <motion.div
                          key="shield-icon"
                          layout
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <Shield className="w-8 h-8 text-emerald-500" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <AnimatePresence mode="popLayout">
                      <motion.span
                        key={isAdmin ? 'admin-title' : 'user-title'}
                        layout
                        initial={{ y: 5, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -5, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        {isAdmin ? 'Secure Portal' : 'Welcome Back'}
                      </motion.span>
                    </AnimatePresence>
                  </h2>
                  <AnimatePresence mode="popLayout">
                    <motion.p
                      key={isAdmin ? 'admin-sub' : 'user-sub'}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="text-slate-500 font-medium"
                    >
                      {isAdmin ? 'Authenticate to access staff dashboard' : 'Log in to manage your recycling orders'}
                    </motion.p>
                  </AnimatePresence>
                </motion.div>

                {isGoogleSigningIn && (
                  <div className="mb-6 p-3 text-sm rounded-lg border border-emerald-100 bg-emerald-50/70 text-center font-medium text-slate-600">
                    Signing in with Google…
                  </div>
                )}

                <motion.form layout className="space-y-6" noValidate onSubmit={handleAuth}>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">Email Address</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-emerald-600 transition-colors">
                        <Mail className="h-5 w-5" />
                      </div>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="block w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-hidden focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 focus:bg-white transition-all text-slate-900 font-medium placeholder:text-slate-400 placeholder:font-normal"
                        placeholder={isAdmin ? 'admin@ewastehub.com' : 'you@email.com'}
                        autoComplete="email"
                        inputMode="email"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between ml-1">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Password</label>
                      <button
                        type="button"
                        onClick={() => navigate('/forgot-password')}
                        className="text-xs font-bold text-emerald-600 hover:text-emerald-700 transition-colors"
                      >
                        Forgot?
                      </button>
                    </div>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-emerald-600 transition-colors">
                        <Lock className="h-5 w-5" />
                      </div>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="block w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-hidden focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 focus:bg-white transition-all text-slate-900 font-medium placeholder:text-slate-400 placeholder:font-normal"
                        placeholder="••••••••"
                        autoComplete="current-password"
                      />
                    </div>
                  </div>

                  <motion.button
                    layout
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full flex items-center justify-center gap-2 py-4.5 bg-slate-950 hover:bg-slate-900 text-white font-bold rounded-2xl shadow-xl shadow-slate-900/20 active:scale-[0.98] transition-all hover:-translate-y-0.5"
                  >
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    <AnimatePresence mode="popLayout">
                      <motion.span
                        key={isAdmin ? 'admin-btn' : 'user-btn'}
                        layout
                        initial={{ opacity: 0, y: 2 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -2 }}
                        transition={{ duration: 0.2 }}
                      >
                        {isSubmitting
                          ? isAdmin
                            ? 'Accessing Staff Portal...'
                            : 'Signing In...'
                          : isAdmin
                            ? 'Access Staff Portal'
                            : 'Sign In (Secure Data Wipe)'}
                      </motion.span>
                    </AnimatePresence>
                  </motion.button>
                </motion.form>

                <AnimatePresence>
                  {!isAdmin && (
                    <motion.div
                      layout
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <div className="pt-8">
                        <div className="relative">
                          <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-slate-100"></div>
                          </div>
                          <div className="relative flex justify-center text-sm">
                            <span className="px-3 bg-white text-slate-400 text-xs font-bold uppercase tracking-wider">
                              or
                            </span>
                          </div>
                        </div>

                        <div className="mt-6 grid grid-cols-2 gap-4">
                          <div className="min-h-[48px] flex items-center justify-center">
                            <div
                              ref={googleButtonRef}
                              className="pointer-events-none absolute opacity-0 w-0 h-0 overflow-hidden"
                              aria-hidden="true"
                            />
                            {googleClientId ? (
                              <button
                                type="button"
                                onClick={handleGoogleSignIn}
                                disabled={!isGoogleReady || isGoogleSigningIn}
                                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-white/80 border-2 border-emerald-50 rounded-2xl font-bold text-sm text-slate-700 transition-all disabled:text-slate-400 disabled:cursor-not-allowed disabled:hover:bg-white/80 enabled:hover:-translate-y-0.5 enabled:hover:bg-emerald-50/70"
                              >
                                <span className="flex size-5 items-center justify-center shrink-0">
                                  <GoogleIcon />
                                </span>
                                {isGoogleSigningIn ? 'Signing in with Google...' : 'Google'}
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled
                                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-white/70 border-2 border-emerald-50 rounded-2xl font-bold text-sm text-slate-400 cursor-not-allowed"
                              >
                                <span className="flex size-5 items-center justify-center shrink-0">
                                  <GoogleIcon />
                                </span>
                                Google (Not Configured)
                              </button>
                            )}
                          </div>
                          {githubClientId ? (
                            <button
                              type="button"
                              onClick={handleGitHubSignIn}
                              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-white/80 border-2 border-emerald-50 rounded-2xl font-bold text-sm text-slate-700 transition-all hover:-translate-y-0.5 hover:bg-emerald-50/70"
                            >
                              <span className="flex size-5 items-center justify-center shrink-0">
                                <Github className="w-5 h-5" />
                              </span>
                              GitHub
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled
                              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-white/70 border-2 border-emerald-50 rounded-2xl font-bold text-sm text-slate-400 cursor-not-allowed"
                            >
                              <span className="flex size-5 items-center justify-center shrink-0">
                                <Github className="w-5 h-5" />
                              </span>
                              GitHub (Not Configured)
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={handleFacebookSignIn}
                            disabled={socialSigningIn !== null}
                            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-white/80 border-2 border-emerald-50 rounded-2xl font-bold text-sm text-slate-700 transition-all disabled:text-slate-400 disabled:cursor-not-allowed disabled:hover:bg-white/80 enabled:hover:-translate-y-0.5 enabled:hover:bg-emerald-50/70"
                          >
                            <span className="flex size-5 items-center justify-center shrink-0">
                              <FacebookIcon />
                            </span>
                            {socialSigningIn === 'facebook' ? 'Signing in...' : 'Facebook'}
                          </button>
                          <button
                            type="button"
                            onClick={handleInstagramSignIn}
                            disabled={socialSigningIn !== null}
                            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-white/80 border-2 border-emerald-50 rounded-2xl font-bold text-sm text-slate-700 transition-all disabled:text-slate-400 disabled:cursor-not-allowed disabled:hover:bg-white/80 enabled:hover:-translate-y-0.5 enabled:hover:bg-emerald-50/70"
                          >
                            <span className="flex size-5 items-center justify-center shrink-0">
                              <InstagramIcon />
                            </span>
                            {socialSigningIn === 'instagram' ? 'Signing in...' : 'Instagram'}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.div layout className="mt-8 text-center">
                  <AnimatePresence>
                    {!isAdmin && (
                      <motion.div
                        layout
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                      >
                        <p className="text-slate-500 font-medium pb-4">
                          New here?{' '}
                          <button
                            type="button"
                            onClick={goToRegister}
                            className="font-bold text-emerald-600 hover:text-emerald-700 transition-colors underline decoration-emerald-500/30 underline-offset-8"
                          >
                            Join our community
                          </button>
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <motion.div layout className="mt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsAdmin(!isAdmin);
                        dismissToast();
                      }}
                      className="text-xs font-bold text-slate-400 hover:text-emerald-600 transition-colors inline-flex items-center gap-1.5"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <AnimatePresence mode="popLayout">
                        <motion.span
                          key={isAdmin ? 'return' : 'staff'}
                          layout
                          initial={{ opacity: 0, y: 2 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -2 }}
                          transition={{ duration: 0.2 }}
                        >
                          {isAdmin ? 'Return to User Login' : 'Staff & Admin Access'}
                        </motion.span>
                      </AnimatePresence>
                    </button>
                  </motion.div>
                </motion.div>

                <motion.div layout className="mt-auto pt-6 mt-8 border-t border-emerald-100/70">
                  <p className="text-center text-xs text-slate-400 flex items-center justify-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    Military-grade data wiping guaranteed for all recycled devices.
                  </p>
                </motion.div>
              </motion.div>
            ) : (
              <motion.div
                key="register"
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
                className="bg-white/90 p-8 md:p-10 rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(15,23,42,0.16)] border border-emerald-100/70 backdrop-blur-xl flex flex-col w-full"
              >
                <div className="text-center mb-8">
                  <h2 className="text-3xl font-black text-slate-900 mb-3 tracking-tight flex items-center justify-center gap-3">
                    Create Account
                  </h2>
                  <p className="text-slate-500 font-medium">Start recycling your old devices today</p>
                </div>

                <form className="space-y-5" noValidate onSubmit={handleAuth}>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">Full Name</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-emerald-600 transition-colors">
                        <User className="h-5 w-5" />
                      </div>
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="block w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-hidden focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 focus:bg-white transition-all text-slate-900 font-medium placeholder:text-slate-400 placeholder:font-normal"
                        placeholder="John Doe"
                        autoComplete="name"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">Email Address</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-emerald-600 transition-colors">
                        <Mail className="h-5 w-5" />
                      </div>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="block w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-hidden focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 focus:bg-white transition-all text-slate-900 font-medium placeholder:text-slate-400 placeholder:font-normal"
                        placeholder="you@email.com"
                        autoComplete="email"
                        inputMode="email"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">Password</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-emerald-600 transition-colors">
                        <Lock className="h-5 w-5" />
                      </div>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="block w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-hidden focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 focus:bg-white transition-all text-slate-900 font-medium placeholder:text-slate-400 placeholder:font-normal"
                        placeholder="Min. 8 characters"
                        autoComplete="new-password"
                      />
                    </div>
                  </div>

                  <div className="flex items-start mt-4 mb-2">
                    <div className="flex items-center h-5">
                      <input
                        id="terms"
                        type="checkbox"
                        checked={termsAccepted}
                        onChange={(e) => setTermsAccepted(e.target.checked)}
                        className="w-4 h-4 text-emerald-600 bg-slate-50 border-slate-300 rounded focus:ring-emerald-500 focus:ring-2 transition-all cursor-pointer"
                      />
                    </div>
                    <div className="ml-3 text-sm leading-tight">
                      <label htmlFor="terms" className="text-slate-500 cursor-pointer font-medium">
                        I agree to the{' '}
                        <a href="#" className="font-bold text-emerald-600 hover:text-emerald-700 hover:underline">
                          Terms of Service
                        </a>{' '}
                        and{' '}
                        <a href="#" className="font-bold text-emerald-600 hover:text-emerald-700 hover:underline">
                          Data Handling Policy
                        </a>.
                      </label>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full flex items-center justify-center gap-3 py-4.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl shadow-xl shadow-slate-900/10 active:scale-[0.98] transition-all"
                    >
                      {isSubmitting ? 'Creating Account...' : 'Create Hub Account'}
                      <ArrowRight className="w-5 h-5 text-emerald-400" />
                    </button>
                  </div>
                </form>

                <div className="mt-8 text-center">
                  <p className="text-slate-500 font-medium">
                    Already have an account?{' '}
                    <button
                      type="button"
                      onClick={goToLogin}
                      className="font-bold text-emerald-600 hover:text-emerald-700 transition-colors underline decoration-emerald-500/30 underline-offset-8"
                    >
                      Sign in here
                    </button>
                  </p>
                </div>

                <div className="mt-auto pt-6 mt-8 border-t border-slate-100">
                  <p className="text-center text-xs text-slate-400 flex items-center justify-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    Military-grade data wiping guaranteed for all recycled devices.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
      <AnimatePresence>
        {demoSocialDialog && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl shadow-slate-950/25"
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
                {demoSocialDialog.provider === 'facebook' ? <FacebookIcon /> : <InstagramIcon />}
                <span className="text-sm font-semibold text-slate-700">
                  Demo {demoSocialTheme[demoSocialDialog.provider].label} sign-in
                </span>
              </div>

              {demoSocialDialog.step === 'choose' ? (
                <div className="p-6">
                  <h2 className="text-3xl font-semibold tracking-tight text-slate-950">Choose an account</h2>
                  <p className="mt-2 text-sm text-slate-500">
                    to continue to{' '}
                    <span className={`font-semibold ${demoSocialTheme[demoSocialDialog.provider].accentText}`}>
                      E-waste Hub
                    </span>
                  </p>
                  <div className="mt-6 divide-y divide-slate-100">
                    {demoSocialAccounts[demoSocialDialog.provider].map((account) => (
                      <button
                        key={account.email}
                        type="button"
                        onClick={() => {
                          setDemoSocialDialog({ ...demoSocialDialog, account, step: 'confirm' });
                        }}
                        className="flex w-full items-center gap-4 py-4 text-left transition-colors hover:bg-slate-50"
                      >
                        <span
                          className={`flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                            demoSocialTheme[demoSocialDialog.provider].avatarClass
                          }`}
                        >
                          {account.initial}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-base font-semibold text-slate-950">{account.name}</span>
                          <span className="block truncate text-sm text-slate-500">{account.email}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="mt-6 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setDemoSocialDialog(null)}
                      className={`rounded-full px-5 py-2 text-sm font-semibold ${
                        demoSocialTheme[demoSocialDialog.provider].accentText
                      } ${demoSocialTheme[demoSocialDialog.provider].hoverClass}`}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-6">
                  <h2 className="text-3xl font-semibold tracking-tight text-slate-950">Sign in to E-waste Hub</h2>
                  <button
                    type="button"
                    onClick={() => setDemoSocialDialog({ ...demoSocialDialog, step: 'choose' })}
                    className="mt-5 inline-flex items-center gap-2 rounded-full border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <span
                      className={`flex size-6 items-center justify-center rounded-full text-xs font-bold ${
                        demoSocialTheme[demoSocialDialog.provider].avatarClass
                      }`}
                    >
                      {demoSocialDialog.account.initial}
                    </span>
                    {demoSocialDialog.account.email}
                  </button>

                  <p className="mt-8 text-lg font-medium text-slate-900">
                    E-waste Hub will access this demo profile information
                  </p>
                  <div className="mt-5 space-y-4">
                    <div className="flex items-start gap-4">
                      <User className="mt-0.5 size-5 text-slate-500" />
                      <div>
                        <p className="font-semibold text-slate-900">{demoSocialDialog.account.name}</p>
                        <p className="text-sm text-slate-500">Name and profile picture</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-4">
                      <Mail className="mt-0.5 size-5 text-slate-500" />
                      <div>
                        <p className="font-semibold text-slate-900">{demoSocialDialog.account.email}</p>
                        <p className="text-sm text-slate-500">Email address</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 flex justify-end gap-3 border-t border-slate-100 pt-5">
                    <button
                      type="button"
                      onClick={() => setDemoSocialDialog(null)}
                      className={`rounded-full border border-slate-300 px-6 py-2.5 text-sm font-semibold ${
                        demoSocialTheme[demoSocialDialog.provider].accentText
                      } ${demoSocialTheme[demoSocialDialog.provider].hoverClass}`}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={continueDemoSocial}
                      disabled={socialSigningIn === demoSocialDialog.provider}
                      className={`rounded-full px-6 py-2.5 text-sm font-semibold shadow-lg transition-colors disabled:cursor-wait ${
                        demoSocialTheme[demoSocialDialog.provider].primaryButtonClass
                      } ${demoSocialTheme[demoSocialDialog.provider].primaryButtonDisabledClass}`}
                    >
                      {socialSigningIn === demoSocialDialog.provider ? 'Continuing...' : 'Continue'}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
