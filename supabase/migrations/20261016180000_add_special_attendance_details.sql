ALTER TABLE public.attendances
  ALTER COLUMN age_category DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS age integer,
  ADD COLUMN IF NOT EXISTS occupation text,
  ADD COLUMN IF NOT EXISTS education text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'attendances_age_positive_check'
      AND conrelid = 'public.attendances'::regclass
  ) THEN
    ALTER TABLE public.attendances
      ADD CONSTRAINT attendances_age_positive_check CHECK (age IS NULL OR age > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'attendances_occupation_check'
      AND conrelid = 'public.attendances'::regclass
  ) THEN
    ALTER TABLE public.attendances
      ADD CONSTRAINT attendances_occupation_check
      CHECK (occupation IS NULL OR occupation IN ('Karyawan swasta', 'Tidak/belum bekerja'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'attendances_education_check'
      AND conrelid = 'public.attendances'::regclass
  ) THEN
    ALTER TABLE public.attendances
      ADD CONSTRAINT attendances_education_check
      CHECK (education IS NULL OR education IN ('SMP', 'SMA', 'D3', 'D4', 'S1', 'S2'));
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_attendances_special_dedup
  ON public.attendances (event_id, name, village, group_name, gender, age, occupation, education)
  WHERE age IS NOT NULL;

DROP FUNCTION IF EXISTS public.submit_event_attendance_summary(uuid, text, text, integer);

CREATE OR REPLACE FUNCTION public.submit_special_attendance(
  p_event_id uuid,
  p_name text,
  p_village text,
  p_group_name text,
  p_gender text,
  p_age integer,
  p_occupation text,
  p_education text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_event RECORD;
  v_name text;
  v_village text;
  v_group text;
  v_existing RECORD;
  v_token text;
  v_attendance_id uuid;
BEGIN
  SELECT id, status, event_type
  INTO v_event
  FROM public.events
  WHERE id = p_event_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Kegiatan tidak ditemukan');
  END IF;

  IF v_event.status != 'open' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Absensi untuk kegiatan ini sudah ditutup');
  END IF;

  IF v_event.event_type NOT IN ('PRANIKAH', 'USIA NIKAH') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Kegiatan ini tidak menggunakan form khusus');
  END IF;

  v_name := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  v_village := btrim(regexp_replace(coalesce(p_village, ''), '\s+', ' ', 'g'));
  v_group := btrim(regexp_replace(coalesce(p_group_name, ''), '\s+', ' ', 'g'));

  IF v_name = '' OR v_village = '' OR v_group = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nama, desa, dan kelompok wajib diisi');
  END IF;

  IF p_gender IS NULL OR p_gender NOT IN ('Laki-laki', 'Perempuan') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Jenis kelamin tidak valid');
  END IF;

  IF p_age IS NULL OR p_age <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usia harus lebih dari 0');
  END IF;

  IF p_occupation IS NULL OR p_occupation NOT IN ('Karyawan swasta', 'Tidak/belum bekerja') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pekerjaan tidak valid');
  END IF;

  IF p_education IS NULL OR p_education NOT IN ('SMP', 'SMA', 'D3', 'D4', 'S1', 'S2') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pendidikan tidak valid');
  END IF;

  SELECT verification_token
  INTO v_existing
  FROM public.attendances
  WHERE event_id = p_event_id
    AND name = v_name
    AND village = v_village
    AND group_name = v_group
    AND gender = p_gender
    AND age = p_age
    AND occupation = p_occupation
    AND education = p_education
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'already_exists', true,
      'token', v_existing.verification_token
    );
  END IF;

  v_token := encode(gen_random_bytes(6), 'hex');

  INSERT INTO public.attendances (
    event_id, name, village, group_name, age_category, gender, age, occupation, education, verification_token
  )
  VALUES (
    p_event_id, v_name, v_village, v_group, NULL, p_gender, p_age, p_occupation, p_education, v_token
  )
  ON CONFLICT (event_id, name, village, group_name, gender, age, occupation, education)
    WHERE age IS NOT NULL
  DO NOTHING
  RETURNING id INTO v_attendance_id;

  IF v_attendance_id IS NULL THEN
    SELECT verification_token
    INTO v_existing
    FROM public.attendances
    WHERE event_id = p_event_id
      AND name = v_name
      AND village = v_village
      AND group_name = v_group
      AND gender = p_gender
      AND age = p_age
      AND occupation = p_occupation
      AND education = p_education
    LIMIT 1;

    RETURN jsonb_build_object(
      'success', false,
      'already_exists', true,
      'token', v_existing.verification_token
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'token', v_token,
    'name', v_name,
    'village', v_village,
    'group_name', v_group,
    'gender', p_gender,
    'age', p_age,
    'occupation', p_occupation,
    'education', p_education
  );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_special_attendance(uuid, text, text, text, text, integer, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_special_attendance(uuid, text, text, text, text, integer, text, text)
  TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.verify_attendance(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_att RECORD;
  v_event RECORD;
  v_verified_by uuid := NULL;
  v_verified_by_name text := NULL;
BEGIN
  SELECT a.id, a.event_id, a.name, a.village, a.group_name, a.age_category, a.gender,
         a.age, a.occupation, a.education, a.checked_in_at, a.verification_token,
         a.verified_at, a.verified_by
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

  IF v_att.verified_by IS NOT NULL THEN
    SELECT ap.name INTO v_verified_by_name
    FROM public.admin_profiles ap
    WHERE ap.id = v_att.verified_by;
  END IF;

  SELECT name, event_date, start_time, end_time, event_type
  INTO v_event
  FROM public.events
  WHERE id = v_att.event_id;

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
      'age', v_att.age,
      'occupation', v_att.occupation,
      'education', v_att.education,
      'checked_in_at', v_att.checked_in_at,
      'verified_by', v_att.verified_by,
      'verified_by_name', v_verified_by_name,
      'event_name', v_event.name,
      'event_type', v_event.event_type,
      'event_date', v_event.event_date,
      'start_time', v_event.start_time,
      'end_time', v_event.end_time
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_attendance(text) TO anon, authenticated;
