-- Deduct paid leave balances exactly once when the final approver approves.
-- Keep a ledger entry so every balance change is explainable and auditable.

CREATE TABLE IF NOT EXISTS public.leave_balance_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  leave_request_id uuid NOT NULL REFERENCES public.leave_requests(id) ON DELETE RESTRICT,
  leave_type text NOT NULL CHECK (leave_type IN ('Casual', 'Sick', 'Earned', 'Unpaid')),
  transaction_type text NOT NULL CHECK (transaction_type IN ('debit', 'reversal')),
  days integer NOT NULL CHECK (days > 0),
  performed_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT leave_balance_transactions_request_type_unique UNIQUE (leave_request_id, transaction_type)
);

ALTER TABLE public.leave_balance_transactions ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS leave_balance_transactions_employee_created_idx
  ON public.leave_balance_transactions (employee_id, created_at DESC);
CREATE INDEX IF NOT EXISTS leave_balance_transactions_request_idx
  ON public.leave_balance_transactions (leave_request_id);
DROP POLICY IF EXISTS leave_balance_transactions_select_scoped ON public.leave_balance_transactions;
CREATE POLICY leave_balance_transactions_select_scoped
  ON public.leave_balance_transactions
  FOR SELECT TO authenticated
  USING (
    employee_id = auth.uid()
    OR public.is_in_my_hierarchy(employee_id)
    OR public.is_executive()
  );

REVOKE ALL ON TABLE public.leave_balance_transactions FROM anon, authenticated;
GRANT SELECT ON TABLE public.leave_balance_transactions TO authenticated;

CREATE OR REPLACE FUNCTION public.review_leave_request(
  p_leave_id uuid,
  p_decision text,
  p_remarks text DEFAULT NULL
)
RETURNS public.leave_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_request public.leave_requests%rowtype;
  v_actor_role text;
  v_next_approver uuid;
  v_balance_updated integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_request
  FROM public.leave_requests
  WHERE id = p_leave_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Leave request not found';
  END IF;
  IF v_request.status <> 'Pending' THEN
    RAISE EXCEPTION 'Only pending leave requests can be reviewed';
  END IF;
  IF v_request.current_approver_id <> auth.uid() THEN
    RAISE EXCEPTION 'This leave request is not assigned to you';
  END IF;
  IF p_decision IS NULL OR p_decision NOT IN ('Approved', 'Rejected') THEN
    RAISE EXCEPTION 'Invalid leave decision';
  END IF;

  SELECT role INTO v_actor_role
  FROM public.profiles
  WHERE id = auth.uid();

  IF p_decision = 'Rejected' THEN
    UPDATE public.leave_requests
    SET status = 'Rejected', current_approver_id = NULL, updated_at = now()
    WHERE id = p_leave_id
    RETURNING * INTO v_request;

    INSERT INTO public.leave_approval_history(leave_request_id, approver_id, action, remarks)
    VALUES (p_leave_id, auth.uid(), 'Rejected', NULLIF(btrim(p_remarks), ''));

    PERFORM public.leave_notification(
      v_request.employee_id, 'leave_rejected', 'Leave request rejected',
      COALESCE(NULLIF(btrim(p_remarks), ''), 'Your leave request was rejected.'), p_leave_id
    );
    PERFORM public.leave_audit(auth.uid(), 'leave_rejected', p_leave_id, NULL, NULL);
    RETURN v_request;
  END IF;

  INSERT INTO public.leave_approval_history(leave_request_id, approver_id, action, remarks)
  VALUES (p_leave_id, auth.uid(), 'Approved', NULLIF(btrim(p_remarks), ''));

  SELECT reports_to INTO v_next_approver
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_actor_role IN ('Managing Director', 'MD-Manufacturing', 'MD-Marketing', 'MD-Transport', 'MD-RD') THEN
    -- Deduct only at final approval. The guarded update and ledger insert are
    -- in the same transaction as the status transition.
    UPDATE public.leave_balances
    SET casual_leave = CASE WHEN v_request.leave_type = 'Casual' THEN COALESCE(casual_leave, 0) - v_request.total_days ELSE COALESCE(casual_leave, 0) END,
        sick_leave = CASE WHEN v_request.leave_type = 'Sick' THEN COALESCE(sick_leave, 0) - v_request.total_days ELSE COALESCE(sick_leave, 0) END,
        earned_leave = CASE WHEN v_request.leave_type = 'Earned' THEN COALESCE(earned_leave, 0) - v_request.total_days ELSE COALESCE(earned_leave, 0) END,
        unpaid_leave = CASE WHEN v_request.leave_type = 'Unpaid' THEN COALESCE(unpaid_leave, 0) - v_request.total_days ELSE COALESCE(unpaid_leave, 0) END,
        updated_at = now()
    WHERE employee_id = v_request.employee_id
      AND CASE v_request.leave_type
        WHEN 'Casual' THEN COALESCE(casual_leave, 0) >= v_request.total_days
        WHEN 'Sick' THEN COALESCE(sick_leave, 0) >= v_request.total_days
        WHEN 'Earned' THEN COALESCE(earned_leave, 0) >= v_request.total_days
        WHEN 'Unpaid' THEN COALESCE(unpaid_leave, 0) >= v_request.total_days
        ELSE false
      END;

    GET DIAGNOSTICS v_balance_updated = ROW_COUNT;
    IF v_balance_updated <> 1 THEN
      RAISE EXCEPTION 'Insufficient % leave balance for this request', v_request.leave_type;
    END IF;

    INSERT INTO public.leave_balance_transactions (
      employee_id, leave_request_id, leave_type, transaction_type, days, performed_by
    ) VALUES (
      v_request.employee_id, p_leave_id, v_request.leave_type, 'debit',
      v_request.total_days, auth.uid()
    );

    UPDATE public.leave_requests
    SET status = 'Approved', current_approver_id = NULL, updated_at = now()
    WHERE id = p_leave_id
    RETURNING * INTO v_request;

    PERFORM public.leave_notification(
      v_request.employee_id, 'leave_approved', 'Leave request approved',
      'Your leave request has been approved.', p_leave_id
    );
  ELSE
    IF v_next_approver IS NULL THEN
      RAISE EXCEPTION 'Next approver is not configured';
    END IF;

    UPDATE public.leave_requests
    SET current_approver_id = v_next_approver, updated_at = now()
    WHERE id = p_leave_id
    RETURNING * INTO v_request;

    PERFORM public.leave_notification(
      v_next_approver, 'leave_submitted', 'Leave request requires approval',
      'A leave request is waiting for your approval.', p_leave_id
    );
  END IF;

  PERFORM public.leave_audit(auth.uid(), 'leave_approved', p_leave_id, NULL, NULL);
  RETURN v_request;
END;
$function$;

REVOKE ALL ON FUNCTION public.review_leave_request(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_leave_request(uuid, text, text) TO authenticated;
