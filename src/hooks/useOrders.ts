import { useEffect, useState } from "react";
import { getOrders } from "../services/orders.service";

export interface Order {
  id: string;
  order_number?: string | null;
  customer_id?: string | null;
  order_date?: string | null;
  expected_delivery?: string | null;
  status: string;
  total_amount?: number | string | null;
  created_by?: string | null;
  created_at?: string | null;

  customers?: {
    name?: string;
  };
}

export function useOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refreshOrders() {
    try {
      setLoading(true);
      const data = await getOrders();
      setOrders(data || []);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load orders"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refreshOrders();
  }, []);

  return {
    orders,
    loading,
    error,
    refreshOrders,
  };
}