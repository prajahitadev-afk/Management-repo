import { supabase } from "../lib/supabase";
import { notifyOrderApproved, notifyOrderRejected } from "./notification.service";
import { normalizeOrderStatus, isOrderStatus, OrderStatus, ORDER_STATUS } from "./order-statuses";

export interface CreateOrderItemInput {
  product_id: string;
  quantity: number;
  unit_price: number;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function normalizeItems(items: unknown): CreateOrderItemInput[] {
  if (Array.isArray(items)) return items as CreateOrderItemInput[];
  if (typeof items === "string") {
    try {
      const parsed = JSON.parse(items);
      if (Array.isArray(parsed)) return parsed as CreateOrderItemInput[];
    } catch {
      // fall through to error below
    }
  }
  throw new Error("Order items must be provided as a JSON array");
}

export async function getOrders() {
  const { data, error } = await supabase
    .from("orders")
    .select("id, order_number, customer_id, order_date, expected_delivery, status, total_amount, created_by, created_at")
    .order("created_at", { ascending: false });

  if (error) throw error;

  const orders = (data || []) as Array<{
    id: string;
    order_number?: string | null;
    customer_id?: string | null;
    order_date?: string | null;
    expected_delivery?: string | null;
    status?: string | null;
    total_amount?: number | string | null;
    created_by?: string | null;
    created_at?: string | null;
  }>;

  return orders.map((order) => ({
    ...order,
    status: normalizeOrderStatus(order.status),
  }));
}

export async function createOrderWithItems(input: {
  order_number: string;
  customer_id: string;
  order_date: string;
  expected_delivery: string;
  status: OrderStatus;
  total_amount: number;
  created_by: string;
  items: CreateOrderItemInput[] | string;
}): Promise<string> {
  if (!isUuid(input.customer_id)) {
    throw new Error("Customer ID must be a valid UUID");
  }

  if (!isUuid(input.created_by)) {
    throw new Error("Created by must be a valid UUID");
  }

  if (!isOrderStatus(input.status)) {
    throw new Error(`Invalid order status: ${input.status}`);
  }

  const payload = {
    p_order_number: input.order_number,
    p_customer_id: input.customer_id,
    p_order_date: input.order_date,
    p_expected_delivery: input.expected_delivery,
    p_status: input.status,
    p_total_amount: input.total_amount,
    p_created_by: input.created_by,
    p_items: normalizeItems(input.items),
  };

  console.log("RPC Payload", payload);

  const { data, error } = await supabase.rpc("create_order_with_items", payload);
  if (error) {
    console.error("RPC ERROR", error);
    console.error("RPC ERROR JSON", JSON.stringify(error, null, 2));
  }
  if (typeof data !== "string") throw new Error("Order transaction did not return an order id");
  return data;
}

export async function approveOrder(orderId: string, orderNumber: string): Promise<void> {
  const { data, error } = await supabase
    .from("orders")
    .update({ status: ORDER_STATUS.Approved })
    .eq("id", orderId)
    .select("id")
    .single();
  if (error) throw error;
  if (!data || !data.id) throw new Error("Failed to update order status");
  await notifyOrderApproved(orderId, orderNumber);
}

export async function rejectOrder(orderId: string, orderNumber: string, reason?: string): Promise<void> {
  const { error } = await supabase.from("orders").update({ status: ORDER_STATUS.Returned }).eq("id", orderId);
  if (error) throw error;
  await notifyOrderRejected(orderId, orderNumber, reason);
}
