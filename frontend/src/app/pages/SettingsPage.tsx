import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  Bell,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  LifeBuoy,
  Lock,
  Loader2,
  Mail,
  ShieldCheck,
  User,
} from 'lucide-react';
import api from '../../api/axios';
import { getStoredUser, setStoredUser, type AuthUser } from '../lib/auth';
import { getApiStyleErrorMessage } from '../lib/httpErrors';

type SettingsTab = 'profile' | 'security' | 'billing' | 'notifications' | 'support';

const SETTINGS_TABS: Array<{ id: SettingsTab; label: string; icon: typeof User }> = [
  { id: 'profile', label: 'Public Profile', icon: User },
  { id: 'security', label: 'Account Security', icon: ShieldCheck },
  { id: 'billing', label: 'Payment & Billing', icon: CreditCard },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'support', label: 'Help & Support', icon: LifeBuoy },
];

function isSettingsTab(value: string | null): value is SettingsTab {
  return Boolean(value && SETTINGS_TABS.some((tab) => tab.id === value));
}

export function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<SettingsTab>(() => {
    const tab = searchParams.get('tab');
    return isSettingsTab(tab) ? tab : 'profile';
  });
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => getStoredUser());
  const [profileName, setProfileName] = useState(() => getStoredUser()?.full_name || '');
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  useEffect(() => {
    const tab = searchParams.get('tab');
    setActiveTab(isSettingsTab(tab) ? tab : 'profile');
  }, [searchParams]);

  useEffect(() => {
    let ignore = false;

    async function loadProfile() {
      try {
        const response = await api.get('/api/me');
        if (!ignore && response.data?.user) {
          setCurrentUser(response.data.user);
          setStoredUser(response.data.user);
          setProfileName(response.data.user.full_name || '');
        }
      } catch {
        // Keep local profile fallback if /api/me is temporarily unavailable.
      }
    }

    loadProfile();
    return () => {
      ignore = true;
    };
  }, []);

  const canChangePassword = (currentUser?.auth_provider || 'local') === 'local';

  const selectTab = (tab: SettingsTab) => {
    setActiveTab(tab);
    setSearchParams(tab === 'profile' ? {} : { tab });
  };

  const handleSaveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setProfileError('');
    setProfileSuccess('');
    setIsSavingProfile(true);

    try {
      const response = await api.patch('/api/me', {
        full_name: profileName.trim() || null,
      });
      if (response.data?.user) {
        setCurrentUser(response.data.user);
        setStoredUser(response.data.user);
        setProfileName(response.data.user.full_name || '');
      }
      setProfileSuccess('Profile updated successfully.');
    } catch (error: unknown) {
      setProfileError(getApiStyleErrorMessage(error, 'Unable to save your profile right now.'));
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (!currentPassword) {
      setPasswordError('Please enter your current password.');
      return;
    }
    if (!newPassword) {
      setPasswordError('Please enter a new password.');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters.');
      return;
    }
    if (!confirmPassword) {
      setPasswordError('Please confirm your new password.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }
    if (currentPassword === newPassword) {
      setPasswordError('New password must be different from your current password.');
      return;
    }

    setIsChangingPassword(true);
    try {
      await api.post('/api/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      setPasswordSuccess('Password updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: unknown) {
      setPasswordError(
        getApiStyleErrorMessage(
          error,
          'Unable to change password right now. Please try again later.',
        ),
      );
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-10 min-h-[calc(100vh-8rem)]">
      <div className="w-full md:w-64 shrink-0 space-y-2">
        <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest px-4 mb-4">
          Account Settings
        </h2>

        <nav className="flex flex-col gap-1">
          {SETTINGS_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => selectTab(tab.id)}
                className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl font-bold transition-all text-left ${
                  isActive
                    ? 'bg-emerald-50 text-emerald-700 shadow-sm'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon className="w-5 h-5" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="flex-1 space-y-8 max-w-3xl">
        {activeTab === 'profile' ? (
          <motion.form
            onSubmit={handleSaveProfile}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.06)] border border-slate-100/50 overflow-hidden"
          >
            <div className="p-10 border-b border-slate-100">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight mb-2">Profile Settings</h1>
              <p className="text-slate-500 font-medium">
                Manage the account details used across your owner portal.
              </p>
            </div>

            <div className="p-10 space-y-8">
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center border-4 border-white shadow-md overflow-hidden">
                  <User className="w-10 h-10 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 mb-1">Profile Picture</h3>
                  <p className="text-sm font-medium text-slate-500">
                    Avatar upload is not connected in this build; your account details below are live.
                  </p>
                </div>
              </div>

              <div className="h-px w-full bg-slate-100"></div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 px-1">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="text"
                      value={profileName}
                      onChange={(event) => setProfileName(event.target.value)}
                      className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-hidden focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 focus:bg-white transition-all font-medium text-slate-900"
                      placeholder="Your name"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 px-1">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="email"
                      value={currentUser?.email || ''}
                      readOnly
                      className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-medium text-slate-500"
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4">
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Sign-in Method</p>
                <p className="mt-1 text-sm font-bold text-slate-700">
                  {(currentUser?.auth_provider || 'local').toUpperCase()}
                </p>
              </div>

              {profileError ? (
                <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                  {profileError}
                </div>
              ) : null}
              {profileSuccess ? (
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                  {profileSuccess}
                </div>
              ) : null}

              <div className="pt-6 border-t border-slate-100 flex justify-end">
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="px-8 py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-2xl font-bold transition-all shadow-lg shadow-emerald-600/20 flex items-center gap-2"
                >
                  {isSavingProfile ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                  {isSavingProfile ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </motion.form>
        ) : null}

        {activeTab === 'security' ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-[2rem] shadow-[0_16px_32px_-16px_rgba(0,0,0,0.06)] border border-slate-100/50 overflow-hidden"
          >
            <div className="p-8 border-b border-slate-100">
              <h3 className="text-xl font-black text-slate-900 tracking-tight mb-2">Reset Password</h3>
              <p className="text-slate-500 font-medium">
                Update your account password to keep your account secure.
              </p>
            </div>

            <div className="p-8">
              {!canChangePassword ? (
                <div className="rounded-2xl border border-sky-100 bg-sky-50 px-5 py-4">
                  <p className="text-sm font-semibold text-sky-700">
                    This account uses third-party sign-in. Password change is currently available only for email/password accounts.
                  </p>
                </div>
              ) : (
                <form className="space-y-5" onSubmit={handleChangePassword}>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">
                      Current Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-hidden focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 focus:bg-white transition-all font-medium text-slate-900"
                        placeholder="Enter your current password"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">
                        New Password
                      </label>
                      <div className="relative">
                        <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-hidden focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 focus:bg-white transition-all font-medium text-slate-900"
                          placeholder="At least 8 characters"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">
                        Confirm Password
                      </label>
                      <div className="relative">
                        <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-hidden focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 focus:bg-white transition-all font-medium text-slate-900"
                          placeholder="Re-enter new password"
                        />
                      </div>
                    </div>
                  </div>

                  {passwordError ? (
                    <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                      {passwordError}
                    </div>
                  ) : null}
                  {passwordSuccess ? (
                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                      {passwordSuccess}
                    </div>
                  ) : null}

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={isChangingPassword}
                      className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-2xl font-bold transition-all shadow-lg shadow-emerald-600/20 inline-flex items-center gap-2"
                    >
                      {isChangingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                      {isChangingPassword ? 'Updating...' : 'Update Password'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </motion.div>
        ) : null}

        {activeTab === 'billing' ? (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[2rem] border border-slate-100 bg-white p-8 shadow-sm"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                <CreditCard className="h-7 w-7" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-slate-900">Payment & Billing</h1>
                <p className="mt-1 text-sm font-medium text-slate-500">
                  Payments are created from live Security Vault checkout records.
                </p>
              </div>
            </div>

            <div className="mt-8 rounded-2xl border border-slate-100 bg-slate-50 px-5 py-5">
              <p className="text-sm font-bold text-slate-700">
                No saved payment method is stored in this demo build.
              </p>
              <p className="mt-2 text-sm font-medium text-slate-500">
                Start or continue checkout from Security Vault when a data retrieval request requires payment.
              </p>
              <Link
                to="/app/security-vault"
                className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800"
              >
                Open Security Vault
                <ExternalLink className="h-4 w-4" />
              </Link>
            </div>
          </motion.section>
        ) : null}

        {activeTab === 'notifications' ? (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[2rem] border border-slate-100 bg-white p-8 shadow-sm"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <Bell className="h-7 w-7" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-slate-900">Notifications</h1>
                <p className="mt-1 text-sm font-medium text-slate-500">
                  The bell in the top bar now reads live saved alerts and remembers what you mark as read.
                </p>
              </div>
            </div>
          </motion.section>
        ) : null}

        {activeTab === 'support' ? (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[2rem] border border-slate-100 bg-white p-8 shadow-sm"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 text-slate-600">
                <LifeBuoy className="h-7 w-7" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-slate-900">Help & Support</h1>
                <p className="mt-1 text-sm font-medium text-slate-500">
                  Use the live dashboard pages below to resolve common owner tasks.
                </p>
              </div>
            </div>

            <div className="mt-8 grid grid-cols-1 gap-3 md:grid-cols-2">
              <Link
                to="/app/dashboard"
                className="rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 text-sm font-black text-slate-700 hover:bg-emerald-50 hover:text-emerald-700"
              >
                Track requests
              </Link>
              <Link
                to="/app/security-vault"
                className="rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 text-sm font-black text-slate-700 hover:bg-emerald-50 hover:text-emerald-700"
              >
                Manage secure data retrieval
              </Link>
              <Link
                to="/app/rewards"
                className="rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 text-sm font-black text-slate-700 hover:bg-emerald-50 hover:text-emerald-700"
              >
                Open rewards and QR vouchers
              </Link>
              <Link
                to="/app/new-request"
                className="rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 text-sm font-black text-slate-700 hover:bg-emerald-50 hover:text-emerald-700"
              >
                Submit another device
              </Link>
            </div>
          </motion.section>
        ) : null}
      </div>
    </div>
  );
}
