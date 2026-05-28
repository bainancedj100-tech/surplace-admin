-- Firebase Auth integration fix for Supabase
-- This script changes the Users table to support Firebase String UIDs 
-- instead of PostgreSQL UUIDs, and fixes the Row Level Security (RLS) policies.

-- 1. Create or replace the tables properly to use 'uid' (varchar)
CREATE TABLE IF NOT EXISTS public.users (
    uid varchar PRIMARY KEY,
    name text,
    email text,
    role text default 'user',
    userType text,
    status text default 'pending',
    walletBalance numeric default 0,
    rating numeric default 5.0,
    totalRatings integer default 0,
    profileImageUrl text,
    lastProfileChangeTime bigint default 0,
    created_at timestamp with time zone default now()
);

-- If the table exists but uid is missing (e.g. template used id), we must add it and set it as unique
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='uid') THEN
        ALTER TABLE public.users ADD COLUMN uid varchar UNIQUE;
    END IF;
END $$;

-- 2. Drop the old wallets / transactions if they had bad foreign keys
DROP TABLE IF EXISTS public.transactions;
DROP TABLE IF EXISTS public.wallets;

-- 3. Recreate them with varchar referencing the uid
CREATE TABLE public.wallets (
    id uuid default gen_random_uuid() primary key,
    driver_id varchar references public.users(uid) ON DELETE CASCADE,
    balance numeric default 0,
    created_at timestamp with time zone default now()
);

CREATE TABLE public.transactions (
    id uuid default gen_random_uuid() primary key,
    driver_id varchar references public.users(uid) ON DELETE CASCADE,
    amount numeric not null,
    admin_name text,
    created_at timestamp with time zone default now()
);

-- 4. Enable RLS and setup permissions for Hybrid Auth (Anon Key access)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Allow anonymous dashboard to SELECT drivers
DROP POLICY IF EXISTS "Allow anonymous select on users" ON public.users;
CREATE POLICY "Allow anonymous select on users" ON public.users FOR SELECT USING (true);

-- Allow Insert from Android App (which acts as Anon when using Firebase Auth)
DROP POLICY IF EXISTS "Allow anonymous insert on users" ON public.users;
CREATE POLICY "Allow anonymous insert on users" ON public.users FOR INSERT WITH CHECK (true);

-- Allow dashboard to update Driver status
DROP POLICY IF EXISTS "Allow anonymous update on users" ON public.users;
CREATE POLICY "Allow anonymous update on users" ON public.users FOR UPDATE USING (true);

-- Enable select and insert for transactions and wallets
DROP POLICY IF EXISTS "Allow anonymous select on transactions" ON public.transactions;
CREATE POLICY "Allow anonymous select on transactions" ON public.transactions FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow anonymous insert on transactions" ON public.transactions;
CREATE POLICY "Allow anonymous insert on transactions" ON public.transactions FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anonymous select on wallets" ON public.wallets;
CREATE POLICY "Allow anonymous select on wallets" ON public.wallets FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow anonymous insert/update on wallets" ON public.wallets;
CREATE POLICY "Allow anonymous insert/update on wallets" ON public.wallets FOR ALL USING (true);

-- End of Fix Script
