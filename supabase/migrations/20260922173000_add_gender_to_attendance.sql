ALTER TABLE public.attendances
  ADD COLUMN IF NOT EXISTS gender text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'attendances_gender_check'
      AND conrelid = 'public.attendances'::regclass
  ) THEN
    ALTER TABLE public.attendances
      ADD CONSTRAINT attendances_gender_check
      CHECK (gender IN ('Laki-laki', 'Perempuan'));
  END IF;
END;
$$;

DROP INDEX IF EXISTS public.idx_attendances_dedup;
CREATE UNIQUE INDEX idx_attendances_dedup
  ON public.attendances (event_id, name, village, group_name, age_category, gender);

CREATE OR REPLACE FUNCTION public.submit_attendance(
  p_event_id uuid,
  p_name text,
  p_village text,
  p_group_name text,
  p_age_category text,
  p_gender text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_event RECORD;
  v_norm_name text;
  v_norm_village text;
  v_norm_group text;
  v_token text;
  v_existing RECORD;
BEGIN
  SELECT id, name, status, event_date, start_time, end_time
  INTO v_event
  FROM public.events
  WHERE id = p_event_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Kegiatan tidak ditemukan');
  END IF;

  IF v_event.status != 'open' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Absensi untuk kegiatan ini sudah ditutup');
  END IF;

  IF p_age_category NOT IN ('SMP', 'SMA', 'PRANIKAH') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Kategori tidak valid');
  END IF;

  IF p_gender NOT IN ('Laki-laki', 'Perempuan') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Jenis kelamin tidak valid');
  END IF;

  v_norm_name := btrim(regexp_replace(p_name, '\s+', ' ', 'g'));
  v_norm_village := btrim(regexp_replace(p_village, '\s+', ' ', 'g'));
  v_norm_group := btrim(regexp_replace(p_group_name, '\s+', ' ', 'g'));

  IF v_norm_name = '' OR v_norm_village = '' OR v_norm_group = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Semua field wajib diisi');
  END IF;

  SELECT id, verification_token, checked_in_at
  INTO v_existing
  FROM public.attendances
  WHERE event_id = p_event_id
    AND name = v_norm_name
    AND village = v_norm_village
    AND group_name = v_norm_group
    AND age_category = p_age_category
    AND gender = p_gender
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
    event_id, name, village, group_name, age_category, gender, verification_token
  )
  VALUES (
    p_event_id, v_norm_name, v_norm_village, v_norm_group, p_age_category, p_gender, v_token
  );

  RETURN jsonb_build_object(
    'success', true,
    'token', v_token,
    'name', v_norm_name,
    'village', v_norm_village,
    'group_name', v_norm_group,
    'age_category', p_age_category,
    'gender', p_gender
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_attendance(uuid, text, text, text, text, text)
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
BEGIN
  SELECT a.id, a.event_id, a.name, a.village, a.group_name, a.age_category, a.gender,
         a.checked_in_at, a.verification_token, a.verified_at
  INTO v_att
  FROM public.attendances a
  WHERE a.verification_token = p_token
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'message', 'Data absensi tidak ditemukan');
  END IF;

  IF v_att.verified_at IS NULL THEN
    UPDATE public.attendances SET verified_at = now() WHERE id = v_att.id;
  END IF;

  SELECT name, event_date, start_time, end_time
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
      'checked_in_at', v_att.checked_in_at,
      'event_name', v_event.name,
      'event_date', v_event.event_date,
      'start_time', v_event.start_time,
      'end_time', v_event.end_time
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_attendance(text) TO anon, authenticated;