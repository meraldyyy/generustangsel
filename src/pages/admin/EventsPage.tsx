import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarPlus, CalendarCheck, ArrowRight, Search } from 'lucide-react';
import { AdminLayout } from '@/components/Layout';
import { Card, Spinner, EmptyState } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import { formatDateShort, formatTime } from '@/lib/format';
import type { Event } from '@/types';

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

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('events').select('*').order('created_at', { ascending: false });
      setEvents(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = events.filter((e) => e.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <AdminLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Kegiatan</h1>
          <p className="mt-1 text-sm text-gray-500">Kelola semua kegiatan absensi</p>
        </div>
        <Link to="/events/create">
          <Button>
            <CalendarPlus size={18} />
            <span className="hidden sm:inline">Buat Kegiatan</span>
          </Button>
        </Link>
      </div>

      <div className="mb-4 relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Cari kegiatan..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-gray-900 placeholder-gray-400 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner size={32} />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-6">
          <EmptyState
            icon={<CalendarCheck size={48} />}
            title={search ? 'Tidak ada kegiatan yang cocok' : 'Belum ada kegiatan'}
            message={search ? 'Coba kata kunci lain' : 'Buat kegiatan pertama untuk memulai'}
          />
          {!search && (
            <div className="flex justify-center pb-4">
              <Link to="/events/create">
                <Button>
                  <CalendarPlus size={18} />
                  Buat Kegiatan
                </Button>
              </Link>
            </div>
          )}
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((event) => (
            <Link key={event.id} to={`/events/${event.id}`}>
              <Card className="cursor-pointer p-4 transition-shadow hover:shadow-md">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate font-semibold text-gray-900">{event.name}</h3>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${statusColors[event.status]}`}>
                        {statusLabels[event.status]}
                      </span>
                    </div>
                    {event.description && (
                      <p className="mt-1 truncate text-sm text-gray-500">{event.description}</p>
                    )}
                    <p className="mt-1 text-sm text-gray-400">
                      {formatDateShort(event.event_date)} • {formatTime(event.start_time)} - {formatTime(event.end_time)}
                    </p>
                  </div>
                  <ArrowRight size={20} className="shrink-0 text-gray-400" />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}
