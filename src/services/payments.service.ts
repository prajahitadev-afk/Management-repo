import { supabase } from "../lib/supabase";

export type PaymentStatus = "Pending" | "Paid" | "Failed";

export interface PaymentRow {
  id: string;
  order_id: string | null;
  amount: number | string | null;
  payment_method: string | null;
  status: PaymentStatus | null;
  created_at: string | null;
  order_number?: string;
  customer_name?: string;
}

const PAYMENT_MANAGEMENT_ROLES = new Set([
  "Admin",
  "Vice Chairman",
  "Vice President",
  "General Manager",
  "Managing Director",
]);

export async function getCanManagePayments(): Promise<boolean> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  const userId = authData.user?.id;
  if (!userId) return false;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return PAYMENT_MANAGEMENT_ROLES.has(String(profile?.role ?? ""));
}

export async function getPayments(): Promise<PaymentRow[]> {
  const { data: payments, error: paymentsError } = await supabase
    .from("payments")
    .select("id, order_id, amount, payment_method, status, created_at")
    .order("created_at", { ascending: false });

  if (paymentsError) throw paymentsError;
  const rows = (payments ?? []) as PaymentRow[];
  if (!rows.length) return [];

  const orderIds = [...new Set(rows.map((payment) => payment.order_id).filter((id): id is string => Boolean(id)))];
  if (!orderIds.length) return rows;

  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select("id, order_number, customer_id, customer_name")
    .in("id", orderIds);

  if (ordersError) throw ordersError;
  const orderRows = orders ?? [];
  const customerIds = [...new Set(orderRows.map((order) => String(order.customer_id ?? "")).filter(Boolean))];
  let customers: Array<{ id: string; name?: string | null; email?: string | null }> = [];

  if (customerIds.length) {
    const { data, error } = await supabase
      .from("customers")
      .select("id, name, email")
      .in("id", customerIds);
    if (error) throw error;
    customers = (data ?? []) as typeof customers;
  }

  const orderMap = new Map(orderRows.map((order) => [String(order.id), order]));
  const customerMap = new Map(customers.map((customer) => [String(customer.id), customer]));

  return rows.map((payment) => {
    const order = orderMap.get(String(payment.order_id));
    const customer = order ? customerMap.get(String(order.customer_id)) : undefined;
    return {
      ...payment,
      order_number: order?.order_number ?? "N/A",
      customer_name: order?.customer_name ?? customer?.name ?? customer?.email ?? "Unknown Customer",
    };
  });
}

export async function setPaymentStatus(
  paymentId: string,
  status: Exclude<PaymentStatus, "Pending">,
  referenceNumber?: string,
  notes?: string,
): Promise<PaymentRow> {
  if (!paymentId.trim()) throw new Error("Payment ID is required");
  const { data, error } = await supabase.rpc("set_payment_status", {
    p_payment_id: paymentId,
    p_status: status,
    p_reference_number: referenceNumber?.trim() || null,
    p_notes: notes?.trim() || null,
  });
  if (error) throw error;
  if (!data) throw new Error("Payment status was not updated");
  return data as PaymentRow;
}
