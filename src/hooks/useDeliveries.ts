import { useEffect, useState } from "react";
import { getDeliveries } from "../services/deliveries.service";

export interface Delivery {
  id: string;
  order_id: string;
  vehicle_id: string;
  dispatch_date: string;
  delivery_date: string;
  status: string;
  created_at: string;

  orders?: {
    order_number: string;
  };
}

export function useDeliveries() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refreshDeliveries() {
    try {
      setLoading(true);
      const data = await getDeliveries();
      setDeliveries(data || []);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load deliveries"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refreshDeliveries();
  }, []);

  return {
    deliveries,
    loading,
    error,
    refreshDeliveries,
  };
}