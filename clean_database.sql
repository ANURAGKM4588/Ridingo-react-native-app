-- ==============================================================================
-- RIDINGO — FRESH DATABASE CLEANUP SCRIPT (COLLECTED DATA ONLY)
-- ==============================================================================
-- Instructions:
-- 1. Open your Supabase Dashboard: https://supabase.com/dashboard/project/xxmcjgonsxpjrgdxchwl
-- 2. Click "SQL Editor" in the left navigation sidebar.
-- 3. Click "New Query", paste this entire script, and click "Run".
-- ==============================================================================

-- 1. Cleanly erase all collected trip, booking, and telemetry records (keeps table & schema intact)
TRUNCATE TABLE public.trips CASCADE;

-- 2. Cleanly erase all collected user/rider profile records (keeps table & schema intact)
TRUNCATE TABLE public.profiles CASCADE;

-- 3. Cleanly erase any other collected partner/driver/notification rows if present
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'drivers') THEN
        TRUNCATE TABLE public.drivers CASCADE;
    END IF;
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'rides') THEN
        TRUNCATE TABLE public.rides CASCADE;
    END IF;
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'notifications') THEN
        TRUNCATE TABLE public.notifications CASCADE;
    END IF;
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'saved_places') THEN
        TRUNCATE TABLE public.saved_places CASCADE;
    END IF;
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'chat_messages') THEN
        TRUNCATE TABLE public.chat_messages CASCADE;
    END IF;
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'api_rate_limits') THEN
        TRUNCATE TABLE public.api_rate_limits CASCADE;
    END IF;
END $$;

-- 4. (Optional) If you also want to remove registered auth logins (phone/email auth accounts):
-- TRUNCATE auth.users CASCADE;

-- 5. Clean up any legacy permissive delete policies (use strict RLS policies from supabase_complete_setup.sql)
DROP POLICY IF EXISTS "Allow delete on profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow delete on trips" ON public.trips;
