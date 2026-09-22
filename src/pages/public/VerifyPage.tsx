import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  CheckCircle2, XCircle, Download, CalendarDays, Clock, QrCode as QrIcon,
} from 'lucide-react';
import { PublicLayout } from '@/components/Layout';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Card';
import { QRCode } from '@/components/QRCode';
import { supabase } from '@/lib/supabase';
import { formatDate, formatTime, formatDateTime } from '@/lib/format';
import type { VerifyAttendanceResult } from '@/types';

export default function VerifyPage() {
  const { token } = useParams<{ token: string }>();
  const [result, setResult] = useState<VerifyAttendanceResult | null>(null);
  const [loading, setLoading] = useState(true);
  const proofRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!token) return;
    async function load() {
      const { data, error } = await supabase.rpc('verify_attendance', { p_token: token });
      if (error) {
        setResult({ valid: false, message: 'Terjadi kesalahan' });
      } else {
        setResult(data as VerifyAttendanceResult);
      }
      setLoading(false);
    }
    load();
  }, [token]);

  const handleDownload = () => {
    const canvas = document.querySelector('#proof-qr canvas') as HTMLCanvasElement;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `bukti-absensi.png`;
    a.click();
  };

  if (loading) {
    return (
      <PublicLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Spinner size={32} />
        </div>
      </PublicLayout>
    );
  }

  if (!result || !result.valid || !result.data) {
    return (
      <PublicLayout>
        <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-500">
            <XCircle size={32} />
          </div>
          <h1 className="text-xl font-bold text-gray-900">QR Tidak Valid</h1>
          <p className="mt-2 text-gray-500">{result?.message ?? 'Data absensi tidak ditemukan'}</p>
        </div>
      </PublicLayout>
    );
  }

  const d = result.data;

  return (
    <PublicLayout>
      <div ref={proofRef} className="space-y-4">
        {/* Header badge */}
        <div className="rounded-xl bg-emerald-50 p-6 text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <CheckCircle2 size={32} />
          </div>
          <h1 className="text-xl font-bold text-emerald-700">ABSENSI BERHASIL</h1>
          <p className="mt-1 text-sm text-emerald-600">Kehadiran Anda telah terverifikasi</p>
        </div>

        {/* QR Code */}
        <div className="flex flex-col items-center rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div id="proof-qr">
            <QRCode value={`${window.location.origin}/verify/${d.token}`} size={220} />
          </div>
          <p className="mt-3 text-xs text-gray-400">Scan QR ini untuk verifikasi</p>
          <div className="mt-2 rounded-lg bg-gray-50 px-3 py-1.5 font-mono text-xs text-gray-600">
            {d.token.slice(0, 12)}...{d.token.slice(-8)}
          </div>
        </div>

        {/* Details */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="divide-y divide-gray-100">
            {[
              ['Nama', d.name],
              ['Desa', d.village],
              ['Kelompok', d.group_name],
              ['Kategori', d.age_category],
              ['Jenis Kelamin', d.gender ?? '-'],
              ['Kegiatan', d.event_name],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between py-2.5">
                <span className="text-sm font-medium text-gray-500">{label}</span>
                <span className="text-sm font-semibold text-gray-900 text-right">{value}</span>
              </div>
            ))}
            <div className="flex justify-between py-2.5">
              <span className="text-sm font-medium text-gray-500">Tanggal</span>
              <span className="text-sm font-semibold text-gray-900 text-right">{formatDate(d.event_date)}</span>
            </div>
            <div className="flex justify-between py-2.5">
              <span className="flex items-center gap-1 text-sm font-medium text-gray-500">
                <Clock size={14} />
                Waktu Kegiatan
              </span>
              <span className="text-sm font-semibold text-gray-900">
                {formatTime(d.start_time)} - {formatTime(d.end_time)}
              </span>
            </div>
            <div className="flex justify-between py-2.5">
              <span className="flex items-center gap-1 text-sm font-medium text-gray-500">
                <CalendarDays size={14} />
                Waktu Absen
              </span>
              <span className="text-sm font-semibold text-gray-900">{formatDateTime(d.checked_in_at)}</span>
            </div>
          </div>
        </div>

        {/* Verification code */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-center shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-400">Verification Code</p>
          <p className="mt-1 font-mono text-sm font-bold text-gray-900 break-all">{d.token}</p>
        </div>

        {/* Save button */}
        <Button size="lg" className="w-full" onClick={handleDownload}>
          <Download size={18} />
          Simpan Bukti (Gambar)
        </Button>

        <div className="flex items-center justify-center gap-1.5 pt-2 text-xs text-gray-400">
          <QrIcon size={14} />
          AbsensiQR - Sistem Absensi Digital
        </div>
      </div>
    </PublicLayout>
  );
}
