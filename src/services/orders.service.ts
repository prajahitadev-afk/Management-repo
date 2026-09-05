import { supabase } from "../lib/supabase";
import { notifyOrderApproved, notifyOrderRejected } from "./notification.service";
import { normalizeOrderStatus, isOrderStatus, OrderStatus, ORDER_STATUS } from "./order-statuses";

export interface CreateOrderItemInput {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface OrderDetailItem {
  id: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface OrderDetails {
  items: OrderDetailItem[];
  grandTotal: number;
}

const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  Pending: [ORDER_STATUS.Approved, ORDER_STATUS.Rejected],
  Approved: [ORDER_STATUS.Dispatched],
  Dispatched: [ORDER_STATUS.Delivered],
  Delivered: [],
  Rejected: [],
};

export async function transitionOrderStatus(orderId: string, nextStatus: OrderStatus): Promise<void> {
  const { data: current, error: currentError } = await supabase.from("orders").select("status").eq("id", orderId).single();
  if (currentError) throw currentError;
  const currentStatus = normalizeOrderStatus(current.status);
  if (!ORDER_TRANSITIONS[currentStatus].includes(nextStatus)) {
    throw new Error(`Invalid order transition from ${currentStatus} to ${nextStatus}.`);
  }
  const { data, error } = await supabase.from("orders").update({ status: nextStatus }).eq("id", orderId).select("id, status").single();
  if (error) throw error;
  if (!data?.id || data.status !== nextStatus) throw new Error("Order status update was not confirmed.");
  window.dispatchEvent(new CustomEvent("order-workflow-changed"));
}

export async function dispatchOrder(orderId: string): Promise<void> {
  await transitionOrderStatus(orderId, ORDER_STATUS.Dispatched);
}

export async function getOrderDetails(orderId: string): Promise<OrderDetails> {
  const { data: orderItems, error: itemsError } = await supabase.from("order_items").select("*").eq("order_id", orderId);
  console.log("ORDER_ITEMS RAW", orderItems);
  console.log("ORDER_ITEMS ERROR", itemsError);
  if (itemsError) {
    console.error("QUERY FAILED", itemsError);
    throw itemsError;
  }
  const rows = (orderItems ?? []) as Array<{ id: string; product_id: string | null; product_name: string | null; quantity: number | null; unit_price: number | string | null; total_price: number | string | null }>;
  const needsProductLookup = rows.some((item) => !item.product_name);
  let products: Array<{ id: string; name: string | null }> = [];
  if (needsProductLookup) {
    const { data, error: productsError } = await supabase.from("products").select("*");
    console.log("PRODUCTS RAW", data);
    console.log("PRODUCTS ERROR", productsError);
    if (productsError) {
      console.error("QUERY FAILED", productsError);
      throw productsError;
    }
    products = (data ?? []) as Array<{ id: string; name: string | null }>;
  }
  const productMap = new Map(products.map((product) => [String(product.id), product]));
  const items = rows.map((item) => {
    const quantity = Number(item.quantity ?? 0);
    const unitPrice = Number(item.unit_price ?? 0);
    return {
      id: item.id,
      productName: item.product_name || productMap.get(String(item.product_id))?.name || "Unknown Product",
      quantity,
      unitPrice,
      totalPrice: Number(item.total_price ?? unitPrice * quantity),
    };
  });
  return { items, grandTotal: items.reduce((sum, item) => sum + item.totalPrice, 0) };
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

  console.log("ORDERS RAW", data);
  console.log("ORDERS ERROR", error);

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
  payment_method: string;
  items: CreateOrderItemInput[] | string;
}): Promise<string> {
  if (!input.customer_id.trim()) {
    throw new Error("Customer ID is required");
  }

  if (!isOrderStatus(input.status)) {
    throw new Error(`Invalid order status: ${input.status}`);
  }

  if (input.status !== ORDER_STATUS.Pending) throw new Error("New orders must start in Pending status.");
  const items = normalizeItems(input.items);
  const orderId = crypto.randomUUID();
  const orderPayload = {
    id: orderId,
    order_number: input.order_number,
    customer_id: input.customer_id,
    order_date: input.order_date,
    expected_delivery: input.expected_delivery,
    status: ORDER_STATUS.Pending,
    total_amount: input.total_amount,
  };
  console.log("ORDER INSERT PAYLOAD", orderPayload);
  console.log("ORDER INSERT TYPES", {
    total_amount: typeof orderPayload.total_amount,
    customer_id: typeof orderPayload.customer_id,
  });
  const { data: order, error: orderError } = await supabase.from("orders").insert(orderPayload).select("id").single();
  console.log("ORDER INSERT ERROR", orderError);
  if (orderError) {
    console.error("ORDER INSERT FAILED", orderError);
    throw orderError;
  }
  if (!order?.id) throw new Error("Order insert did not return an id");

  const itemPayload = items.map((item) => ({
    id: crypto.randomUUID(),
    order_id: orderId,
    product_id: item.product_id,
    product_name: item.product_name,
    quantity: item.quantity,
    unit_price: item.unit_price,
    total_price: item.total_price,
  }));
  console.log("ORDER ITEMS INSERT PAYLOAD", itemPayload);
  const { error: itemsError } = await supabase.from("order_items").insert(itemPayload);
  console.log("ORDER ITEMS INSERT ERROR", itemsError);
  if (itemsError) {
    console.error("ORDER ITEMS INSERT FAILED", itemsError);
    throw itemsError;
  }

  const paymentPayload = {
    order_id: orderId,
    amount: input.total_amount,
    payment_method: input.payment_method,
    status: "Pending",
  };
  console.log("PAYMENT INSERT PAYLOAD", paymentPayload);
  const { error: paymentError } = await supabase.from("payments").insert(paymentPayload);
  console.log("PAYMENT INSERT ERROR", paymentError);
  if (paymentError) {
    console.error("PAYMENT INSERT FAILED", paymentError);
    throw paymentError;
  }
  return orderId;
}

export async function approveOrder(orderId: string, orderNumber: string, actorRole?: string): Promise<void> {
  if (!canApproveOrderRole(actorRole)) {
    throw new Error("You are not authorized to approve orders.");
  }
  await transitionOrderStatus(orderId, ORDER_STATUS.Approved);
  await notifyOrderApproved(orderId, orderNumber);
}

export async function rejectOrder(orderId: string, orderNumber: string, reason?: string, actorRole?: string): Promise<void> {
  if (!canApproveOrderRole(actorRole)) {
    throw new Error("You are not authorized to reject orders.");
  }
  await transitionOrderStatus(orderId, ORDER_STATUS.Rejected);
  await notifyOrderRejected(orderId, orderNumber, reason);
}

function canApproveOrderRole(role?: string): boolean {
  return ["Vice Chairman", "Vice President", "MD-Marketing", "MD-Transport", "General Manager"].includes(role ?? "");
}
