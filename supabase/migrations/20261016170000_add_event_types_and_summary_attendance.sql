ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS event_type text NOT NULL DEFAULT 'UMUM';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'events_event_type_check'
      AND conrelid = 'public.events'::regclass
  ) THEN
    ALTER TABLE public.events
      ADD CONSTRAINT events_event_type_check
      CHECK (event_type IN ('UMUM', 'PRANIKAH', 'USIA NIKAH'));
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.event_attendance_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  village text NOT NULL,
  gender text NOT NULL CHECK (gender IN ('Laki-laki', 'Perempuan')),
  total integer NOT NULL CHECK (total > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, village, gender)
);

ALTER TABLE public.event_attendance_summaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_event_attendance_summaries_authenticated"
  ON public.event_attendance_summaries;
CREATE POLICY "select_event_attendance_summaries_authenticated"
  ON public.event_attendance_summaries FOR SELECT
  TO authenticated USING (true);

REVOKE ALL ON public.event_attendance_summaries FROM anon, authenticated;
GRANT SELECT ON public.event_attendance_summaries TO authenticated;

DROP FUNCTION IF EXISTS public.get_event_for_attendance(uuid);
CREATE FUNCTION public.get_event_for_attendance(p_event_id uuid)
RETURNS TABLE (
  id uuid,
  name text,
  event_date date,
  start_time time,
  end_time time,
  status text,
  event_type text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.id, e.name, e.event_date, e.start_time, e.end_time, e.status, e.event_type
  FROM public.events e
  WHERE e.id = p_event_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_event_for_attendance(uuid) TO anon, authenticated;

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
  SELECT id, name, status, event_type
  INTO v_event
  FROM public.events
  WHERE id = p_event_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Kegiatan tidak ditemukan');
  END IF;

  IF v_event.status != 'open' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Absensi untuk kegiatan ini sudah ditutup');
  END IF;

  IF v_event.event_type != 'UMUM' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Gunakan form rekap untuk kegiatan ini');
  END IF;

  IF p_age_category IS NULL OR p_age_category NOT IN ('SMP', 'SMA', 'PRANIKAH') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Kategori tidak valid');
  END IF;

  IF p_gender IS NULL OR p_gender NOT IN ('Laki-laki', 'Perempuan') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Jenis kelamin tidak valid');
  END IF;

  v_norm_name := btrim(regexp_replace(p_name, '\s+', ' ', 'g'));
  v_norm_village := btrim(regexp_replace(p_village, '\s+', ' ', 'g'));
  v_norm_group := btrim(regexp_replace(p_group_name, '\s+', ' ', 'g'));

  IF v_norm_name IS NULL OR v_norm_name = ''
    OR v_norm_village IS NULL OR v_norm_village = ''
    OR v_norm_group IS NULL OR v_norm_group = '' THEN
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

REVOKE ALL ON FUNCTION public.submit_attendance(uuid, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_attendance(uuid, text, text, text, text, text)
  TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.submit_event_attendance_summary(
  p_event_id uuid,
  p_village text,
  p_gender text,
  p_total integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event RECORD;
  v_village text;
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
    RETURN jsonb_build_object('success', false, 'error', 'Kegiatan ini tidak menggunakan form rekap');
  END IF;

  v_village := btrim(regexp_replace(p_village, '\s+', ' ', 'g'));
  IF v_village IS NULL OR v_village = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Desa wajib dipilih');
  END IF;

  IF p_gender IS NULL OR p_gender NOT IN ('Laki-laki', 'Perempuan') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Jenis kelamin tidak valid');
  END IF;

  IF p_total IS NULL OR p_total <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Jumlah peserta harus lebih dari 0');
  END IF;

  INSERT INTO public.event_attendance_summaries (event_id, village, gender, total)
  VALUES (p_event_id, v_village, p_gender, p_total)
  ON CONFLICT (event_id, village, gender)
  DO UPDATE SET total = public.event_attendance_summaries.total + EXCLUDED.total;

  RETURN jsonb_build_object(
    'success', true,
    'village', v_village,
    'gender', p_gender,
    'total', p_total
  );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_event_attendance_summary(uuid, text, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_event_attendance_summary(uuid, text, text, integer)
  TO anon, authenticated;
