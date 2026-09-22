import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarCheck, CalendarClock, CalendarPlus, ArrowRight, CircleDot } from 'lucide-react';
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

export default function DashboardPage() {
  const [stats, setStats] = useState({ totalEvents: 0, activeEvents: 0, totalAttendances: 0 });
  const [recentEvents, setRecentEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [{ count: totalEvents }, { count: activeEvents }, { count: totalAttendances }, { data: events }] =
        await Promise.all([
          supabase.from('events').select('*', { count: 'exact', head: true }),
          supabase.from('events').select('*', { count: 'exact', head: true }).eq('status', 'open'),
          supabase.from('attendances').select('*', { count: 'exact', head: true }),
          supabase.from('events').select('*').order('created_at', { ascending: false }).limit(5),
        ]);

      setStats({
        totalEvents: totalEvents ?? 0,
        activeEvents: activeEvents ?? 0,
        totalAttendances: totalAttendances ?? 0,
      });
      setRecentEvents(events ?? []);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex justify-center py-20">
          <Spinner size={32} />
        </div>
      </AdminLayout>
    );
  }

  const statCards = [
    { label: 'Total Kegiatan', value: stats.totalEvents, icon: CalendarClock, color: 'text-blue-600 bg-blue-50' },
    { label: 'Kegiatan Aktif', value: stats.activeEvents, icon: CircleDot, color: 'text-emerald-600 bg-emerald-50' },
  ];
  
  return (
    <AdminLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">Ringkasan sistem absensi</p>
        </div>
        <Link to="/events/create">
          <Button>
            <CalendarPlus size={18} />
            <span className="hidden sm:inline">Buat Kegiatan</span>
          </Button>
        </Link>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {statCards.map((stat) => (
          <Card key={stat.label} className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">{stat.label}</p>
                <p className="mt-2 text-3xl font-bold text-gray-900">{stat.value}</p>
              </div>
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${stat.color}`}>
                <stat.icon size={24} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Kegiatan Terbaru</h2>
          <Link to="/events" className="text-sm font-semibold text-blue-600 hover:text-blue-700">
            Lihat semua
          </Link>
        </div>

        {recentEvents.length === 0 ? (
          <Card className="p-6">
            <EmptyState
              icon={<CalendarCheck size={48} />}
              title="Belum ada kegiatan"
              message="Buat kegiatan pertama untuk memulai absensi"
            />
            <div className="flex justify-center pb-4">
              <Link to="/events/create">
                <Button>
                  <CalendarPlus size={18} />
                  Buat Kegiatan
                </Button>
              </Link>
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {recentEvents.map((event) => (
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
                      <p className="mt-1 text-sm text-gray-500">
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
      </div>
    </AdminLayout>
  );
}
