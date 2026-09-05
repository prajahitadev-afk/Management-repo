import { useEffect, useState, useCallback } from "react";
import { getEmployeeHierarchyTree, getHierarchyEmployees } from "../services/employee-hierarchy.service";
import type { EmployeeHierarchyNode, HierarchyEmployee } from "../types/employee-hierarchy.types";

interface UseOrganizationChartOptions {
  userId?: string;
}

export function useOrganizationChart({ userId }: UseOrganizationChartOptions = {}) {
  const [nodes, setNodes] = useState<EmployeeHierarchyNode[]>([]);
  const [employees, setEmployees] = useState<HierarchyEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [nextNodes, nextEmployees] = await Promise.all([getEmployeeHierarchyTree(), getHierarchyEmployees()]);
      setNodes(nextNodes);
      setEmployees(nextEmployees);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load organization chart");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { nodes, employees, loading, error, refresh };
}
