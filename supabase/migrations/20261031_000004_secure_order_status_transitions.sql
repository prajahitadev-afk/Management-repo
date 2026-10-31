-- Route order state changes through one server-side authorization and transition check.
CREATE OR REPLACE FUNCTION public.transition_order_status(
  p_order_id text,
  p_next_status text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_current_status text;
  v_actor_role text;
  v_actor_department text;
  v_is_assigned_driver boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT role, department INTO v_actor_role, v_actor_department
  FROM public.profiles WHERE id = auth.uid();

  IF v_actor_role IS NULL THEN
    RAISE EXCEPTION 'An employee profile is required';
  END IF;

  SELECT status INTO v_current_status
  FROM public.orders WHERE id = p_order_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_current_status = p_next_status THEN
    RETURN v_current_status;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.deliveries d
    WHERE d.order_id::text = p_order_id AND d.driver_id = auth.uid()
  ) INTO v_is_assigned_driver;

  IF v_current_status = 'Pending' AND p_next_status IN ('Approved', 'Rejected') THEN
    IF v_actor_role NOT IN ('Admin', 'Vice Chairman', 'Vice President', 'General Manager', 'MD-Marketing', 'MD-Transport') THEN
      RAISE EXCEPTION 'You are not authorized to approve or reject orders';
    END IF;
  ELSIF v_current_status = 'Approved' AND p_next_status = 'Dispatched' THEN
    IF NOT (
      v_actor_role IN ('Admin', 'Vice Chairman', 'Vice President', 'General Manager', 'MD-Transport')
      OR (v_actor_role IN ('Manager', 'Supervisor') AND v_actor_department IN ('Transport', 'Transportation'))
      OR v_is_assigned_driver
    ) THEN
      RAISE EXCEPTION 'You are not authorized to dispatch this order';
    END IF;
  ELSIF v_current_status = 'Dispatched' AND p_next_status = 'Delivered' THEN
    IF NOT (
      v_actor_role IN ('Admin', 'Vice Chairman', 'Vice President', 'General Manager', 'MD-Transport')
      OR (v_actor_role IN ('Manager', 'Supervisor') AND v_actor_department IN ('Transport', 'Transportation'))
      OR v_is_assigned_driver
    ) THEN
      RAISE EXCEPTION 'You are not authorized to complete this delivery';
    END IF;
  ELSE
    RAISE EXCEPTION 'Invalid order transition from % to %', v_current_status, p_next_status;
  END IF;

  UPDATE public.orders SET status = p_next_status WHERE id = p_order_id;
  RETURN p_next_status;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.transition_order_status(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transition_order_status(text, text) TO authenticated;

DROP POLICY IF EXISTS orders_update_authorized ON public.orders;
REVOKE UPDATE ON TABLE public.orders FROM anon, authenticated;
GRANT SELECT ON TABLE public.orders TO authenticated;
