export interface EmployeeHierarchyRecord {
  id: string;
  employeeId: string;
  supervisorId: string;
  hierarchyLevel: number;
  departmentId: string;
  createdAt: string;
}

export interface EmployeeHierarchyInput {
  employeeId: string;
  supervisorId: string;
  hierarchyLevel: number;
  departmentId: string;
}

export interface EmployeeHierarchyNode {
  id: string;
  employeeCode: string;
  name: string;
  role: string;
  department: string;
  supervisorId: string;
  joiningDate: string | null;
  status: string;
  children: EmployeeHierarchyNode[];
}

export interface HierarchyEmployee {
  id: string;
  employeeCode: string;
  name: string;
  role: string;
  department: string;
  hierarchyLevel: number;
  status: string;
}
