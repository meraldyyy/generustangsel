import { useEffect, useState, type FormEvent } from 'react';
import { Pencil, Plus, ShieldCheck, Trash2, UserRound } from 'lucide-react';
import { AdminLayout } from '@/components/Layout';
import { Button } from '@/components/ui/Button';
import { Card, EmptyState, Spinner } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { supabase } from '@/lib/supabase';
import type { AdminProfile } from '@/types';

interface AdminForm {
  name: string;
  email: string;
  password: string;
}

const emptyForm: AdminForm = { name: '', email: '', password: '' };

async function callAdminFunction(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('admin-management', { body });
  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes('failed to send') || message.includes('404') || message.includes('not found')) {
      throw new Error('Fitur kelola admin belum aktif di Supabase. Deploy Edge Function admin-management terlebih dahulu.');
    }
    throw new Error(error.message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export default function AdminsPage() {
  const [admins, setAdmins] = useState<AdminProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState<AdminForm>(emptyForm);
  const [editing, setEditing] = useState<AdminProfile | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<{ admin: AdminProfile; action: 'deactivate' | 'activate' | 'delete' } | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const loadAdmins = async () => {
    setLoading(true);
    setError(null);
    const { data, error: loadError } = await supabase
      .from('admin_profiles')
      .select('id, name, email, is_active, created_at, updated_at')
      .order('created_at', { ascending: true });

    if (loadError) {
      setError(loadError.message);
    } else {
      setAdmins((data ?? []).map((admin) => ({ ...admin, last_sign_in_at: null })));
    }
    setLoading(false);
  };

  useEffect(() => {
    void loadAdmins();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setShowForm(true);
  };

  const openEdit = (admin: AdminProfile) => {
    setEditing(admin);
    setForm({ name: admin.name, email: admin.email, password: '' });
    setFormError(null);
    setShowForm(true);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    if (!form.name.trim() || !form.email.trim() || (!editing && form.password.length < 6)) {
      setFormError(editing ? 'Nama dan email wajib diisi' : 'Nama, email, dan password minimal 6 karakter wajib diisi');
      return;
    }

    setSaving(true);
    try {
      await callAdminFunction(editing
        ? { action: 'update', id: editing.id, name: form.name, email: form.email }
        : { action: 'create', name: form.name, email: form.email, password: form.password });
      setShowForm(false);
      await loadAdmins();
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : 'Perubahan gagal disimpan');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirm = async () => {
    if (!confirmTarget) return;
    setConfirmLoading(true);
    try {
      await callAdminFunction({ action: confirmTarget.action, id: confirmTarget.admin.id });
      setConfirmTarget(null);
      await loadAdmins();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Aksi admin gagal');
    } finally {
      setConfirmLoading(false);
    }
  };

  return (
    <AdminLayout>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Kelola Admin</h1>
          <p className="mt-1 text-sm text-gray-500">Kelola akun yang dapat mengakses sistem.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus size={18} />
          Tambah Admin
        </Button>
      </div>

      {error && <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-20"><Spinner size={32} /></div>
      ) : admins.length === 0 ? (
        <Card><EmptyState icon={<UserRound size={48} />} title="Belum ada profil admin" /></Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 text-left">
                <tr>
                  <th className="px-4 py-3 font-semibold text-gray-600">Nama</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Email</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Status</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Dibuat pada</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Terakhir login</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {admins.map((admin) => (
                  <tr key={admin.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{admin.name}</td>
                    <td className="px-4 py-3 text-gray-600">{admin.email}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${admin.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                        {admin.is_active ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{new Date(admin.created_at).toLocaleString('id-ID')}</td>
                    <td className="px-4 py-3 text-gray-600">{admin.last_sign_in_at ? new Date(admin.last_sign_in_at).toLocaleString('id-ID') : '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="secondary" onClick={() => openEdit(admin)} title="Edit admin">
                          <Pencil size={15} />
                          Edit
                        </Button>
                        <Button size="sm" variant={admin.is_active ? 'danger' : 'success'} onClick={() => setConfirmTarget({ admin, action: admin.is_active ? 'deactivate' : 'activate' })}>
                          <ShieldCheck size={15} />
                          {admin.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setConfirmTarget({ admin, action: 'delete' })} title="Hapus admin">
                          <Trash2 size={15} className="text-red-600" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !saving && setShowForm(false)}>
          <form className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onSubmit={handleSubmit} onClick={(event) => event.stopPropagation()}>
            <h2 className="text-xl font-bold text-gray-900">{editing ? 'Edit Admin' : 'Tambah Admin'}</h2>
            <p className="mt-1 text-sm text-gray-500">{editing ? 'Perbarui identitas akun admin.' : 'Buat akun Supabase Auth baru untuk admin.'}</p>
            <div className="mt-5 space-y-4">
              <Input label="Nama" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
              <Input label="Email" type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
              {!editing && <Input label="Password" type="password" minLength={6} required value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />}
              {formError && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{formError}</div>}
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => setShowForm(false)} disabled={saving}>Batal</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan'}</Button>
            </div>
          </form>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirmTarget)}
        title={confirmTarget?.action === 'delete' ? 'Hapus admin?' : confirmTarget?.action === 'deactivate' ? 'Nonaktifkan admin?': 'Aktifkan admin?'}
        message={confirmTarget?.action === 'delete'
          ? `Akun ${confirmTarget?.admin.email} akan dihapus dari Supabase Auth.`
          : `Status akun ${confirmTarget?.admin.email} akan diubah.`}
        confirmLabel={confirmTarget?.action === 'delete' ? 'Ya, Hapus' : 'Ya, Ubah'}
        confirmVariant={confirmTarget?.action === 'activate' ? 'primary' : 'danger'}
        loading={confirmLoading}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmTarget(null)}
      />
    </AdminLayout>
  );
}
