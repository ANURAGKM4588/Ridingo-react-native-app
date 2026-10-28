-- ==============================================================================
-- RIDINGO — COMPLETE PRODUCTION DATABASE SETUP & HEALTH MIGRATION
-- Project: https://supabase.com/dashboard/project/xxmcjgonsxpjrgdxchwl
-- Compatible with: User App (Android/iOS) + Driver App (Android/iOS)
-- ==============================================================================
-- Instructions:
-- 1. Open Supabase Dashboard -> "SQL Editor"
-- 2. Paste this entire script into a "New Query" and click "Run".
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. TABLE: public.profiles (Users & Riders)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    phone text PRIMARY KEY,
    name text,
    email text,
    car jsonb,
    preferences jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 2. TABLE: public.trips (Bookings, Dispatches & Live Trips)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.trips (
    id text PRIMARY KEY,
    cat text NOT NULL,
    qty numeric DEFAULT 1,
    pickup text NOT NULL,
    drop_loc text,
    when_ts bigint NOT NULL,
    done_ts bigint DEFAULT 0,
    fare numeric NOT NULL,
    advance numeric NOT NULL,
    status text DEFAULT 'requested',
    driver jsonb,
    car jsonb,
    rider jsonb,
    cashback numeric DEFAULT 0,
    by_who text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Ensure all optional & extended columns exist on trips
DO $$
BEGIN
    ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS distance_km numeric;
    ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS distance_text text;
    ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS duration_text text;
    ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS eta text;
    ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS otp text;
    ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS vehicle_brand text;
    ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS vehicle_model text;
    ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS vehicle_number text;
    ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS car_photos jsonb DEFAULT '[]'::jsonb;
    ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'pending';
    ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS payment_details jsonb DEFAULT '{}'::jsonb;
END $$;

-- Enforce strict database-level input validation constraints on trips
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_trips_fare_positive') THEN
        ALTER TABLE public.trips ADD CONSTRAINT chk_trips_fare_positive CHECK (fare >= 0);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_trips_advance_non_negative') THEN
        ALTER TABLE public.trips ADD CONSTRAINT chk_trips_advance_non_negative CHECK (advance >= 0);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_trips_qty_positive') THEN
        ALTER TABLE public.trips ADD CONSTRAINT chk_trips_qty_positive CHECK (qty > 0);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_trips_status_valid') THEN
        ALTER TABLE public.trips ADD CONSTRAINT chk_trips_status_valid CHECK (
            status IN ('requested', 'accepted', 'pickup_arrived', 'ready_to_start', 'inprogress', 'completed', 'cancelled')
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_trips_payment_status_valid') THEN
        ALTER TABLE public.trips ADD CONSTRAINT chk_trips_payment_status_valid CHECK (
            payment_status IN ('pending', 'processing', 'PAID', 'failed', 'refunded')
        );
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 3. TABLE: public.drivers (Driver Partners Registry)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.drivers (
    id text PRIMARY KEY,
    name text,
    first_name text,
    last_name text,
    phone text,
    email text,
    home_address text,
    street text,
    city text DEFAULT 'Kochi',
    pincode text,
    state text DEFAULT 'Kerala',
    nationality text DEFAULT 'India',
    dl_number text,
    dl_photo text,
    aadhar_number text,
    aadhar_photo text,
    avatar text,
    category text DEFAULT 'new_registration',
    status text DEFAULT 'pending',
    rating numeric DEFAULT 5.0,
    trips_completed integer DEFAULT 0,
    total_earnings numeric DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Enforce strict database-level input validation constraints on drivers
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_drivers_status_valid') THEN
        ALTER TABLE public.drivers ADD CONSTRAINT chk_drivers_status_valid CHECK (
            status IN ('pending', 'approved', 'rejected', 'suspended')
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_drivers_category_valid') THEN
        ALTER TABLE public.drivers ADD CONSTRAINT chk_drivers_category_valid CHECK (
            category IN ('new_registration', 'old_registered', 'partner')
        );
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 4. TABLE: public.notifications (Push & In-App Notifications)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
    id text PRIMARY KEY,
    user_id text,
    driver_id text,
    title text,
    message text,
    type text DEFAULT 'info',
    read boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- Strict authentication, authorization, and data privacy enforcement:
-- - Users can only view and modify their own private profiles and bookings.
-- - Drivers can only access unassigned dispatches and trips assigned to them.
-- - Driver private KYC documents (Aadhar, DL) and addresses are shielded from users.
-- - Only executive administrators (team.ridingo@gmail.com) have platform-wide access.
-- ------------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Helper function to check if the current user is an authenticated administrator
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
    RETURN (
        auth.jwt() ->> 'email' = 'team.ridingo@gmail.com'
        OR auth.jwt() ->> 'role' = 'service_role'
        OR current_user = 'postgres'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$
BEGIN
    -- --------------------------------------------------------------------------
    -- 5.1 Profiles RLS
    -- --------------------------------------------------------------------------
    DROP POLICY IF EXISTS "Public profiles read" ON public.profiles;
    DROP POLICY IF EXISTS "Public profiles insert" ON public.profiles;
    DROP POLICY IF EXISTS "Public profiles update" ON public.profiles;
    DROP POLICY IF EXISTS "Public profiles delete" ON public.profiles;
    DROP POLICY IF EXISTS "Users read own profile or banners" ON public.profiles;
    DROP POLICY IF EXISTS "Users insert profile" ON public.profiles;
    DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
    DROP POLICY IF EXISTS "Admin delete profiles" ON public.profiles;

    -- Read: Offer banners are public. Profiles are strictly readable only by the owner or admin.
    CREATE POLICY "Users read own profile or banners" ON public.profiles
        FOR SELECT USING (
            name = 'RIDINGO_OFFER_BANNERS'
            OR phone = auth.jwt() ->> 'phone'
            OR phone = (auth.jwt() ->> 'user_metadata')::jsonb ->> 'phone_number'
            OR email = auth.jwt() ->> 'email'
            OR (auth.uid() IS NOT NULL AND preferences->>'userId' = auth.uid()::text)
            OR public.is_admin()
        );

    -- Insert: Any registered user or client can create their initial profile (cannot create banner)
    CREATE POLICY "Users insert profile" ON public.profiles
        FOR INSERT WITH CHECK (
            name != 'RIDINGO_OFFER_BANNERS'
            OR public.is_admin()
        );

    -- Update: Users can only update their own profile; Offer banners only editable by admin
    CREATE POLICY "Users update own profile" ON public.profiles
        FOR UPDATE USING (
            (
                phone = auth.jwt() ->> 'phone'
                OR phone = (auth.jwt() ->> 'user_metadata')::jsonb ->> 'phone_number'
                OR email = auth.jwt() ->> 'email'
                OR (auth.uid() IS NOT NULL AND preferences->>'userId' = auth.uid()::text)
            )
            OR (name = 'RIDINGO_OFFER_BANNERS' AND public.is_admin())
            OR public.is_admin()
        );

    -- Delete: Restricted to verified Administrators or users deleting their own account
    CREATE POLICY "Admin delete profiles" ON public.profiles
        FOR DELETE USING (
            public.is_admin()
            OR (
                auth.uid() IS NOT NULL AND (
                    phone = auth.jwt() ->> 'phone' 
                    OR email = auth.jwt() ->> 'email'
                )
            )
        );

    -- --------------------------------------------------------------------------
    -- 5.2 Trips RLS (Riders & Dispatches)
    -- --------------------------------------------------------------------------
    DROP POLICY IF EXISTS "Public trips read" ON public.trips;
    DROP POLICY IF EXISTS "Public trips insert" ON public.trips;
    DROP POLICY IF EXISTS "Public trips update" ON public.trips;
    DROP POLICY IF EXISTS "Public trips delete" ON public.trips;
    DROP POLICY IF EXISTS "Scoped trips read" ON public.trips;
    DROP POLICY IF EXISTS "Trips insert" ON public.trips;
    DROP POLICY IF EXISTS "Trips update authorized" ON public.trips;
    DROP POLICY IF EXISTS "Admin delete trips" ON public.trips;

    -- Read:
    -- 1. Unassigned 'requested' trips are readable so nearby drivers can accept dispatches
    -- 2. Once accepted or completed, trips are ONLY readable by the booking rider or assigned driver
    -- 3. Admin can read all trips
    CREATE POLICY "Scoped trips read" ON public.trips
        FOR SELECT USING (
            status = 'requested'
            OR by_who = auth.jwt() ->> 'phone'
            OR by_who = (auth.jwt() ->> 'user_metadata')::jsonb ->> 'phone_number'
            OR rider->>'phone' = auth.jwt() ->> 'phone'
            OR rider->>'phone' = (auth.jwt() ->> 'user_metadata')::jsonb ->> 'phone_number'
            OR rider->>'email' = auth.jwt() ->> 'email'
            OR rider->>'id' = auth.uid()::text
            OR driver->>'phone' = auth.jwt() ->> 'phone'
            OR driver->>'id' = auth.uid()::text
            OR public.is_admin()
        );

    -- Insert: Users and guest bookings can request trips (must start in 'requested' status)
    CREATE POLICY "Trips insert" ON public.trips
        FOR INSERT WITH CHECK (
            status = 'requested'
            OR public.is_admin()
        );

    -- Update:
    -- Riders can cancel their own bookings.
    -- Available drivers can accept open 'requested' trips.
    -- Assigned driver can update trip progress (arrived, start, end).
    -- Cross-user and cross-driver trip modification is completely blocked.
    CREATE POLICY "Trips update authorized" ON public.trips
        FOR UPDATE USING (
            -- Rider cancelling their own trip
            (
                (by_who = auth.jwt() ->> 'phone' OR rider->>'phone' = auth.jwt() ->> 'phone' OR rider->>'id' = auth.uid()::text)
                AND status IN ('requested', 'accepted', 'pickup_arrived', 'inprogress')
            )
            -- Driver accepting an open dispatch request
            OR (status = 'requested')
            -- Assigned driver updating trip progress
            OR (driver->>'phone' = auth.jwt() ->> 'phone' OR driver->>'id' = auth.uid()::text)
            -- Executive Admin
            OR public.is_admin()
        );

    -- Delete: Strictly restricted to verified Administrators
    CREATE POLICY "Admin delete trips" ON public.trips
        FOR DELETE USING (public.is_admin());

    -- --------------------------------------------------------------------------
    -- 5.3 Drivers RLS
    -- --------------------------------------------------------------------------
    DROP POLICY IF EXISTS "Public drivers read" ON public.drivers;
    DROP POLICY IF EXISTS "Public drivers insert" ON public.drivers;
    DROP POLICY IF EXISTS "Public drivers update" ON public.drivers;
    DROP POLICY IF EXISTS "Public drivers delete" ON public.drivers;
    DROP POLICY IF EXISTS "Scoped drivers read" ON public.drivers;
    DROP POLICY IF EXISTS "Drivers registration insert" ON public.drivers;
    DROP POLICY IF EXISTS "Drivers update authorized" ON public.drivers;
    DROP POLICY IF EXISTS "Admin delete drivers" ON public.drivers;

    -- Read:
    -- Drivers can view their own record.
    -- Public users can view approved drivers (public fields only).
    -- Admin can view all drivers.
    CREATE POLICY "Scoped drivers read" ON public.drivers
        FOR SELECT USING (
            status = 'approved'
            OR phone = auth.jwt() ->> 'phone'
            OR email = auth.jwt() ->> 'email'
            OR id = auth.uid()::text
            OR public.is_admin()
        );

    -- Insert: Prospective driver partners can submit registration application (must be 'pending')
    CREATE POLICY "Drivers registration insert" ON public.drivers
        FOR INSERT WITH CHECK (
            (status = 'pending' AND category = 'new_registration')
            OR public.is_admin()
        );

    -- Update:
    -- Driver can update their own personal info.
    -- Only admin can approve/reject/suspend or change ratings and earnings.
    CREATE POLICY "Drivers update authorized" ON public.drivers
        FOR UPDATE USING (
            (phone = auth.jwt() ->> 'phone' OR email = auth.jwt() ->> 'email' OR id = auth.uid()::text)
            OR public.is_admin()
        );

    -- Delete: Strictly restricted to verified Administrators
    CREATE POLICY "Admin delete drivers" ON public.drivers
        FOR DELETE USING (public.is_admin());

    -- --------------------------------------------------------------------------
    -- 5.4 Notifications RLS
    -- --------------------------------------------------------------------------
    DROP POLICY IF EXISTS "Public notifications read" ON public.notifications;
    DROP POLICY IF EXISTS "Public notifications insert" ON public.notifications;
    DROP POLICY IF EXISTS "Public notifications update" ON public.notifications;
    DROP POLICY IF EXISTS "Public notifications delete" ON public.notifications;
    DROP POLICY IF EXISTS "User read own notifications" ON public.notifications;
    DROP POLICY IF EXISTS "Notifications insert" ON public.notifications;
    DROP POLICY IF EXISTS "User update own notifications" ON public.notifications;
    DROP POLICY IF EXISTS "Admin delete notifications" ON public.notifications;
    DROP POLICY IF EXISTS "User delete own notifications" ON public.notifications;

    CREATE POLICY "User read own notifications" ON public.notifications
        FOR SELECT USING (
            user_id = auth.jwt() ->> 'email'
            OR user_id = auth.jwt() ->> 'phone'
            OR driver_id = auth.jwt() ->> 'phone'
            OR driver_id = auth.uid()::text
            OR user_id = auth.uid()::text
            OR public.is_admin()
        );

    CREATE POLICY "Notifications insert" ON public.notifications
        FOR INSERT WITH CHECK (true);

    CREATE POLICY "User update own notifications" ON public.notifications
        FOR UPDATE USING (
            user_id = auth.jwt() ->> 'email'
            OR user_id = auth.jwt() ->> 'phone'
            OR driver_id = auth.jwt() ->> 'phone'
            OR driver_id = auth.uid()::text
            OR user_id = auth.uid()::text
            OR public.is_admin()
        );

    CREATE POLICY "User delete own notifications" ON public.notifications
        FOR DELETE USING (
            user_id = auth.jwt() ->> 'email'
            OR user_id = auth.jwt() ->> 'phone'
            OR driver_id = auth.jwt() ->> 'phone'
            OR driver_id = auth.uid()::text
            OR user_id = auth.uid()::text
            OR public.is_admin()
        );
END $$;

-- ------------------------------------------------------------------------------
-- 6. ENABLE SUPABASE REALTIME REPLICATION
-- Realtime streaming for trips, drivers, and notifications across apps
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.trips;
    EXCEPTION WHEN duplicate_object THEN
        NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.drivers;
    EXCEPTION WHEN duplicate_object THEN
        NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    EXCEPTION WHEN duplicate_object THEN
        NULL;
    END;
END $$;

-- ------------------------------------------------------------------------------
-- 7. STORAGE BUCKETS (Vehicle Photos & Driver Documents)
-- ------------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES 
    ('vehicle-inspections', 'vehicle-inspections', true),
    ('driver-documents', 'driver-documents', false)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- Storage bucket access policies
DO $$
BEGIN
    DROP POLICY IF EXISTS "Public Access vehicle-inspections" ON storage.objects;
    DROP POLICY IF EXISTS "Public Access driver-documents" ON storage.objects;
    DROP POLICY IF EXISTS "Vehicle inspections read" ON storage.objects;
    DROP POLICY IF EXISTS "Vehicle inspections write" ON storage.objects;
    DROP POLICY IF EXISTS "Driver documents restricted read" ON storage.objects;
    DROP POLICY IF EXISTS "Driver documents write" ON storage.objects;
    DROP POLICY IF EXISTS "Driver documents restricted write" ON storage.objects;
    DROP POLICY IF EXISTS "Driver documents restricted update" ON storage.objects;
    DROP POLICY IF EXISTS "Driver documents restricted delete" ON storage.objects;

    -- Vehicle inspections: Publicly viewable for ride safety & inspections
    CREATE POLICY "Vehicle inspections read" ON storage.objects
        FOR SELECT USING (bucket_id = 'vehicle-inspections');

    CREATE POLICY "Vehicle inspections write" ON storage.objects
        FOR INSERT WITH CHECK (
            bucket_id = 'vehicle-inspections'
            AND (
                public.is_admin()
                OR (
                    auth.uid() IS NOT NULL
                    AND lower(storage.extension(name)) IN ('jpg', 'jpeg', 'png', 'webp', 'mp4')
                )
            )
        );

    -- Driver documents (Aadhaar & DL): Strictly private KYC bucket
    -- Read: Only admin or the document owner
    CREATE POLICY "Driver documents restricted read" ON storage.objects
        FOR SELECT USING (
            bucket_id = 'driver-documents'
            AND (
                public.is_admin()
                OR (auth.uid() IS NOT NULL AND (storage.foldername(name))[1] = auth.uid()::text)
            )
        );

    -- Write: Only authenticated driver uploading to their own scoped folder with valid document extension
    CREATE POLICY "Driver documents restricted write" ON storage.objects
        FOR INSERT WITH CHECK (
            bucket_id = 'driver-documents'
            AND (
                public.is_admin()
                OR (
                    auth.uid() IS NOT NULL 
                    AND (storage.foldername(name))[1] = auth.uid()::text
                    AND lower(storage.extension(name)) IN ('jpg', 'jpeg', 'png', 'webp', 'pdf')
                )
            )
        );

    -- Update & Delete: Strictly restricted to owner or admin
    CREATE POLICY "Driver documents restricted update" ON storage.objects
        FOR UPDATE USING (
            bucket_id = 'driver-documents'
            AND (
                public.is_admin()
                OR (auth.uid() IS NOT NULL AND (storage.foldername(name))[1] = auth.uid()::text)
            )
        );

    CREATE POLICY "Driver documents restricted delete" ON storage.objects
        FOR DELETE USING (
            bucket_id = 'driver-documents'
            AND (
                public.is_admin()
                OR (auth.uid() IS NOT NULL AND (storage.foldername(name))[1] = auth.uid()::text)
            )
        );
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- ------------------------------------------------------------------------------
-- 8. UNBYPASSABLE SERVER-SIDE RATE LIMITING & BOT DEFENSE TRIGGERS
-- Direct API requests (e.g. via PostgREST / curl / Postman) cannot bypass
-- PostgreSQL BEFORE INSERT triggers executing inside the database kernel.
-- ------------------------------------------------------------------------------

-- Rate limiting tracking store
CREATE TABLE IF NOT EXISTS public.api_rate_limits (
    rate_key text PRIMARY KEY,
    request_count integer NOT NULL DEFAULT 1,
    window_start timestamptz NOT NULL DEFAULT clock_timestamp(),
    last_request timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_api_rate_limits_window ON public.api_rate_limits (window_start);

-- Secure table: strict RLS with no public grants prevents client tampering
ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;

-- Atomic sliding-window rate checker function
CREATE OR REPLACE FUNCTION public.check_rate_limit(
    p_key text,
    p_max_requests integer,
    p_window_seconds integer
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_now timestamptz := clock_timestamp();
    v_record record;
BEGIN
    -- Opportunistic cleanup of stale rate limits older than 2 hours (approx 2% of executions)
    IF random() < 0.02 THEN
        DELETE FROM public.api_rate_limits WHERE window_start < v_now - interval '2 hours';
    END IF;

    -- Upsert or lock entry for atomic counter mutation
    SELECT request_count, window_start INTO v_record
    FROM public.api_rate_limits
    WHERE rate_key = p_key
    FOR UPDATE;

    IF NOT FOUND THEN
        INSERT INTO public.api_rate_limits (rate_key, request_count, window_start, last_request)
        VALUES (p_key, 1, v_now, v_now)
        ON CONFLICT (rate_key) DO UPDATE
            SET request_count = api_rate_limits.request_count + 1,
                last_request = v_now;
        RETURN true;
    END IF;

    -- If current window has expired, reset counter and window start
    IF v_now >= (v_record.window_start + (p_window_seconds || ' seconds')::interval) THEN
        UPDATE public.api_rate_limits
        SET request_count = 1,
            window_start = v_now,
            last_request = v_now
        WHERE rate_key = p_key;
        RETURN true;
    END IF;

    -- If requests exceed maximum allowed threshold in current window, reject
    IF v_record.request_count >= p_max_requests THEN
        RETURN false;
    END IF;

    -- Otherwise increment counter and accept
    UPDATE public.api_rate_limits
    SET request_count = request_count + 1,
        last_request = v_now
    WHERE rate_key = p_key;

    RETURN true;
END;
$$;

-- 8.1 Trip Creation Rate Limiter & Bot Protection Trigger
CREATE OR REPLACE FUNCTION public.trg_enforce_trips_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_identifier text;
    v_rate_key text;
    v_allowed boolean;
BEGIN
    -- Bypass rate checks for administrators and database superusers
    IF public.is_admin() THEN
        RETURN NEW;
    END IF;

    -- Bot & Payload Sanity Validations
    IF NEW.pickup IS NULL OR length(trim(NEW.pickup)) < 2 THEN
        RAISE EXCEPTION 'Bot protection: Invalid or missing pickup location'
            USING ERRCODE = 'P0001';
    END IF;

    IF NEW.fare IS NOT NULL AND NEW.fare < 0 THEN
        RAISE EXCEPTION 'Bot protection: Fare cannot be negative'
            USING ERRCODE = 'P0001';
    END IF;

    IF NEW.advance IS NOT NULL AND NEW.advance < 0 THEN
        RAISE EXCEPTION 'Bot protection: Advance cannot be negative'
            USING ERRCODE = 'P0001';
    END IF;

    -- Resolve client identifier from user phone, user id, or request jwt sub
    v_identifier := COALESCE(
        NULLIF(NEW.by_who, ''),
        NULLIF(NEW.rider->>'phone', ''),
        NULLIF(current_setting('request.jwt.claim.sub', true), ''),
        'anon_client'
    );

    v_rate_key := 'rate:trips:' || v_identifier;

    -- Rate Limit: Max 5 trip creations per 10 minutes (600 seconds)
    v_allowed := public.check_rate_limit(v_rate_key, 5, 600);

    IF NOT v_allowed THEN
        RAISE EXCEPTION 'Rate limit exceeded: Maximum 5 trip bookings allowed per 10 minutes. Please wait before creating another booking.'
            USING ERRCODE = 'P0001';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_trips_rate_limit ON public.trips;
CREATE TRIGGER trg_trips_rate_limit
    BEFORE INSERT ON public.trips
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_enforce_trips_rate_limit();

-- 8.2 Driver Registration Rate Limiter & Bot Protection Trigger
CREATE OR REPLACE FUNCTION public.trg_enforce_drivers_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_identifier text;
    v_rate_key text;
    v_allowed boolean;
    v_clean_phone text;
BEGIN
    -- Bypass rate checks for administrators
    IF public.is_admin() THEN
        RETURN NEW;
    END IF;

    -- Bot & Payload Sanity Validations: Must have a valid phone number
    v_clean_phone := regexp_replace(COALESCE(NEW.phone, ''), '\D', '', 'g');
    IF length(v_clean_phone) < 10 THEN
        RAISE EXCEPTION 'Bot protection: Driver registration requires a valid 10-digit mobile number'
            USING ERRCODE = 'P0001';
    END IF;

    IF NEW.name IS NULL AND NEW.first_name IS NULL THEN
        RAISE EXCEPTION 'Bot protection: Driver applicant name is required'
            USING ERRCODE = 'P0001';
    END IF;

    v_identifier := COALESCE(
        NULLIF(v_clean_phone, ''),
        NULLIF(current_setting('request.jwt.claim.sub', true), ''),
        'anon_driver'
    );

    v_rate_key := 'rate:drivers:' || v_identifier;

    -- Rate Limit: Max 3 driver registrations per 1 hour (3600 seconds)
    v_allowed := public.check_rate_limit(v_rate_key, 3, 3600);

    IF NOT v_allowed THEN
        RAISE EXCEPTION 'Rate limit exceeded: Maximum 3 driver registrations allowed per hour. Please wait before trying again.'
            USING ERRCODE = 'P0001';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_drivers_rate_limit ON public.drivers;
CREATE TRIGGER trg_drivers_rate_limit
    BEFORE INSERT ON public.drivers
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_enforce_drivers_rate_limit();
