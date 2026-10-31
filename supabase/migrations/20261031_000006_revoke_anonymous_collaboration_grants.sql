-- RLS policies are scoped to authenticated users. Remove the underlying table grants
-- as an additional barrier so anonymous API keys cannot query collaboration records.
REVOKE ALL ON TABLE
  public.collaboration_applications,
  public.collaboration_audit_logs,
  public.collaboration_bills,
  public.collaboration_companies
FROM anon;
