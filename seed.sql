-- Strategic Tracker demo seed data (development/demo only).
-- Run after supabase_setup.sql. Populates a fictional team so the
-- dashboard, weekly briefing, and 1:1 views have something to show.
--
-- Everyone here is invented. All emails are @example.com.
-- Demo password for every account: demo1234
--
-- Part A creates the login accounts. It writes to auth.users directly,
-- which works on hosted Supabase but can be sensitive to auth-schema
-- changes between versions. If Part A errors, create the accounts
-- instead via Supabase Dashboard, Authentication, Add user (use the
-- same emails), then run Part B on its own. It matches users by email.

-- Part A: demo accounts.
INSERT INTO auth.users
  (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
   created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
   confirmation_token, recovery_token, email_change_token_new, email_change)
SELECT
  '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated',
  'authenticated', d.email, crypt('demo1234', gen_salt('bf')), now(), now(), now(),
  '{"provider":"email","providers":["email"]}',
  jsonb_build_object('full_name', d.full_name, 'role', d.role),
  '', '', '', ''
FROM (VALUES
  ('jordan.hayes@example.com',   'Jordan Hayes',   'ceo'),
  ('morgan.reed@example.com',    'Morgan Reed',    'admin'),
  ('dana.whitfield@example.com', 'Dana Whitfield', 'direct_report'),
  ('priya.nair@example.com',     'Priya Nair',     'direct_report'),
  ('mateo.alvarez@example.com',  'Mateo Alvarez',  'direct_report'),
  ('sofia.costa@example.com',    'Sofia Costa',    'direct_report')
) AS d(email, full_name, role)
ON CONFLICT (email) DO NOTHING;

-- The on_auth_user_created trigger creates the matching public.users rows.
-- Give each direct report a timezone so reminders fire at 4pm local.
UPDATE users SET timezone = 'America/Chicago'   WHERE email IN ('jordan.hayes@example.com', 'morgan.reed@example.com', 'dana.whitfield@example.com');
UPDATE users SET timezone = 'Asia/Kolkata'      WHERE email = 'priya.nair@example.com';
UPDATE users SET timezone = 'America/Mexico_City' WHERE email = 'mateo.alvarez@example.com';
UPDATE users SET timezone = 'Europe/Berlin'     WHERE email = 'sofia.costa@example.com';

-- Part B: objectives, sub-objectives, and check-ins.
-- Matches users by email, so it also works if you created the accounts by hand.
DO $$
DECLARE
  wk0 date := date_trunc('week', now())::date;  -- this Monday
  wk1 date := wk0 - 7;
  wk2 date := wk0 - 14;
  u uuid;
  obj uuid;
  sub uuid;
BEGIN
  -- Bail out cleanly if Part A hasn't produced the accounts yet.
  IF NOT EXISTS (SELECT 1 FROM users WHERE email = 'dana.whitfield@example.com') THEN
    RAISE NOTICE 'Demo accounts not found, create them first, then re-run Part B.';
    RETURN;
  END IF;

  -- Start from a clean slate if the seed is run more than once.
  DELETE FROM strategic_objectives
  WHERE owner_id IN (SELECT id FROM users WHERE email LIKE '%@example.com');

  -- Dana Whitfield, Product
  SELECT id INTO u FROM users WHERE email = 'dana.whitfield@example.com';

  INSERT INTO strategic_objectives (owner_id, title, short_title, sort_order, is_active)
  VALUES (u, 'Launch the EU self-serve onboarding flow', 'EU onboarding', 1, true)
  RETURNING id INTO obj;

  INSERT INTO sub_objectives (objective_id, title, short_title, sort_order, is_active)
  VALUES (obj, 'Ship the guided setup wizard', 'Setup wizard', 1, true) RETURNING id INTO sub;
  INSERT INTO weekly_checkins (sub_objective_id, submitted_by, week_start, status, progress_this_week, comments) VALUES
    (sub, u, wk2, 'on_track',  'Yes', 'Wireframes signed off.'),
    (sub, u, wk1, 'at_risk',   'Yes', 'Held up waiting on design QA.'),
    (sub, u, wk0, 'on_track',  'Yes', 'Unblocked — build underway.');

  INSERT INTO sub_objectives (objective_id, title, short_title, sort_order, is_active)
  VALUES (obj, 'Localise billing for EUR', 'EUR billing', 2, true) RETURNING id INTO sub;
  INSERT INTO weekly_checkins (sub_objective_id, submitted_by, week_start, status, progress_this_week, support_needed, comments) VALUES
    (sub, u, wk1, 'on_hold',   'No',  'Need a decision on the payments vendor.', 'Waiting on vendor selection.'),
    (sub, u, wk0, 'on_hold',   'No',  'Still blocked.', 'Same blocker as last week.');

  -- Priya Nair, Engineering
  SELECT id INTO u FROM users WHERE email = 'priya.nair@example.com';

  INSERT INTO strategic_objectives (owner_id, title, short_title, sort_order, is_active)
  VALUES (u, 'Cut p95 API latency below 200ms', 'API latency', 1, true)
  RETURNING id INTO obj;

  INSERT INTO sub_objectives (objective_id, title, short_title, sort_order, is_active)
  VALUES (obj, 'Add read replicas for the reporting queries', 'Read replicas', 1, true) RETURNING id INTO sub;
  INSERT INTO weekly_checkins (sub_objective_id, submitted_by, week_start, status, progress_this_week, comments) VALUES
    (sub, u, wk2, 'on_track',  'Yes', 'Replica provisioned in staging.'),
    (sub, u, wk1, 'on_track',  'Yes', 'Cut p95 from 480ms to 260ms.'),
    (sub, u, wk0, 'completed', 'Yes', 'Live in production — p95 at 180ms.');

  INSERT INTO sub_objectives (objective_id, title, short_title, sort_order, is_active)
  VALUES (obj, 'Cache the dashboard aggregate endpoints', 'Cache aggregates', 2, true) RETURNING id INTO sub;
  INSERT INTO weekly_checkins (sub_objective_id, submitted_by, week_start, status, progress_this_week, discuss_in_meeting, comments) VALUES
    (sub, u, wk0, 'not_started', 'No', true, 'Starting once the replica work lands.');

  -- Mateo Alvarez, Sales (opportunity-tracking objective)
  SELECT id INTO u FROM users WHERE email = 'mateo.alvarez@example.com';

  INSERT INTO strategic_objectives (owner_id, title, short_title, sort_order, is_active, opportunity_target)
  VALUES (u, 'Close 5 enterprise pilots in LATAM', 'LATAM pilots', 1, true, 5)
  RETURNING id INTO obj;

  -- Opportunity objectives use an implicit sub for the weekly status line.
  INSERT INTO sub_objectives (objective_id, title, sort_order, is_active, is_implicit)
  VALUES (obj, 'Close 5 enterprise pilots in LATAM', 0, true, true) RETURNING id INTO sub;
  INSERT INTO weekly_checkins (sub_objective_id, submitted_by, week_start, status, progress_this_week, comments) VALUES
    (sub, u, wk1, 'on_track', 'Yes', 'Two signed, three in legal.'),
    (sub, u, wk0, 'on_track', 'Yes', 'Third signed this week.');

  INSERT INTO objective_opportunities (objective_id, customer, project_description, segment, estimated_value_text, status, sort_order) VALUES
    (obj, 'Andes Logistics', 'Fleet routing pilot', 'Transportation', '$120k', 'Signed', 1),
    (obj, 'Café del Sur',    'Inventory forecasting', 'Retail', '$85k',  'Signed', 2),
    (obj, 'Patagonia Foods', 'Demand planning rollout', 'CPG', '$210k', 'Signed', 3);

  -- Sofia Costa, Marketing (a missed week, to show the "missing" state)
  SELECT id INTO u FROM users WHERE email = 'sofia.costa@example.com';

  INSERT INTO strategic_objectives (owner_id, title, short_title, sort_order, is_active)
  VALUES (u, 'Rebuild the demand-gen funnel', 'Demand gen', 1, true)
  RETURNING id INTO obj;

  INSERT INTO sub_objectives (objective_id, title, short_title, sort_order, is_active)
  VALUES (obj, 'Replatform the marketing site', 'Site replatform', 1, true) RETURNING id INTO sub;
  INSERT INTO weekly_checkins (sub_objective_id, submitted_by, week_start, status, progress_this_week, comments) VALUES
    (sub, u, wk2, 'off_track', 'No', 'Agency missed the first milestone.');
  -- (no wk1 / wk0 check-in on purpose, so it shows up as a missing submission)
END $$;

-- Sign in with any address above and password: demo1234
