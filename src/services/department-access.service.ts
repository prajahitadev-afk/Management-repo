import { normalizeDepartment, type DepartmentKey } from "./department.service";

export type DepartmentRole = "Worker" | "Supervisor" | "Manager" | "Chief Manager" | "General Manager" | "MD" | "Admin";

const roleKey = (role: string | null | undefined): DepartmentRole => {
  if (role === "Admin") return "Admin";
  if (String(role ?? "").startsWith("MD-") || role === "Managing Director") return "MD";
  if (role === "Supervisor" || role === "Manager" || role === "Chief Manager" || role === "General Manager") return role;
  return "Worker";
};

const tabs: Record<DepartmentKey, Record<DepartmentRole, string[]>> = {
  manufacturing: {
    Worker: ["Production", "Defects", "Hours"], Supervisor: ["Team Output", "Quality"], Manager: ["Targets"], "Chief Manager": ["Department Output"], "General Manager": ["Production Analytics"], MD: ["Strategy"], Admin: ["Production", "Defects", "Hours", "Team Output", "Quality", "Targets", "Department Output", "Production Analytics", "Strategy"],
  },
  marketing: {
    Worker: ["Leads", "Conversions", "My Performance"], Supervisor: ["Team Performance", "Lead Review", "Conversion Review"], Manager: ["Campaigns", "Revenue", "Targets"], "Chief Manager": ["Marketing Efficiency"], "General Manager": ["Department Analytics"], MD: ["Revenue & Growth"], Admin: ["Leads", "Conversions", "My Performance", "Team Performance", "Lead Review", "Conversion Review", "Campaigns", "Revenue", "Targets", "Marketing Efficiency", "Department Analytics", "Revenue & Growth"],
  },
  transportation: {
    Worker: ["Deliveries", "Distance", "Fuel", "Trips"], Supervisor: ["Driver Performance", "Delay Tracking", "Team Trips"], Manager: ["Fleet Operations", "Route Planning", "Vehicle Status", "Utilization"], "Chief Manager": ["Route Efficiency", "Cost Analysis", "Service Quality"], "General Manager": ["Logistics Analytics", "Fleet Capacity", "Department Comparison"], MD: ["Transportation Oversight", "Strategic Fleet Planning", "Annual Cost", "Network Performance"], Admin: ["Deliveries", "Distance", "Fuel", "Trips", "Driver Performance", "Delay Tracking", "Team Trips", "Fleet Operations", "Route Planning", "Vehicle Status", "Utilization", "Route Efficiency", "Cost Analysis", "Service Quality", "Logistics Analytics", "Fleet Capacity", "Department Comparison", "Transportation Oversight", "Strategic Fleet Planning", "Annual Cost", "Network Performance"],
  },
  research: {
    Worker: ["Experiments", "Samples", "Research Log"], Supervisor: ["Team Progress", "Experiment Review", "Sample Tracking"], Manager: ["Projects", "Milestones", "Resource Planning", "Approvals"], "Chief Manager": ["Research Progress", "Project Comparison", "Risk Review"], "General Manager": ["Innovation Reports", "Portfolio Analytics", "Capacity"], MD: ["Product Development", "Strategic Portfolio", "Innovation Roadmap", "Investment Overview"], Admin: ["Experiments", "Samples", "Research Log", "Team Progress", "Experiment Review", "Sample Tracking", "Projects", "Milestones", "Resource Planning", "Approvals", "Research Progress", "Project Comparison", "Risk Review", "Innovation Reports", "Portfolio Analytics", "Capacity", "Product Development", "Strategic Portfolio", "Innovation Roadmap", "Investment Overview"],
  },
  administration: {
    Worker: ["Overview"], Supervisor: ["Overview", "Team Performance"], Manager: ["Overview", "Team Performance"], "Chief Manager": ["Overview", "Department Performance"], "General Manager": ["Overview", "Department Analytics"], MD: ["Overview", "Strategy"], Admin: ["Overview", "Team Performance", "Department Performance", "Department Analytics", "Strategy"],
  },
};

export function getAllowedTabs(role: string | null | undefined, department: string | null | undefined): string[] {
  const departmentTabs = tabs[normalizeDepartment(department)];
  const resolvedRole = roleKey(role);
  if (resolvedRole === "Admin") return [...new Set(Object.values(departmentTabs).flat())];
  return departmentTabs[resolvedRole];
}

export function canAccessTab(role: string | null | undefined, department: string | null | undefined, tab: string): boolean {
  return getAllowedTabs(role, department).includes(tab);
}