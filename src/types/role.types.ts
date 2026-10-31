export const EMPLOYEE_ROLES = [
  "Vice Chairman",
  "President",
  "Vice President",
  "Managing Director",
  "MD-Manufacturing",
  "MD-Marketing",
  "MD-Transport",
  "MD-RD",
  "General Manager",
  "Chief Manager",
  "Manager",
  "Supervisor",
  "Worker",
] as const;

export type EmployeeRole = (typeof EMPLOYEE_ROLES)[number];

export interface RoleAssignment {
  employeeId: string;
  role: EmployeeRole;
}
