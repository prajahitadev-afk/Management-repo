-- Consistent trip, distance, fuel, delay, and target writes. The operational
-- delivery tables remain separate but can reference the same employee identity.

CREATE OR REPLACE FUNCTION public.list_transport_trips()
RETURNS TABLE (
  id uuid, trip_code text, driver_id uuid, origin text, destination text,
  trip_date date, status text, created_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication is required'; END IF;
  IF NOT public.same_department('Transportation') AND NOT public.is_executive() THEN
    RAISE EXCEPTION 'Only Transportation staff can view trips';
  END IF;
  RETURN QUERY
  SELECT t.id, t.trip_code, t.driver_id, t.origin, t.destination, t.trip_date, t.status, t.created_at
  FROM public.transport_trips t
  ORDER BY t.trip_date DESC, t.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_transport_trip(
  p_driver_id uuid, p_origin text, p_destination text, p_trip_date date
)
RETURNS public.transport_trips
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_role text;
  v_trip public.transport_trips;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Authentication is required'; END IF;
  SELECT role INTO v_role FROM public.profiles WHERE id = v_actor;
  IF v_role NOT IN ('Admin','Manager','General Manager','MD-Transport','Managing Director','Vice Chairman','Vice President') THEN
    RAISE EXCEPTION 'You are not authorized to create trips';
  END IF;
  IF p_driver_id IS NULL OR NULLIF(btrim(p_origin),'') IS NULL
     OR NULLIF(btrim(p_destination),'') IS NULL OR p_trip_date IS NULL THEN
    RAISE EXCEPTION 'Driver, origin, destination, and trip date are required';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = p_driver_id
      AND lower(btrim(COALESCE(p.department,''))) = 'transportation'
  ) THEN
    RAISE EXCEPTION 'Driver must belong to Transportation';
  END IF;

  INSERT INTO public.transport_trips (
    trip_code, driver_id, origin, destination, trip_date, status
  ) VALUES (
    'TRP-' || to_char(p_trip_date, 'YYYYMMDD') || '-' || upper(substr(gen_random_uuid()::text, 1, 8)),
    p_driver_id, btrim(p_origin), btrim(p_destination), p_trip_date, 'Planned'
  )
  RETURNING * INTO v_trip;
  RETURN v_trip;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_transport_trip(
  p_trip_id uuid, p_status text
)
RETURNS public.transport_trips
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_trip public.transport_trips;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Authentication is required'; END IF;
  SELECT * INTO v_trip FROM public.transport_trips WHERE id = p_trip_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Trip was not found'; END IF;
  IF v_actor <> v_trip.driver_id
     AND NOT public.is_in_my_hierarchy(v_trip.driver_id)
     AND NOT public.is_department_md()
     AND NOT public.is_executive() THEN
    RAISE EXCEPTION 'You are not authorized to update this trip';
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('Planned','In Progress','Completed','Cancelled') THEN
    RAISE EXCEPTION 'Invalid trip status';
  END IF;
  IF v_trip.status = 'Planned' AND p_status NOT IN ('In Progress','Cancelled') AND p_status <> v_trip.status THEN
    RAISE EXCEPTION 'A planned trip can only start or be cancelled';
  END IF;
  IF v_trip.status = 'In Progress' AND p_status NOT IN ('Completed','Cancelled') AND p_status <> v_trip.status THEN
    RAISE EXCEPTION 'An in-progress trip can only be completed or cancelled';
  END IF;
  IF v_trip.status IN ('Completed','Cancelled') AND p_status <> v_trip.status THEN
    RAISE EXCEPTION 'Completed or cancelled trips cannot be reopened';
  END IF;
  UPDATE public.transport_trips SET status = p_status WHERE id = p_trip_id RETURNING * INTO v_trip;
  RETURN v_trip;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_transport_distance(
  p_trip_id uuid, p_distance_km numeric, p_recorded_at timestamptz
)
RETURNS public.transport_distance_logs
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_trip public.transport_trips;
  v_log public.transport_distance_logs;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Authentication is required'; END IF;
  IF p_distance_km IS NULL OR p_distance_km <= 0 OR p_recorded_at IS NULL THEN
    RAISE EXCEPTION 'Positive distance and recorded date are required';
  END IF;
  SELECT * INTO v_trip FROM public.transport_trips WHERE id = p_trip_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Trip was not found'; END IF;
  IF v_trip.status IN ('Completed','Cancelled') THEN RAISE EXCEPTION 'Trip is closed'; END IF;
  IF v_actor <> v_trip.driver_id
     AND NOT public.is_in_my_hierarchy(v_trip.driver_id)
     AND NOT public.is_department_md()
     AND NOT public.is_executive() THEN
    RAISE EXCEPTION 'You are not authorized to record distance for this trip';
  END IF;
  INSERT INTO public.transport_distance_logs(trip_id, distance_km, recorded_at)
  VALUES (p_trip_id, p_distance_km, p_recorded_at)
  RETURNING * INTO v_log;
  RETURN v_log;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_transport_fuel(
  p_trip_id uuid, p_fuel_litres numeric, p_fuel_cost numeric, p_recorded_at timestamptz
)
RETURNS public.transport_fuel_logs
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_trip public.transport_trips;
  v_log public.transport_fuel_logs;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Authentication is required'; END IF;
  IF p_fuel_litres IS NULL OR p_fuel_litres <= 0
     OR p_fuel_cost IS NULL OR p_fuel_cost < 0 OR p_recorded_at IS NULL THEN
    RAISE EXCEPTION 'Positive fuel quantity, non-negative cost, and date are required';
  END IF;
  SELECT * INTO v_trip FROM public.transport_trips WHERE id = p_trip_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Trip was not found'; END IF;
  IF v_trip.status IN ('Completed','Cancelled') THEN RAISE EXCEPTION 'Trip is closed'; END IF;
  IF v_actor <> v_trip.driver_id
     AND NOT public.is_in_my_hierarchy(v_trip.driver_id)
     AND NOT public.is_department_md()
     AND NOT public.is_executive() THEN
    RAISE EXCEPTION 'You are not authorized to record fuel for this trip';
  END IF;
  INSERT INTO public.transport_fuel_logs(trip_id, fuel_litres, fuel_cost, recorded_at)
  VALUES (p_trip_id, p_fuel_litres, p_fuel_cost, p_recorded_at)
  RETURNING * INTO v_log;
  RETURN v_log;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_transport_delay(
  p_trip_id uuid, p_delay_minutes integer, p_reason text, p_recorded_at timestamptz
)
RETURNS public.transport_delay_logs
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_trip public.transport_trips;
  v_log public.transport_delay_logs;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Authentication is required'; END IF;
  IF p_delay_minutes IS NULL OR p_delay_minutes <= 0
     OR NULLIF(btrim(p_reason),'') IS NULL OR p_recorded_at IS NULL THEN
    RAISE EXCEPTION 'Positive delay duration, reason, and date are required';
  END IF;
  SELECT * INTO v_trip FROM public.transport_trips WHERE id = p_trip_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Trip was not found'; END IF;
  IF v_actor <> v_trip.driver_id
     AND NOT public.is_in_my_hierarchy(v_trip.driver_id)
     AND NOT public.is_department_md()
     AND NOT public.is_executive() THEN
    RAISE EXCEPTION 'You are not authorized to record a delay for this trip';
  END IF;
  INSERT INTO public.transport_delay_logs(trip_id, delay_minutes, reason, recorded_at)
  VALUES (p_trip_id, p_delay_minutes, btrim(p_reason), p_recorded_at)
  RETURNING * INTO v_log;
  RETURN v_log;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_transport_target(
  p_target_deliveries integer, p_period_start date, p_period_end date
)
RETURNS public.transport_targets
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_role text;
  v_target public.transport_targets;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Authentication is required'; END IF;
  SELECT role INTO v_role FROM public.profiles WHERE id = v_actor;
  IF v_role NOT IN ('Admin','Manager','General Manager','MD-Transport','Managing Director','Vice Chairman','Vice President') THEN
    RAISE EXCEPTION 'You are not authorized to create transportation targets';
  END IF;
  IF p_target_deliveries IS NULL OR p_target_deliveries <= 0
     OR p_period_start IS NULL OR p_period_end IS NULL OR p_period_end < p_period_start THEN
    RAISE EXCEPTION 'Valid positive target and date range are required';
  END IF;
  INSERT INTO public.transport_targets (
    target_name, target_period, target_deliveries, actual_deliveries,
    manager_id, start_date, end_date, status
  ) VALUES (
    'Delivery target ' || p_period_start::text || ' - ' || p_period_end::text,
    p_period_start::text || ' to ' || p_period_end::text,
    p_target_deliveries, 0, v_actor, p_period_start, p_period_end, 'Active'
  )
  RETURNING * INTO v_target;
  RETURN v_target;
END;
$$;

REVOKE ALL ON FUNCTION public.list_transport_trips() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_transport_trip(uuid,text,text,date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_transport_trip(uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_transport_distance(uuid,numeric,timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_transport_fuel(uuid,numeric,numeric,timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_transport_delay(uuid,integer,text,timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_transport_target(integer,date,date) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.list_transport_trips() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_transport_trip(uuid,text,text,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_transport_trip(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_transport_distance(uuid,numeric,timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_transport_fuel(uuid,numeric,numeric,timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_transport_delay(uuid,integer,text,timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_transport_target(integer,date,date) TO authenticated;
