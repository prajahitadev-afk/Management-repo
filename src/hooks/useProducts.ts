import { useEffect, useState } from "react";
import { getProducts } from "../services/products.service";

export interface Product {
  id: string;
  name: string;
  price: number;
  stock_quantity: number;
  product_code?: string;
  category?: string;
  category_id?: string | null;
  original_price?: number | null;
  weight?: string | null;
  fragrance?: string | null;
  rating?: number;
  review_count?: number;
  badge?: string | null;
  usage?: string | null;
  precautions?: string | null;
  collection?: string | null;
  description?: string | null;
  status?: string;
  tagline?: string | null;
  created_at?: string;
  updated_at?: string;
}

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refreshProducts() {
    try {
      setLoading(true);
      const data = await getProducts();
      setProducts(data || []);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load products"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refreshProducts();
  }, []);

  return {
    products,
    loading,
    error,
    refreshProducts,
  };
}