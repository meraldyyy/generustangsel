CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

ALTER FUNCTION public.submit_attendance(uuid, text, text, text, text)
  SET search_path = public, extensions;