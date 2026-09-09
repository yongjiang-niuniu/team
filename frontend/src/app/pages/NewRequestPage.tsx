import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  Laptop,
  Smartphone,
  Tablet,
  Gamepad2,
  Cpu,
  ShieldCheck,
  Truck,
  MapPin,
  CheckCircle2,
  ChevronDown,
  ArrowRight,
  Cloud,
  QrCode,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import api from '../../api/axios';
import { PaymentSummaryCard } from '../components/PaymentSummaryCard';
import { getApiStyleErrorMessage } from '../lib/httpErrors';
import { type PaymentSummary } from '../lib/payment';
import { formatPreferredMethodLabel, formatRequestStatusLabel, type PortalRequest } from '../lib/userPortal';

const CATEGORIES = [
  { id: 'phone', icon: Smartphone, label: 'Smartphone' },
  { id: 'laptop', icon: Laptop, label: 'Laptop' },
  { id: 'tablet', icon: Tablet, label: 'Tablet' },
  { id: 'console', icon: Gamepad2, label: 'Console' },
  { id: 'other', icon: Cpu, label: 'Other' },
];

const CONDITIONS = [
  { id: 'working', label: 'Working' },
  { id: 'broken', label: 'Broken' },
  { id: 'unknown', label: 'Unknown' },
];

const DEMAND_OPTIONS = [
  { id: 'high', label: 'High demand' },
  { id: 'medium', label: 'Medium demand' },
  { id: 'low', label: 'Low demand' },
  { id: 'unknown', label: 'Not sure' },
];

type FormState = {
  itemName: string;
  category: string;
  condition: string;
  ageYears: string;
  demand: string;
  classification: string;
  method: string;
  pickupAddress: string;
  contactPhone: string;
  dataWipe: boolean;
  paidRetrieval: boolean;
};

const DEFAULT_FORM: FormState = {
  itemName: '',
  category: 'phone',
  condition: 'working',
  ageYears: '',
  demand: 'medium',
  classification: 'Unknown',
  method: 'dropoff',
  pickupAddress: '',
  contactPhone: '',
  dataWipe: true,
  paidRetrieval: false,
};

export function NewRequestPage() {
  const [formData, setFormData] = useState<FormState>(DEFAULT_FORM);

  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [submittedRequest, setSubmittedRequest] = useState<PortalRequest | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsSubmitting(true);

    try {
      const response = await api.post('/api/requests', {
        item_name: formData.itemName,
        category: formData.category,
        condition: formData.condition,
        preferred_method: formData.method,
        pickup_address: formData.pickupAddress || null,
        contact_phone: formData.contactPhone || null,
        data_wipe: formData.dataWipe,
        paid_retrieval: formData.paidRetrieval,
        age_years: formData.ageYears ? Number(formData.ageYears) : null,
        demand: formData.demand,
      });

      setSubmittedRequest(response.data?.request ?? null);
      setIsSubmitted(true);
    } catch (error: unknown) {
      setErrorMessage(
        getApiStyleErrorMessage(error, 'We could not submit your request right now.'),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setIsSubmitted(false);
    setErrorMessage('');
    setSubmittedRequest(null);
    setFormData(DEFAULT_FORM);
  };

  if (isSubmitted) {
    const classification = formatRequestStatusLabel(submittedRequest?.device?.classification || formData.classification);
    const submittedDeviceName = submittedRequest?.device?.name || formData.itemName;
    const submittedMethod = formatPreferredMethodLabel(submittedRequest?.preferred_method || formData.method);
    const retrievalPaymentSummary: PaymentSummary = {
      provider: null,
      status: formData.paidRetrieval ? 'requires_payment' : 'not_started',
      amount: formData.paidRetrieval ? 10 : null,
      currency: 'GBP',
      deviceName: submittedDeviceName,
      quotedPrice: formData.paidRetrieval ? 10 : null,
      finalPrice: classification === 'Recycle' && formData.paidRetrieval ? 10 : null,
      note: formData.paidRetrieval
        ? 'Payment UI is now prepared on the front end. Backend provider, reference, and paid-at fields can plug into this summary later.'
        : 'No paid retrieval option was selected for this request.',
    };
    return (
      <div className="max-w-2xl mx-auto pb-10">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-white p-8 md:p-10 rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.06)] border border-slate-100/50"
        >
          <div className="w-20 h-20 bg-emerald-100 rounded-[1.5rem] flex items-center justify-center mb-8">
            <CheckCircle2 className="w-10 h-10 text-emerald-600" />
          </div>

          <h2 className="text-3xl font-black text-slate-900 mb-3 tracking-tight">Classification Result</h2>
          <p className="text-slate-500 font-medium text-lg mb-8">
            <strong className="text-slate-900">{submittedDeviceName}</strong> has been categorized as <strong className="text-emerald-600">{classification}</strong>. Here are your next steps.
          </p>

          <div className="mb-6 rounded-3xl border border-slate-100 bg-slate-50 px-6 py-5">
            <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Submission Summary</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm font-medium text-slate-600">
              <p>Request ID: <span className="font-bold text-slate-900">EW-{submittedRequest?.id ?? 'Pending'}</span></p>
              <p>Collection Method: <span className="font-bold text-slate-900">{submittedMethod}</span></p>
              <p>Workflow Status: <span className="font-bold text-slate-900">{submittedRequest?.device?.workflow_status || 'pending'}</span></p>
              <p>Condition: <span className="font-bold text-slate-900">{formData.condition}</span></p>
            </div>
          </div>

          <div className="space-y-6">
            {classification === 'Current' && (
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                <h3 className="text-xl font-bold text-slate-900 mb-2">Trade-in Ready</h3>
                <p className="text-slate-500 font-medium text-sm mb-6">Take your device to a partner store to get your estimated value.</p>

                <div className="flex flex-col gap-4">
                  <button className="flex items-center justify-center gap-2 w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold transition-all shadow-md shadow-emerald-600/20">
                    <QrCode className="w-5 h-5" />
                    Get QR Code
                  </button>

                  <a href="#" className="flex items-center justify-center gap-2 text-slate-500 hover:text-slate-700 text-sm font-bold transition-colors underline underline-offset-4 decoration-slate-300">
                    View estimated value on CeX
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>
            )}

            {classification === 'Recycle' && (
              <div className="space-y-6">
                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-slate-900">Data Retrieval Service</h3>
                  <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-black rounded-lg">Fee: £10.00</span>
                </div>
                <p className="text-slate-500 font-medium text-sm mb-6">Files will be hosted for 3 months after ethical disposal.</p>

                <Link
                  to="/app/security-vault"
                  className="flex items-center justify-center gap-2 py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold transition-colors"
                >
                  Open Security Vault
                </Link>
                </div>

                <PaymentSummaryCard
                  summary={retrievalPaymentSummary}
                  title="Retrieval Payment"
                  subtitle="The user journey now routes into the real Security Vault checkout flow instead of the old front-end-only demo links."
                />
              </div>
            )}

            {(classification === 'Rare' || classification === 'Unknown') && (
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                <h3 className="text-xl font-bold text-slate-900 mb-2">Awaiting Assessment</h3>
                <p className="text-slate-500 font-medium text-sm">
                  {classification === 'Rare'
                    ? 'Our specialists will appraise your collectable item and contact you with an offer.'
                    : 'Our team will identify the device upon arrival to determine the best course of action.'}
                </p>
              </div>
            )}

            <button
              onClick={handleReset}
              className="w-full py-4 text-slate-500 hover:text-slate-800 font-bold transition-colors mt-4"
            >
              Submit another device
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto pb-10">
      <div className="mb-10">
        <h1 className="text-3xl font-black text-slate-900 mb-2 tracking-tight">Submit Device for Recycling</h1>
        <p className="text-slate-500 font-medium text-lg">Tell us about your device to get a quote and recycle responsibly.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {errorMessage && (
          <div className="rounded-2xl border border-red-100 bg-red-50 px-5 py-4 text-sm font-semibold text-red-600">
            {errorMessage}
          </div>
        )}

        <div className="bg-white p-8 md:p-10 rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.06)] border border-slate-100/50 space-y-8">
          <div className="space-y-3">
            <label className="text-sm font-bold uppercase tracking-wider text-slate-400 ml-1">Device Name</label>
            <input
              type="text"
              required
              value={formData.itemName}
              onChange={(e) => setFormData({ ...formData, itemName: e.target.value })}
              placeholder="e.g., iPhone 13 Pro Max"
              className="w-full px-6 py-4.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-hidden focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 focus:bg-white transition-all text-slate-900 font-medium placeholder:text-slate-300 placeholder:font-normal"
            />
          </div>

          <div className="space-y-3">
            <label className="text-sm font-bold uppercase tracking-wider text-slate-400 ml-1">Category</label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsCategoryOpen(!isCategoryOpen)}
                className={`w-full px-6 py-4.5 text-left border rounded-2xl transition-all font-bold flex items-center justify-between ${
                  isCategoryOpen
                    ? 'bg-white border-emerald-500 ring-4 ring-emerald-500/10 text-slate-900'
                    : 'bg-slate-50 border-slate-200 text-slate-900 hover:bg-slate-100'
                }`}
              >
                {CATEGORIES.find(c => c.id === formData.category)?.label || 'Select Category'}
                <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${isCategoryOpen ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {isCategoryOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setIsCategoryOpen(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute z-20 w-full mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden py-2"
                    >
                      {CATEGORIES.map((cat) => {
                        const Icon = cat.icon;
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => {
                              setFormData({ ...formData, category: cat.id });
                              setIsCategoryOpen(false);
                            }}
                            className={`w-full px-6 py-3.5 flex items-center gap-3 text-left transition-colors ${
                              formData.category === cat.id
                                ? 'bg-emerald-50 text-emerald-700 font-bold'
                                : 'text-slate-600 font-medium hover:bg-slate-50 hover:text-slate-900'
                            }`}
                          >
                            <Icon className={`w-5 h-5 ${formData.category === cat.id ? 'text-emerald-600' : 'text-slate-400'}`} />
                            {cat.label}
                          </button>
                        );
                      })}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-bold uppercase tracking-wider text-slate-400 ml-1">Device Condition</label>
            <div className="p-1.5 bg-slate-100 rounded-2xl grid grid-cols-3 gap-1.5">
              {CONDITIONS.map((condition) => (
                <button
                  key={condition.id}
                  type="button"
                  onClick={() => setFormData({ ...formData, condition: condition.id })}
                  className={`py-3 rounded-xl font-bold transition-all ${
                    formData.condition === condition.id
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                      : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                  }`}
                >
                  {condition.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <label className="text-sm font-bold uppercase tracking-wider text-slate-400 ml-1">Approx. Device Age</label>
              <input
                type="number"
                min="0"
                max="100"
                value={formData.ageYears}
                onChange={(e) => setFormData({ ...formData, ageYears: e.target.value })}
                placeholder="Years in use"
                className="w-full px-6 py-4.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-hidden focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 focus:bg-white transition-all text-slate-900 font-medium placeholder:text-slate-300 placeholder:font-normal"
              />
            </div>

            <div className="space-y-3">
              <label className="text-sm font-bold uppercase tracking-wider text-slate-400 ml-1">Estimated Market Demand</label>
              <div className="grid grid-cols-2 gap-3">
                {DEMAND_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setFormData({ ...formData, demand: option.id })}
                    className={`px-4 py-3.5 rounded-2xl border font-bold transition-all ${
                      formData.demand === option.id
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-emerald-100 bg-emerald-50/60 p-6">
            <p className="text-sm font-black uppercase tracking-wider text-emerald-700 mb-2">Automatic Classification</p>
            <p className="text-sm font-medium text-emerald-900/80 leading-relaxed">
              We now classify devices from the details you provide here. Condition, age, and market demand guide the result after submission.
            </p>
          </div>
        </div>

        <div className="bg-white p-8 md:p-10 rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.06)] border border-slate-100/50 space-y-8">
          <div className="space-y-4">
            <label className="text-sm font-bold uppercase tracking-wider text-slate-400 ml-1">Recycling Method</label>
            <div className="p-1.5 bg-slate-100 rounded-2xl flex gap-1.5">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, method: 'dropoff' })}
                className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold transition-all ${
                  formData.method === 'dropoff'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                }`}
              >
                <MapPin className="w-5 h-5" />
                Dropoff
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, method: 'pickup' })}
                className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold transition-all ${
                  formData.method === 'pickup'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                }`}
              >
                <Truck className="w-5 h-5" />
                Free Pickup
              </button>
            </div>
            <p className="text-xs font-medium text-slate-400 ml-1">
              {formData.method === 'dropoff'
                ? 'Bring it to any of our 5,000+ partner locations nationwide.'
                : 'Schedule a courier to collect the device from your doorstep.'}
            </p>
          </div>

          {formData.method === 'pickup' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <label className="text-sm font-bold uppercase tracking-wider text-slate-400 ml-1">Pickup Address</label>
                <input
                  type="text"
                  value={formData.pickupAddress}
                  onChange={(e) => setFormData({ ...formData, pickupAddress: e.target.value })}
                  placeholder="Street, city, postcode"
                  className="w-full px-6 py-4.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-hidden focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 focus:bg-white transition-all text-slate-900 font-medium placeholder:text-slate-300 placeholder:font-normal"
                />
              </div>

              <div className="space-y-3">
                <label className="text-sm font-bold uppercase tracking-wider text-slate-400 ml-1">Contact Phone</label>
                <input
                  type="tel"
                  value={formData.contactPhone}
                  onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                  placeholder="Phone for courier updates"
                  className="w-full px-6 py-4.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-hidden focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 focus:bg-white transition-all text-slate-900 font-medium placeholder:text-slate-300 placeholder:font-normal"
                />
              </div>
            </div>
          )}

          <div className="pt-2 space-y-4">
            <label className="text-sm font-bold uppercase tracking-wider text-slate-400 ml-1">Data Protection</label>

            <div className="space-y-3">
              <label className="flex items-center gap-4 p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 cursor-pointer group">
                <div className="relative">
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={formData.dataWipe}
                    onChange={(e) => setFormData({ ...formData, dataWipe: e.target.checked })}
                  />
                  <div className="w-6 h-6 border-2 border-emerald-200 rounded-lg peer-checked:bg-emerald-600 peer-checked:border-emerald-600 transition-all flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4 text-white scale-0 peer-checked:scale-100 transition-transform" />
                  </div>
                </div>
                <div className="flex-1 flex items-center gap-4">
                  <div className="bg-emerald-100 p-2.5 rounded-xl">
                    <ShieldCheck className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800">Free Certified Data Wiping</h4>
                    <p className="text-sm font-medium text-slate-500">I need a military-grade secure data wiping certificate.</p>
                  </div>
                  <div className="ml-auto text-emerald-600 font-black text-sm pr-2">FREE</div>
                </div>
              </label>

              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-4 p-5 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 cursor-pointer group transition-all">
                  <div className="relative">
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={formData.paidRetrieval}
                      onChange={(e) => setFormData({ ...formData, paidRetrieval: e.target.checked })}
                    />
                    <div className="w-6 h-6 border-2 border-slate-300 rounded-lg peer-checked:bg-emerald-600 peer-checked:border-emerald-600 transition-all flex items-center justify-center">
                      <CheckCircle2 className="w-4 h-4 text-white scale-0 peer-checked:scale-100 transition-transform" />
                    </div>
                  </div>
                  <div className="flex-1 flex items-center gap-4">
                    <div className="bg-slate-200 p-2.5 rounded-xl group-hover:bg-slate-300 transition-colors">
                      <Cloud className="w-6 h-6 text-slate-600" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800">Paid Data Retrieval</h4>
                      <p className="text-sm font-medium text-slate-500">Extract and save my personal data before wiping.</p>
                    </div>
                  </div>
                </label>

                <AnimatePresence>
                  {formData.paidRetrieval && (
                    <motion.div
                      initial={{ opacity: 0, y: -10, height: 0 }}
                      animate={{ opacity: 1, y: 0, height: 'auto' }}
                      exit={{ opacity: 0, y: -10, height: 0 }}
                      className="px-5 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium text-slate-600 overflow-hidden"
                    >
                      Extract and host my files in the cloud for 3 months. Fee: £10.00 (Payable after evaluation)
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-3 py-5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-lg rounded-[2rem] shadow-xl shadow-emerald-600/20 active:scale-[0.98] transition-all disabled:cursor-not-allowed disabled:bg-emerald-400"
          >
            {isSubmitting ? 'Submitting Request...' : 'Submit Request'}
            <ArrowRight className="w-6 h-6 text-emerald-300" />
          </button>
          <p className="text-center mt-6 text-sm font-medium text-slate-400">
            By submitting, you agree to our <span className="underline underline-offset-4 decoration-slate-200 cursor-pointer">Terms of Service</span>.
          </p>
        </div>
      </form>
    </div>
  );
}
