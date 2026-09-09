import { useState,useEffect } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  PlusCircle, 
  Settings, 
  LogOut, 
  Menu, 
  X,
  Recycle
} from 'lucide-react';

// Simple utility if not present
function classNames(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  useEffect(() => {
  const handleEsc = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      setSidebarOpen(false);
    }
  };

  window.addEventListener('keydown', handleEsc);

  return () => {
    window.removeEventListener('keydown', handleEsc);
  };
}, []);

  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'New Request', href: '/new-request', icon: PlusCircle },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans text-slate-900">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={classNames(
        "fixed top-0 left-0 z-50 h-screen w-64 bg-white shadow-xl transition-all duration-300 ease-in-out lg:translate-x-0 lg:static lg:shadow-none border-r border-slate-100",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex h-16 items-center justify-between px-6 border-b border-slate-100">
          <div className="flex items-center gap-2 text-green-700 font-bold text-xl">
            <Recycle className="h-6 w-6" />
            <span>eWaste Hub</span>
          </div>
          <button 
            className="lg:hidden text-slate-500 hover:text-slate-700"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <nav className="p-4 space-y-1">
          {navigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              className={({ isActive }) => classNames(
                "flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-colors",
                isActive 
                  ? "bg-green-50 text-green-700 shadow-sm shadow-green-100 ring-1 ring-green-200" 
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </NavLink>
          ))}
        </nav>

        <div className="absolute bottom-0 w-full p-4 border-t border-slate-100">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-br from-green-50 to-emerald-50 border border-green-100">
            <div className="flex-1">
              <p className="text-xs font-medium text-green-800">Impact Score</p>
              <p className="text-lg font-bold text-green-700">1,240 kg</p>
              <p className="text-[10px] text-green-600">CO2 Saved</p>
            </div>
            <Recycle className="h-8 w-8 text-green-200 opacity-50" />
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Navbar */}
        <header className="h-16 bg-white border-b border-slate-100 flex items-center justify-between px-4 lg:px-8 shadow-sm z-30">
          <button 
            className="lg:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-50 rounded-lg"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </button>

          <div className="hidden lg:block text-slate-400 text-sm">
            <span className="font-medium text-slate-900">Welcome back,</span> Alex
          </div>

          <div className="flex items-center gap-4 ml-auto">
            <div className="flex items-center gap-3 pl-4 border-l border-slate-100">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-slate-900">Alex Morgan</p>
                <p className="text-xs text-slate-500">Eco Warrior</p>
              </div>
              <img 
                src="https://images.unsplash.com/photo-1701463387028-3947648f1337?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjBwb3J0cmFpdCUyMGF2YXRhcnxlbnwxfHx8fDE3NzI0ODQwODh8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral" 
                alt="Profile" 
                className="h-10 w-10 rounded-full object-cover border-2 border-white shadow-md ring-2 ring-green-50"
              />
              <button className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors ml-2">
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto bg-slate-50 p-4 lg:p-8">
          <div className="max-w-5xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
