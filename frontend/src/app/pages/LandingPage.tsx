import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import {
  ArrowRight,
  ArrowUp,
  BadgePoundSterling,
  ChevronDown,
  CheckCircle2,
  CloudDownload,
  Cpu,
  FileCheck2,
  HelpCircle,
  Leaf,
  LockKeyhole,
  MapPin,
  Recycle,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

const impactMetrics = [
  { value: "3-6", suffix: " mo", label: "secure retrieval window" },
  { value: "4", suffix: " paths", label: "current, recycle, rare, unknown" },
  { value: "2+", suffix: "", label: "working device categories" },
];

const navItems = [
  { id: "services", label: "Services" },
  { id: "how-it-works", label: "How it works" },
  { id: "trust", label: "Trust" },
  { id: "faq", label: "FAQ" },
];

const serviceCards = [
  {
    title: "Identify device value",
    description:
      "Owners submit phones, laptops, tablets, consoles and more. The hub classifies whether each device is current, recyclable, rare or unknown.",
    icon: Cpu,
  },
  {
    title: "Retrieve data securely",
    description:
      "For recycle devices, staff can retrieve personal data, host it temporarily in the cloud and release a secure download link.",
    icon: CloudDownload,
  },
  {
    title: "Wipe before reuse",
    description:
      "Every accepted device moves through a wipe workflow with staff oversight and certificate tracking for safer recycling.",
    icon: ShieldCheck,
  },
  {
    title: "Route to trusted partners",
    description:
      "Current and rare devices can surface partner hand-in options, referral codes and bonus vouchers for local resale or collection.",
    icon: BadgePoundSterling,
  },
];

const processSteps = [
  "Submit your device details",
  "Staff classify and prepare the route",
  "Choose retrieval, resale or recycling",
  "Receive proof, download links or partner rewards",
];

const faqItems = [
  {
    question: "Why do owners use eWaste Hub instead of storing old devices?",
    answer:
      "The hub handles the practical blockers from the brief: old photos, backup devices, resale value, collectable items and fear of data theft.",
  },
  {
    question: "What happens to recycle devices with data on them?",
    answer:
      "Owners can request paid data retrieval. Staff prepare the archive, issue a secure time-limited link, and the device can then proceed through wiping and recycling.",
  },
  {
    question: "How do current or rare devices work?",
    answer:
      "The system can route these devices to resale or hand-in partners with referral codes and bonus labels while still supporting secure wipe workflows.",
  },
  {
    question: "Is this for businesses?",
    answer:
      "No. The brief is B2C, focused on device owners rather than business eWaste contracts.",
  },
];

export function LandingPage() {
  const [activeSection, setActiveSection] = useState("services");
  const [hasScrolled, setHasScrolled] = useState(false);
  const [openFaq, setOpenFaq] = useState(0);
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const updateScrollState = () => {
      const scrollY = window.scrollY;
      setHasScrolled(scrollY > 24);
      setShowScrollTop(scrollY > 650);

      let currentSection = navItems[0];
      for (const item of navItems) {
        const element = document.getElementById(item.id);
        if (!element) {
          continue;
        }
        if (element.offsetTop - 160 <= scrollY) {
          currentSection = item;
        }
      }
      if (currentSection) {
        setActiveSection(currentSection.id);
      }
    };

    updateScrollState();
    window.addEventListener("scroll", updateScrollState, { passive: true });
    return () => window.removeEventListener("scroll", updateScrollState);
  }, []);

  return (
    <div className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,#fff7ed_0%,#fef3c7_28%,#fefce8_52%,#ecfdf5_100%)] font-sans text-slate-900">
      <div className="pointer-events-none fixed inset-0">
        <motion.div
          animate={{ x: [0, 30, -18, 0], y: [0, 24, 8, 0], scale: [1, 1.08, 0.98, 1] }}
          transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
          className="absolute left-[-10%] top-[-15%] h-96 w-96 rounded-full bg-amber-300/45 blur-3xl"
        />
        <motion.div
          animate={{ x: [0, -36, 14, 0], y: [0, 18, -24, 0], scale: [1, 0.94, 1.08, 1] }}
          transition={{ duration: 19, repeat: Infinity, ease: "easeInOut" }}
          className="absolute right-[-12%] top-[20%] h-[30rem] w-[30rem] rounded-full bg-orange-300/35 blur-3xl"
        />
        <motion.div
          animate={{ x: [0, 18, 42, 0], y: [0, -18, 20, 0], scale: [1, 1.1, 0.96, 1] }}
          transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-[-20%] left-[35%] h-[28rem] w-[28rem] rounded-full bg-rose-200/30 blur-3xl"
        />
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 90, repeat: Infinity, ease: "linear" }}
          className="absolute left-1/2 top-20 h-[42rem] w-[42rem] -translate-x-1/2 rounded-full border-2 border-amber-500/28 shadow-[0_0_80px_rgba(245,158,11,0.16)]"
        />
        <motion.div
          animate={{ rotate: -360, scale: [1, 1.03, 1] }}
          transition={{ rotate: { duration: 110, repeat: Infinity, ease: "linear" }, scale: { duration: 12, repeat: Infinity, ease: "easeInOut" } }}
          className="absolute left-[52%] top-36 h-[30rem] w-[30rem] -translate-x-1/2 rounded-full border border-orange-400/30"
        />
        <motion.div
          animate={{ rotate: 360, scale: [1, 0.97, 1] }}
          transition={{ rotate: { duration: 130, repeat: Infinity, ease: "linear" }, scale: { duration: 14, repeat: Infinity, ease: "easeInOut" } }}
          className="absolute left-[43%] top-60 h-[20rem] w-[20rem] -translate-x-1/2 rounded-full border border-emerald-500/18"
        />
        <motion.svg
          aria-hidden="true"
          viewBox="0 0 900 500"
          className="absolute inset-x-0 top-24 mx-auto h-[34rem] max-w-6xl opacity-70"
        >
          <motion.path
            d="M40 360 C210 190 320 430 480 230 C610 70 690 250 860 110"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            className="text-amber-500"
            strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0.25 }}
            animate={{ pathLength: [0.25, 1, 0.25], opacity: [0.3, 0.78, 0.3] }}
            transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.path
            d="M80 410 C250 250 350 470 510 270 C635 120 710 285 840 165"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-emerald-600"
            strokeLinecap="round"
            strokeDasharray="10 16"
            initial={{ pathLength: 0.1, opacity: 0.15 }}
            animate={{ pathLength: [0.35, 1, 0.35], opacity: [0.18, 0.48, 0.18] }}
            transition={{ duration: 15, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}
          />
        </motion.svg>
      </div>

      <header
        className={`sticky top-0 z-40 border-b px-6 py-4 transition-all lg:px-8 ${
          hasScrolled
            ? "border-amber-200/70 bg-amber-50/80 shadow-xl shadow-amber-900/10 backdrop-blur-xl"
            : "border-transparent bg-transparent"
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between">
        <Link to="/" className="flex items-center gap-3">
          <span className="rounded-2xl bg-emerald-500 p-2.5 shadow-lg shadow-emerald-500/25">
            <Recycle className="h-7 w-7" />
          </span>
          <span className="text-lg font-black uppercase tracking-tight">eWaste Hub</span>
        </Link>

        <nav className="hidden items-center gap-2 text-sm font-bold text-slate-600 md:flex">
          {navItems.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className={`rounded-full px-4 py-2 transition-colors ${
                activeSection === item.id ? "bg-white text-emerald-800 shadow-sm" : "hover:bg-white/60 hover:text-slate-950"
              }`}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <Link
          to="/auth/login"
          className="rounded-full bg-white px-5 py-2.5 text-sm font-black text-slate-900 shadow-xl shadow-amber-900/10 transition-transform hover:-translate-y-0.5 hover:bg-amber-50"
        >
          Log in
        </Link>
        </div>
      </header>

      <main className="relative z-10">
        <section className="mx-auto grid max-w-7xl grid-cols-1 gap-12 px-6 pb-20 pt-10 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:pb-28 lg:pt-20">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="flex flex-col justify-center"
          >
            <div className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-amber-200/80 bg-white/75 px-4 py-2 text-sm font-bold text-amber-800 shadow-lg shadow-amber-900/10 backdrop-blur">
              <Sparkles className="h-4 w-4" />
              B2C eWaste recycling with data protection first
            </div>
            <h1 className="max-w-4xl text-5xl font-black leading-[0.95] tracking-tight sm:text-6xl lg:text-7xl">
              Give old tech a safer second life.
            </h1>
            <p className="mt-6 max-w-2xl text-lg font-medium leading-8 text-slate-700">
              Identify device value, retrieve important personal data, wipe securely, and route reusable electronics to
              ethical local resale or recycling partners.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/auth/register"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-6 py-4 text-sm font-black text-white shadow-2xl shadow-emerald-700/20 transition-transform hover:-translate-y-1 hover:bg-emerald-400"
              >
                Start recycling
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/auth/login"
                className="inline-flex items-center justify-center rounded-2xl border border-amber-200/80 bg-white/80 px-6 py-4 text-sm font-black text-slate-800 shadow-xl shadow-amber-900/10 backdrop-blur transition-all hover:-translate-y-1 hover:bg-amber-50"
              >
                Log in to your account
              </Link>
            </div>

            <div className="mt-12 grid max-w-2xl grid-cols-3 gap-3">
              {impactMetrics.map((metric, index) => (
                <motion.div
                  key={metric.label}
                  initial={{ opacity: 0, y: 14, scale: 0.96 }}
                  whileInView={{ opacity: 1, y: 0, scale: 1 }}
                  viewport={{ once: false, amount: 0.7 }}
                  transition={{ delay: index * 0.08, duration: 0.35 }}
                  whileHover={{ y: -6 }}
                  className="rounded-3xl border border-amber-200/70 bg-white/70 p-4 shadow-xl shadow-amber-900/10 backdrop-blur"
                >
                  <p className="text-2xl font-black text-slate-900">
                    {metric.value}
                    <span className="text-base text-emerald-700">{metric.suffix}</span>
                  </p>
                  <p className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-500">{metric.label}</p>
                </motion.div>
              ))}
            </div>
            <motion.a
              href="#services"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: [0, 8, 0] }}
              transition={{ delay: 0.9, duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
              className="mt-10 inline-flex w-fit items-center gap-2 rounded-full border border-amber-200/80 bg-white/70 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-amber-800 shadow-lg shadow-amber-900/10 backdrop-blur"
            >
              Scroll to explore
              <ChevronDown className="h-4 w-4" />
            </motion.a>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: [0, -10, 0] }}
            transition={{ opacity: { duration: 0.7, delay: 0.15 }, scale: { duration: 0.7, delay: 0.15 }, y: { duration: 6, repeat: Infinity, ease: "easeInOut" } }}
            className="relative"
          >
            <div className="absolute -inset-6 rounded-[3rem] bg-orange-300/25 blur-2xl" />
            <div className="relative overflow-hidden rounded-[2.5rem] border border-amber-200/80 bg-white/70 p-5 shadow-2xl shadow-amber-900/15 backdrop-blur-xl">
              <div className="rounded-[2rem] bg-gradient-to-br from-amber-50 via-white to-emerald-50 p-6">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-700">Live route</p>
                    <h2 className="mt-2 text-2xl font-black">Device decision panel</h2>
                  </div>
                  <span className="rounded-full bg-emerald-500 px-3 py-1 text-xs font-black text-white shadow-lg shadow-emerald-700/20">
                    Protected
                  </span>
                </div>

                <div className="space-y-4">
                  {[
                    ["iPhone 12", "current", "Partner resale + optional wipe"],
                    ["Old laptop", "recycle", "Paid data retrieval + free wipe"],
                    ["Retro console", "rare", "Specialist resale route"],
                    ["Unlisted tablet", "unknown", "Staff review required"],
                  ].map(([name, status, route]) => (
                    <motion.div key={name} whileHover={{ x: 8 }} className="rounded-2xl border border-amber-100 bg-white/80 p-4 shadow-lg shadow-amber-900/5">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-black">{name}</p>
                          <p className="mt-1 text-sm font-medium text-slate-500">{route}</p>
                        </div>
                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black uppercase text-emerald-700">
                          {status}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        <section id="services" className="relative border-y border-amber-200/70 bg-white/45 py-20">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mb-10 max-w-3xl">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-700">What the hub does</p>
              <h2 className="mt-3 text-4xl font-black tracking-tight">One place for value, data and recycling decisions.</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {serviceCards.map((card, index) => (
                <motion.article
                  key={card.title}
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: false, amount: 0.25, margin: "-10% 0px" }}
                  transition={{ delay: index * 0.05, duration: 0.35 }}
                  whileHover={{ y: -8 }}
                  className="rounded-[2rem] border border-amber-200/70 bg-white/75 p-6 shadow-xl shadow-amber-900/10 backdrop-blur transition-colors hover:bg-amber-50/90"
                >
                  <div className="mb-5 inline-flex rounded-2xl bg-emerald-100 p-3 text-emerald-700">
                    <card.icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-xl font-black">{card.title}</h3>
                  <p className="mt-3 text-sm font-medium leading-6 text-slate-600">{card.description}</p>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        <section id="how-it-works" className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-6 py-20 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-700">Process</p>
            <h2 className="mt-3 text-4xl font-black tracking-tight">Designed for people who kept devices for a reason.</h2>
            <p className="mt-5 text-base font-medium leading-7 text-slate-600">
              The brief is simple: reduce eWaste without ignoring the real concerns, such as old photos, backups,
              collectable devices and fear of data theft.
            </p>
          </div>
          <div className="space-y-4">
            {processSteps.map((step, index) => (
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: false, amount: 0.35, margin: "-10% 0px" }}
                transition={{ delay: index * 0.05, duration: 0.35 }}
                whileHover={{ y: -5 }}
                className="flex items-center gap-4 rounded-[1.75rem] border border-amber-200/70 bg-white/75 p-5 shadow-lg shadow-amber-900/10"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 text-sm font-black text-white shadow-lg shadow-emerald-700/20">
                  {index + 1}
                </span>
                <p className="text-lg font-black">{step}</p>
              </motion.div>
            ))}
          </div>
        </section>

        <section id="trust" className="mx-auto max-w-7xl px-6 pb-20 lg:px-8">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {[
              [LockKeyhole, "Data handling policy", "Retrieval links are time-limited and records are tracked."],
              [FileCheck2, "Wipe certificates", "Staff can record proof of data destruction before final recycling."],
              [MapPin, "Local-first routes", "Reusable devices are routed toward local resale or ethical recycling."],
            ].map(([Icon, title, text]) => (
              <motion.div key={String(title)} whileHover={{ y: -6 }} className="rounded-[2rem] border border-amber-200/70 bg-white/75 p-6 shadow-lg shadow-amber-900/10">
                <Icon className="h-7 w-7 text-emerald-700" />
                <h3 className="mt-4 text-xl font-black">{String(title)}</h3>
                <p className="mt-2 text-sm font-medium leading-6 text-slate-600">{String(text)}</p>
              </motion.div>
            ))}
          </div>
        </section>

        <section id="faq" className="mx-auto max-w-4xl px-6 pb-24 lg:px-8">
          <div className="mb-8 text-center">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-700">Questions</p>
            <h2 className="mt-3 text-4xl font-black tracking-tight">What owners usually ask first.</h2>
          </div>
          <div className="space-y-3">
            {faqItems.map((item, index) => {
              const isOpen = openFaq === index;
              return (
                <div key={item.question} className="overflow-hidden rounded-[1.5rem] border border-amber-200/70 bg-white/75 shadow-lg shadow-amber-900/5">
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? -1 : index)}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                  >
                    <span className="inline-flex items-center gap-3 text-base font-black">
                      <HelpCircle className="h-5 w-5 text-emerald-700" />
                      {item.question}
                    </span>
                    <ChevronDown
                      className={`h-5 w-5 shrink-0 text-slate-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  <motion.div
                    initial={false}
                    animate={{ height: isOpen ? "auto" : 0, opacity: isOpen ? 1 : 0 }}
                    transition={{ duration: 0.24 }}
                    className="overflow-hidden"
                  >
                    <p className="px-5 pb-5 text-sm font-medium leading-6 text-slate-600">{item.answer}</p>
                  </motion.div>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {showScrollTop ? (
        <motion.button
          type="button"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-6 right-6 z-50 rounded-full border border-amber-200 bg-white px-4 py-4 text-slate-900 shadow-2xl shadow-amber-900/20 transition-transform hover:-translate-y-1"
          aria-label="Scroll back to top"
        >
          <ArrowUp className="h-5 w-5" />
        </motion.button>
      ) : null}

      <footer className="relative z-10 border-t border-amber-200/70 bg-amber-50/80 px-6 py-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 text-sm font-medium text-slate-600 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <Leaf className="h-5 w-5 text-emerald-700" />
            <span>eWaste Hub, safer recycling for consumer electronics.</span>
          </div>
          <div className="flex flex-wrap gap-5">
            <a href="#trust" className="hover:text-slate-950">
              Data policy
            </a>
            <a href="#trust" className="hover:text-slate-950">
              Recycling standards
            </a>
            <a href="#services" className="hover:text-slate-950">
              Partner referrals
            </a>
            <span className="inline-flex items-center gap-1">
              <CheckCircle2 className="h-4 w-4 text-emerald-700" />
              Sandbox payments only
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
