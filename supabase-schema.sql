-- ══════════════════════════════════════════════════════════════
-- AZZURRO HOTELS — Unified Supabase Schema
-- ══════════════════════════════════════════════════════════════
-- Run this ENTIRE file in your Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════════════════════════

-- ─── 1. ENUMS ───
CREATE TYPE user_role AS ENUM ('admin', 'manager', 'receptionist', 'staff');

-- ─── 2. PROFILES (linked to Supabase Auth) ───
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'staff',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 3. DASHBOARD ACCESS (admin assigns per user) ───
CREATE TABLE dashboard_access (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  dashboard TEXT NOT NULL, -- 'maintenance', 'hr', 'complaints'
  granted_by UUID REFERENCES profiles(id),
  granted_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, dashboard)
);

-- ─── 4. HR: TASKS ───
CREATE TABLE tasks (
  id BIGINT PRIMARY KEY,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 5. HR: ARCHIVE ───
CREATE TABLE archive (
  id BIGINT PRIMARY KEY,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 6. HR: ADMINS (users who can delete tasks) ───
CREATE TABLE admins (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE
);

-- ─── 7. MAINTENANCE: PROPERTIES ───
CREATE TABLE properties (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 8. MAINTENANCE: ROOMS ───
CREATE TABLE rooms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE NOT NULL,
  number TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 9. MAINTENANCE: ISSUES ───
CREATE TABLE maintenance_issues (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE NOT NULL,
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE NOT NULL,
  description TEXT NOT NULL,
  urgency TEXT NOT NULL DEFAULT 'normal',
  status TEXT DEFAULT 'open',
  archived BOOLEAN DEFAULT false,
  reported_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 10. MAINTENANCE: ISSUE UPDATES ───
CREATE TABLE maintenance_updates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  issue_id UUID REFERENCES maintenance_issues(id) ON DELETE CASCADE NOT NULL,
  author_email TEXT NOT NULL,
  text TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 11. MAINTENANCE: MEDIA ───
CREATE TABLE maintenance_media (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  update_id UUID REFERENCES maintenance_updates(id) ON DELETE CASCADE,
  issue_id UUID REFERENCES maintenance_issues(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  media_type TEXT NOT NULL,
  file_name TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 12. COMPLAINTS ───
CREATE TABLE complaints (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  guest_name TEXT NOT NULL,
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  source TEXT DEFAULT '',
  location TEXT DEFAULT '',
  room TEXT NOT NULL,
  check_in DATE,
  check_out DATE,
  still_at_property TEXT DEFAULT '',
  used_bed TEXT DEFAULT '',
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  category TEXT NOT NULL,
  sub_category TEXT DEFAULT '',
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'urgent',
  priority TEXT NOT NULL DEFAULT 'medium',
  notes TEXT DEFAULT '',
  who_at_fault TEXT DEFAULT '',
  logged_by UUID REFERENCES profiles(id),
  assigned_to UUID REFERENCES profiles(id),
  resolved_by UUID REFERENCES profiles(id),
  date_of_closure DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

-- ─── 13. COMPLAINT ACTIVITIES ───
CREATE TABLE complaint_activities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  complaint_id UUID REFERENCES complaints(id) ON DELETE CASCADE NOT NULL,
  author_id UUID REFERENCES profiles(id),
  author_name TEXT NOT NULL,
  author_role TEXT NOT NULL,
  text TEXT DEFAULT '',
  media_url TEXT DEFAULT '',
  media_type TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 14. AI CHAT HISTORY ───
CREATE TABLE ai_chat_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  complaint_id UUID REFERENCES complaints(id),
  messages JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);


-- ══════════════════════════════════════════════════════════════
-- INDEXES
-- ══════════════════════════════════════════════════════════════

CREATE INDEX idx_dashboard_access_user ON dashboard_access(user_id);
CREATE INDEX idx_rooms_property ON rooms(property_id);
CREATE INDEX idx_maint_issues_room ON maintenance_issues(room_id);
CREATE INDEX idx_maint_issues_property ON maintenance_issues(property_id);
CREATE INDEX idx_complaints_status ON complaints(status);
CREATE INDEX idx_complaints_date ON complaints(date DESC);
CREATE INDEX idx_complaint_activities ON complaint_activities(complaint_id, created_at DESC);


-- ══════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ══════════════════════════════════════════════════════════════

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaint_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_chat_history ENABLE ROW LEVEL SECURITY;

-- Profiles: users see own, admins see all
CREATE POLICY "Users view own profile" ON profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins update profiles" ON profiles FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins insert profiles" ON profiles FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admins delete profiles" ON profiles FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Dashboard access
CREATE POLICY "Users see own access" ON dashboard_access FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins manage access" ON dashboard_access FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins update access" ON dashboard_access FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins delete access" ON dashboard_access FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- All data tables: authenticated users can read/write
-- (Dashboard-level access is enforced by the shell, not RLS)
CREATE POLICY "auth_all" ON properties FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON rooms FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON maintenance_issues FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON maintenance_updates FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON maintenance_media FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON archive FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON admins FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON complaints FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON complaint_activities FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "own_chats" ON ai_chat_history FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());


-- ══════════════════════════════════════════════════════════════
-- AUTO-CREATE PROFILE ON SIGNUP
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'staff'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- ══════════════════════════════════════════════════════════════
-- AUTO-UPDATE TIMESTAMPS
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER complaints_updated BEFORE UPDATE ON complaints FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER maint_issues_updated BEFORE UPDATE ON maintenance_issues FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ══════════════════════════════════════════════════════════════
-- ENABLE REALTIME
-- ══════════════════════════════════════════════════════════════

ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE dashboard_access;
ALTER PUBLICATION supabase_realtime ADD TABLE properties;
ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE maintenance_issues;
ALTER PUBLICATION supabase_realtime ADD TABLE maintenance_updates;
ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE archive;
ALTER PUBLICATION supabase_realtime ADD TABLE complaints;
ALTER PUBLICATION supabase_realtime ADD TABLE complaint_activities;


-- ══════════════════════════════════════════════════════════════
-- STORAGE BUCKETS
-- ══════════════════════════════════════════════════════════════
-- Create these in Supabase Dashboard → Storage:
--   1. "maintenance-media"  (private)
--   2. "complaint-media"    (private)
--
-- Then add these policies in the Storage section:
--   - Allow authenticated users to upload/read from both buckets


-- ══════════════════════════════════════════════════════════════
-- FIRST ADMIN SETUP
-- ══════════════════════════════════════════════════════════════
-- After your first signup, run this to make yourself admin:
--
-- UPDATE profiles SET role = 'admin' WHERE email = 'YOUR_EMAIL@example.com';
--
-- INSERT INTO dashboard_access (user_id, dashboard)
--   SELECT id, unnest(ARRAY['maintenance','hr','complaints'])
--   FROM profiles WHERE email = 'YOUR_EMAIL@example.com';
--
-- ══════════════════════════════════════════════════════════════
