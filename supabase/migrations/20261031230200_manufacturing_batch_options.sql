-- Authenticated Manufacturing staff need a safe batch list to associate
-- output, defect, and working-hour records with a batch. Keep the table's
-- direct SELECT policy hierarchy-scoped and expose only the required columns.
CREATE OR REPLACE FUNCTION public.list_manufacturing_batches()
RETURNS TABLE (
  id uuid,
  batch_code text,
  product_name text,
  status text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication is required';
  END IF;
  IF NOT public.same_department('Manufacturing') AND NOT public.is_executive() THEN
    RAISE EXCEPTION 'Only Manufacturing staff can view production batches';
  END IF;

  RETURN QUERY
  SELECT b.id, b.batch_code, b.product_name, b.status
  FROM public.manufacturing_batches b
  ORDER BY b.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.list_manufacturing_batches() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_manufacturing_batches() TO authenticated;
