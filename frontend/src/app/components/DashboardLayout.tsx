import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  CreditCard,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  PlusCircle,
  QrCode,
  Recycle,
  Search,
  Shield,
  User,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import axios from 'axios';
import api from '../../api/axios';
import {
  clearAuthSession,
  getAccessToken,
  getDisplayName,
  getRoleLabel,
  getStoredUser,
  isDemoSocialToken,
  setStoredUser,
  type AuthUser,
} from '../lib/auth';
import { fetchHealthStatus } from '../lib/userPortal';

export function DashboardLayout() {
  const navigate = useNavigate();
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => getStoredUser());
  const [apiHealthLabel, setApiHealthLabel] = useState('Checking API');
  const [isApiHealthy, setIsApiHealthy] = useState(false);

  const profileContainerRef = useRef<HTMLDivElement>(null);
  const notifContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileContainerRef.current && !profileContainerRef.current.contains(event.target as Node)) {
        setIsPopoverOpen(false);
      }
      if (notifContainerRef.current && !notifContainerRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    let ignore = false;

    async function loadCurrentUser() {
      if (isDemoSocialToken(getAccessToken())) {
        return;
      }

      try {
        const response = await api.get('/api/me');
        if (!ignore && response.data?.user) {
          setCurrentUser(response.data.user);
          setStoredUser(response.data.user);
        }
      } catch (error: unknown) {
        if (!ignore && axios.isAxiosError(error) && error.response?.status === 401) {
          clearAuthSession();
          navigate('/auth/login', { replace: true });
        }
      }
    }

    loadCurrentUser();

    return () => {
      ignore = true;
    };
  }, [navigate]);

  useEffect(() => {
    let ignore = false;

    async function loadHealth() {
      try {
        const health = await fetchHealthStatus();
        if (!ignore) {
          setIsApiHealthy((health.status || '').toLowerCase() === 'ok');
          setApiHealthLabel((health.status || 'online').toUpperCase());
        }
      } catch {
        if (!ignore) {
          setIsApiHealthy(false);
          setApiHealthLabel('OFFLINE');
        }
      }
    }

    void loadHealth();
    return () => {
      ignore = true;
    };
  }, []);

  const handleLogout = () => {
    clearAuthSession();
    setIsPopoverOpen(false);
    navigate('/auth/login', { replace: true });
  };

  const handleManageAccount = () => {
    setIsPopoverOpen(false);
    navigate('/app/settings');
  };

  const displayName = getDisplayName(currentUser);
  const displayEmail = currentUser?.email || 'Loading profile...';
  const roleLabel = getRoleLabel(currentUser?.role);

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900">
      <aside className="w-72 bg-white border-r border-slate-100 flex flex-col shrink-0 z-10">
        <div className="p-8 flex items-center gap-3">
          <div className="bg-emerald-600 p-2 rounded-xl shadow-lg shadow-emerald-600/20">
            <Recycle className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-black tracking-tighter uppercase text-slate-900">eWaste Hub</span>
        </div>

        <nav className="flex-1 px-4 space-y-2">
          <NavLink
            to="/app/dashboard"
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3.5 rounded-2xl font-bold transition-all ${
                isActive
                  ? 'bg-emerald-50 text-emerald-700 shadow-sm'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
              }`
            }
          >
            <LayoutDashboard className="w-5 h-5" />
            Dashboard
          </NavLink>

          <NavLink
            to="/app/new-request"
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3.5 rounded-2xl font-bold transition-all ${
                isActive
                  ? 'bg-emerald-50 text-emerald-700 shadow-sm'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
              }`
            }
          >
            <PlusCircle className="w-5 h-5" />
            New Request
          </NavLink>

          <NavLink
            to="/app/security-vault"
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3.5 rounded-2xl font-bold transition-all ${
                isActive
                  ? 'bg-emerald-50 text-emerald-700 shadow-sm'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
              }`
            }
          >
            <Shield className="w-5 h-5" />
            Security Vault
          </NavLink>

          <NavLink
            to="/app/rewards"
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3.5 rounded-2xl font-bold transition-all ${
                isActive
                  ? 'bg-emerald-50 text-emerald-700 shadow-sm'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
              }`
            }
          >
            <QrCode className="w-5 h-5" />
            My Rewards
          </NavLink>
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <header className="h-20 bg-white border-b border-slate-100 px-8 flex items-center justify-between shrink-0 z-20">
          <div className="relative w-96 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
            <input
              type="text"
              placeholder="Search your requests..."
              className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 focus:bg-white transition-all text-sm font-medium"
            />
          </div>

          <div className="flex items-center gap-6">
            <div
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-black uppercase tracking-widest ${
                isApiHealthy
                  ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
                  : 'border-red-100 bg-red-50 text-red-600'
              }`}
            >
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  isApiHealthy ? 'bg-emerald-500' : 'bg-red-500'
                }`}
              />
              API {apiHealthLabel}
            </div>

            <div className="relative" ref={notifContainerRef}>
              <button
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className={`relative p-2 transition-colors rounded-full ${isNotificationsOpen ? 'text-emerald-600 bg-emerald-50' : 'text-slate-400 hover:text-slate-900 hover:bg-slate-50'}`}
              >
                <Bell className="w-6 h-6" />
                <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
              </button>

              <AnimatePresence>
                {isNotificationsOpen && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    className="absolute right-0 top-[calc(100%+20px)] w-[380px] bg-white rounded-3xl shadow-[0_20px_40px_-10px_rgba(0,0,0,0.1)] border border-slate-100 overflow-hidden z-[100]"
                  >
                    <div className="p-5 border-b border-slate-50 flex items-center justify-between bg-white">
                      <h3 className="text-lg font-black text-slate-900 tracking-tight">Recent Alerts</h3>
                      <span className="px-2.5 py-1 bg-red-100 text-red-600 text-xs font-bold rounded-full">3 Unread</span>
                    </div>

                    <div className="flex flex-col max-h-[400px] overflow-y-auto">
                      <div className="p-4 flex gap-4 hover:bg-slate-50 transition-colors cursor-pointer border-b border-slate-50 group">
                        <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900 mb-0.5">Device Evaluated!</p>
                          <p className="text-sm text-slate-500 font-medium leading-relaxed pr-2">Your MacBook Pro is classified as Current. Get your QR Code.</p>
                          <p className="text-[10px] text-slate-400 font-bold mt-2 uppercase tracking-wider">2 mins ago</p>
                        </div>
                      </div>

                      <div className="p-4 flex gap-4 hover:bg-slate-50 transition-colors cursor-pointer border-b border-slate-50 group">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                          <Shield className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900 mb-0.5">Data Retrieval Complete</p>
                          <p className="text-sm text-slate-500 font-medium leading-relaxed pr-2">Download your iPad Air files now.</p>
                          <p className="text-[10px] text-slate-400 font-bold mt-2 uppercase tracking-wider">1 hour ago</p>
                        </div>
                      </div>

                      <div className="p-4 flex gap-4 hover:bg-orange-50/50 transition-colors cursor-pointer group bg-orange-50/30">
                        <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                          <AlertTriangle className="w-5 h-5 text-orange-600" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900 mb-0.5">Action Required</p>
                          <p className="text-sm text-slate-600 font-medium leading-relaxed pr-2">Your data link for Dell XPS expires in 3 days.</p>
                          <p className="text-[10px] text-orange-400 font-bold mt-2 uppercase tracking-wider">5 hours ago</p>
                        </div>
                      </div>
                    </div>

                    <div className="p-3 border-t border-slate-50 bg-slate-50/50 text-center">
                      <button className="w-full py-2.5 text-sm font-bold text-slate-500 hover:text-slate-900 transition-colors rounded-xl hover:bg-slate-100/50">
                        Mark all as read
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="h-8 w-[1px] bg-slate-100 mx-1"></div>

            <div className="relative" ref={profileContainerRef}>
              <div
                onClick={() => setIsPopoverOpen(!isPopoverOpen)}
                className="flex items-center gap-3 cursor-pointer group select-none"
              >
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">{displayName}</p>
                  <p className="text-xs font-medium text-slate-400">{roleLabel}</p>
                </div>
                <div className={`w-11 h-11 rounded-full bg-emerald-50 flex items-center justify-center border-2 overflow-hidden transition-all ${isPopoverOpen ? 'border-emerald-500 scale-105 shadow-sm' : 'border-emerald-400 group-hover:scale-105'}`}>
                  <User className="w-6 h-6 text-emerald-600" strokeWidth={2} />
                </div>
              </div>

              <AnimatePresence>
                {isPopoverOpen && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    className="absolute right-0 top-[calc(100%+12px)] w-[320px] bg-white rounded-3xl shadow-[0_20px_40px_-10px_rgba(0,0,0,0.1)] border border-slate-100 overflow-hidden z-[100]"
                  >
                    <div className="pt-8 pb-5 flex flex-col items-center text-center">
                      <div className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center border-2 border-emerald-100 mb-4 shadow-sm">
                        <User className="w-10 h-10 text-emerald-600" strokeWidth={2} />
                      </div>
                      <h3 className="text-xl font-black text-slate-900 mb-0.5">{displayName}</h3>
                      <p className="text-sm font-medium text-slate-500 mb-3">{displayEmail}</p>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-bold border border-emerald-100/50">
                        {roleLabel}
                      </span>
                    </div>

                    <div className="px-6 pb-6">
                      <button
                        onClick={handleManageAccount}
                        className="w-full py-3 bg-emerald-50/50 hover:bg-emerald-50 text-emerald-700 border border-emerald-200/60 rounded-full font-bold transition-colors"
                      >
                        Manage your Account & Settings
                      </button>
                    </div>

                    <div className="h-px bg-slate-100 w-full"></div>

                    <div className="p-4 space-y-1">
                      <button className="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors">
                        <CreditCard className="w-5 h-5 text-slate-400" strokeWidth={2} />
                        Payment Methods
                      </button>
                      <button className="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors">
                        <LifeBuoy className="w-5 h-5 text-slate-400" strokeWidth={2} />
                        Help & Support
                      </button>
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                      >
                        <LogOut className="w-5 h-5 text-slate-400" strokeWidth={2} />
                        Sign Out
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-10 bg-slate-50/50 relative z-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
