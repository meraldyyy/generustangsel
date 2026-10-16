import { useEffect, useState, type FormEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
 CalendarDays, Clock, CheckCircle2, AlertCircle, Loader2, ArrowRight,
} from 'lucide-react';
import { PublicLayout } from '@/components/Layout';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Card';
import { supabase } from '@/lib/supabase';
import { formatDate, formatTime, AGE_CATEGORIES, VILLAGES } from '@/lib/format';
import type { EventForAttendance, SubmitAttendanceResult, AgeCategory, Gender } from '@/types';

type PageState = 'loading' | 'not_found' | 'closed' | 'form' | 'submitting' | 'success' | 'already';

export default function AttendancePage() {
  const { eventId } = useParams<{ eventId: string }>();
  const [event, setEvent] = useState<EventForAttendance | null>(null);
  const [state, setState] = useState<PageState>('loading');
  const [result, setResult] = useState<SubmitAttendanceResult | null>(null);

  // form fields
  const [name, setName] = useState('');
  const [village, setVillage] = useState('');
  const [groupName, setGroupName] = useState('');
  const [category, setCategory] = useState<AgeCategory | ''>('');
  const [gender, setGender] = useState<Gender | ''>('');
  const [age, setAge] = useState('');
  const [occupation, setOccupation] = useState('');
  const [otherOccupation, setOtherOccupation] = useState('');
  const [education, setEducation] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isSpecialEvent = event?.event_type === 'PRANIKAH' || event?.event_type === 'USIA NIKAH';

  useEffect(() => {
    if (!eventId) return;
    async function load() {
      const { data, error } = await supabase.rpc('get_event_for_attendance', { p_event_id: eventId });
      if (error || !data || data.length === 0) {
        setState('not_found');
        return;
      }
      const eventData = data[0] as EventForAttendance;
      setEvent(eventData);
      if (eventData.status !== 'open') {
        setState('closed');
      } else {
        setState('form');
      }
    }
    load();
  }, [eventId]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Nama wajib diisi';
    if (!village.trim()) e.village = 'Desa wajib diisi';
    if (!groupName.trim()) e.groupName = 'Kelompok wajib diisi';
    if (!gender) e.gender = 'Jenis kelamin wajib dipilih';
    if (isSpecialEvent) {
      if (!Number.isInteger(Number(age)) || Number(age) <= 0) e.age = 'Usia harus berupa angka lebih dari 0';
      if (!occupation) e.occupation = 'Pekerjaan wajib dipilih';
      if (occupation === 'Lainnya' && !otherOccupation.trim()) {
        e.otherOccupation = 'Pekerjaan lainnya wajib diisi';
      }
      if (!education) e.education = 'Pendidikan wajib dipilih';
    } else {
      if (!category) e.category = 'Kategori wajib dipilih';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate() || !eventId) return;
    setState('submitting');

    const { data, error } = isSpecialEvent
      ? await supabase.rpc('submit_special_attendance', {
          p_event_id: eventId,
          p_name: name,
          p_village: village,
          p_group_name: groupName,
          p_gender: gender,
          p_age: Number(age),
          p_occupation: occupation === 'Lainnya' ? otherOccupation.trim() : occupation,
          p_education: education,
        })
      : await supabase.rpc('submit_attendance', {
          p_event_id: eventId,
          p_name: name,
          p_village: village,
          p_group_name: groupName,
          p_age_category: category,
          p_gender: gender,
        });

    if (error) {
      setState('form');

      const message = error.message.includes('Could not find the function')
        ? 'Fungsi absensi di database belum tersedia. Pastikan migrasi Supabase terbaru sudah dijalankan.'
        : error.message || 'Terjadi kesalahan. Silakan coba lagi.';

      setErrors({ form: message });
      return;
    }

    const res = data as SubmitAttendanceResult;
    setResult(res);

    if (res.already_exists) {
      setState('already');
    } else if (res.success) {
      setState('success');
    } else {
      setState('form');
      setErrors({ form: res.error ?? 'Terjadi kesalahan' });
    }
  };

  // ===== LOADING =====
  if (state === 'loading') {
    return (
      <PublicLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Spinner size={32} />
        </div>
      </PublicLayout>
    );
  }

  // ===== NOT FOUND =====
  if (state === 'not_found') {
    return (
      <PublicLayout>
        <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
          <AlertCircle size={48} className="mb-4 text-gray-300" />
          <h1 className="text-xl font-bold text-gray-900">Kegiatan Tidak Ditemukan</h1>
          <p className="mt-2 text-gray-500">QR Code yang Anda scan tidak valid atau kegiatan telah dihapus.</p>
        </div>
      </PublicLayout>
    );
  }

  // ===== CLOSED =====
  if (state === 'closed') {
    return (
      <PublicLayout>
        <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-500">
            <AlertCircle size={32} />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Absensi Ditutup</h1>
          <p className="mt-2 text-gray-500">Absensi untuk kegiatan ini sudah ditutup.</p>
        </div>
      </PublicLayout>
    );
  }

  // ===== ALREADY ATTENDED =====
  if (state === 'already' && result?.token) {
    return (
      <PublicLayout>
        <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 text-amber-500">
            <AlertCircle size={32} />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Anda Sudah Melakukan Absensi</h1>
          <p className="mt-2 mb-6 text-gray-500">Anda telah tercatat hadir di kegiatan ini.</p>
          <Link to={`/verify/${result.token}`}>
            <Button size="lg">
              Lihat Bukti Absensi
              <ArrowRight size={18} />
            </Button>
          </Link>
        </div>
      </PublicLayout>
    );
  }

  // ===== SUCCESS =====
  if (state === 'success' && result?.token) {
    return (
      <PublicLayout>
        <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-500">
            <CheckCircle2 size={32} />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Absensi Berhasil!</h1>
          <p className="mt-2 mb-6 text-gray-500">Alhamdulillah Jazaakumullahu Khoiro, kehadiran Anda telah tercatat.</p>
          <Link to={`/verify/${result.token}`}>
            <Button size="lg">
              Lihat Bukti Absensi
              <ArrowRight size={18} />
            </Button>
          </Link>
        </div>
      </PublicLayout>
    );
  }

  // ===== FORM =====
  return (
    <PublicLayout>
      <div className="mb-6 flex items-center justify-center gap-2">
       
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

      {event && (
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h1 className="text-xl font-bold text-gray-900">{event.name}</h1>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-blue-700">{event.event_type}</p>
          <div className="mt-3 space-y-1.5 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <CalendarDays size={16} className="text-gray-400" />
              {formatDate(event.event_date)}
            </div>
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-gray-400" />
              {formatTime(event.start_time)} - {formatTime(event.end_time)}
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          {isSpecialEvent ? 'Konfirmasi Kehadiran' : 'Isi Data Absensi'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nama"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nama lengkap"
            error={errors.name}
            disabled={state === 'submitting'}
          />
          {isSpecialEvent && (
            <Select
              label="Jenis Kelamin"
              required
              value={gender}
              onChange={(e) => setGender(e.target.value as Gender)}
              error={errors.gender}
              disabled={state === 'submitting'}
            >
              <option value="">Pilih jenis kelamin...</option>
              <option value="Laki-laki">Laki-laki</option>
              <option value="Perempuan">Perempuan</option>
            </Select>
          )}
          {isSpecialEvent && (
            <Input
              label="Kelompok"
              required
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Nomor/nama kelompok"
              error={errors.groupName}
              disabled={state === 'submitting'}
            />
          )}
          <Select
            label="Desa"
            required
            value={village}
            onChange={(e) => setVillage(e.target.value)}
            error={errors.village}
            disabled={state === 'submitting'}
          >
            <option value="">Pilih desa...</option>
            {VILLAGES.map((villageName) => (
              <option key={villageName} value={villageName}>{villageName}</option>
            ))}
          </Select>
          {!isSpecialEvent && (
            <Input
              label="Kelompok"
              required
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Nomor/nama kelompok"
              error={errors.groupName}
              disabled={state === 'submitting'}
            />
          )}
          {isSpecialEvent ? (
            <>
              <Input
                label="Usia"
                type="number"
                min="1"
                step="1"
                required
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="Usia dalam tahun"
                error={errors.age}
                disabled={state === 'submitting'}
              />
              <Select
                label="Pekerjaan"
                required
                value={occupation}
                onChange={(e) => setOccupation(e.target.value)}
                error={errors.occupation}
                disabled={state === 'submitting'}
              >
                <option value="">Pilih pekerjaan...</option>
                <option value="Guru">Guru</option>
                <option value="Karyawan swasta">Karyawan swasta</option>
                <option value="Wirausaha">Wirausaha</option>
                <option value="PNS">PNS</option>
                <option value="Tidak/belum bekerja">Tidak/belum bekerja</option>
                <option value="Lainnya">Lainnya</option>
              </Select>
              {occupation === 'Lainnya' && (
                <Input
                  label="Pekerjaan lainnya"
                  required
                  maxLength={100}
                  value={otherOccupation}
                  onChange={(e) => setOtherOccupation(e.target.value)}
                  placeholder="Tulis pekerjaan"
                  error={errors.otherOccupation}
                  disabled={state === 'submitting'}
                />
              )}
              <Select
                label="Pendidikan Terakhir"
                required
                value={education}
                onChange={(e) => setEducation(e.target.value)}
                error={errors.education}
                disabled={state === 'submitting'}
              >
                <option value="">Pilih pendidikan...</option>
                <option value="SMP">SMP</option>
                <option value="SMA">SMA</option>
                <option value="Undergraduate">Undergraduate</option>
                <option value="D3">D3</option>
                <option value="D4">D4</option>
                <option value="S1">S1</option>
                <option value="S2">S2</option>
              </Select>
            </>
          ) : (
            <>
              <Select
                label="Kategori"
                required
                value={category}
                onChange={(e) => setCategory(e.target.value as AgeCategory)}
                error={errors.category}
                disabled={state === 'submitting'}
              >
                <option value="">Pilih kategori...</option>
                {AGE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </Select>
            </>
          )}
          {!isSpecialEvent && (
            <Select
              label="Jenis Kelamin"
              required
              value={gender}
              onChange={(e) => setGender(e.target.value as Gender)}
              error={errors.gender}
              disabled={state === 'submitting'}
            >
              <option value="">Pilih jenis kelamin...</option>
              <option value="Laki-laki">Laki-laki</option>
              <option value="Perempuan">Perempuan</option>
            </Select>
          )}

          {errors.form && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{errors.form}</div>
          )}

          <Button type="submit" size="lg" className="w-full" disabled={state === 'submitting'}>
            {state === 'submitting' ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Memproses...
              </>
            ) : (
              isSpecialEvent ? 'KONFIRMASI KEHADIRAN' : 'ABSEN SEKARANG'
            )}
          </Button>
        </form>
      </div>
    </PublicLayout>
  );
}
