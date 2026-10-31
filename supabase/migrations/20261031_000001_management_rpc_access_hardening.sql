-- Secure the existing leave workflow RPCs. Their function bodies validate auth.uid()
-- and enforce ownership/current-approver checks before changing records.
REVOKE EXECUTE ON FUNCTION public.cancel_leave_request(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_leave_request(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.review_leave_request(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_leave_request(uuid, text, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.submit_leave_request(text, date, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_leave_request(text, date, date, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.update_leave_request(uuid, text, date, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_leave_request(uuid, text, date, date, text) TO authenticated;

-- These helpers are invoked only by trusted SECURITY DEFINER workflow functions.
REVOKE EXECUTE ON FUNCTION public.leave_audit(uuid, text, uuid, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.leave_notification(uuid, text, text, text, uuid) FROM PUBLIC, anon, authenticated;

-- Auth user profile creation is a trigger action, not a callable PostgREST RPC.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
