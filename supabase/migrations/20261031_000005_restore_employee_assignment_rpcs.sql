-- Restore the role and department assignment RPCs used by the Management Portal.
CREATE OR REPLACE FUNCTION public.role_level(role_name text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $function$
  SELECT CASE role_name
    WHEN 'Worker' THEN 1 WHEN 'Supervisor' THEN 2 WHEN 'Manager' THEN 3
    WHEN 'Chief Manager' THEN 4 WHEN 'General Manager' THEN 5
    WHEN 'Managing Director' THEN 6 WHEN 'MD-Manufacturing' THEN 6
    WHEN 'MD-Marketing' THEN 6 WHEN 'MD-Transport' THEN 6 WHEN 'MD-RD' THEN 6
    WHEN 'President' THEN 7 WHEN 'Vice President' THEN 7
    WHEN 'Vice Chairman' THEN 8 WHEN 'Admin' THEN 9 ELSE 0
  END;
$function$;

CREATE OR REPLACE FUNCTION public.assign_employee_role(
  p_employee_id uuid, p_role text, p_assigned_by uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_actor_role text; v_actor_department text;
  v_target_role text; v_target_department text;
  v_actor_level integer; v_target_level integer;
BEGIN
  IF auth.uid() IS NULL OR p_assigned_by IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Authenticated actor does not match the request';
  END IF;
  IF p_role NOT IN (
    'Worker', 'Supervisor', 'Manager', 'Chief Manager', 'General Manager',
    'Managing Director', 'MD-Manufacturing', 'MD-Marketing', 'MD-Transport',
    'MD-RD', 'President', 'Vice President', 'Vice Chairman'
  ) THEN RAISE EXCEPTION 'Invalid employee role'; END IF;

  SELECT role, department INTO v_actor_role, v_actor_department
  FROM public.profiles WHERE id = auth.uid();
  SELECT role, department INTO v_target_role, v_target_department
  FROM public.profiles WHERE id = p_employee_id FOR UPDATE;

  IF v_actor_role IS NULL OR v_target_role IS NULL THEN
    RAISE EXCEPTION 'Actor or target employee profile was not found';
  END IF;
  IF v_target_role = 'Vice Chairman' THEN RAISE EXCEPTION 'The Vice Chairman account is protected'; END IF;
  IF v_actor_role = 'Worker' THEN RAISE EXCEPTION 'This role cannot assign employee roles'; END IF;
  IF v_actor_role = 'Vice President' AND v_target_role = 'Vice President' THEN
    RAISE EXCEPTION 'Vice Presidents cannot modify peer Vice Presidents';
  END IF;
  IF p_role IN ('Vice Chairman', 'Vice President') AND v_actor_role <> 'Vice Chairman' THEN
    RAISE EXCEPTION 'Only the Vice Chairman can assign these executive roles';
  END IF;

  v_actor_level := public.role_level(v_actor_role);
  v_target_level := public.role_level(p_role);
  IF v_actor_role NOT IN ('Vice Chairman', 'Vice President', 'Admin') THEN
    IF v_target_level >= v_actor_level THEN RAISE EXCEPTION 'You cannot assign a peer or higher-level role'; END IF;
    IF NOT public.is_in_my_hierarchy(p_employee_id) THEN
      RAISE EXCEPTION 'You can only manage employees in your reporting hierarchy';
    END IF;
    IF v_actor_role LIKE 'MD-%' AND coalesce(v_actor_department, '') <> coalesce(v_target_department, '') THEN
      RAISE EXCEPTION 'Department MDs can only manage employees in their department';
    END IF;
  END IF;

  UPDATE public.profiles SET role = p_role, hierarchy_level = v_target_level WHERE id = p_employee_id;
  RETURN p_role;
END;
$function$;

CREATE TABLE IF NOT EXISTS public.employee_department_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  previous_department text,
  new_department text NOT NULL,
  changed_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.employee_department_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS employee_department_history_select_scoped ON public.employee_department_history;
CREATE POLICY employee_department_history_select_scoped ON public.employee_department_history
  FOR SELECT TO authenticated
  USING (employee_id = auth.uid() OR public.is_in_my_hierarchy(employee_id) OR public.is_executive());

REVOKE ALL ON TABLE public.employee_department_history FROM anon, authenticated;
GRANT SELECT ON TABLE public.employee_department_history TO authenticated;

CREATE OR REPLACE FUNCTION public.assign_employee_department(
  p_employee_id uuid, p_department text, p_changed_by uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_actor_role text; v_actor_department text;
  v_target_role text; v_target_department text;
BEGIN
  IF auth.uid() IS NULL OR p_changed_by IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Authenticated actor does not match the request';
  END IF;
  IF p_department NOT IN ('Administration', 'Manufacturing', 'Marketing', 'Transportation', 'Research & Development') THEN
    RAISE EXCEPTION 'Invalid department';
  END IF;

  SELECT role, department INTO v_actor_role, v_actor_department
  FROM public.profiles WHERE id = auth.uid();
  SELECT role, department INTO v_target_role, v_target_department
  FROM public.profiles WHERE id = p_employee_id FOR UPDATE;

  IF v_actor_role IS NULL OR v_target_role IS NULL THEN
    RAISE EXCEPTION 'Actor or target employee profile was not found';
  END IF;
  IF v_target_role = 'Vice Chairman' THEN RAISE EXCEPTION 'The Vice Chairman account is protected'; END IF;
  IF v_actor_role = 'Worker' THEN RAISE EXCEPTION 'This role cannot assign employee departments'; END IF;
  IF v_actor_role = 'Vice President' AND v_target_role = 'Vice President' THEN
    RAISE EXCEPTION 'Vice Presidents cannot modify peer Vice Presidents';
  END IF;

  IF v_actor_role NOT IN ('Vice Chairman', 'Vice President', 'Admin') THEN
    IF public.role_level(v_target_role) >= public.role_level(v_actor_role) THEN
      RAISE EXCEPTION 'You cannot manage a peer or higher-level employee';
    END IF;
    IF NOT public.is_in_my_hierarchy(p_employee_id) THEN
      RAISE EXCEPTION 'You can only manage employees in your reporting hierarchy';
    END IF;
    IF v_actor_role LIKE 'MD-%'
       AND (coalesce(v_actor_department, '') <> coalesce(v_target_department, '')
            OR p_department <> v_actor_department) THEN
      RAISE EXCEPTION 'Department MDs can only manage employees within their department';
    END IF;
  END IF;

  UPDATE public.profiles SET department = p_department WHERE id = p_employee_id;
  INSERT INTO public.employee_department_history(employee_id, previous_department, new_department, changed_by)
  VALUES (p_employee_id, v_target_department, p_department, auth.uid());
  RETURN p_department;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.assign_employee_role(uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_employee_role(uuid, text, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.assign_employee_department(uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_employee_department(uuid, text, uuid) TO authenticated;
