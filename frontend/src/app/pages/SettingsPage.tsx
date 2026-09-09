import { useEffect, useState, type FormEvent } from 'react';
import { motion } from 'motion/react';
import {
  User,
  ShieldCheck,
  CreditCard,
  Bell,
  Camera,
  Mail,
  Phone,
  CheckCircle2,
  Lock,
  Plus,
  Loader2,
} from 'lucide-react';
import api from '../../api/axios';
import { getStoredUser, type AuthUser } from '../lib/auth';
import { getApiStyleErrorMessage } from '../lib/httpErrors';

export function SettingsPage() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => getStoredUser());
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  useEffect(() => {
    let ignore = false;

    async function loadProfile() {
      try {
        const response = await api.get('/api/me');
        if (!ignore && response.data?.user) {
          setCurrentUser(response.data.user);
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
          <button className="flex items-center gap-3 px-4 py-3.5 rounded-2xl font-bold bg-emerald-50 text-emerald-700 shadow-sm transition-all text-left">
            <User className="w-5 h-5" />
            Public Profile
          </button>

          <button className="flex items-center gap-3 px-4 py-3.5 rounded-2xl font-bold text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-all text-left">
            <ShieldCheck className="w-5 h-5" />
            Account Security
          </button>

          <button className="flex items-center gap-3 px-4 py-3.5 rounded-2xl font-bold text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-all text-left">
            <CreditCard className="w-5 h-5" />
            Payment & Billing
          </button>

          <button className="flex items-center gap-3 px-4 py-3.5 rounded-2xl font-bold text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-all text-left">
            <Bell className="w-5 h-5" />
            Notifications
          </button>
        </nav>
      </div>

      <div className="flex-1 space-y-8 max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.06)] border border-slate-100/50 overflow-hidden"
        >
          <div className="p-10 border-b border-slate-100">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight mb-2">Profile Settings</h1>
            <p className="text-slate-500 font-medium">
              Manage your personal information and how it appears to others.
            </p>
          </div>

          <div className="p-10 space-y-10">
            <div className="flex items-center gap-8">
              <div className="relative group cursor-pointer">
                <div className="w-24 h-24 rounded-full bg-emerald-100 flex items-center justify-center border-4 border-white shadow-md overflow-hidden transition-all">
                  <User className="w-12 h-12 text-emerald-600" />
                </div>
                <div className="absolute inset-0 bg-slate-900/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                  <Camera className="w-6 h-6 text-white" />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 mb-1">Profile Picture</h3>
                <p className="text-sm font-medium text-slate-500 mb-3">JPG, GIF or PNG. Max size of 5MB.</p>
                <button className="px-5 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-sm font-bold transition-colors border border-slate-200">
                  Upload new picture
                </button>
              </div>
            </div>

            <div className="h-px w-full bg-slate-100"></div>

            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 px-1">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="text"
                      defaultValue={currentUser?.full_name || 'Alex Morgan'}
                      className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-hidden focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 focus:bg-white transition-all font-medium text-slate-900"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 px-1">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="email"
                      defaultValue={currentUser?.email || 'alex@email.com'}
                      className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-hidden focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 focus:bg-white transition-all font-medium text-slate-900"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 px-1">Phone Number</label>
                <div className="relative max-w-md">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="tel"
                    defaultValue="+44 7700 900077"
                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-hidden focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 focus:bg-white transition-all font-medium text-slate-900"
                  />
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-100 flex justify-end">
              <button className="px-8 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold transition-all shadow-lg shadow-emerald-600/20 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" />
                Save Changes
              </button>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-[2rem] shadow-[0_16px_32px_-16px_rgba(0,0,0,0.06)] border border-slate-100/50 overflow-hidden"
        >
          <div className="p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-center shrink-0 shadow-inner">
                <CreditCard className="w-7 h-7 text-slate-400" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 mb-1">Payment Methods</h3>
                <div className="flex items-center gap-2 text-sm font-bold text-emerald-600">
                  <Lock className="w-4 h-4" /> Ready for Secure Data Retrieval (£10 Fee)
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 bg-slate-50 px-5 py-3.5 rounded-2xl border border-slate-200">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Primary</span>
                <span className="text-sm font-black text-slate-700">PayPal Linked</span>
              </div>
              <div className="w-px h-8 bg-slate-200 mx-2"></div>
              <button className="w-8 h-8 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:border-emerald-200 transition-colors">
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
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
      </div>
    </div>
  );
}
