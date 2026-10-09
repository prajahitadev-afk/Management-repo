export const EMPLOYEE_DEPARTMENTS = [
  "Administration",
  "Marketing",
  "Manufacturing",
  "Transport",
  "Research & Development",
] as const;

export type EmployeeDepartment = (typeof EMPLOYEE_DEPARTMENTS)[number];

export function normalizeDepartmentName(value: string | null | undefined): EmployeeDepartment {
  const normalized = String(value ?? "").trim().toLowerCase();

  if (!normalized) {
    return "Administration";
  }

  const departmentMap: Record<string, EmployeeDepartment> = {
    administration: "Administration",
    admin: "Administration",
    general: "Administration",
    finance: "Administration",
    hr: "Administration",
    operations: "Administration",
    sales: "Administration",
    marketing: "Marketing",
    manufacturing: "Manufacturing",
    transport: "Transport",
    transportation: "Transport",
    "research & development": "Research & Development",
    "research and development": "Research & Development",
    rnd: "Research & Development",
    "r&d": "Research & Development",
  };

  return departmentMap[normalized] ?? "Administration";
}
