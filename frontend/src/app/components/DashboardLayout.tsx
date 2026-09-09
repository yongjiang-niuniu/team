import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
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
import {
  fetchMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from '../lib/notifications';

function formatNotificationTime(value?: string | null): string {
  if (!value) {
    return 'Just now';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  const diffMinutes = Math.max(0, Math.round((Date.now() - parsed.getTime()) / 60000));
  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes} min${diffMinutes === 1 ? '' : 's'} ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  return parsed.toLocaleDateString('en-GB', { month: 'short', day: '2-digit' });
}

function notificationTone(notification: AppNotification) {
  const kind = (notification.kind || '').toLowerCase();
  const severity = (notification.severity || '').toLowerCase();
  if (severity === 'success' || kind === 'referral') {
    return {
      icon: CheckCircle2,
      circle: 'bg-emerald-100',
      iconClass: 'text-emerald-600',
      row: 'hover:bg-emerald-50/60',
    };
  }
  if (severity === 'warning') {
    return {
      icon: AlertTriangle,
      circle: 'bg-orange-100',
      iconClass: 'text-orange-600',
      row: 'hover:bg-orange-50/60',
    };
  }
  return {
    icon: Shield,
    circle: 'bg-blue-100',
    iconClass: 'text-blue-600',
    row: 'hover:bg-slate-50',
  };
}

export function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => getStoredUser());
  const [apiHealthLabel, setApiHealthLabel] = useState('Checking');
  const [isApiHealthy, setIsApiHealthy] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNotificationLoading, setIsNotificationLoading] = useState(false);

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

  const loadNotifications = useCallback(async () => {
    setIsNotificationLoading(true);
    try {
      const result = await fetchMyNotifications();
      setNotifications(result.notifications);
      setUnreadCount(result.unread_count);
    } catch {
      setNotifications([]);
      setUnreadCount(0);
    } finally {
      setIsNotificationLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    if (location.pathname === '/app/dashboard') {
      const params = new URLSearchParams(location.search);
      setSearchQuery(params.get('q') || '');
    }
  }, [location.pathname, location.search]);

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
          const isHealthy = (health.status || '').toLowerCase() === 'ok';
          setIsApiHealthy(isHealthy);
          setApiHealthLabel(isHealthy ? 'Online' : 'Needs attention');
        }
      } catch {
        if (!ignore) {
          setIsApiHealthy(false);
          setApiHealthLabel('Offline');
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

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = searchQuery.trim();
    navigate(trimmed ? `/app/dashboard?q=${encodeURIComponent(trimmed)}` : '/app/dashboard');
  };

  const handleToggleNotifications = () => {
    const nextOpen = !isNotificationsOpen;
    setIsNotificationsOpen(nextOpen);
    if (nextOpen) {
      void loadNotifications();
    }
  };

  const handleNotificationClick = async (notification: AppNotification) => {
    if (!notification.read_at) {
      const updated = await markNotificationRead(notification.id);
      if (updated) {
        setNotifications((current) => current.map((item) => (item.id === updated.id ? updated : item)));
        setUnreadCount((current) => Math.max(0, current - 1));
      }
    }
    setIsNotificationsOpen(false);
    if (notification.target_path?.startsWith('/app/')) {
      navigate(notification.target_path);
    }
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead();
    const now = new Date().toISOString();
    setNotifications((current) => current.map((item) => ({ ...item, read_at: item.read_at || now })));
    setUnreadCount(0);
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
          <form className="relative w-96 group" onSubmit={handleSearchSubmit}>
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search your requests..."
              className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 focus:bg-white transition-all text-sm font-medium"
            />
          </form>

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
              {apiHealthLabel}
            </div>

            <div className="relative" ref={notifContainerRef}>
              <button
                type="button"
                onClick={handleToggleNotifications}
                className={`relative p-2 transition-colors rounded-full ${isNotificationsOpen ? 'text-emerald-600 bg-emerald-50' : 'text-slate-400 hover:text-slate-900 hover:bg-slate-50'}`}
              >
                <Bell className="w-6 h-6" />
                {unreadCount > 0 ? (
                  <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
                ) : null}
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
                      <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${unreadCount > 0 ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'}`}>
                        {unreadCount} Unread
                      </span>
                    </div>

                    <div className="flex flex-col max-h-[400px] overflow-y-auto">
                      {isNotificationLoading ? (
                        <div className="p-6 text-center text-sm font-bold text-slate-400">Loading alerts...</div>
                      ) : notifications.length === 0 ? (
                        <div className="p-6 text-center text-sm font-bold text-slate-400">No alerts yet.</div>
                      ) : notifications.map((notification) => {
                        const tone = notificationTone(notification);
                        const Icon = tone.icon;
                        const isUnread = !notification.read_at;
                        return (
                          <button
                            key={notification.id}
                            type="button"
                            onClick={() => void handleNotificationClick(notification)}
                            className={`w-full p-4 flex gap-4 text-left transition-colors cursor-pointer border-b border-slate-50 group ${tone.row} ${isUnread ? 'bg-slate-50/70' : 'bg-white'}`}
                          >
                            <div className={`w-10 h-10 rounded-full ${tone.circle} flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform`}>
                              <Icon className={`w-5 h-5 ${tone.iconClass}`} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start gap-2">
                                <p className="text-sm font-bold text-slate-900 mb-0.5">{notification.title}</p>
                                {isUnread ? <span className="mt-1 h-2 w-2 rounded-full bg-red-500 shrink-0" /> : null}
                              </div>
                              {notification.body ? (
                                <p className="text-sm text-slate-500 font-medium leading-relaxed pr-2">{notification.body}</p>
                              ) : null}
                              <p className="text-[10px] text-slate-400 font-bold mt-2 uppercase tracking-wider">
                                {formatNotificationTime(notification.created_at)}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    <div className="p-3 border-t border-slate-50 bg-slate-50/50 text-center">
                      <button
                        type="button"
                        onClick={() => void handleMarkAllRead()}
                        disabled={unreadCount === 0}
                        className="w-full py-2.5 text-sm font-bold text-slate-500 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors rounded-xl hover:bg-slate-100/50"
                      >
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
                      <button
                        type="button"
                        onClick={() => {
                          setIsPopoverOpen(false);
                          navigate('/app/settings?tab=billing');
                        }}
                        className="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                      >
                        <CreditCard className="w-5 h-5 text-slate-400" strokeWidth={2} />
                        Payment Methods
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsPopoverOpen(false);
                          navigate('/app/settings?tab=support');
                        }}
                        className="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                      >
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
