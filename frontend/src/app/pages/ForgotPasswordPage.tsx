import { useState } from 'react';
import { ArrowLeft, Mail, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';

import api from '../../api/axios';
import { getApiStyleErrorMessage } from '../lib/httpErrors';

const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmedEmail = email.trim();
    setErrorMessage('');

    if (!trimmedEmail) {
      setErrorMessage('Please enter your email address.');
      return;
    }
    if (!EMAIL_OK.test(trimmedEmail)) {
      setErrorMessage('Please enter a valid email address (include an @).');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post('/api/auth/forgot-password', { email: trimmedEmail });
      setIsSubmitted(true);
    } catch (error: unknown) {
      setErrorMessage(
        getApiStyleErrorMessage(
          error,
          'We could not submit your reset request right now. Please try again later.',
        ),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 font-sans">
      <div className="w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="bg-white p-8 md:p-10 rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.08)] border border-slate-100"
        >
          <button
            type="button"
            onClick={() => navigate('/auth/login')}
            className="mb-6 inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to login
          </button>

          {!isSubmitted ? (
            <>
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                  <Mail className="w-8 h-8 text-emerald-600" />
                </div>
                <h1 className="text-3xl font-black text-slate-900 mb-3 tracking-tight">
                  Forgot Password
                </h1>
                <p className="text-slate-500 font-medium">
                  Enter your email and we will send a secure reset link if the account exists.
                </p>
              </div>

              <form className="space-y-5" noValidate onSubmit={handleSubmit}>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">
                    Email Address
                  </label>
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
                  {errorMessage ? (
                    <p className="text-sm font-semibold text-rose-600 px-1">{errorMessage}</p>
                  ) : null}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-2 py-4.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold rounded-2xl shadow-xl shadow-slate-900/10 active:scale-[0.98] transition-all"
                >
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  {isSubmitting ? 'Submitting...' : 'Send Reset Request'}
                </button>
              </form>
            </>
          ) : (
            <div className="text-center">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                <ShieldCheck className="w-8 h-8 text-emerald-600" />
              </div>
              <h2 className="text-3xl font-black text-slate-900 mb-3 tracking-tight">
                Check Your Email
              </h2>
              <p className="text-slate-500 font-medium">
                If the email is registered, password reset instructions will be sent.
              </p>
              <button
                type="button"
                onClick={() => navigate('/auth/login')}
                className="mt-8 w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-bold transition-all shadow-xl shadow-emerald-500/20"
              >
                Return to Login
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
