-- ==============================================================================
-- RIDINGO — CLEAN SLATE DATABASE DATA ERASER
-- Target Database: Supabase PostgreSQL (Project: xxmcjgonsxpjrgdxchwl)
-- ==============================================================================
-- INSTRUCTIONS:
-- 1. Open Supabase Dashboard -> "SQL Editor"
-- 2. Paste this script and click "Run".
-- 3. All collected rows (trips, notifications, drivers, profiles) will be erased.
-- 4. ALL tables, columns, indexes, functions, triggers, and RLS policies remain 100% INTACT!
-- ==============================================================================

-- 1. Erase collected trips & ride bookings
TRUNCATE TABLE public.trips CASCADE;

-- 2. Erase collected push and in-app notifications
TRUNCATE TABLE public.notifications CASCADE;

-- 3. Erase collected driver partner test records
TRUNCATE TABLE public.drivers CASCADE;

-- 4. Erase collected user/rider profile records
TRUNCATE TABLE public.profiles CASCADE;

-- Verification: Check that table structures are clean and empty
SELECT 'trips' AS table_name, count(*) AS remaining_rows FROM public.trips
UNION ALL
SELECT 'notifications', count(*) FROM public.notifications
UNION ALL
SELECT 'drivers', count(*) FROM public.drivers
UNION ALL
SELECT 'profiles', count(*) FROM public.profiles;
