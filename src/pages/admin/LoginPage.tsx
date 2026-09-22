import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, ArrowRight } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';

export default function LoginPage() {
  const { signIn, resetPassword } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    if (window.location.hash.includes('type=recovery')) {
      navigate('/reset-password', { replace: true });
    }
  }, [navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await signIn(email, password);
    const error = result.error;

    setLoading(false);

    if (error) {
      setError(error);
      return;
    }

    navigate('/dashboard');
  };

  const handleResetRequest = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await resetPassword(email);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setResetSent(true);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-600 via-blue-700 to-slate-800 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-lg">
            <img
              src="/logo.png"
              alt="Logo"
              className="h-12 w-12 object-contain"
            />
          </div>
          <h1 className="text-2xl font-bold text-white">Generus Tangsel</h1>
          <p className="mt-1 text-blue-200">Sistem Absensi Berbasis QR Code</p>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-xl">
          <h2 className="mb-6 text-xl font-bold text-gray-900">
            {showForgotPassword ? 'Reset Password' : 'Masuk ke Dashboard'}
          </h2>

          {showForgotPassword ? (
            resetSent ? (
              <div className="space-y-4 text-center text-sm text-gray-600">
                <p>Link reset password sudah dikirim ke email Anda. Cek inbox atau folder spam.</p>
                <button type="button" onClick={() => setShowForgotPassword(false)} className="font-semibold text-blue-600 hover:text-blue-700">
                  Kembali ke login
                </button>
              </div>
            ) : (
              <form onSubmit={handleResetRequest} className="space-y-4">
                <p className="text-sm text-gray-500">Masukkan email admin untuk menerima link reset password.</p>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
                <Button type="submit" size="lg" className="w-full" disabled={loading}>
                  {loading ? 'Mengirim...' : 'Kirim Link Reset'}
                </Button>
              </form>
            )
          ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <div className="relative">
                <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-gray-900 placeholder-gray-400 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">Password</label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-gray-900 placeholder-gray-400 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
            )}

            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? 'Memproses...' : 'Masuk'}
              {!loading && <ArrowRight size={18} />}
            </Button>
            <button type="button" onClick={() => { setShowForgotPassword(true); setError(null); }} className="w-full text-center text-sm font-semibold text-blue-600 hover:text-blue-700">
              Lupa password?
            </button>
          </form>
          )}

          <p className="mt-6 text-center text-sm text-gray-500">
            Akun admin dibuat oleh admin aktif melalui menu Kelola Admin.
          </p>
        </div>

        <p className="mt-6 text-center text-sm text-blue-200">
          <Link to="/attendance/demo" className="hover:text-white">Halaman Peserta</Link>
        </p>
      </div>
    </div>
  );
}
