-- handle_new_user is a trigger function (fires on auth.users insert regardless
-- of EXECUTE grants), so it never needs to be callable directly. Revoke EXECUTE
-- to keep it off the exposed PostgREST RPC surface, matching enforce_user_role_guard.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
