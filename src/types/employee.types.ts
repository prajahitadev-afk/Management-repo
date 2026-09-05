export interface Employee {
  id: string;
  employeeId: string;
  employeeCode: string;
  name: string;
  email: string;
  phone: string;
  department: string;
  role: string;
  designation: string;
  hierarchyLevel: number | null;
  reportsTo: string | null;
  status: string;
  joiningDate: string | null;
  createdAt: string | null;
  photoUrl: string | null;
}

export interface EmployeeProfile extends Employee {
  dob: string | null;
  gender: string | null;
  address: string | null;
  departmentName: string | null;
  roleName: string | null;
  managerName: string | null;
  attendancePercentage: number;
  billsCount: number;
  ordersCount: number;
  performanceSummary: string;
}

export interface AttendanceRecord {
  employeeId: string;
  employeeName: string;
  status: string;
  date: string;
}

export interface AttendanceSummary {
  date: string;
  totalEmployees: number;
  present: number;
  absent: number;
  halfDay: number;
  leave: number;
  attendancePercentage: number;
  records: AttendanceRecord[];
}

export interface OrganizationNode extends Employee {
  children: OrganizationNode[];
  managerName: string | null;
}

export interface EmployeeFilters {
  search?: string;
  department?: string;
  role?: string;
  status?: string;
}

export type AttendanceStatus = "Present" | "Absent" | "Half Day" | "Leave";
