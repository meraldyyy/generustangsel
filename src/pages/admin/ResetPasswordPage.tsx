import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const { updatePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError('Password minimal 6 karakter.');
      return;
    }
    if (password !== confirmation) {
      setError('Konfirmasi password tidak sama.');
      return;
    }
    setLoading(true);
    const result = await updatePassword(password);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    await supabase.auth.signOut();
    setSaved(true);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-600 via-blue-700 to-slate-800 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        {saved ? (
          <div className="text-center">
            <h1 className="text-xl font-bold text-gray-900">Password berhasil diubah</h1>
            <p className="mt-2 text-sm text-gray-500">Silakan login menggunakan password baru.</p>
            <Button className="mt-6 w-full" onClick={() => navigate('/login')}>Kembali ke Login</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <h1 className="text-xl font-bold text-gray-900">Buat Password Baru</h1>
            <p className="text-sm text-gray-500">Masukkan password baru untuk akun admin Anda.</p>
            <div className="relative">
              <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="password" required minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password baru" className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <input type="password" required minLength={6} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="Konfirmasi password" className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
            <Button type="submit" className="w-full" disabled={loading}>{loading ? 'Menyimpan...' : 'Simpan Password'}</Button>
          </form>
        )}
      </div>
    </div>
  );
}