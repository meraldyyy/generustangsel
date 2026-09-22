import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CalendarPlus } from 'lucide-react';
import { AdminLayout } from '@/components/Layout';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

export default function CreateEventPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !eventDate || !startTime || !endTime) {
      setError('Nama, tanggal, jam mulai, dan jam selesai wajib diisi');
      return;
    }

    if (endTime <= startTime) {
      setError('Jam selesai harus setelah jam mulai');
      return;
    }

    setShowSaveDialog(true);
  };

  const saveEvent = async () => {
    setLoading(true);
    const { data, error: insertError } = await supabase
      .from('events')
      .insert({
        name: name.trim(),
        description: description.trim() || null,
        event_date: eventDate,
        start_time: startTime,
        end_time: endTime,
        status: 'draft',
        created_by: user?.id ?? null,
      })
      .select('id')
      .single();

    setLoading(false);

    if (insertError) {
      setError(insertError.message);
      setShowSaveDialog(false);
      return;
    }

    navigate(`/events/${data.id}`);
  };

  return (
    <AdminLayout>
      <button
        onClick={() => navigate('/events')}
        className="mb-4 flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft size={16} />
        Kembali
      </button>

      <h1 className="mb-1 text-2xl font-bold text-gray-900">Buat Kegiatan</h1>
      <p className="mb-6 text-sm text-gray-500">Isi detail kegiatan absensi baru</p>

      <form onSubmit={handleSubmit} className="max-w-2xl space-y-5">
        <Input
          label="Nama Kegiatan"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Contoh: Pertemuan Pemuda Desa"
        />

        <Textarea
          label="Deskripsi (opsional)"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Deskripsi singkat tentang kegiatan"
        />

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <Input
            label="Tanggal"
            type="date"
            required
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
          />
          <Input
            label="Jam Mulai"
            type="time"
            required
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
          <Input
            label="Jam Selesai"
            type="time"
            required
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
          />
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <div className="flex gap-3">
          <Button type="submit" disabled={loading}>
            {loading ? 'Menyimpan...' : (
              <>
                <CalendarPlus size={18} />
                Simpan Kegiatan
              </>
            )}
          </Button>
          <Button type="button" variant="secondary" onClick={() => navigate('/events')}>
            Batal
          </Button>
        </div>
      </form>
      <ConfirmDialog
        open={showSaveDialog}
        title="Simpan kegiatan?"
        message={`Kegiatan "${name.trim()}" akan dibuat sebagai draft dan bisa dibuka untuk absensi setelahnya.`}
        confirmLabel="Ya, Simpan"
        loading={loading}
        onConfirm={saveEvent}
        onCancel={() => setShowSaveDialog(false)}
      />
    </AdminLayout>
  );
}
