-- ============================================================
-- AEROGLIDE USER PROFILES SCHEMAS & POLICIES (MIGRATION 20260523000002)
-- Location: /server/supabase/migrations/20260523000002_profiles.sql
-- ============================================================

-- ─── 1. USER PROFILES TABLE ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id                 UUID          PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name          TEXT          NOT NULL,
  phone_number       TEXT,
  nationality        TEXT,
  dob                DATE,
  gender             TEXT          CHECK (gender IN ('male', 'female', 'other', 'unspecified')),
  passport_details   TEXT,
  emergency_contact  TEXT,
  avatar_url         TEXT,
  created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Indexing profiles
CREATE INDEX IF NOT EXISTS idx_profiles_id ON public.profiles(id);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ─── 2. RLS POLICIES FOR PROFILES ─────────────────────────────
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "profiles_delete_own" ON public.profiles
  FOR DELETE USING (auth.uid() = id);

-- ─── 3. AUTOMATIC PROFILE CREATION TRIGGER ───────────────────
-- Creates a profile row automatically whenever a new user registers in auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;
CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_profile();

-- ─── 4. STORAGE BUCKET & RLS FOR AVATARS ──────────────────────
-- Create avatars bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for avatars storage
CREATE POLICY "Avatar select by anyone"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "Avatar upload by owner"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars' AND
  (auth.uid())::text = (storage.foldername(name))[1]
);

CREATE POLICY "Avatar update by owner"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'avatars' AND
  (auth.uid())::text = (storage.foldername(name))[1]
);

CREATE POLICY "Avatar delete by owner"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'avatars' AND
  (auth.uid())::text = (storage.foldername(name))[1]
);

-- Grant select/insert/update/delete privileges
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO anon, authenticated, service_role;
