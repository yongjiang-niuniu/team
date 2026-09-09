import { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';

export type AuthToastVariant = 'success' | 'error' | 'info';

type Props = {
  message: string;
  variant: AuthToastVariant;
  onDismiss: () => void;
  durationMs?: number;
};

const styles: Record<
  AuthToastVariant,
  { bar: string; icon: string; Icon: typeof CheckCircle2 }
> = {
  success: {
    bar: 'border-emerald-200 bg-white text-slate-800 shadow-[0_20px_50px_-12px_rgba(16,185,129,0.35)]',
    icon: 'text-emerald-500',
    Icon: CheckCircle2,
  },
  error: {
    bar: 'border-rose-200 bg-white text-slate-800 shadow-[0_20px_50px_-12px_rgba(244,63,94,0.2)]',
    icon: 'text-rose-500',
    Icon: AlertCircle,
  },
  info: {
    bar: 'border-slate-200 bg-white text-slate-800 shadow-[0_20px_50px_-12px_rgba(15,23,42,0.12)]',
    icon: 'text-sky-500',
    Icon: Info,
  },
};

export function AuthToast({ message, variant, onDismiss, durationMs = 5200 }: Props) {
  useEffect(() => {
    const t = window.setTimeout(onDismiss, durationMs);
    return () => window.clearTimeout(t);
  }, [onDismiss, durationMs]);

  const cfg = styles[variant];
  const Icon = cfg.Icon;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[200] flex justify-center px-4 pt-6 sm:pt-8"
      role="status"
      aria-live="polite"
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={message}
          initial={{ opacity: 0, y: -12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 380, damping: 28 }}
          className={`pointer-events-auto flex max-w-md items-start gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold ${cfg.bar}`}
        >
          <Icon className={`mt-0.5 size-5 shrink-0 ${cfg.icon}`} aria-hidden />
          <p className="min-w-0 flex-1 leading-snug">{message}</p>
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 rounded-lg px-2 py-1 text-xs font-bold uppercase tracking-wide text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            OK
          </button>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
