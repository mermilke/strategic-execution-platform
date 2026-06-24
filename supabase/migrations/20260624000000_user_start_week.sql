-- Per-person "week 0" for the staleness tracker. Weeks before this (and the
-- start week itself) are not counted as missed, so a newly added report does not
-- show a large "no update" number before they have begun checking in. When NULL,
-- the dashboard falls back to the report's first check-in week.
ALTER TABLE users ADD COLUMN IF NOT EXISTS start_week DATE;
