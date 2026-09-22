CREATE TABLE IF NOT EXISTS public.admin_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.admin_profiles (id, name, email)
SELECT
  id,
  COALESCE(NULLIF(raw_user_meta_data->>'name', ''), email),
  email
FROM auth.users
WHERE email IS NOT NULL
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_active_admin(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_profiles
    WHERE id = p_user_id
      AND is_active = true
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_active_admin(uuid) TO authenticated;

ALTER TABLE public.admin_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_admin_profiles_active_admin" ON public.admin_profiles;
CREATE POLICY "select_admin_profiles_active_admin"
  ON public.admin_profiles FOR SELECT
  TO authenticated
  USING (public.is_active_admin());

DROP POLICY IF EXISTS "manage_admin_profiles_active_admin" ON public.admin_profiles;
CREATE POLICY "manage_admin_profiles_active_admin"
  ON public.admin_profiles FOR ALL
  TO authenticated
  USING (public.is_active_admin())
  WITH CHECK (public.is_active_admin());

CREATE OR REPLACE FUNCTION public.protect_last_active_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD.is_active AND NOT EXISTS (
    SELECT 1 FROM public.admin_profiles WHERE id <> OLD.id AND is_active
  ) THEN
    RAISE EXCEPTION 'Tidak dapat menghapus admin aktif terakhir';
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.is_active AND NOT NEW.is_active AND NOT EXISTS (
    SELECT 1 FROM public.admin_profiles WHERE id <> OLD.id AND is_active
  ) THEN
    RAISE EXCEPTION 'Tidak dapat menonaktifkan admin aktif terakhir';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS protect_last_active_admin_trigger ON public.admin_profiles;
CREATE TRIGGER protect_last_active_admin_trigger
  BEFORE UPDATE OR DELETE ON public.admin_profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_last_active_admin();

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.admin_profiles(id) ON DELETE SET NULL;

ALTER TABLE public.attendances
  ADD COLUMN IF NOT EXISTS verified_by uuid REFERENCES public.admin_profiles(id) ON DELETE SET NULL;

DROP POLICY IF EXISTS "select_events_authenticated" ON public.events;
CREATE POLICY "select_events_active_admin" ON public.events FOR SELECT
  TO authenticated USING (public.is_active_admin());

DROP POLICY IF EXISTS "insert_events_authenticated" ON public.events;
CREATE POLICY "insert_events_active_admin" ON public.events FOR INSERT
  TO authenticated
  WITH CHECK (public.is_active_admin() AND created_by = auth.uid());

DROP POLICY IF EXISTS "update_events_authenticated" ON public.events;
CREATE POLICY "update_events_active_admin" ON public.events FOR UPDATE
  TO authenticated
  USING (public.is_active_admin())
  WITH CHECK (public.is_active_admin() AND updated_by = auth.uid());

DROP POLICY IF EXISTS "delete_events_authenticated" ON public.events;
CREATE POLICY "delete_events_active_admin" ON public.events FOR DELETE
  TO authenticated USING (public.is_active_admin());

DROP POLICY IF EXISTS "select_attendances_authenticated" ON public.attendances;
CREATE POLICY "select_attendances_active_admin" ON public.attendances FOR SELECT
  TO authenticated USING (public.is_active_admin());

CREATE OR REPLACE FUNCTION public.verify_attendance(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_att record;
  v_event record;
  v_verified_by uuid := NULL;
  v_verified_by_name text := NULL;
BEGIN
  SELECT a.id, a.event_id, a.name, a.village, a.group_name, a.age_category, a.gender,
         a.checked_in_at, a.verification_token, a.verified_at, a.verified_by
  INTO v_att
  FROM public.attendances a
  WHERE a.verification_token = p_token
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'message', 'Data absensi tidak ditemukan');
  END IF;

  IF public.is_active_admin() AND v_att.verified_at IS NULL THEN
    v_verified_by := auth.uid();
    SELECT ap.name INTO v_verified_by_name
    FROM public.admin_profiles ap
    WHERE ap.id = v_verified_by;

    UPDATE public.attendances
    SET verified_at = now(), verified_by = v_verified_by
    WHERE id = v_att.id;
  END IF;

  SELECT name, event_date, start_time, end_time
  INTO v_event
  FROM public.events
  WHERE id = v_att.event_id;

  IF v_att.verified_by IS NOT NULL THEN
    SELECT ap.name INTO v_verified_by_name
    FROM public.admin_profiles ap
    WHERE ap.id = v_att.verified_by;
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'already_verified', v_att.verified_at IS NOT NULL,
    'data', jsonb_build_object(
      'token', v_att.verification_token,
      'name', v_att.name,
      'village', v_att.village,
      'group_name', v_att.group_name,
      'age_category', v_att.age_category,
      'gender', v_att.gender,
      'checked_in_at', v_att.checked_in_at,
      'verified_by', v_att.verified_by,
      'verified_by_name', v_verified_by_name,
      'event_name', v_event.name,
      'event_date', v_event.event_date,
      'start_time', v_event.start_time,
      'end_time', v_event.end_time
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_attendance(text) TO anon, authenticated;
GRANT SELECT ON public.admin_profiles TO authenticated;
