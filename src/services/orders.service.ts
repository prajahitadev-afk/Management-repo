import { supabase } from "../lib/supabase";
import { notifyOrderApproved, notifyOrderRejected } from "./notification.service";

export interface CreateOrderItemInput {
  product_id: string;
  quantity: number;
  unit_price: number;
}

export async function getOrders() {
  const { data, error } = await supabase
    .from("orders")
    .select("id, order_number, customer_id, order_date, expected_delivery, status, total_amount, created_by, created_at")
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data || [];
}

export async function createOrderWithItems(input: {
  order_number: string;
  customer_id: string;
  order_date: string;
  expected_delivery: string;
  status: string;
  total_amount: number;
  items: CreateOrderItemInput[];
}): Promise<string> {
  const { data, error } = await supabase.rpc("create_order_with_items", {
    p_order_number: input.order_number,
    p_customer_id: input.customer_id,
    p_order_date: input.order_date,
    p_expected_delivery: input.expected_delivery,
    p_status: input.status,
    p_total_amount: input.total_amount,
    p_items: input.items,
  });
  if (error) throw error;
  if (typeof data !== "string") throw new Error("Order transaction did not return an order id");
  return data;
}

export async function approveOrder(orderId: string, orderNumber: string): Promise<void> {
  const { data, error } = await supabase
    .from("orders")
    .update({ status: "Approved" })
    .eq("id", orderId)
    .select("id")
    .single();
  if (error) throw error;
  if (!data || !data.id) throw new Error("Failed to update order status");
  await notifyOrderApproved(orderId, orderNumber);
}

export async function rejectOrder(orderId: string, orderNumber: string, reason?: string): Promise<void> {
  const { error } = await supabase.from("orders").update({ status: "Rejected" }).eq("id", orderId);
  if (error) throw error;
  await notifyOrderRejected(orderId, orderNumber, reason);
}
