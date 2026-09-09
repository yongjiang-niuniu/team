import React, { useMemo, useState } from 'react';
import { Lock, ShieldCheck, CheckCircle, ArrowLeft, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../api/axios';
import { getApiStyleErrorMessage } from '../lib/httpErrors';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const token = useMemo(() => searchParams.get('token')?.trim() || '', [searchParams]);

  const handleResetPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage('');

    if (!token) {
      setErrorMessage('This reset link is missing a token. Please request a new link.');
      return;
    }
    if (newPassword.length < 8) {
      setErrorMessage('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post('/api/auth/reset-password', {
        token,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });

      setIsSuccess(true);
      window.setTimeout(() => {
        navigate('/auth/login');
      }, 3000);
    } catch (error: unknown) {
      setErrorMessage(
        getApiStyleErrorMessage(
          error,
          'Unable to reset password right now. Please request a new reset link.',
        ),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 font-sans">
        <div className="w-full max-w-md bg-white p-8 md:p-10 rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.08)] border border-slate-100">
          <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
            <AlertTriangle className="w-8 h-8 text-rose-600" />
          </div>
          <h1 className="text-3xl font-black text-slate-900 mb-3 tracking-tight text-center">
            Invalid Reset Link
          </h1>
          <p className="text-slate-500 font-medium text-center">
            This link is missing a reset token. Please request a new password reset email.
          </p>
          <button
            type="button"
            onClick={() => navigate('/forgot-password')}
            className="mt-8 w-full py-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl shadow-xl shadow-slate-900/10 transition-all"
          >
            Request New Link
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 font-sans">
      <div className="w-full max-w-md">
        <AnimatePresence mode="wait">
          {!isSuccess ? (
            <motion.div
              key="reset-form"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="bg-white p-8 md:p-10 rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.08)] border border-slate-100 flex flex-col"
            >
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                  <Lock className="w-8 h-8 text-emerald-600" />
                </div>
                <h2 className="text-3xl font-black text-slate-900 mb-3 tracking-tight">
                  Set New Password
                </h2>
                <p className="text-slate-500 font-medium">
                  Your new password must be different from previously used passwords.
                </p>
              </div>

              <form className="space-y-6" onSubmit={handleResetPassword}>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">New Password</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-emerald-600 transition-colors">
                      <Lock className="h-5 w-5" />
                    </div>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="block w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-hidden focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 focus:bg-white transition-all text-slate-900 font-medium placeholder:text-slate-400 placeholder:font-normal"
                      placeholder="Min. 8 characters"
                      required
                      minLength={8}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">Confirm Password</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-emerald-600 transition-colors">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="block w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-hidden focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 focus:bg-white transition-all text-slate-900 font-medium placeholder:text-slate-400 placeholder:font-normal"
                      placeholder="Repeat new password"
                      required
                      minLength={8}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-2 py-4.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold rounded-2xl shadow-xl shadow-slate-900/10 active:scale-[0.98] transition-all"
                >
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  {isSubmitting ? 'Resetting Password...' : 'Reset & Secure Account'}
                </button>

                {errorMessage ? (
                  <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    <p className="text-sm font-semibold text-rose-700 leading-snug">
                      {errorMessage}
                    </p>
                  </div>
                ) : null}
              </form>
            </motion.div>
          ) : (
            <motion.div
              key="success-message"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white p-8 md:p-10 rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.08)] border border-slate-100 flex flex-col text-center"
            >
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                <CheckCircle className="w-10 h-10 text-emerald-600" />
              </div>
              <h2 className="text-3xl font-black text-slate-900 mb-3 tracking-tight">
                Password Reset!
              </h2>
              <p className="text-slate-500 font-medium">
                Your password has been successfully updated. You will be redirected to the login page momentarily.
              </p>

              <div className="mt-8">
                <div className="w-8 h-8 border-4 border-slate-200 border-t-emerald-500 rounded-full animate-spin mx-auto"></div>
              </div>
              <button
                type="button"
                onClick={() => navigate('/auth/login')}
                className="mt-8 inline-flex items-center justify-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-700 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Go to login now
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
