-- weekly_checkins.submitted_by referenced users(id) with no ON DELETE action,
-- so deleting a user who had submitted a check-in failed the foreign key. Every
-- other users(id) reference in the schema cascades; bring this one in line.
ALTER TABLE weekly_checkins
  DROP CONSTRAINT IF EXISTS weekly_checkins_submitted_by_fkey;

ALTER TABLE weekly_checkins
  ADD CONSTRAINT weekly_checkins_submitted_by_fkey
    FOREIGN KEY (submitted_by) REFERENCES users(id) ON DELETE CASCADE;
