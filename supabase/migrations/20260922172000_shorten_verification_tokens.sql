CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.submit_attendance(
  p_event_id uuid,
  p_name text,
  p_village text,
  p_group_name text,
  p_age_category text
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
    event_id, name, village, group_name, age_category, verification_token
  )
  VALUES (
    p_event_id, v_norm_name, v_norm_village, v_norm_group, p_age_category, v_token
  );

  RETURN jsonb_build_object(
    'success', true,
    'token', v_token,
    'name', v_norm_name,
    'village', v_norm_village,
    'group_name', v_norm_group,
    'age_category', p_age_category
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_attendance(uuid, text, text, text, text)
TO anon, authenticated;