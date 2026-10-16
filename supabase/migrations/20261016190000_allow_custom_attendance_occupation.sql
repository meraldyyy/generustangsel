ALTER TABLE public.attendances
  DROP CONSTRAINT IF EXISTS attendances_occupation_check;

ALTER TABLE public.attendances
  ADD CONSTRAINT attendances_occupation_check
  CHECK (
    occupation IS NULL
    OR (btrim(occupation) <> '' AND length(occupation) <= 100)
  );

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
  v_occupation text;
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
  v_occupation := btrim(regexp_replace(coalesce(p_occupation, ''), '\s+', ' ', 'g'));

  IF v_name = '' OR v_village = '' OR v_group = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nama, desa, dan kelompok wajib diisi');
  END IF;

  IF p_gender IS NULL OR p_gender NOT IN ('Laki-laki', 'Perempuan') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Jenis kelamin tidak valid');
  END IF;

  IF p_age IS NULL OR p_age <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usia harus lebih dari 0');
  END IF;

  IF v_occupation = '' OR length(v_occupation) > 100 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pekerjaan wajib diisi (maksimal 100 karakter)');
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
    AND occupation = v_occupation
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
    p_event_id, v_name, v_village, v_group, NULL, p_gender, p_age, v_occupation, p_education, v_token
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
      AND occupation = v_occupation
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
    'occupation', v_occupation,
    'education', p_education
  );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_special_attendance(uuid, text, text, text, text, integer, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_special_attendance(uuid, text, text, text, text, integer, text, text)
  TO anon, authenticated;
