import { supabase } from "../lib/supabase";

export interface PaymentRow { id: string; order_id: string | null; amount: number | string | null; payment_method: string | null; status: string | null; created_at: string | null; order_number?: string; customer_name?: string; }

export async function getPayments(): Promise<PaymentRow[]> {
  const { data: payments, error: paymentsError } = await supabase.from("payments").select("*").order("created_at", { ascending: false });
  console.log("PAYMENTS RAW", payments);
  console.log("PAYMENTS ERROR", paymentsError);
  console.log("[Payments runtime trace]", { ordersCount: 0, customersCount: 0, orderItemsCount: 0, paymentsCount: payments?.length ?? 0, error: paymentsError?.message ?? null });
  if (paymentsError) {
    console.error("QUERY FAILED", paymentsError);
    throw paymentsError;
  }
  const rows = payments ?? [];
  const { data: orders, error: ordersError } = await supabase.from("orders").select("*");
  console.log("PAYMENT ORDERS RAW", orders);
  console.log("PAYMENT ORDERS ERROR", ordersError);
  if (ordersError) {
    console.error("QUERY FAILED", ordersError);
    throw ordersError;
  }
  const { data: customers, error: customersError } = await supabase.from("customers").select("*");
  console.log("PAYMENT CUSTOMERS RAW", customers);
  console.log("PAYMENT CUSTOMERS ERROR", customersError);
  if (customersError) {
    console.error("QUERY FAILED", customersError);
    throw customersError;
  }
  const orderMap = new Map((orders ?? []).map((order) => [String(order.id), order]));
  const customerMap = new Map((customers ?? []).map((customer) => [String(customer.id), customer]));
  return rows.map((payment) => {
    const order = orderMap.get(String(payment.order_id));
    const customer = customerMap.get(String(order?.customer_id));
    const customerName = customer?.name ?? customer?.email ?? "Unknown Customer";
    return { ...payment, order_number: order?.order_number ?? "N/A", customer_name: customerName };
  });
}
