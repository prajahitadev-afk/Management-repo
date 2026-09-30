import { supabase } from "../lib/supabase";

export interface CollaboratorCompany {
  id: string;
  company_name: string;
  company_code: string;
  collaborator_head_name: string;
  collaborator_head_email: string;
  contact_phone?: string;
  address?: string;
  status: "active" | "suspended";
  created_at: string;
}

export type CollaborationStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "PENDING INTERNAL APPROVAL"
  | "APPROVED BY PRAJAHITA"
  | "AWAITING COLLABORATOR ACCEPTANCE"
  | "COLLABORATION ACCEPTED"
  | "DECLINED - ORDER CANCELLED";

export type ApproverRole = "Vice Chairman" | "President" | "MD-Marketing" | "COMPLETED";

export interface CollaborationApplication {
  id: string;
  application_number: string; // PRJ-COL-2026-XXXXXX
  collaborator_company_id: string;
  collaborator_company_name: string;
  customer_name: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  currency: string;
  shipping_transport: string;
  delivery_location: string;
  payment_terms: string;
  required_date: string;
  notes?: string;
  supporting_document_name?: string;
  
  status: CollaborationStatus;
  
  submitted_by_id: string;
  submitted_by_name: string;
  submitted_at: string;
  
  // Approval Hierarchy tracking: 1. Vice Chairman -> 2. President -> 3. Marketing MD
  current_approver_role: ApproverRole;
  
  vice_chairman_approved: boolean;
  vice_chairman_approved_at?: string;
  vice_chairman_approver_name?: string;
  
  president_approved: boolean;
  president_approved_at?: string;
  president_approver_name?: string;
  
  marketing_md_approved: boolean;
  marketing_md_approved_at?: string;
  marketing_md_approver_name?: string;
  
  rejection_reason?: string;
  rejected_by_name?: string;
  rejected_at?: string;
  
  // External Collaborator Handshake
  collaborator_decision?: "ACCEPTED" | "DECLINED";
  collaborator_decline_reason?: string;
  collaborator_accepted_by?: string;
  collaborator_decision_at?: string;
  
  // Final Bill Number
  generated_bill_number?: string; // PRJ-BILL-2026-XXXXX
  generated_bill_at?: string;
  
  created_at: string;
  updated_at: string;
}

export interface CollaborationAuditLog {
  id: string;
  application_id: string;
  application_number: string;
  user_name: string;
  user_role: string;
  user_sector: string;
  company_name: string;
  action: string;
  previous_status: CollaborationStatus | "N/A";
  new_status: CollaborationStatus;
  details: string;
  ip_address: string;
  device_info: string;
  created_at: string;
}

export interface CollaborationBill {
  id: string;
  bill_number: string;
  application_id: string;
  collaborator_company_name: string;
  customer_name: string;
  product_name: string;
  total_amount: number;
  currency: string;
  status: string;
  generated_at: string;
}

// Initial Seed Collaborator Companies
export const INITIAL_COLLABORATORS: CollaboratorCompany[] = [
  {
    id: "comp-001",
    company_name: "ABC TRADING COMPANY",
    company_code: "ABC-001",
    collaborator_head_name: "Rajesh Sharma",
    collaborator_head_email: "head@abctrading.com",
    contact_phone: "+91 98200 11223",
    address: "Bandra Kurla Complex, Mumbai, Maharashtra",
    status: "active",
    created_at: "2026-01-10T10:00:00Z",
  },
  {
    id: "comp-002",
    company_name: "GLOBAL SOAP DISTRIBUTORS",
    company_code: "GSD-002",
    collaborator_head_name: "Anita Kulkarni",
    collaborator_head_email: "head@globalsoap.com",
    contact_phone: "+91 98333 44556",
    address: "Hinjawadi IT Park, Pune, Maharashtra",
    status: "active",
    created_at: "2026-01-15T11:30:00Z",
  },
  {
    id: "comp-003",
    company_name: "WESTERN MAHARASHTRA LOGISTICS",
    company_code: "WML-003",
    collaborator_head_name: "Vikram Patel",
    collaborator_head_email: "head@wmlogistics.com",
    contact_phone: "+91 98444 77889",
    address: "MIDC Hingna, Nagpur, Maharashtra",
    status: "active",
    created_at: "2026-02-01T09:15:00Z",
  },
];

// Initial Seed Applications to demonstrate the exact workflow
export const INITIAL_APPLICATIONS: CollaborationApplication[] = [
  {
    id: "app-101",
    application_number: "PRJ-COL-2026-000124",
    collaborator_company_id: "comp-001",
    collaborator_company_name: "ABC TRADING COMPANY",
    customer_name: "Reliance Retail Maharashtra",
    product_name: "Prajahita Herbal Organic Soap (500 Units Pack)",
    quantity: 120,
    unit_price: 2500,
    total_amount: 300000,
    currency: "INR",
    shipping_transport: "Express Truck Freight (Cold-Chain Safe)",
    delivery_location: "Warehouse #4, Bhiwandi, Thane, MH",
    payment_terms: "50% Advance, 50% on Delivery",
    required_date: "2026-10-15",
    notes: "High priority festive distribution batch for Western Maharashtra regional stores.",
    supporting_document_name: "Purchase_Requisition_ABC_2026.pdf",
    
    status: "AWAITING COLLABORATOR ACCEPTANCE",
    submitted_by_id: "user-mkt-01",
    submitted_by_name: "Suresh Deshmukh (Marketing Lead)",
    submitted_at: "2026-09-20T09:00:00Z",
    
    current_approver_role: "COMPLETED",
    vice_chairman_approved: true,
    vice_chairman_approved_at: "2026-09-21T11:00:00Z",
    vice_chairman_approver_name: "Vice Chairman (Prajahita Executive Board)",
    
    president_approved: true,
    president_approved_at: "2026-09-22T14:30:00Z",
    president_approver_name: "President (Prajahita Trust)",
    
    marketing_md_approved: true,
    marketing_md_approved_at: "2026-09-23T10:15:00Z",
    marketing_md_approver_name: "MD-Marketing (Prajahita Sector Head)",
    
    created_at: "2026-09-20T09:00:00Z",
    updated_at: "2026-09-23T10:15:00Z",
  },
  {
    id: "app-102",
    application_number: "PRJ-COL-2026-000125",
    collaborator_company_id: "comp-002",
    collaborator_company_name: "GLOBAL SOAP DISTRIBUTORS",
    customer_name: "D-Mart Mega Outlets",
    product_name: "Prajahita Anti-Bacterial Hygiene Soap (200g Box)",
    quantity: 300,
    unit_price: 1200,
    total_amount: 360000,
    currency: "INR",
    shipping_transport: "Standard Logistics Container",
    delivery_location: "Central Hub, Pune MIDC, MH",
    payment_terms: "Net 30 Days",
    required_date: "2026-10-20",
    notes: "Q4 bulk distribution order.",
    supporting_document_name: "GlobalSoap_Contract_Draft.pdf",
    
    status: "PENDING INTERNAL APPROVAL",
    submitted_by_id: "user-mkt-02",
    submitted_by_name: "Priya Nair (Marketing Admin)",
    submitted_at: "2026-09-25T14:00:00Z",
    
    current_approver_role: "Vice Chairman",
    vice_chairman_approved: false,
    president_approved: false,
    marketing_md_approved: false,
    
    created_at: "2026-09-25T14:00:00Z",
    updated_at: "2026-09-25T14:00:00Z",
  },
  {
    id: "app-103",
    application_number: "PRJ-COL-2026-000120",
    collaborator_company_id: "comp-001",
    collaborator_company_name: "ABC TRADING COMPANY",
    customer_name: "Star Bazaar Outlets",
    product_name: "Prajahita Neem Active Skin Care Soap",
    quantity: 80,
    unit_price: 2000,
    total_amount: 160000,
    currency: "INR",
    shipping_transport: "Local Transport Service",
    delivery_location: "Vashi Logistics Hub, Navi Mumbai, MH",
    payment_terms: "100% On Delivery",
    required_date: "2026-09-18",
    notes: "Accepted order, bill generated.",
    
    status: "COLLABORATION ACCEPTED",
    submitted_by_id: "user-mkt-01",
    submitted_by_name: "Suresh Deshmukh (Marketing Lead)",
    submitted_at: "2026-09-10T10:00:00Z",
    
    current_approver_role: "COMPLETED",
    vice_chairman_approved: true,
    vice_chairman_approved_at: "2026-09-11T12:00:00Z",
    vice_chairman_approver_name: "Vice Chairman",
    president_approved: true,
    president_approved_at: "2026-09-12T10:00:00Z",
    president_approver_name: "President",
    marketing_md_approved: true,
    marketing_md_approved_at: "2026-09-12T16:00:00Z",
    marketing_md_approver_name: "MD-Marketing",
    
    collaborator_decision: "ACCEPTED",
    collaborator_accepted_by: "Rajesh Sharma (ABC Trading Head)",
    collaborator_decision_at: "2026-09-14T11:20:00Z",
    
    generated_bill_number: "PRJ-BILL-2026-00452",
    generated_bill_at: "2026-09-14T11:20:00Z",
    
    created_at: "2026-09-10T10:00:00Z",
    updated_at: "2026-09-14T11:20:00Z",
  }
];

export const INITIAL_AUDIT_LOGS: CollaborationAuditLog[] = [
  {
    id: "log-001",
    application_id: "app-101",
    application_number: "PRJ-COL-2026-000124",
    user_name: "Suresh Deshmukh",
    user_role: "Marketing Lead",
    user_sector: "Marketing",
    company_name: "Prajahita Charitable Trust",
    action: "APPLICATION SUBMITTED",
    previous_status: "DRAFT",
    new_status: "PENDING INTERNAL APPROVAL",
    details: "Created Collaboration Application PRJ-COL-2026-000124 for ABC TRADING COMPANY (Valued: ₹3,00,000)",
    ip_address: "192.168.1.45",
    device_info: "Windows 11 Workstation / Edge Browser",
    created_at: "2026-09-20T09:00:00Z",
  },
  {
    id: "log-002",
    application_id: "app-101",
    application_number: "PRJ-COL-2026-000124",
    user_name: "Vice Chairman",
    user_role: "Vice Chairman",
    user_sector: "Executive Board",
    company_name: "Prajahita Charitable Trust",
    action: "INTERNAL APPROVAL (STEP 1/3 - VICE CHAIRMAN)",
    previous_status: "PENDING INTERNAL APPROVAL",
    new_status: "PENDING INTERNAL APPROVAL",
    details: "Approved by Vice Chairman (Highest Authority). Routed to President for Step 2.",
    ip_address: "10.0.0.12",
    device_info: "iPad Pro / Safari",
    created_at: "2026-09-21T11:00:00Z",
  },
  {
    id: "log-003",
    application_id: "app-101",
    application_number: "PRJ-COL-2026-000124",
    user_name: "President",
    user_role: "President",
    user_sector: "Executive Board",
    company_name: "Prajahita Charitable Trust",
    action: "INTERNAL APPROVAL (STEP 2/3 - PRESIDENT)",
    previous_status: "PENDING INTERNAL APPROVAL",
    new_status: "PENDING INTERNAL APPROVAL",
    details: "Approved by President. Routed to Marketing MD for Step 3.",
    ip_address: "10.0.0.14",
    device_info: "MacBook Pro / Chrome",
    created_at: "2026-09-22T14:30:00Z",
  },
  {
    id: "log-004",
    application_id: "app-101",
    application_number: "PRJ-COL-2026-000124",
    user_name: "MD-Marketing",
    user_role: "MD-Marketing",
    user_sector: "Marketing",
    company_name: "Prajahita Charitable Trust",
    action: "INTERNAL APPROVAL COMPLETED (STEP 3/3 - MARKETING MD)",
    previous_status: "PENDING INTERNAL APPROVAL",
    new_status: "AWAITING COLLABORATOR ACCEPTANCE",
    details: "Final internal approval granted by Marketing MD. Sent to Collaborator Head (Rajesh Sharma @ ABC TRADING COMPANY).",
    ip_address: "192.168.1.18",
    device_info: "Windows 11 Workstation / Firefox",
    created_at: "2026-09-23T10:15:00Z",
  },
];

export const INITIAL_BILLS: CollaborationBill[] = [
  {
    id: "bill-001",
    bill_number: "PRJ-BILL-2026-00452",
    application_id: "app-103",
    collaborator_company_name: "ABC TRADING COMPANY",
    customer_name: "Star Bazaar Outlets",
    product_name: "Prajahita Neem Active Skin Care Soap",
    total_amount: 160000,
    currency: "INR",
    status: "ISSUED & VERIFIED",
    generated_at: "2026-09-14T11:20:00Z",
  }
];

// Access Control helper as strictly required by Section 1 & 4 of PDF:
export function canUserAccessCollaborationModule(user: { role: string; department: string }): boolean {
  if (!user) return false;
  
  // Highest authorities always have access
  if (user.role === "Vice Chairman" || user.role === "President" || user.role === "Admin") {
    return true;
  }
  
  // Marketing MD / Managing Director of Marketing
  if (user.role === "MD-Marketing" || (user.role === "Managing Director" && user.department === "Marketing")) {
    return true;
  }
  
  // External Collaborator Head
  if (user.role === "External Collaborator" || user.role === "Collaborator Head") {
    return true;
  }
  
  // Marketing sector users
  if (user.department === "Marketing") {
    return true;
  }
  
  // Non-Marketing internal users (Manufacturing, Transport, Finance, HR, R&D) MUST BE DENIED
  return false;
}

// In-Memory Store for reactive client updates
let applicationsStore = [...INITIAL_APPLICATIONS];
let auditLogsStore = [...INITIAL_AUDIT_LOGS];
let companiesStore = [...INITIAL_COLLABORATORS];
let billsStore = [...INITIAL_BILLS];

// Service functions
export async function fetchCollaborationApplications(user: { id: string; role: string; department: string; company_name?: string }): Promise<CollaborationApplication[]> {
  // Try to fetch from Supabase if connected
  try {
    const { data, error } = await supabase.from("collaboration_applications").select("*").order("created_at", { ascending: false });
    if (!error && data && data.length > 0) {
      applicationsStore = data as CollaborationApplication[];
    }
  } catch (e) {
    // Fallback to memory store
  }

  // Filter by company if External Collaborator
  if (user.role === "External Collaborator" || user.role === "Collaborator Head") {
    const company = user.company_name || "ABC TRADING COMPANY";
    return applicationsStore.filter((app) => app.collaborator_company_name.toLowerCase() === company.toLowerCase());
  }

  return [...applicationsStore];
}

export async function fetchCollaborationAuditLogs(applicationId?: string): Promise<CollaborationAuditLog[]> {
  try {
    const { data, error } = await supabase.from("collaboration_audit_logs").select("*").order("created_at", { ascending: false });
    if (!error && data && data.length > 0) {
      auditLogsStore = data as CollaborationAuditLog[];
    }
  } catch (e) {
    // Fallback
  }

  if (applicationId) {
    return auditLogsStore.filter((log) => log.application_id === applicationId);
  }
  return [...auditLogsStore];
}

export async function fetchCollaboratorCompanies(): Promise<CollaboratorCompany[]> {
  try {
    const { data, error } = await supabase.from("collaboration_companies").select("*").order("company_name", { ascending: true });
    if (!error && data && data.length > 0) {
      companiesStore = data as CollaboratorCompany[];
    }
  } catch (e) {
    // Fallback
  }
  return [...companiesStore];
}

export async function fetchCollaborationBills(): Promise<CollaborationBill[]> {
  try {
    const { data, error } = await supabase.from("collaboration_bills").select("*").order("generated_at", { ascending: false });
    if (!error && data && data.length > 0) {
      billsStore = data as CollaborationBill[];
    }
  } catch (e) {
    // Fallback
  }
  return [...billsStore];
}

// Create Application (Apply Bill)
export async function createCollaborationApplication(
  params: {
    collaborator_company_id: string;
    collaborator_company_name: string;
    customer_name: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    currency: string;
    shipping_transport: string;
    delivery_location: string;
    payment_terms: string;
    required_date: string;
    notes?: string;
    supporting_document_name?: string;
  },
  user: { id: string; name: string; role: string; department: string }
): Promise<CollaborationApplication> {
  const nextNumber = Math.floor(100000 + Math.random() * 900000);
  const appNumber = `PRJ-COL-2026-${nextNumber}`;
  const totalAmount = params.quantity * params.unit_price;
  const now = new Date().toISOString();

  const newApp: CollaborationApplication = {
    id: `app-${Date.now()}`,
    application_number: appNumber,
    collaborator_company_id: params.collaborator_company_id,
    collaborator_company_name: params.collaborator_company_name,
    customer_name: params.customer_name,
    product_name: params.product_name,
    quantity: params.quantity,
    unit_price: params.unit_price,
    total_amount: totalAmount,
    currency: params.currency || "INR",
    shipping_transport: params.shipping_transport,
    delivery_location: params.delivery_location,
    payment_terms: params.payment_terms,
    required_date: params.required_date,
    notes: params.notes,
    supporting_document_name: params.supporting_document_name,
    
    status: "PENDING INTERNAL APPROVAL",
    submitted_by_id: user.id,
    submitted_by_name: user.name,
    submitted_at: now,
    
    current_approver_role: "Vice Chairman", // Hierarchy step 1
    vice_chairman_approved: false,
    president_approved: false,
    marketing_md_approved: false,
    
    created_at: now,
    updated_at: now,
  };

  applicationsStore.unshift(newApp);

  // Create Audit Log Entry
  const auditLog: CollaborationAuditLog = {
    id: `log-${Date.now()}`,
    application_id: newApp.id,
    application_number: appNumber,
    user_name: user.name,
    user_role: user.role,
    user_sector: user.department || "Marketing",
    company_name: "Prajahita Charitable Trust",
    action: "APPLICATION SUBMITTED",
    previous_status: "DRAFT",
    new_status: "PENDING INTERNAL APPROVAL",
    details: `Applied Bill for ${params.customer_name} via ${params.collaborator_company_name}. Total Value: ${params.currency} ${totalAmount.toLocaleString()}`,
    ip_address: "127.0.0.1",
    device_info: "Prajahita EMS Portal",
    created_at: now,
  };
  auditLogsStore.unshift(auditLog);

  // Attempt Supabase sync
  try {
    await supabase.from("collaboration_applications").insert(newApp);
    await supabase.from("collaboration_audit_logs").insert(auditLog);
  } catch (e) {
    // Ignore
  }

  return newApp;
}

// Internal Approval Routing (Hierarchy: 1. Vice Chairman -> 2. President -> 3. Marketing MD)
export async function approveInternalStep(
  applicationId: string,
  user: { id: string; name: string; role: string; department: string }
): Promise<CollaborationApplication> {
  const app = applicationsStore.find((a) => a.id === applicationId);
  if (!app) throw new Error("Application not found");

  const now = new Date().toISOString();
  const prevStatus = app.status;

  if (user.role === "Vice Chairman" || user.role === "Admin") {
    app.vice_chairman_approved = true;
    app.vice_chairman_approved_at = now;
    app.vice_chairman_approver_name = user.name;
    
    // Advance to Step 2: President
    app.current_approver_role = "President";
    app.updated_at = now;

    auditLogsStore.unshift({
      id: `log-${Date.now()}`,
      application_id: app.id,
      application_number: app.application_number,
      user_name: user.name,
      user_role: user.role,
      user_sector: "Executive Board",
      company_name: "Prajahita Charitable Trust",
      action: "INTERNAL APPROVAL (STEP 1/3 - VICE CHAIRMAN)",
      previous_status: prevStatus,
      new_status: app.status,
      details: "Approved by Vice Chairman (Highest Authority). Advanced to Step 2 (President).",
      ip_address: "127.0.0.1",
      device_info: "Prajahita EMS Portal",
      created_at: now,
    });
  } else if (user.role === "President") {
    if (!app.vice_chairman_approved && (user.role as string) !== "Admin") {
      throw new Error("Requires prior approval from Vice Chairman first.");
    }
    app.president_approved = true;
    app.president_approved_at = now;
    app.president_approver_name = user.name;
    
    // Advance to Step 3: Marketing MD
    app.current_approver_role = "MD-Marketing";
    app.updated_at = now;

    auditLogsStore.unshift({
      id: `log-${Date.now()}`,
      application_id: app.id,
      application_number: app.application_number,
      user_name: user.name,
      user_role: user.role,
      user_sector: "Executive Board",
      company_name: "Prajahita Charitable Trust",
      action: "INTERNAL APPROVAL (STEP 2/3 - PRESIDENT)",
      previous_status: prevStatus,
      new_status: app.status,
      details: "Approved by President (2nd Authority). Advanced to Step 3 (Marketing MD).",
      ip_address: "127.0.0.1",
      device_info: "Prajahita EMS Portal",
      created_at: now,
    });
  } else if (user.role === "MD-Marketing" || user.role === "Managing Director") {
    if (!app.president_approved && (user.role as string) !== "Admin") {
      throw new Error("Requires prior approval from President first.");
    }
    app.marketing_md_approved = true;
    app.marketing_md_approved_at = now;
    app.marketing_md_approver_name = user.name;
    
    // Final internal approval completed! Now route to Collaborator
    app.status = "AWAITING COLLABORATOR ACCEPTANCE";
    app.current_approver_role = "COMPLETED";
    app.updated_at = now;

    auditLogsStore.unshift({
      id: `log-${Date.now()}`,
      application_id: app.id,
      application_number: app.application_number,
      user_name: user.name,
      user_role: user.role,
      user_sector: "Marketing",
      company_name: "Prajahita Charitable Trust",
      action: "INTERNAL APPROVAL COMPLETED (STEP 3/3 - MARKETING MD)",
      previous_status: prevStatus,
      new_status: "AWAITING COLLABORATOR ACCEPTANCE",
      details: "Internal Prajahita approval complete. Automatically routed to Collaborator Head for acceptance/decline.",
      ip_address: "127.0.0.1",
      device_info: "Prajahita EMS Portal",
      created_at: now,
    });
  } else {
    throw new Error("Unauthorized role for internal collaboration approval.");
  }

  return { ...app };
}

// Reject Internal Application
export async function rejectInternalApplication(
  applicationId: string,
  reason: string,
  user: { id: string; name: string; role: string; department: string }
): Promise<CollaborationApplication> {
  const app = applicationsStore.find((a) => a.id === applicationId);
  if (!app) throw new Error("Application not found");

  const now = new Date().toISOString();
  const prevStatus = app.status;

  app.status = "DECLINED - ORDER CANCELLED";
  app.rejection_reason = reason;
  app.rejected_by_name = `${user.name} (${user.role})`;
  app.rejected_at = now;
  app.updated_at = now;

  auditLogsStore.unshift({
    id: `log-${Date.now()}`,
    application_id: app.id,
    application_number: app.application_number,
    user_name: user.name,
    user_role: user.role,
    user_sector: user.department || "Executive Board",
    company_name: "Prajahita Charitable Trust",
    action: "INTERNAL APPROVAL REJECTED",
    previous_status: prevStatus,
    new_status: "DECLINED - ORDER CANCELLED",
    details: `Application rejected during internal approval. Reason: ${reason}`,
    ip_address: "127.0.0.1",
    device_info: "Prajahita EMS Portal",
    created_at: now,
  });

  return { ...app };
}

// Collaborator Decision (ACCEPT or DECLINE)
export async function respondByCollaborator(
  applicationId: string,
  decision: "ACCEPTED" | "DECLINED",
  declineReason: string | undefined,
  user: { name: string; company_name?: string }
): Promise<CollaborationApplication> {
  const app = applicationsStore.find((a) => a.id === applicationId);
  if (!app) throw new Error("Application not found");

  const now = new Date().toISOString();
  const prevStatus = app.status;

  app.collaborator_decision = decision;
  app.collaborator_decision_at = now;
  app.collaborator_accepted_by = user.name;
  app.updated_at = now;

  if (decision === "ACCEPTED") {
    app.status = "COLLABORATION ACCEPTED";
    
    // Generate Final Bill / Order Number e.g. PRJ-BILL-2026-00452
    const billNum = `PRJ-BILL-2026-${Math.floor(10000 + Math.random() * 90000)}`;
    app.generated_bill_number = billNum;
    app.generated_bill_at = now;

    // Add to Bills store
    const newBill: CollaborationBill = {
      id: `bill-${Date.now()}`,
      bill_number: billNum,
      application_id: app.id,
      collaborator_company_name: app.collaborator_company_name,
      customer_name: app.customer_name,
      product_name: app.product_name,
      total_amount: app.total_amount,
      currency: app.currency,
      status: "ISSUED & VERIFIED",
      generated_at: now,
    };
    billsStore.unshift(newBill);

    auditLogsStore.unshift({
      id: `log-${Date.now()}`,
      application_id: app.id,
      application_number: app.application_number,
      user_name: user.name,
      user_role: "Collaborator Head",
      user_sector: "External Collaborator",
      company_name: app.collaborator_company_name,
      action: "COLLABORATOR ACCEPTED",
      previous_status: prevStatus,
      new_status: "COLLABORATION ACCEPTED",
      details: `Collaborator Head accepted the application. Generated Bill Number: ${billNum}`,
      ip_address: "127.0.0.1",
      device_info: "External Collaborator Portal",
      created_at: now,
    });
  } else {
    app.status = "DECLINED - ORDER CANCELLED";
    app.collaborator_decline_reason = declineReason || "Declined by collaborator head.";

    auditLogsStore.unshift({
      id: `log-${Date.now()}`,
      application_id: app.id,
      application_number: app.application_number,
      user_name: user.name,
      user_role: "Collaborator Head",
      user_sector: "External Collaborator",
      company_name: app.collaborator_company_name,
      action: "COLLABORATOR DECLINED",
      previous_status: prevStatus,
      new_status: "DECLINED - ORDER CANCELLED",
      details: `Collaborator Head declined the application. Reason: ${app.collaborator_decline_reason}`,
      ip_address: "127.0.0.1",
      device_info: "External Collaborator Portal",
      created_at: now,
    });
  }

  return { ...app };
}

// Admin: Toggle Collaborator Company Status
export async function toggleCollaboratorCompanyStatus(companyId: string): Promise<CollaboratorCompany[]> {
  const company = companiesStore.find((c) => c.id === companyId);
  if (company) {
    company.status = company.status === "active" ? "suspended" : "active";
  }
  return [...companiesStore];
}

// Admin: Add New Collaborator Company
export async function addCollaboratorCompany(data: {
  company_name: string;
  company_code: string;
  collaborator_head_name: string;
  collaborator_head_email: string;
  contact_phone?: string;
  address?: string;
}): Promise<CollaboratorCompany[]> {
  const newComp: CollaboratorCompany = {
    id: `comp-${Date.now()}`,
    company_name: data.company_name,
    company_code: data.company_code,
    collaborator_head_name: data.collaborator_head_name,
    collaborator_head_email: data.collaborator_head_email,
    contact_phone: data.contact_phone,
    address: data.address,
    status: "active",
    created_at: new Date().toISOString(),
  };
  companiesStore.push(newComp);
  return [...companiesStore];
}
