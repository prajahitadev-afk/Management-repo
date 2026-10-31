-- Manual payment settlement workflow. Payment state and the related order
-- payment_status are changed atomically and every transition is recorded.

CREATE TABLE IF NOT EXISTS public.payment_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE RESTRICT,
  order_id text NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  previous_status text NOT NULL,
  new_status text NOT NULL CHECK (new_status IN ('Paid', 'Failed')),
  reference_number text,
  notes text,
  performed_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_status_history ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS payment_status_history_payment_created_idx
  ON public.payment_status_history (payment_id, created_at DESC);

DROP POLICY IF EXISTS payment_status_history_select_finance ON public.payment_status_history;
CREATE POLICY payment_status_history_select_finance
  ON public.payment_status_history
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('Admin', 'Vice Chairman', 'Vice President', 'General Manager', 'Managing Director')
    )
  );

REVOKE ALL ON TABLE public.payment_status_history FROM anon, authenticated;
GRANT SELECT ON TABLE public.payment_status_history TO authenticated;

CREATE OR REPLACE FUNCTION public.set_payment_status(
  p_payment_id uuid,
  p_status text,
  p_reference_number text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS public.payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_actor_role text;
  v_payment public.payments;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Authentication is required'; END IF;
  IF p_status IS NULL OR p_status NOT IN ('Paid', 'Failed') THEN
    RAISE EXCEPTION 'Payment status must be Paid or Failed';
  END IF;

  SELECT role INTO v_actor_role
  FROM public.profiles
  WHERE id = v_actor;

  IF v_actor_role NOT IN ('Admin', 'Vice Chairman', 'Vice President', 'General Manager', 'Managing Director') THEN
    RAISE EXCEPTION 'You are not authorized to update payment status';
  END IF;

  SELECT * INTO v_payment
  FROM public.payments
  WHERE id = p_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Payment was not found'; END IF;
  IF v_payment.status <> 'Pending' THEN
    RAISE EXCEPTION 'Only pending payments can be settled';
  END IF;

  UPDATE public.payments
  SET status = p_status, sync_updated_at = now()
  WHERE id = p_payment_id
  RETURNING * INTO v_payment;

  UPDATE public.orders
  SET payment_status = p_status, sync_updated_at = now()
  WHERE id = v_payment.order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'The related order was not found; payment update was rolled back';
  END IF;

  INSERT INTO public.payment_status_history (
    payment_id, order_id, previous_status, new_status,
    reference_number, notes, performed_by
  ) VALUES (
    v_payment.id, v_payment.order_id, 'Pending', p_status,
    NULLIF(btrim(p_reference_number), ''), NULLIF(btrim(p_notes), ''), v_actor
  );

  RETURN v_payment;
END;
$$;

REVOKE ALL ON FUNCTION public.set_payment_status(uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_payment_status(uuid, text, text, text) TO authenticated;
