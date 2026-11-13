-- Support the canonical Admin role through the same authorized RPC used by the UI.
-- Administrator is a permission role; designation and department remain independent.
CREATE OR REPLACE FUNCTION public.assign_employee_role(
  p_employee_id uuid,
  p_role text,
  p_assigned_by uuid DEFAULT auth.uid()
)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_actor_role text;
  v_actor_department text;
  v_target_role text;
  v_target_department text;
  v_requested_role text := NULLIF(btrim(p_role), '');
  v_actor_level integer;
  v_target_level integer;
BEGIN
  IF auth.uid() IS NULL OR p_assigned_by IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Authenticated actor does not match the request';
  END IF;

  IF p_employee_id IS NULL OR v_requested_role IS NULL THEN
    RAISE EXCEPTION 'Employee and role are required';
  END IF;

  IF v_requested_role NOT IN (
    'Admin', 'Worker', 'Supervisor', 'Manager', 'Chief Manager',
    'General Manager', 'Managing Director', 'MD-Manufacturing',
    'MD-Marketing', 'MD-Transport', 'MD-RD', 'President',
    'Vice President', 'Vice Chairman'
  ) THEN
    RAISE EXCEPTION 'Invalid employee role';
  END IF;

  SELECT role, department
  INTO v_actor_role, v_actor_department
  FROM public.profiles
  WHERE id = auth.uid();

  SELECT role, department
  INTO v_target_role, v_target_department
  FROM public.profiles
  WHERE id = p_employee_id
  FOR UPDATE;

  IF v_actor_role IS NULL OR v_target_role IS NULL THEN
    RAISE EXCEPTION 'Actor or target employee profile was not found';
  END IF;

  IF p_employee_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot change your own role';
  END IF;

  IF v_actor_role = 'Worker' THEN
    RAISE EXCEPTION 'This role cannot assign employee roles';
  END IF;

  -- The Vice Chairman can promote the protected Vice Chairman profile to Admin.
  -- Other users cannot demote or alter the protected Vice Chairman profile.
  IF v_target_role = 'Vice Chairman'
     AND NOT (v_actor_role = 'Vice Chairman' AND v_requested_role = 'Admin')
     AND v_actor_role <> 'Admin' THEN
    RAISE EXCEPTION 'The Vice Chairman account is protected';
  END IF;

  IF v_actor_role = 'Vice President' AND v_target_role = 'Vice President' THEN
    RAISE EXCEPTION 'Vice Presidents cannot modify peer Vice Presidents';
  END IF;

  IF v_requested_role IN ('Admin', 'Vice Chairman', 'Vice President')
     AND v_actor_role NOT IN ('Vice Chairman', 'Admin') THEN
    RAISE EXCEPTION 'Only an Administrator or Vice Chairman can assign this executive role';
  END IF;

  v_actor_level := public.role_level(v_actor_role);
  v_target_level := public.role_level(v_requested_role);

  -- Vice Chairman and Administrator are organization-wide authorities.
  -- Vice Chairman may promote a separate account to Administrator.
  IF v_actor_role NOT IN ('Vice Chairman', 'Admin') THEN
    IF v_target_level >= v_actor_level THEN
      RAISE EXCEPTION 'You cannot assign a peer or higher-level role';
    END IF;

    IF NOT public.is_in_my_hierarchy(p_employee_id) THEN
      RAISE EXCEPTION 'You can only manage employees in your reporting hierarchy';
    END IF;

    IF v_actor_role LIKE 'MD-%'
       AND lower(coalesce(v_actor_department, '')) <> lower(coalesce(v_target_department, '')) THEN
      RAISE EXCEPTION 'Department MDs can only manage employees in their department';
    END IF;
  END IF;

  UPDATE public.profiles
  SET role = v_requested_role,
      hierarchy_level = v_target_level
  WHERE id = p_employee_id;

  RETURN v_requested_role;
END;
$function$;

REVOKE ALL ON FUNCTION public.assign_employee_role(uuid, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assign_employee_role(uuid, text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.assign_employee_role(uuid, text, uuid) TO authenticated;
