import { useEffect, useState, useCallback } from "react";
import { getOrganizationChart } from "../services/employee.service";
import type { OrganizationNode } from "../types/employee.types";

export function useOrganizationChart() {
  const [nodes, setNodes] = useState<OrganizationNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const nextNodes = await getOrganizationChart();
      setNodes(nextNodes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load organization chart");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { nodes, loading, error, refresh };
}
