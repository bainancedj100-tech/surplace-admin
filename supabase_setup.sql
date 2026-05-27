-- Run this script in your Supabase SQL Editor

-- 1. Create Storage Buckets for Surplace
insert into storage.buckets (id, name, public) values ('profiles', 'profiles', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('driver_docs', 'driver_docs', true) on conflict (id) do nothing;

-- 2. Storage Policies
create policy if not exists "Public Access to profiles" on storage.objects for select using ( bucket_id = 'profiles' );
create policy if not exists "Public Access to driver docs" on storage.objects for select using ( bucket_id = 'driver_docs' );

create policy if not exists "Authenticated users can upload profiles" on storage.objects for insert with check ( bucket_id = 'profiles' AND auth.role() = 'authenticated' );
create policy if not exists "Authenticated users can update profiles" on storage.objects for update with check ( bucket_id = 'profiles' AND auth.role() = 'authenticated' );

-- 3. Users Table fixes
alter table public.users add column if not exists "lastProfileChangeTime" bigint default 0;

-- Drop and recreate update policy for safety
drop policy if exists "Users can update their own data" on public.users;
create policy "Users can update their own data" on public.users 
for update using ( auth.uid()::text = uid::text ) with check ( auth.uid()::text = uid::text );

-- 4. New Tables for Dashboard (Wallets and Transactions)
create table if not exists public.wallets (
    id uuid default gen_random_uuid() primary key,
    driver_id varchar references public.users(uid),
    balance numeric default 0,
    created_at timestamp with time zone default now()
);

create table if not exists public.transactions (
    id uuid default gen_random_uuid() primary key,
    driver_id varchar references public.users(uid),
    amount numeric not null,
    admin_name text,
    created_at timestamp with time zone default now()
);

-- Realtime Setup
alter publication supabase_realtime add table public.users;
alter publication supabase_realtime add table public.wallets;
