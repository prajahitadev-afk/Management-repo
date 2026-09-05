export type EmployeeKpiStatus = "Completed" | "In Progress";

export interface EmployeeKpi {
  id: string;
  employeeId: string;
  metricName: string;
  targetValue: number;
  achievedValue: number;
  reviewMonth: number;
  reviewYear: number;
  status: EmployeeKpiStatus;
  createdAt: string;
}

export interface EmployeeKpiAssignment {
  employeeId: string;
  metricName: string;
  targetValue: number;
  reviewMonth: number;
  reviewYear: number;
}
