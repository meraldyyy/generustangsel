import { type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, CalendarPlus, QrCode, ShieldCheck, LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/events', label: 'Kegiatan', icon: CalendarPlus },
  { to: '/scanner', label: 'Scanner', icon: QrCode },
  { to: '/admins', label: 'Kelola Admin', icon: ShieldCheck },
];

export function AdminLayout({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleSignOut = async () => {
    setLoggingOut(true);
    await signOut();
    navigate('/login');
    setLoggingOut(false);
    setShowLogoutDialog(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-gray-200 bg-white md:flex">
        <div className="flex h-16 items-center gap-2 border-b border-gray-200 px-6">
          <div className="flex items-center gap-3">
  <img
    src="/logo.png"
    alt="Logo Generus Tangsel"
    className="h-9 w-9 object-contain"
  />

  <span className="font-bold text-gray-900">
    Generus Tangsel
  </span>
</div>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => {
            const active = location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  active ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <item.icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-gray-200 p-4">
          <p className="mb-2 truncate text-xs text-gray-400">{user?.email}</p>
          <button
            onClick={() => setShowLogoutDialog(true)}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-red-50 hover:text-red-700"
          >
            <LogOut size={18} />
            Keluar
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 md:hidden">
        <div className="flex items-center gap-2">
           <div className="flex items-center gap-3">
              <img
                src="/logo.png"
                alt="Logo Generus Tangsel"
                className="h-9 w-9 object-contain"
              />
              <span className="font-bold text-gray-900">
                Generus Tangsel
              </span>
            </div>
        </div>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="rounded-lg p-2 text-gray-600 hover:bg-gray-100"
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile nav */}
      {mobileOpen && (
        <div className="border-b border-gray-200 bg-white px-4 py-2 md:hidden">
          {navItems.map((item) => {
            const active = location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  active ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <item.icon size={18} />
                {item.label}
              </Link>
            );
          })}
          <button
            onClick={() => setShowLogoutDialog(true)}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-700"
          >
            <LogOut size={18} />
            Keluar
          </button>
        </div>
      )}

      <main className="md:pl-64">
        <div className="mx-auto max-w-5xl px-4 py-6 md:px-8 md:py-8">{children}</div>
      </main>
      <ConfirmDialog
        open={showLogoutDialog}
        title="Keluar dari akun?"
        message="Sesi admin akan diakhiri dan Anda akan kembali ke halaman login."
        confirmLabel="Ya, Keluar"
        confirmVariant="danger"
        loading={loggingOut}
        onConfirm={handleSignOut}
        onCancel={() => setShowLogoutDialog(false)}
      />
    </div>
  );
}

export function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      <div className="mx-auto max-w-2xl px-4 py-6">{children}</div>
    </div>
  );
}
