-- Manufacturing defect reporting and supervisor review.
-- Writes are routed through authenticated, hierarchy-aware RPCs because the
-- deployed table intentionally has SELECT-only RLS policies.

CREATE OR REPLACE FUNCTION public.record_manufacturing_defect(
  p_batch_id uuid,
  p_worker_id uuid,
  p_defect_type text,
  p_quantity integer,
  p_severity text DEFAULT 'Medium',
  p_description text DEFAULT NULL
)
RETURNS public.manufacturing_defects
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_worker_department text;
  v_batch public.manufacturing_batches;
  v_defect public.manufacturing_defects;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication is required';
  END IF;

  IF p_batch_id IS NULL OR p_worker_id IS NULL
     OR NULLIF(btrim(p_defect_type), '') IS NULL THEN
    RAISE EXCEPTION 'Batch, worker, and defect type are required';
  END IF;

  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Defect quantity must be greater than zero';
  END IF;

  IF COALESCE(p_severity, 'Medium') NOT IN ('Low', 'Medium', 'High', 'Critical') THEN
    RAISE EXCEPTION 'Invalid defect severity';
  END IF;

  SELECT department INTO v_worker_department
  FROM public.profiles
  WHERE id = p_worker_id;

  IF NOT FOUND OR lower(COALESCE(v_worker_department, '')) <> 'manufacturing' THEN
    RAISE EXCEPTION 'Worker must belong to Manufacturing';
  END IF;

  IF v_actor <> p_worker_id
     AND NOT public.is_in_my_hierarchy(p_worker_id)
     AND NOT public.is_department_md()
     AND NOT public.is_executive() THEN
    RAISE EXCEPTION 'You are not allowed to report defects for this worker';
  END IF;

  SELECT * INTO v_batch
  FROM public.manufacturing_batches
  WHERE id = p_batch_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Manufacturing batch was not found';
  END IF;

  INSERT INTO public.manufacturing_defects (
    batch_id, worker_id, defect_type, defect_quantity, severity,
    description, status
  )
  VALUES (
    p_batch_id, p_worker_id, btrim(p_defect_type), p_quantity,
    COALESCE(p_severity, 'Medium'), NULLIF(btrim(p_description), ''), 'Open'
  )
  RETURNING * INTO v_defect;

  RETURN v_defect;
END;
$$;

CREATE OR REPLACE FUNCTION public.review_manufacturing_defect(
  p_defect_id uuid
)
RETURNS public.manufacturing_defects
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_defect public.manufacturing_defects;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication is required';
  END IF;

  SELECT * INTO v_defect
  FROM public.manufacturing_defects
  WHERE id = p_defect_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Manufacturing defect was not found';
  END IF;

  IF v_actor = v_defect.worker_id
     OR (
       NOT public.is_in_my_hierarchy(v_defect.worker_id)
       AND NOT public.is_department_md()
       AND NOT public.is_executive()
     ) THEN
    RAISE EXCEPTION 'You are not allowed to review this defect';
  END IF;

  IF v_defect.status <> 'Open' THEN
    RAISE EXCEPTION 'Only open defects can be reviewed';
  END IF;

  UPDATE public.manufacturing_defects
  SET status = 'Reviewed',
      reviewed_by = v_actor,
      reviewed_at = now()
  WHERE id = p_defect_id
  RETURNING * INTO v_defect;

  RETURN v_defect;
END;
$$;

REVOKE ALL ON FUNCTION public.record_manufacturing_defect(uuid, uuid, text, integer, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.review_manufacturing_defect(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_manufacturing_defect(uuid, uuid, text, integer, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_manufacturing_defect(uuid) TO authenticated;
