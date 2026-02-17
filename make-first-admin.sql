-- ══════════════════════════════════════════════════════════════
-- MAKE FIRST ADMIN
-- ══════════════════════════════════════════════════════════════
-- Run this AFTER you create your first account (sign up via the app).
-- Replace the email below with your actual email.
-- ══════════════════════════════════════════════════════════════

-- Step 1: Make yourself admin
UPDATE profiles SET role = 'admin' WHERE email = 'YOUR_EMAIL@example.com';

-- Step 2: Grant access to all dashboards
INSERT INTO dashboard_access (user_id, dashboard)
  SELECT id, unnest(ARRAY['maintenance', 'hr', 'complaints'])
  FROM profiles WHERE email = 'YOUR_EMAIL@example.com';
