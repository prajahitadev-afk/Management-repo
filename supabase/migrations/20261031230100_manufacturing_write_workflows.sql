-- Make manufacturing creation and production logging work with the deployed
-- SELECT-only RLS policies. All write actors are derived from auth.uid().

CREATE OR REPLACE FUNCTION public.create_manufacturing_batch(
  p_batch_code text,
  p_product_name text,
  p_planned_quantity integer,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL,
  p_assigned_supervisor uuid DEFAULT NULL
)
RETURNS public.manufacturing_batches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_batch public.manufacturing_batches;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Authentication is required'; END IF;
  IF NULLIF(btrim(p_batch_code), '') IS NULL OR NULLIF(btrim(p_product_name), '') IS NULL THEN
    RAISE EXCEPTION 'Batch code and product name are required';
  END IF;
  IF p_planned_quantity IS NULL OR p_planned_quantity <= 0 THEN
    RAISE EXCEPTION 'Planned quantity must be greater than zero';
  END IF;
  IF p_start_date IS NOT NULL AND p_end_date IS NOT NULL AND p_end_date < p_start_date THEN
    RAISE EXCEPTION 'Batch end date cannot be before its start date';
  END IF;
  IF NOT public.same_department('Manufacturing') AND NOT public.is_executive() THEN
    RAISE EXCEPTION 'Only Manufacturing staff can create production batches';
  END IF;
  IF p_assigned_supervisor IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = p_assigned_supervisor
      AND lower(btrim(COALESCE(p.department, ''))) = 'manufacturing'
  ) THEN
    RAISE EXCEPTION 'Assigned supervisor must belong to Manufacturing';
  END IF;

  INSERT INTO public.manufacturing_batches (
    batch_code, product_name, planned_quantity, created_by,
    assigned_supervisor, start_date, end_date, status
  ) VALUES (
    btrim(p_batch_code), btrim(p_product_name), p_planned_quantity, v_actor,
    p_assigned_supervisor, p_start_date, p_end_date, 'Planned'
  )
  RETURNING * INTO v_batch;

  RETURN v_batch;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_manufacturing_output(
  p_batch_id uuid,
  p_worker_id uuid,
  p_quantity integer,
  p_production_date date DEFAULT CURRENT_DATE,
  p_remarks text DEFAULT NULL
)
RETURNS public.manufacturing_outputs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_batch public.manufacturing_batches;
  v_output public.manufacturing_outputs;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Authentication is required'; END IF;
  IF p_batch_id IS NULL OR p_worker_id IS NULL THEN
    RAISE EXCEPTION 'Batch and worker are required';
  END IF;
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Production quantity must be greater than zero';
  END IF;
  IF p_production_date IS NULL THEN RAISE EXCEPTION 'Production date is required'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = p_worker_id
      AND lower(btrim(COALESCE(p.department, ''))) = 'manufacturing'
  ) THEN
    RAISE EXCEPTION 'Worker must belong to Manufacturing';
  END IF;
  IF v_actor <> p_worker_id
     AND NOT public.is_in_my_hierarchy(p_worker_id)
     AND NOT public.is_department_md()
     AND NOT public.is_executive() THEN
    RAISE EXCEPTION 'You are not allowed to record output for this worker';
  END IF;

  SELECT * INTO v_batch
  FROM public.manufacturing_batches
  WHERE id = p_batch_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Manufacturing batch was not found'; END IF;
  IF v_batch.status IN ('Completed', 'Cancelled') THEN
    RAISE EXCEPTION 'Output cannot be recorded for a completed or cancelled batch';
  END IF;
  IF v_batch.actual_quantity + p_quantity > v_batch.planned_quantity THEN
    RAISE EXCEPTION 'Recorded output cannot exceed the batch planned quantity';
  END IF;

  INSERT INTO public.manufacturing_outputs (
    batch_id, worker_id, quantity_produced, production_date, remarks
  ) VALUES (
    p_batch_id, p_worker_id, p_quantity, p_production_date, NULLIF(btrim(p_remarks), '')
  )
  RETURNING * INTO v_output;

  UPDATE public.manufacturing_batches
  SET actual_quantity = actual_quantity + p_quantity,
      status = CASE WHEN status = 'Planned' THEN 'In Progress' ELSE status END,
      updated_at = now()
  WHERE id = p_batch_id;

  RETURN v_output;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_manufacturing_working_hours(
  p_batch_id uuid,
  p_worker_id uuid,
  p_work_date date,
  p_hours_worked numeric,
  p_overtime_hours numeric DEFAULT 0,
  p_remarks text DEFAULT NULL
)
RETURNS public.manufacturing_working_hours
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_hours public.manufacturing_working_hours;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Authentication is required'; END IF;
  IF p_batch_id IS NULL OR p_worker_id IS NULL OR p_work_date IS NULL THEN
    RAISE EXCEPTION 'Batch, worker, and work date are required';
  END IF;
  IF p_hours_worked IS NULL OR p_hours_worked <= 0
     OR COALESCE(p_overtime_hours, 0) < 0
     OR COALESCE(p_overtime_hours, 0) > p_hours_worked THEN
    RAISE EXCEPTION 'Working hours must be positive and overtime cannot exceed total hours';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = p_worker_id
      AND lower(btrim(COALESCE(p.department, ''))) = 'manufacturing'
  ) THEN
    RAISE EXCEPTION 'Worker must belong to Manufacturing';
  END IF;
  IF v_actor <> p_worker_id
     AND NOT public.is_in_my_hierarchy(p_worker_id)
     AND NOT public.is_department_md()
     AND NOT public.is_executive() THEN
    RAISE EXCEPTION 'You are not allowed to record hours for this worker';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.manufacturing_batches b WHERE b.id = p_batch_id) THEN
    RAISE EXCEPTION 'Manufacturing batch was not found';
  END IF;

  INSERT INTO public.manufacturing_working_hours (
    batch_id, worker_id, work_date, hours_worked, overtime_hours, remarks
  ) VALUES (
    p_batch_id, p_worker_id, p_work_date, p_hours_worked,
    COALESCE(p_overtime_hours, 0), NULLIF(btrim(p_remarks), '')
  )
  RETURNING * INTO v_hours;

  RETURN v_hours;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_manufacturing_target(
  p_target_quantity integer,
  p_period_start date,
  p_period_end date
)
RETURNS public.manufacturing_targets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_target public.manufacturing_targets;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Authentication is required'; END IF;
  IF p_target_quantity IS NULL OR p_target_quantity <= 0 THEN
    RAISE EXCEPTION 'Target quantity must be greater than zero';
  END IF;
  IF p_period_start IS NULL OR p_period_end IS NULL OR p_period_end < p_period_start THEN
    RAISE EXCEPTION 'A valid target period is required';
  END IF;
  IF NOT public.same_department('Manufacturing') AND NOT public.is_executive() THEN
    RAISE EXCEPTION 'Only Manufacturing staff can create production targets';
  END IF;

  INSERT INTO public.manufacturing_targets (
    target_name, target_period, target_quantity, actual_quantity,
    manager_id, start_date, end_date, status
  ) VALUES (
    'Production target ' || p_period_start::text || ' - ' || p_period_end::text,
    p_period_start::text || ' to ' || p_period_end::text,
    p_target_quantity, 0, v_actor, p_period_start, p_period_end, 'Active'
  )
  RETURNING * INTO v_target;

  RETURN v_target;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_manufacturing_batch(
  p_batch_id uuid,
  p_status text DEFAULT NULL,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL,
  p_assigned_supervisor uuid DEFAULT NULL
)
RETURNS public.manufacturing_batches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_batch public.manufacturing_batches;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Authentication is required'; END IF;
  SELECT * INTO v_batch
  FROM public.manufacturing_batches
  WHERE id = p_batch_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Manufacturing batch was not found'; END IF;
  IF v_actor <> v_batch.created_by
     AND v_actor <> v_batch.assigned_supervisor
     AND NOT public.is_in_my_hierarchy(v_batch.created_by)
     AND NOT public.is_department_md()
     AND NOT public.is_executive() THEN
    RAISE EXCEPTION 'You are not allowed to update this batch';
  END IF;
  IF p_status IS NOT NULL AND p_status NOT IN ('Planned', 'In Progress', 'Completed', 'Cancelled') THEN
    RAISE EXCEPTION 'Invalid batch status';
  END IF;
  IF p_status = 'Completed' AND v_batch.actual_quantity = 0 THEN
    RAISE EXCEPTION 'A batch with no recorded output cannot be completed';
  END IF;
  IF p_start_date IS NOT NULL AND p_end_date IS NOT NULL AND p_end_date < p_start_date THEN
    RAISE EXCEPTION 'Batch end date cannot be before its start date';
  END IF;
  IF p_assigned_supervisor IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = p_assigned_supervisor
      AND lower(btrim(COALESCE(p.department, ''))) = 'manufacturing'
  ) THEN
    RAISE EXCEPTION 'Assigned supervisor must belong to Manufacturing';
  END IF;

  UPDATE public.manufacturing_batches
  SET status = COALESCE(p_status, status),
      start_date = COALESCE(p_start_date, start_date),
      end_date = COALESCE(p_end_date, end_date),
      assigned_supervisor = COALESCE(p_assigned_supervisor, assigned_supervisor),
      updated_at = now()
  WHERE id = p_batch_id
  RETURNING * INTO v_batch;

  RETURN v_batch;
END;
$$;

REVOKE ALL ON FUNCTION public.create_manufacturing_batch(text, text, integer, date, date, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_manufacturing_output(uuid, uuid, integer, date, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_manufacturing_working_hours(uuid, uuid, date, numeric, numeric, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_manufacturing_target(integer, date, date) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.update_manufacturing_target(
  p_target_id uuid,
  p_target_quantity integer DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_period_start date DEFAULT NULL,
  p_period_end date DEFAULT NULL
)
RETURNS public.manufacturing_targets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_target public.manufacturing_targets;
  v_start date;
  v_end date;
  v_quantity integer;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Authentication is required'; END IF;
  SELECT * INTO v_target
  FROM public.manufacturing_targets
  WHERE id = p_target_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Manufacturing target was not found'; END IF;
  IF v_actor <> v_target.manager_id
     AND NOT public.is_in_my_hierarchy(v_target.manager_id)
     AND NOT public.is_department_md()
     AND NOT public.is_executive() THEN
    RAISE EXCEPTION 'You are not allowed to update this target';
  END IF;

  v_start := COALESCE(p_period_start, v_target.start_date);
  v_end := COALESCE(p_period_end, v_target.end_date);
  v_quantity := COALESCE(p_target_quantity, v_target.target_quantity);
  IF v_quantity <= 0 OR v_quantity < v_target.actual_quantity THEN
    RAISE EXCEPTION 'Target must be positive and cannot be lower than actual production';
  END IF;
  IF v_start IS NULL OR v_end IS NULL OR v_end < v_start THEN
    RAISE EXCEPTION 'Invalid target date range';
  END IF;
  IF p_status IS NOT NULL AND p_status NOT IN ('Active','Completed','Cancelled') THEN
    RAISE EXCEPTION 'Invalid manufacturing target status';
  END IF;
  IF COALESCE(p_status, v_target.status) = 'Completed' AND v_target.actual_quantity < v_quantity THEN
    RAISE EXCEPTION 'A target cannot be completed before its quantity is achieved';
  END IF;

  UPDATE public.manufacturing_targets
  SET target_quantity = v_quantity,
      start_date = v_start,
      end_date = v_end,
      target_name = 'Production target ' || v_start::text || ' - ' || v_end::text,
      target_period = v_start::text || ' to ' || v_end::text,
      status = COALESCE(p_status, status),
      updated_at = now()
  WHERE id = p_target_id
  RETURNING * INTO v_target;
  RETURN v_target;
END;
$function$;

REVOKE ALL ON FUNCTION public.update_manufacturing_target(uuid, integer, text, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_manufacturing_target(uuid, integer, text, date, date) TO authenticated;

REVOKE ALL ON FUNCTION public.update_manufacturing_batch(uuid, text, date, date, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.create_manufacturing_batch(text, text, integer, date, date, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_manufacturing_output(uuid, uuid, integer, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_manufacturing_working_hours(uuid, uuid, date, numeric, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_manufacturing_target(integer, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_manufacturing_batch(uuid, text, date, date, uuid) TO authenticated;
