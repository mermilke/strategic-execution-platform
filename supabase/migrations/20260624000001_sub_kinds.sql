-- Sub-objective "kinds": a sub can track its own structured list instead of the
-- standard weekly check-in.
--   training -> training_sessions (>= 1 complete session per calendar quarter)
--   monthly  -> monthly_checks    (a 12-month grid, complete when all are done)
-- A 'standard' sub keeps using the normal weekly check-in and is unaffected.
ALTER TABLE sub_objectives ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'standard';

-- Ownership helper for the sub-level lists. SECURITY DEFINER so it can run inside
-- the policies below regardless of the caller's table grants; it only ever
-- reports whether the caller owns the sub. Left callable by authenticated (like
-- is_manager_or_admin) because the policies evaluate it as the querying role.
CREATE OR REPLACE FUNCTION public.owns_sub(p_sub uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.sub_objectives s
    JOIN public.strategic_objectives o ON o.id = s.objective_id
    WHERE s.id = p_sub AND o.owner_id = auth.uid()
  );
$$;

-- TRAINING SESSIONS -- a session "counts" only when all of its fields are filled.
CREATE TABLE IF NOT EXISTS training_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_objective_id UUID NOT NULL REFERENCES sub_objectives(id) ON DELETE CASCADE,
  session_date DATE,
  topic TEXT,
  participants TEXT,
  follow_up TEXT,
  next_steps TEXT,
  results TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE training_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "training_select" ON training_sessions;
CREATE POLICY "training_select" ON training_sessions FOR SELECT
  USING ((select public.is_manager_or_admin()) OR public.owns_sub(sub_objective_id));
DROP POLICY IF EXISTS "training_write" ON training_sessions;
CREATE POLICY "training_write" ON training_sessions FOR ALL
  USING ((select public.is_manager_or_admin()) OR public.owns_sub(sub_objective_id))
  WITH CHECK ((select public.is_manager_or_admin()) OR public.owns_sub(sub_objective_id));

-- MONTHLY CHECKS -- one row per sub per month of the tracked year.
CREATE TABLE IF NOT EXISTS monthly_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_objective_id UUID NOT NULL REFERENCES sub_objectives(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'not_started',
  note TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (sub_objective_id, month)
);
ALTER TABLE monthly_checks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "monthly_select" ON monthly_checks;
CREATE POLICY "monthly_select" ON monthly_checks FOR SELECT
  USING ((select public.is_manager_or_admin()) OR public.owns_sub(sub_objective_id));
DROP POLICY IF EXISTS "monthly_write" ON monthly_checks;
CREATE POLICY "monthly_write" ON monthly_checks FOR ALL
  USING ((select public.is_manager_or_admin()) OR public.owns_sub(sub_objective_id))
  WITH CHECK ((select public.is_manager_or_admin()) OR public.owns_sub(sub_objective_id));
