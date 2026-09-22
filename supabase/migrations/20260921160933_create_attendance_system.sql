/*
# QR Code Attendance System - Database Schema

Creates the core tables for a QR Code-based attendance tracking system.

1. New Tables
- `events` — Activities/events that admins create. Each has a status (draft/open/closed).
  - id (uuid PK)
  - name (text, not null)
  - description (text, nullable)
  - event_date (date, not null)
  - start_time (time, not null)
  - end_time (time, not null)
  - status (text: draft/open/closed, default draft)
  - created_by (uuid, references auth.users)
  - created_at (timestamptz, default now())
- `attendances` — Records of participants who checked in to an event.
  - id (uuid PK)
  - event_id (uuid FK → events.id ON DELETE CASCADE)
  - name (text, not null)
  - village (text, not null)
  - group_name (text, not null)
  - age_category (text: SMP/SMA/PRANIKAH, not null)
  - checked_in_at (timestamptz, default now())
  - verification_token (text, unique, not null) — random secure token for proof QR
  - verified_at (timestamptz, nullable) — timestamp when admin first scanned the proof QR
  - created_at (timestamptz, default now())

2. Indexes & Constraints
- Unique index on (event_id, name, village, group_name, age_category) to prevent duplicate attendance.
- Index on verification_token for fast lookups.
- Index on event_id for fast join/filter.

3. Security (RLS)
- `events`: only authenticated users (admins) can CRUD. Anon cannot access.
- `attendances`: locked down — no direct table access for anon or authenticated users.
  All reads/writes go through SECURITY DEFINER functions that enforce business rules.

4. RPC Functions (SECURITY DEFINER)
- `get_event_for_attendance(p_event_id)` — public: returns event info needed for the attendance form.
- `submit_attendance(p_event_id, p_name, p_village, p_group_name, p_age_category)` — public:
  validates event is open, normalizes inputs, checks for duplicates, creates record,
  generates a crypto-random verification token, returns the attendance record.
- `verify_attendance(p_token)` — public: looks up attendance + event by token, marks verified_at
  if null, returns full proof data. Does NOT modify or delete the record.

5. Important Notes
- The verification_token is generated with gen_random_bytes(6) → 12-char hex string (48 bits of entropy).
- Input normalization: trim whitespace and collapse internal whitespace runs to single spaces.
- The submit_attendance function returns a JSON object with success/error status and data.
*/

-- ============ EVENTS TABLE ============
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  event_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'closed')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_events_authenticated" ON events;
CREATE POLICY "select_events_authenticated" ON events FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_events_authenticated" ON events;
CREATE POLICY "insert_events_authenticated" ON events FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_events_authenticated" ON events;
CREATE POLICY "update_events_authenticated" ON events FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_events_authenticated" ON events;
CREATE POLICY "delete_events_authenticated" ON events FOR DELETE
  TO authenticated USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;

-- ============ ATTENDANCES TABLE ============
CREATE TABLE IF NOT EXISTS attendances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name text NOT NULL,
  village text NOT NULL,
  group_name text NOT NULL,
  age_category text NOT NULL CHECK (age_category IN ('SMP', 'SMA', 'PRANIKAH')),
  gender text NOT NULL CHECK (gender IN ('Laki-laki', 'Perempuan')),
  checked_in_at timestamptz NOT NULL DEFAULT now(),
  verification_token text NOT NULL UNIQUE,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE attendances ENABLE ROW LEVEL SECURITY;

-- No direct table policies for anon — all access via SECURITY DEFINER functions.
-- Authenticated admins get read access for the dashboard/event detail views.
DROP POLICY IF EXISTS "select_attendances_authenticated" ON attendances;
CREATE POLICY "select_attendances_authenticated" ON attendances FOR SELECT
  TO authenticated USING (true);

GRANT SELECT ON public.attendances TO authenticated;

-- ============ INDEXES ============
CREATE UNIQUE INDEX IF NOT EXISTS idx_attendances_dedup
  ON attendances (event_id, name, village, group_name, age_category, gender);

CREATE INDEX IF NOT EXISTS idx_attendances_token ON attendances (verification_token);

CREATE INDEX IF NOT EXISTS idx_attendances_event ON attendances (event_id);

-- ============ RPC: get_event_for_attendance ============
-- Public function: returns event info for the attendance form page.
-- Only returns the safe subset of fields (no internal data).
CREATE OR REPLACE FUNCTION get_event_for_attendance(p_event_id uuid)
RETURNS TABLE (
  id uuid,
  name text,
  event_date date,
  start_time time,
  end_time time,
  status text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.id, e.name, e.event_date, e.start_time, e.end_time, e.status
  FROM events e
  WHERE e.id = p_event_id;
$$;

GRANT EXECUTE ON FUNCTION get_event_for_attendance(uuid) TO anon, authenticated;

-- ============ RPC: submit_attendance ============
-- Public function: validates and creates an attendance record.
-- Returns JSONB: { success: bool, message: text, data: record }
CREATE OR REPLACE FUNCTION submit_attendance(
  p_event_id uuid,
  p_name text,
  p_village text,
  p_group_name text,
  p_age_category text,
  p_gender text
)
RETURNS JSONB
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
  v_result JSONB;
BEGIN
  -- 1. Fetch event
  SELECT id, name, status, event_date, start_time, end_time
  INTO v_event
  FROM events
  WHERE id = p_event_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Kegiatan tidak ditemukan');
  END IF;

  -- 2. Check event is open
  IF v_event.status != 'open' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Absensi untuk kegiatan ini sudah ditutup');
  END IF;

  -- 3. Validate inputs
  IF p_age_category NOT IN ('SMP', 'SMA', 'PRANIKAH') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Kategori tidak valid');
  END IF;

  IF p_gender NOT IN ('Laki-laki', 'Perempuan') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Jenis kelamin tidak valid');
  END IF;

  -- 4. Normalize inputs: trim + collapse whitespace
  v_norm_name := btrim(regexp_replace(p_name, '\s+', ' ', 'g'));
  v_norm_village := btrim(regexp_replace(p_village, '\s+', ' ', 'g'));
  v_norm_group := btrim(regexp_replace(p_group_name, '\s+', ' ', 'g'));

  IF v_norm_name = '' OR v_norm_village = '' OR v_norm_group = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Semua field wajib diisi');
  END IF;

  -- 5. Check for duplicate
  SELECT id, verification_token, checked_in_at
  INTO v_existing
  FROM attendances
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

  -- 6. Generate verification token (48 bits of entropy)
  v_token := encode(gen_random_bytes(6), 'hex');

  -- 7. Insert attendance record
  INSERT INTO attendances (event_id, name, village, group_name, age_category, gender, verification_token)
  VALUES (p_event_id, v_norm_name, v_norm_village, v_norm_group, p_age_category, p_gender, v_token);

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

GRANT EXECUTE ON FUNCTION submit_attendance(uuid, text, text, text, text, text) TO anon, authenticated;

-- ============ RPC: verify_attendance ============
-- Public function: looks up attendance by token, marks verified_at if null.
-- Returns JSONB with full proof data or error.
CREATE OR REPLACE FUNCTION verify_attendance(p_token text)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_att RECORD;
  v_event RECORD;
  v_result JSONB;
BEGIN
  SELECT a.id, a.event_id, a.name, a.village, a.group_name, a.age_category, a.gender,
         a.checked_in_at, a.verification_token, a.verified_at
  INTO v_att
  FROM attendances a
  WHERE a.verification_token = p_token
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'message', 'Data absensi tidak ditemukan');
  END IF;

  -- Mark verified_at if null (first scan)
  IF v_att.verified_at IS NULL THEN
    UPDATE attendances SET verified_at = now() WHERE id = v_att.id;
  END IF;

  -- Fetch event info
  SELECT name, event_date, start_time, end_time
  INTO v_event
  FROM events
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

GRANT EXECUTE ON FUNCTION verify_attendance(text) TO anon, authenticated;