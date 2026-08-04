export const ORDER_STATUSES = [
  "Pending",
  "Approved",
  "Created",
  "Loaded",
  "Dispatched",
  "In Transit",
  "Delivered",
  "Cancelled",
  "Returned",
] as const;

export const ORDER_STATUS = {
  Pending: "Pending",
  Approved: "Approved",
  Created: "Created",
  Loaded: "Loaded",
  Dispatched: "Dispatched",
  "In Transit": "In Transit",
  Delivered: "Delivered",
  Cancelled: "Cancelled",
  Returned: "Returned",
} as const;

export type OrderStatus = typeof ORDER_STATUSES[number];

const LEGACY_ORDER_STATUS_MAP: Record<string, OrderStatus> = {
  "Pending Approval": "Pending",
  "Submitted": "Pending",
  "Order Approved": "Approved",
  "Processing": "Created",
  "Packed": "Created",
  "Shipped": "Dispatched",
  "Out For Delivery": "In Transit",
  "Confirmed": "Delivered",
  "Completed": "Delivered",
  "Draft": "Pending",
  "Returned for Correction": "Returned",
};

export function isOrderStatus(value: string | null | undefined): value is OrderStatus {
  return ORDER_STATUSES.includes(value as OrderStatus);
}

export function getOrderStatusValue(status: OrderStatus): OrderStatus {
  return status;
}

export function normalizeOrderStatus(value: string | null | undefined): OrderStatus {
  if (!value) return "Pending";
  if (isOrderStatus(value)) return value;
  return LEGACY_ORDER_STATUS_MAP[value] ?? "Pending";
}
