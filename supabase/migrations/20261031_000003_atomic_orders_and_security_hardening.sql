-- Atomic order + item + pending-payment creation. All three inserts commit or roll back together.
DROP FUNCTION IF EXISTS public.create_order_with_items(text, uuid, date, date, text, numeric, uuid, jsonb);

CREATE OR REPLACE FUNCTION public.create_order_with_items(
  p_order_number text,
  p_customer_id text,
  p_order_date date,
  p_expected_delivery text,
  p_status text,
  p_total_amount numeric,
  p_payment_method text,
  p_items jsonb
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_order_id text := gen_random_uuid()::text;
  v_item_count integer;
  v_calculated_total numeric;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF p_order_number IS NULL OR length(trim(p_order_number)) = 0 THEN
    RAISE EXCEPTION 'Order number is required';
  END IF;
  IF p_customer_id IS NULL OR length(trim(p_customer_id)) = 0 THEN
    RAISE EXCEPTION 'Customer is required';
  END IF;
  IF p_status <> 'Pending' THEN
    RAISE EXCEPTION 'New orders must start in Pending status';
  END IF;
  IF p_payment_method IS NULL OR length(trim(p_payment_method)) = 0 THEN
    RAISE EXCEPTION 'Payment method is required';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'At least one order item is required';
  END IF;

  SELECT count(*), coalesce(sum(item.total_price), 0)
    INTO v_item_count, v_calculated_total
  FROM jsonb_to_recordset(p_items) AS item(
    product_id text, product_name text, quantity integer,
    unit_price numeric, total_price numeric
  );

  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(p_items) AS item(
      product_id text, product_name text, quantity integer,
      unit_price numeric, total_price numeric
    )
    WHERE coalesce(item.quantity, 0) <= 0
       OR coalesce(item.unit_price, -1) < 0
       OR coalesce(item.total_price, -1) < 0
       OR abs(item.total_price - (item.quantity * item.unit_price)) > 0.01
  ) THEN
    RAISE EXCEPTION 'Order item quantities and prices are invalid';
  END IF;

  IF abs(coalesce(p_total_amount, 0) - v_calculated_total) > 0.01 THEN
    RAISE EXCEPTION 'Order total does not match the item totals';
  END IF;

  INSERT INTO public.orders (
    id, order_number, customer_id, order_date, expected_delivery,
    created_by, status, payment_status, payment_method, total_amount, item_count
  ) VALUES (
    v_order_id, trim(p_order_number), p_customer_id, p_order_date, p_expected_delivery,
    auth.uid()::text, 'Pending', 'Pending', trim(p_payment_method), p_total_amount, v_item_count
  );

  INSERT INTO public.order_items (
    id, order_id, product_id, product_name, quantity, price, unit_price, total_price
  )
  SELECT gen_random_uuid()::text, v_order_id, item.product_id, item.product_name,
         item.quantity, item.unit_price, item.unit_price, item.total_price
  FROM jsonb_to_recordset(p_items) AS item(
    product_id text, product_name text, quantity integer,
    unit_price numeric, total_price numeric
  );

  INSERT INTO public.payments (order_id, payment_method, amount, status)
  VALUES (v_order_id, trim(p_payment_method), p_total_amount, 'Pending');

  RETURN v_order_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.create_order_with_items(text, text, date, text, text, numeric, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_order_with_items(text, text, date, text, text, numeric, text, jsonb) TO authenticated;

-- Orders can be read by authenticated staff; writes are constrained to status transitions.
DROP POLICY IF EXISTS "Orders Insert" ON public.orders;
DROP POLICY IF EXISTS orders_insert ON public.orders;
DROP POLICY IF EXISTS orders_delete ON public.orders;
DROP POLICY IF EXISTS orders_select ON public.orders;
DROP POLICY IF EXISTS orders_read ON public.orders;
DROP POLICY IF EXISTS orders_update ON public.orders;
DROP POLICY IF EXISTS "Order Items Insert" ON public.order_items;
DROP POLICY IF EXISTS order_items_read ON public.order_items;
DROP POLICY IF EXISTS "Payments Insert" ON public.payments;
DROP POLICY IF EXISTS payments_read ON public.payments;

CREATE POLICY orders_select_authenticated ON public.orders
  FOR SELECT TO authenticated USING (true);
CREATE POLICY orders_update_authorized ON public.orders
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('Admin', 'Vice Chairman', 'Vice President', 'General Manager', 'MD-Marketing', 'MD-Transport')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('Admin', 'Vice Chairman', 'Vice President', 'General Manager', 'MD-Marketing', 'MD-Transport')
    )
  );

CREATE POLICY order_items_select_authenticated ON public.order_items
  FOR SELECT TO authenticated USING (true);
CREATE POLICY payments_select_authenticated ON public.payments
  FOR SELECT TO authenticated USING (true);

REVOKE ALL ON TABLE public.orders FROM anon, authenticated;
GRANT SELECT ON TABLE public.orders TO authenticated;
GRANT UPDATE (status) ON TABLE public.orders TO authenticated;

REVOKE ALL ON TABLE public.order_items FROM anon, authenticated;
GRANT SELECT ON TABLE public.order_items TO authenticated;

REVOKE ALL ON TABLE public.payments FROM anon, authenticated;
GRANT SELECT ON TABLE public.payments TO authenticated;

-- Pin SECURITY DEFINER helper functions to a trusted search_path.
ALTER FUNCTION public.current_user_role() SET search_path = public, pg_temp;
ALTER FUNCTION public.current_user_department() SET search_path = public, pg_temp;
ALTER FUNCTION public.create_order_notification() SET search_path = public, pg_temp;
ALTER FUNCTION public.is_executive() SET search_path = public, pg_temp;
ALTER FUNCTION public.is_in_my_hierarchy(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.is_department_head() SET search_path = public, pg_temp;
ALTER FUNCTION public.same_department(text) SET search_path = public, pg_temp;
ALTER FUNCTION public.role_level(text) SET search_path = public, pg_temp;
ALTER FUNCTION public.is_department_md() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_updated_at_column() SET search_path = public, pg_temp;
ALTER FUNCTION public.leave_days(date, date) SET search_path = public, pg_temp;
ALTER FUNCTION public.leave_role_rank(text) SET search_path = public, pg_temp;
ALTER FUNCTION public.update_customer_name() SET search_path = public, pg_temp;
ALTER FUNCTION public.create_customer_record() SET search_path = public, pg_temp;
ALTER FUNCTION public.handle_new_user() SET search_path = public, pg_temp;
ALTER FUNCTION public.debug_auth() SET search_path = public, pg_temp;
