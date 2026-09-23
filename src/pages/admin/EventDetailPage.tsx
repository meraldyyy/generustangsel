import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, QrCode, Download, Lock, Unlock, Users, Search, Trash2, CheckCircle2,
} from 'lucide-react';
import { AdminLayout } from '@/components/Layout';
import { Card, Spinner, EmptyState } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Input';
import { QRCode } from '@/components/QRCode';
import { supabase } from '@/lib/supabase';
import { formatDate, formatTime, formatDateTime, AGE_CATEGORIES, VILLAGES } from '@/lib/format';
import type { Event, Attendance } from '@/types';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useAuth } from '@/context/AuthContext';

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  open: 'bg-emerald-100 text-emerald-700',
  closed: 'bg-red-100 text-red-700',
};

const statusLabels: Record<string, string> = {
  draft: 'Draft',
  open: 'Aktif',
  closed: 'Ditutup',
};

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [event, setEvent] = useState<Event | null>(null);
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [showQR, setShowQR] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [adminNames, setAdminNames] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!id) return;
    async function load() {
      const [{ data: eventData }, { data: attData }] = await Promise.all([
        supabase.from('events').select('*').eq('id', id).maybeSingle(),
        supabase.from('attendances').select('*').eq('event_id', id).order('checked_in_at', { ascending: false }),
      ]);
      setEvent(eventData as Event | null);
      setAttendances((attData as Attendance[]) ?? []);
      const adminIds = [...new Set([
        eventData?.created_by,
        eventData?.updated_by,
        ...((attData as Attendance[] | null) ?? []).map((attendance) => attendance.verified_by),
      ].filter((value): value is string => Boolean(value)))];
      if (adminIds.length) {
        const { data: profiles } = await supabase.from('admin_profiles').select('id, name').in('id', adminIds);
        setAdminNames(Object.fromEntries((profiles ?? []).map((profile) => [profile.id, profile.name])));
      }
      setLoading(false);
    }
    load();
  }, [id]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { SMP: 0, SMA: 0, PRANIKAH: 0 };
    attendances.forEach((a) => {
      counts[a.age_category] = (counts[a.age_category] ?? 0) + 1;
    });
    return counts;
  }, [attendances]);

  const genderCounts = useMemo(() => {
    const counts: Record<string, number> = { 'Laki-laki': 0, Perempuan: 0 };
    attendances.forEach((a) => {
      if (a.gender) counts[a.gender] = (counts[a.gender] ?? 0) + 1;
    });
    return counts;
  }, [attendances]);

  const desaCounts = useMemo(() => {
    const counts: Record<string, number> = Object.fromEntries(VILLAGES.map((village) => [village, 0]));
    attendances.forEach((attendance) => {
      if (attendance.village in counts) counts[attendance.village] += 1;
    });
    return counts;
  }, [attendances]);

  const filtered = useMemo(() => {
    return attendances.filter((a) => {
      const matchSearch =
        a.name.toLowerCase().includes(search.toLowerCase()) ||
        a.village.toLowerCase().includes(search.toLowerCase()) ||
        a.group_name.toLowerCase().includes(search.toLowerCase());
      const matchCategory = !filterCategory || a.age_category === filterCategory;
      return matchSearch && matchCategory;
    });
  }, [attendances, search, filterCategory]);

  const updateStatus = async (newStatus: 'draft' | 'open' | 'closed') => {
    if (!event) return;
    setUpdating(true);
    const { data } = await supabase
      .from('events')
      .update({ status: newStatus, updated_by: user?.id ?? null })
      .eq('id', event.id)
      .select('*')
      .single();
    if (data) setEvent(data as Event);
    setUpdating(false);
  };

  const deleteEvent = async () => {
    if (!event) return;
    setDeleting(true);
    const { error } = await supabase.from('events').delete().eq('id', event.id);
    if (error) {
      setDeleting(false);
      setShowDeleteDialog(false);
      return;
    }
    navigate('/events');
  };

  const downloadQR = () => {
    const canvas = document.querySelector('#event-qr canvas') as HTMLCanvasElement;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `qr-${event?.name.replace(/\s+/g, '-').toLowerCase()}.png`;
    a.click();
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex justify-center py-20">
          <Spinner size={32} />
        </div>
      </AdminLayout>
    );
  }

  if (!event) {
    return (
      <AdminLayout>
        <EmptyState title="Kegiatan tidak ditemukan" />
        <div className="flex justify-center pb-4">
          <Link to="/events"><Button>Kembali ke Daftar</Button></Link>
        </div>
      </AdminLayout>
    );
  }

  const attendanceUrl = `${window.location.origin}/attendance/${event.id}`;

  return (
    <AdminLayout>
      <button
        onClick={() => navigate('/events')}
        className="mb-4 flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft size={16} />
        Kembali
      </button>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">{event.name}</h1>
            <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusColors[event.status]}`}>
              {statusLabels[event.status]}
            </span>
          </div>
          {event.description && <p className="mt-2 text-gray-600">{event.description}</p>}
          <p className="mt-2 text-sm text-gray-500">
            {formatDate(event.event_date)} • {formatTime(event.start_time)} - {formatTime(event.end_time)}
          </p>
          {event.created_by && (
            <p className="mt-1 text-xs text-gray-400">
              Dibuat oleh: {adminNames[event.created_by] ?? 'Admin'}
            </p>
          )}
        </div>
        <Button variant="danger" size="sm" onClick={() => setShowDeleteDialog(true)} className="w-full shrink-0 sm:w-auto">
          <Trash2 size={16} />
          Hapus
        </Button>
      </div>

      {/* Action buttons */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {event.status !== 'open' && (
          <Button
            variant="success"
            onClick={() => updateStatus('open')}
            disabled={updating}
            className="w-full sm:w-auto"
          >
            <Unlock size={18} />
            Buka Absensi
          </Button>
        )}
        {event.status !== 'closed' && (
          <Button
            variant="danger"
            onClick={() => updateStatus('closed')}
            disabled={updating}
            className="w-full sm:w-auto"
          >
            <Lock size={18} />
            Tutup Absensi
          </Button>
        )}
        {event.status === 'open' && (
          <Button variant="secondary" onClick={() => updateStatus('draft')} disabled={updating} className="w-full sm:w-auto">
            Kembalikan ke Draft
          </Button>
        )}
        <Button variant="secondary" onClick={() => setShowQR(true)} className="w-full sm:w-auto">
          <QrCode size={18} />
          Tampilkan QR
        </Button>
      </div>

      <ConfirmDialog
        open={showDeleteDialog}
        title="Hapus kegiatan?"
        message={`Kegiatan "${event.name}" dan seluruh data absensinya akan dihapus permanen.`}
        confirmLabel="Ya, Hapus"
        confirmVariant="danger"
        loading={deleting}
        onConfirm={deleteEvent}
        onCancel={() => setShowDeleteDialog(false)}
      />

      {/* QR Modal */}
      {showQR && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowQR(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-1 text-lg font-bold text-gray-900">QR Code Kegiatan</h3>
            <p className="mb-4 truncate text-sm text-gray-500">{event.name}</p>
            <div id="event-qr" className="flex justify-center">
              <QRCode value={attendanceUrl} size={280} />
            </div>
            <p className="mt-4 break-all rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">{attendanceUrl}</p>
            <div className="mt-4 flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setShowQR(false)}>
                Tutup
              </Button>
              <Button className="flex-1" onClick={downloadQR}>
                <Download size={18} />
                Download
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-blue-600" />
            <p className="text-sm font-medium text-gray-500">Total</p>
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-900">{attendances.length}</p>
        </Card>
        {AGE_CATEGORIES.map((cat) => (
          <Card key={cat} className="p-4">
            <p className="text-sm font-medium text-gray-500">{cat}</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{categoryCounts[cat] ?? 0}</p>
          </Card>
        ))}
        <Card className="p-4">
          <p className="text-sm font-medium text-gray-500">Laki-laki</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{genderCounts['Laki-laki']}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm font-medium text-gray-500">Perempuan</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{genderCounts.Perempuan}</p>
        </Card>
        {VILLAGES.map((village) => (
          <Card key={village} className="p-4">
            <p className="text-sm font-medium text-gray-500">{village}</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{desaCounts[village]}</p>
          </Card>
        ))}
      </div>

      {/* Attendance list */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">Daftar Peserta</h2>
        <span className="text-sm text-gray-500">{filtered.length} peserta</span>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Cari nama, desa, kelompok..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-gray-900 placeholder-gray-400 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <Select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="sm:w-48">
          <option value="">Semua Kategori</option>
          {AGE_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card className="p-6">
          <EmptyState
            icon={<Users size={48} />}
            title={attendances.length === 0 ? 'Belum ada peserta absen' : 'Tidak ada peserta yang cocok'}
            message={attendances.length === 0 ? 'Bagikan QR kegiatan untuk mulai menerima absensi' : 'Coba ubah pencarian'}
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          {/* Desktop table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 text-left">
                <tr>
                  <th className="px-4 py-3 font-semibold text-gray-600">No</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Nama</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Desa</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Kelompok</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Kategori</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Jenis Kelamin</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Waktu Absen</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Status</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Diverifikasi oleh</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((att, idx) => (
                  <tr key={att.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-400">{idx + 1}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{att.name}</td>
                    <td className="px-4 py-3 text-gray-600">{att.village}</td>
                    <td className="px-4 py-3 text-gray-600">{att.group_name}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                        {att.age_category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{att.gender ?? '-'}</td>
                    <td className="px-4 py-3 text-gray-600">{formatDateTime(att.checked_in_at)}</td>
                    <td className="px-4 py-3">
                      {att.verified_at ? (
                        <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
                          <CheckCircle2 size={14} />
                          Terverifikasi
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-gray-400">Belum</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {att.verified_by ? (adminNames[att.verified_by] ?? 'Admin') : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="divide-y divide-gray-100 md:hidden">
            {filtered.map((att, idx) => (
              <div key={att.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900">{idx + 1}. {att.name}</p>
                    <p className="mt-0.5 text-sm text-gray-500">{att.village} • {att.group_name} • {att.gender ?? '-'}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                    {att.age_category}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="text-gray-400">{formatDateTime(att.checked_in_at)}</span>
                  {att.verified_at && (
                    <span className="flex items-center gap-1 font-medium text-emerald-600">
                      <CheckCircle2 size={12} />
                      Terverifikasi
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </AdminLayout>
  );
}
