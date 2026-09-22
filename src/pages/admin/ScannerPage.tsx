import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QrCode, ScanLine, CheckCircle2, XCircle, ArrowLeft } from 'lucide-react';
import { AdminLayout } from '@/components/Layout';
import { Card, Spinner } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { QRScanner } from '@/components/QRScanner';
import { supabase } from '@/lib/supabase';
import { formatDate, formatTime, formatDateTime } from '@/lib/format';
import type { VerifyAttendanceResult } from '@/types';

export default function ScannerPage() {
  const navigate = useNavigate();
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<VerifyAttendanceResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [manualToken, setManualToken] = useState('');

  const handleScan = async (decodedText: string) => {
    // Extract token from URL or raw text
    let token = decodedText;
    const match = decodedText.match(/\/verify\/([a-f0-9]+)/);
    if (match) token = match[1];

    setScanning(false);
    setLoading(true);
    setResult(null);

    const { data, error } = await supabase.rpc('verify_attendance', { p_token: token });

    setLoading(false);

    if (error) {
      setResult({ valid: false, message: 'Terjadi kesalahan verifikasi' });
      return;
    }

    setResult(data as VerifyAttendanceResult);
  };

  const handleManualVerify = () => {
    if (manualToken.trim()) handleScan(manualToken.trim());
  };

  return (
    <AdminLayout>
      <button
        onClick={() => navigate('/dashboard')}
        className="mb-4 flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft size={16} />
        Kembali
      </button>

      <h1 className="mb-1 text-2xl font-bold text-gray-900">Scanner QR Bukti</h1>
      <p className="mb-6 text-sm text-gray-500">Scan QR Code bukti absensi peserta untuk verifikasi</p>

      {!scanning && !result && !loading && (
        <Card className="p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
            <ScanLine size={32} />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Scan QR Bukti Peserta</h3>
          <p className="mx-auto mt-1 mb-6 max-w-sm text-sm text-gray-500">
            Tekan tombol di bawah untuk membuka kamera dan arahkan ke QR Code bukti absensi
          </p>
          <Button size="lg" onClick={() => setScanning(true)}>
            <QrCode size={20} />
            Mulai Scan
          </Button>

          <div className="mt-8 border-t border-gray-200 pt-6">
            <p className="mb-2 text-sm font-medium text-gray-600">Atau masukkan token manual:</p>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
              <input
                type="text"
                placeholder="Token verifikasi..."
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleManualVerify()}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:w-80"
              />
              <Button variant="secondary" onClick={handleManualVerify} disabled={!manualToken.trim()}>
                Verifikasi
              </Button>
            </div>
          </div>
        </Card>
      )}

      {scanning && (
        <Card className="p-6">
          <QRScanner onScan={handleScan} onClose={() => setScanning(false)} />
        </Card>
      )}

      {loading && (
        <Card className="p-12">
          <div className="flex flex-col items-center gap-3">
            <Spinner size={32} />
            <p className="text-sm text-gray-500">Memverifikasi...</p>
          </div>
        </Card>
      )}

      {result && (
        <div className="space-y-4">
          {result.valid && result.data && (
            <Card className="overflow-hidden">
              <div className="bg-emerald-50 px-6 py-5 text-center">
                <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <CheckCircle2 size={32} />
                </div>
                <h2 className="text-xl font-bold text-emerald-700">
                  {result.already_verified ? 'TERVERIFIKASI' : '✓ ABSENSI VALID'}
                </h2>
                {result.already_verified && (
                  <p className="mt-1 text-sm text-emerald-600">QR Valid, Data Terverifikasi</p>
                )}
              </div>
              <div className="divide-y divide-gray-100 px-6 py-4">
                {[
                  ['Nama', result.data.name],
                  ['Desa', result.data.village],
                  ['Kelompok', result.data.group_name],
                  ['Kategori', result.data.age_category],
                  ['Jenis Kelamin', result.data.gender ?? '-'],
                  ['Kegiatan', result.data.event_name],
                  ['Tanggal', formatDate(result.data.event_date)],
                  ['Waktu', `${formatTime(result.data.start_time)} - ${formatTime(result.data.end_time)}`],
                  ['Waktu Absen', formatDateTime(result.data.checked_in_at)],
                  ['Diverifikasi oleh', result.data.verified_by_name ?? 'Admin aktif'],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between py-2.5">
                    <span className="text-sm font-medium text-gray-500">{label}</span>
                    <span className="text-sm font-semibold text-gray-900 text-right">{value}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {!result.valid && (
            <Card className="overflow-hidden">
              <div className="bg-red-50 px-6 py-8 text-center">
                <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600">
                  <XCircle size={32} />
                </div>
                <h2 className="text-xl font-bold text-red-700">✕ QR TIDAK VALID</h2>
                <p className="mt-1 text-sm text-red-600">{result.message ?? 'Data absensi tidak ditemukan'}</p>
              </div>
            </Card>
          )}

          <div className="flex justify-center gap-3">
            <Button variant="secondary" onClick={() => { setResult(null); setScanning(true); }}>
              <QrCode size={18} />
              Scan Lagi
            </Button>
            <Button onClick={() => setResult(null)}>
              Selesai
            </Button>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
