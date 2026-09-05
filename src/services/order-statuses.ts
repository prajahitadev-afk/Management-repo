export const ORDER_STATUSES = [
  "Pending",
  "Approved",
  "Dispatched",
  "Delivered",
  "Rejected",
] as const;

export const ORDER_STATUS = {
  Pending: "Pending",
  Approved: "Approved",
  Dispatched: "Dispatched",
  Delivered: "Delivered",
  Rejected: "Rejected",
} as const;

export type OrderStatus = typeof ORDER_STATUSES[number];

const LEGACY_ORDER_STATUS_MAP: Record<string, OrderStatus> = {
  "Pending Approval": "Pending",
  "Submitted": "Pending",
  "Order Approved": "Approved",
  "Processing": "Pending",
  "Packed": "Pending",
  "Created": "Approved",
  "Loaded": "Approved",
  "Shipped": "Dispatched",
  "Out For Delivery": "Dispatched",
  "In Transit": "Dispatched",
  "Confirmed": "Delivered",
  "Completed": "Delivered",
  "Draft": "Pending",
  "Cancelled": "Rejected",
  "Returned": "Rejected",
  "Returned for Correction": "Rejected",
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
