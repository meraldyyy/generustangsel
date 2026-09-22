import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const authorization = request.headers.get('Authorization');

  if (!supabaseUrl || !anonKey || !serviceRoleKey || !authorization) {
    return json({ error: 'Konfigurasi server atau sesi tidak tersedia' }, 500);
  }

  const token = authorization.replace(/^Bearer\s+/i, '');
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: userData, error: userError } = await adminClient.auth.getUser(token);

  if (userError || !userData.user) return json({ error: 'Sesi tidak valid' }, 401);

  const callerId = userData.user.id;
  const { data: callerProfile } = await adminClient
    .from('admin_profiles')
    .select('id, is_active')
    .eq('id', callerId)
    .eq('is_active', true)
    .maybeSingle();

  if (!callerProfile) return json({ error: 'Akses admin tidak aktif' }, 403);

  const body = request.method === 'GET' ? { action: 'list' } : await request.json();

  if (body.action === 'list') {
    const [{ data: profiles, error: profileError }, { data: users, error: usersError }] = await Promise.all([
      adminClient.from('admin_profiles').select('id, name, email, is_active, created_at, updated_at').order('created_at'),
      adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ]);

    if (profileError || usersError) return json({ error: profileError?.message ?? usersError?.message }, 500);

    const usersById = new Map(users.users.map((user) => [user.id, user]));
    return json({
      admins: (profiles ?? []).map((profile) => ({
        ...profile,
        email: usersById.get(profile.id)?.email ?? profile.email,
        last_sign_in_at: usersById.get(profile.id)?.last_sign_in_at ?? null,
      })),
    });
  }

  if (body.action === 'create') {
    const email = String(body.email ?? '').trim().toLowerCase();
    const name = String(body.name ?? '').trim();
    const password = String(body.password ?? '');
    if (!email || !name || password.length < 6) return json({ error: 'Nama, email, dan password minimal 6 karakter wajib diisi' }, 400);

    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createError || !created.user) return json({ error: createError?.message ?? 'Akun gagal dibuat' }, 400);

    const { error: profileError } = await adminClient.from('admin_profiles').insert({
      id: created.user.id,
      name,
      email,
      is_active: true,
    });
    if (profileError) {
      await adminClient.auth.admin.deleteUser(created.user.id);
      return json({ error: profileError.message }, 400);
    }
    return json({ success: true });
  }

  const targetId = String(body.id ?? '');
  if (!targetId) return json({ error: 'ID admin wajib diisi' }, 400);
  if (targetId === callerId && (body.action === 'delete' || body.is_active === false)) {
    return json({ error: 'Anda tidak dapat menonaktifkan atau menghapus akun sendiri' }, 400);
  }

  const { data: target, error: targetError } = await adminClient
    .from('admin_profiles')
    .select('id, is_active')
    .eq('id', targetId)
    .maybeSingle();
  if (targetError || !target) return json({ error: 'Admin tidak ditemukan' }, 404);

  if ((body.action === 'deactivate' || body.is_active === false || body.action === 'delete') && target.is_active) {
    const { count } = await adminClient
      .from('admin_profiles')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true);
    if ((count ?? 0) <= 1) return json({ error: 'Sistem harus memiliki minimal satu admin aktif' }, 400);
  }

  if (body.action === 'delete') {
    const { error } = await adminClient.auth.admin.deleteUser(targetId);
    if (error) return json({ error: error.message }, 400);
    return json({ success: true });
  }

  if (body.action === 'update' || body.action === 'activate' || body.action === 'deactivate') {
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.action === 'activate') updates.is_active = true;
    if (body.action === 'deactivate') updates.is_active = false;
    if (body.action === 'update') {
      const email = String(body.email ?? '').trim().toLowerCase();
      const name = String(body.name ?? '').trim();
      if (!email || !name) return json({ error: 'Nama dan email wajib diisi' }, 400);
      updates.name = name;
      updates.email = email;
      const { error: authError } = await adminClient.auth.admin.updateUserById(targetId, { email });
      if (authError) return json({ error: authError.message }, 400);
    }
    const { error } = await adminClient.from('admin_profiles').update(updates).eq('id', targetId);
    if (error) return json({ error: error.message }, 400);
    return json({ success: true });
  }

  return json({ error: 'Aksi tidak dikenali' }, 400);
});
