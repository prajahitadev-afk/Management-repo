export const ASSIGNABLE_DEPARTMENTS = [
  "Manufacturing",
  "Marketing",
  "Transportation",
  "Research and Development",
] as const;

export type AssignableDepartment = (typeof ASSIGNABLE_DEPARTMENTS)[number];

export interface EmployeeDepartmentHistory {
  id: string;
  employeeId: string;
  previousDepartment: string | null;
  newDepartment: AssignableDepartment;
  changedBy: string;
  createdAt: string;
}
