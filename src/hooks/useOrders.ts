import { useEffect, useState } from "react";
import { getOrders } from "../services/orders.service";

export interface Order {
  id: string;
  order_number: string;
  customer_id: string;
  order_date: string;
  expected_delivery: string;
  status: string;
  total_amount: number;
  created_by: string;
  created_at: string;

  customers?: {
    first_name?: string;
    last_name?: string;
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