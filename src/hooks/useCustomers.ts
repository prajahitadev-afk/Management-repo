import { useEffect, useState } from "react";
import { getCustomers } from "../services/customers.service";

export interface Customer {
  id: string;
  customer_code: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  status: string | null;
  created_at: string | null;
}

export function useCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refreshCustomers() {
    try {
      setLoading(true);
      const data = await getCustomers();
      setCustomers(data || []);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load customers"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refreshCustomers();
  }, []);

  return {
    customers,
    loading,
    error,
    refreshCustomers,
  };
}