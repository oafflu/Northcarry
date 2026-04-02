-- Fix: "Database error creating new user" when creating users (guest checkout, backfill, admin).
-- Cause: Trigger on auth.users inserts into notification_preferences, but that table has RLS
--        and no INSERT policy for the trigger context, so the insert fails and the whole
--        auth transaction rolls back.
-- Fix: Recreate the trigger function with SECURITY DEFINER so it runs with definer rights
--      and can insert into notification_preferences regardless of RLS.
--
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor). Then retry "Create Customers from Orders"
-- or guest checkout; new user creation should succeed.

CREATE OR REPLACE FUNCTION public.create_notification_preferences()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notification_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Trigger already exists; no need to drop/recreate unless you want to point it at the new function.
-- The EXECUTE FUNCTION already references create_notification_preferences(), which we just replaced.
COMMENT ON FUNCTION public.create_notification_preferences() IS 'Trigger on auth.users: create notification_preferences row for new users. Uses SECURITY DEFINER so insert is allowed despite RLS.';
