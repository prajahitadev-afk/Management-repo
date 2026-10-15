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

export type CollaborationAuditLogEntry = Omit<CollaborationAuditLog, "ip_address" | "device_info">;

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

function createCollaborationId(): string {
  return crypto.randomUUID();
}

// Initial Seed Collaborator Companies
export const INITIAL_COLLABORATORS: CollaboratorCompany[] = [
  {
    id: "00000000-0000-4000-8000-000000000001",
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
    id: "00000000-0000-4000-8000-000000000002",
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
    id: "00000000-0000-4000-8000-000000000003",
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
    collaborator_company_id: "00000000-0000-4000-8000-000000000001",
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
    collaborator_company_id: "00000000-0000-4000-8000-000000000002",
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
    collaborator_company_id: "00000000-0000-4000-8000-000000000001",
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
let applicationsStore: CollaborationApplication[] = [];
let auditLogsStore: CollaborationAuditLog[] = [];
let companiesStore: CollaboratorCompany[] = [];
let billsStore: CollaborationBill[] = [];

const collaborationSupabaseEnabled =
  Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY) &&
  String(import.meta.env.VITE_ENABLE_COLLABORATION_SUPABASE ?? "true").toLowerCase() !== "false";

let collaborationSupabaseReady: boolean | null = null;
let collaborationSupabaseCheckPromise: Promise<boolean> | null = null;

async function ensureCollaborationSupabaseReady(): Promise<boolean> {
  if (!collaborationSupabaseEnabled) {
    collaborationSupabaseReady = false;
    return false;
  }

  if (collaborationSupabaseReady === true) return true;
  if (!collaborationSupabaseCheckPromise) {
    collaborationSupabaseCheckPromise = (async () => {
      const requiredTables = [
        "collaboration_companies",
        "collaboration_applications",
        "collaboration_audit_logs",
        "collaboration_bills",
      ];
      try {
        const results = await Promise.all(
          requiredTables.map(async (tableName) => {
            const { error } = await supabase.from(tableName).select("id").limit(1);
            return { tableName, error };
          })
        );

        const failed = results.filter((result) => result.error);
        if (failed.length > 0) {
          throw new Error(
            `Collaboration database is not ready. Check the collaboration tables and permissions in Supabase: ${failed
              .map((item) => `${item.tableName}: ${item.error?.message ?? "query failed"}`)
              .join("; ")}`
          );
        }

        collaborationSupabaseReady = true;
        return true;
      } catch (error) {
        collaborationSupabaseReady = null;
        throw error;
      } finally {
        collaborationSupabaseCheckPromise = null;
      }
    })();
  }

  return await collaborationSupabaseCheckPromise;
}

export async function fetchCollaborationAuditLogs(applicationId?: string): Promise<CollaborationAuditLogEntry[]> {
  if (await ensureCollaborationSupabaseReady()) {
    const { data, error } = await supabase
      .from("collaboration_audit_logs")
      .select("id, application_id, user_name, user_role, user_sector, company_name, action, previous_status, new_status, details, created_at, collaboration_applications(application_number)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(`Could not load collaboration audit logs: ${error.message}`);
    if (data) {
      const rows = data as Array<
        Omit<CollaborationAuditLog, "application_number" | "ip_address" | "device_info"> & {
          collaboration_applications: { application_number: string } | null;
        }
      >;
      auditLogsStore = rows.map(({ collaboration_applications, ...log }) => ({
        ...log,
        application_number: collaboration_applications?.application_number ?? "",
      }));
    }
  }

  const logs = applicationId
    ? auditLogsStore.filter((log) => log.application_id === applicationId)
    : auditLogsStore;
  return logs.map(({ ip_address: _ipAddress, device_info: _deviceInfo, ...log }) => log);
}

async function persistApplicationState(app: CollaborationApplication) {
  if (!(await ensureCollaborationSupabaseReady())) return;

  const { error } = await supabase
    .from("collaboration_applications")
    .upsert(app, { onConflict: "id" });
  if (error) throw new Error(`Could not save collaboration application: ${error.message}`);
}

async function persistAuditLog(log: CollaborationAuditLog) {
  if (!(await ensureCollaborationSupabaseReady())) return;

  const { error } = await supabase.from("collaboration_audit_logs").insert(log);
  if (error) throw new Error(`Could not save collaboration audit log: ${error.message}`);
}

async function getApplicationForAction(applicationId: string): Promise<CollaborationApplication> {
  if (await ensureCollaborationSupabaseReady()) {
    const { data, error } = await supabase
      .from("collaboration_applications")
      .select("*")
      .eq("id", applicationId)
      .maybeSingle();
    if (error) throw new Error(`Could not load application for approval: ${error.message}`);
    if (!data) throw new Error("Application not found.");

    const app = data as CollaborationApplication;
    applicationsStore = applicationsStore.map((item) => item.id === app.id ? app : item);
    return app;
  }

  const app = applicationsStore.find((item) => item.id === applicationId);
  if (!app) throw new Error("Application not found.");
  return app;
}

async function persistApplicationTransition(
  app: CollaborationApplication,
  expectedStatus: CollaborationStatus,
  expectedApprover: ApproverRole
): Promise<CollaborationApplication> {
  if (!(await ensureCollaborationSupabaseReady())) {
    applicationsStore = applicationsStore.map((item) => item.id === app.id ? app : item);
    return app;
  }

  const { data, error } = await supabase
    .from("collaboration_applications")
    .update(app)
    .eq("id", app.id)
    .eq("status", expectedStatus)
    .eq("current_approver_role", expectedApprover)
    .select("*")
    .maybeSingle();

  if (error) throw new Error(`Could not save approval decision: ${error.message}`);
  if (!data) throw new Error("This application was already processed. Refresh and review its current status.");

  const savedApp = data as CollaborationApplication;
  applicationsStore = applicationsStore.map((item) => item.id === savedApp.id ? savedApp : item);
  return savedApp;
}

function assertCurrentApprover(
  app: CollaborationApplication,
  user: { role: string; department: string }
): ApproverRole {
  if (app.status !== "PENDING INTERNAL APPROVAL") {
    throw new Error("This application is not waiting for internal approval.");
  }
  if (!["Vice Chairman", "President", "MD-Marketing"].includes(app.current_approver_role)) {
    throw new Error("This application has no pending internal approval step.");
  }

  const isMarketingManagingDirector = app.current_approver_role === "MD-Marketing"
    && user.role === "Managing Director"
    && user.department === "Marketing";
  if (user.role !== app.current_approver_role && user.role !== "Admin" && !isMarketingManagingDirector) {
    throw new Error(`Only the current approver (${app.current_approver_role}) can take action on this application.`);
  }
  return app.current_approver_role;
}

// Service functions
export async function fetchCollaborationApplications(user: { id: string; role: string; department: string; company_name?: string }): Promise<CollaborationApplication[]> {
  if (await ensureCollaborationSupabaseReady()) {
    try {
      const { data, error } = await supabase.from("collaboration_applications").select("*").order("created_at", { ascending: false });
      if (error) throw new Error(`Could not load collaboration applications: ${error.message}`);
      if (data) applicationsStore = data as CollaborationApplication[];
    } catch (e) {
      throw e;
    }
  }

  // Filter by company if External Collaborator
  if (user.role === "External Collaborator" || user.role === "Collaborator Head") {
    const company = user.company_name?.trim();
    if (!company) return [];
    return applicationsStore.filter((app) => app.collaborator_company_name.toLowerCase() === company.toLowerCase());
  }

  return [...applicationsStore];
}

export async function fetchCollaboratorCompanies(): Promise<CollaboratorCompany[]> {
  if (await ensureCollaborationSupabaseReady()) {
    try {
      const { data, error } = await supabase.from("collaboration_companies").select("*").order("company_name", { ascending: true });
      if (error) throw new Error(`Could not load collaborator companies: ${error.message}`);
      if (data) companiesStore = data as CollaboratorCompany[];
    } catch (e) {
      throw e;
    }
  }
  return [...companiesStore];
}

export async function fetchCollaborationBills(): Promise<CollaborationBill[]> {
  if (await ensureCollaborationSupabaseReady()) {
    try {
      const { data, error } = await supabase.from("collaboration_bills").select("*").order("generated_at", { ascending: false });
      if (error) throw new Error(`Could not load collaboration bills: ${error.message}`);
      if (data) billsStore = data as CollaborationBill[];
    } catch (e) {
      throw e;
    }
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
  const appNumber = `PRJ-COL-${new Date().getFullYear()}-${nextNumber}`;
  const totalAmount = params.quantity * params.unit_price;
  const now = new Date().toISOString();

  const newApp: CollaborationApplication = {
    id: createCollaborationId(),
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

  // Create Audit Log Entry
  const auditLog: CollaborationAuditLog = {
    id: createCollaborationId(),
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
    created_at: now,
  };
  if (await ensureCollaborationSupabaseReady()) {
    const { error: applicationError } = await supabase
      .from("collaboration_applications")
      .insert(newApp);
    if (applicationError) {
      throw new Error(`Could not submit collaboration application: ${applicationError.message}`);
    }

    const { error: auditError } = await supabase.from("collaboration_audit_logs").insert(auditLog);
    if (auditError) {
      throw new Error(`Application was saved, but its audit log could not be saved: ${auditError.message}`);
    }
  }

  applicationsStore.unshift(newApp);
  auditLogsStore.unshift(auditLog);
  return newApp;
}

// Internal Approval Routing (Hierarchy: 1. Vice Chairman -> 2. President -> 3. Marketing MD)
export async function approveInternalStep(
  applicationId: string,
  user: { id: string; name: string; role: string; department: string }
): Promise<CollaborationApplication> {
  const app = await getApplicationForAction(applicationId);
  const expectedRole = assertCurrentApprover(app, user);

  const now = new Date().toISOString();
  const prevStatus = app.status;
  const nextApprover: ApproverRole = expectedRole === "Vice Chairman"
    ? "President"
    : expectedRole === "President"
      ? "MD-Marketing"
      : "COMPLETED";
  const updatedApp: CollaborationApplication = {
    ...app,
    ...(expectedRole === "Vice Chairman" ? {
      vice_chairman_approved: true,
      vice_chairman_approved_at: now,
      vice_chairman_approver_name: user.name,
    } : {}),
    ...(expectedRole === "President" ? {
      president_approved: true,
      president_approved_at: now,
      president_approver_name: user.name,
    } : {}),
    ...(expectedRole === "MD-Marketing" ? {
      marketing_md_approved: true,
      marketing_md_approved_at: now,
      marketing_md_approver_name: user.name,
      status: "AWAITING COLLABORATOR ACCEPTANCE" as const,
    } : {}),
    current_approver_role: nextApprover,
    updated_at: now,
  };
  const stepNumber = expectedRole === "Vice Chairman" ? 1 : expectedRole === "President" ? 2 : 3;
  const approvalLog: CollaborationAuditLog = {
    id: createCollaborationId(),
    application_id: app.id,
    application_number: app.application_number,
    user_name: user.name,
    user_role: user.role,
    user_sector: user.department || "Executive Board",
    company_name: "Prajahita Charitable Trust",
    action: `INTERNAL APPROVAL (STEP ${stepNumber}/3 - ${expectedRole.toUpperCase()})`,
    previous_status: prevStatus,
    new_status: updatedApp.status,
    details: expectedRole === "MD-Marketing"
      ? "Internal approval complete. Routed to the collaborator for acceptance."
      : `Approved by ${expectedRole}. Advanced to ${nextApprover}.`,
    created_at: now,
  };

  const savedApp = await persistApplicationTransition(updatedApp, prevStatus, expectedRole);
  await persistAuditLog(approvalLog);
  auditLogsStore.unshift(approvalLog);
  return savedApp;
}

// Reject Internal Application
export async function rejectInternalApplication(
  applicationId: string,
  reason: string,
  user: { id: string; name: string; role: string; department: string }
): Promise<CollaborationApplication> {
  const app = await getApplicationForAction(applicationId);
  const expectedRole = assertCurrentApprover(app, user);
  if (!reason.trim()) throw new Error("A rejection reason is required.");

  const now = new Date().toISOString();
  const prevStatus = app.status;
  const updatedApp: CollaborationApplication = {
    ...app,
    status: "DECLINED - ORDER CANCELLED",
    rejection_reason: reason.trim(),
    rejected_by_name: `${user.name} (${user.role})`,
    rejected_at: now,
    updated_at: now,
  };

  const log: CollaborationAuditLog = {
    id: createCollaborationId(),
    application_id: app.id,
    application_number: app.application_number,
    user_name: user.name,
    user_role: user.role,
    user_sector: user.department || "Executive Board",
    company_name: "Prajahita Charitable Trust",
    action: "INTERNAL APPROVAL REJECTED",
    previous_status: prevStatus,
    new_status: "DECLINED - ORDER CANCELLED",
    details: `Application rejected during internal approval by ${expectedRole}. Reason: ${reason.trim()}`,
    created_at: now,
  };

  const savedApp = await persistApplicationTransition(updatedApp, prevStatus, expectedRole);
  await persistAuditLog(log);
  auditLogsStore.unshift(log);

  return savedApp;
}

// Collaborator Decision (ACCEPT or DECLINE)
export async function respondByCollaborator(
  applicationId: string,
  decision: "ACCEPTED" | "DECLINED",
  declineReason: string | undefined,
  user: { name: string; role: string; company_name?: string }
): Promise<CollaborationApplication> {
  const app = await getApplicationForAction(applicationId);
  if (app.status !== "AWAITING COLLABORATOR ACCEPTANCE" || app.current_approver_role !== "COMPLETED") {
    throw new Error("This offer is not ready for collaborator acceptance.");
  }
  if (user.role !== "External Collaborator" && user.role !== "Collaborator Head") {
    throw new Error("Only the assigned collaborator can accept or decline this offer.");
  }
  if (user.company_name && user.company_name.toLowerCase() !== app.collaborator_company_name.toLowerCase()) {
    throw new Error("This offer belongs to a different collaborator company.");
  }
  if (decision === "DECLINED" && !declineReason?.trim()) {
    throw new Error("A reason is required to decline this offer.");
  }

  const now = new Date().toISOString();
  const prevStatus = app.status;
  const isAccepted = decision === "ACCEPTED";
  const billNumber = isAccepted
    ? `PRJ-BILL-${new Date().getFullYear()}-${Math.floor(10000000 + Math.random() * 90000000)}`
    : undefined;
  const updatedApp: CollaborationApplication = {
    ...app,
    status: isAccepted ? "COLLABORATION ACCEPTED" : "DECLINED - ORDER CANCELLED",
    collaborator_decision: decision,
    collaborator_decision_at: now,
    collaborator_accepted_by: user.name,
    collaborator_decline_reason: isAccepted ? undefined : declineReason?.trim(),
    generated_bill_number: billNumber,
    generated_bill_at: billNumber ? now : undefined,
    updated_at: now,
  };
  const log: CollaborationAuditLog = {
    id: createCollaborationId(),
    application_id: app.id,
    application_number: app.application_number,
    user_name: user.name,
    user_role: user.role,
    user_sector: "External Collaborator",
    company_name: app.collaborator_company_name,
    action: isAccepted ? "COLLABORATOR ACCEPTED" : "COLLABORATOR DECLINED",
    previous_status: prevStatus,
    new_status: updatedApp.status,
    details: isAccepted
      ? `Collaborator accepted the offer. Generated Bill Number: ${billNumber}`
      : `Collaborator declined the offer. Reason: ${declineReason?.trim()}`,
    created_at: now,
  };
  const newBill: CollaborationBill | null = billNumber ? {
    id: createCollaborationId(),
    bill_number: billNumber,
    application_id: app.id,
    collaborator_company_name: app.collaborator_company_name,
    customer_name: app.customer_name,
    product_name: app.product_name,
    total_amount: app.total_amount,
    currency: app.currency,
    status: "ISSUED & VERIFIED",
    generated_at: now,
  } : null;

  const savedApp = await persistApplicationTransition(updatedApp, prevStatus, "COMPLETED");
  try {
    if (newBill && await ensureCollaborationSupabaseReady()) {
      const { error } = await supabase.from("collaboration_bills").insert(newBill);
      if (error) throw new Error(`Could not save generated collaboration bill: ${error.message}`);
    }
    await persistAuditLog(log);
  } catch (error) {
    if (newBill && await ensureCollaborationSupabaseReady()) {
      await supabase.from("collaboration_bills").delete().eq("id", newBill.id);
    }
    const rollbackApp: CollaborationApplication = {
      ...app,
      updated_at: new Date().toISOString(),
    };
    await persistApplicationTransition(rollbackApp, updatedApp.status, "COMPLETED");
    throw error;
  }

  if (newBill) billsStore.unshift(newBill);
  auditLogsStore.unshift(log);
  return savedApp;
}

// Admin: Toggle Collaborator Company Status
export async function toggleCollaboratorCompanyStatus(companyId: string): Promise<CollaboratorCompany[]> {
  const company = companiesStore.find((c) => c.id === companyId);
  if (company) {
    const nextStatus = company.status === "active" ? "suspended" : "active";
    company.status = nextStatus;

    if (await ensureCollaborationSupabaseReady()) {
      const { error } = await supabase
        .from("collaboration_companies")
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq("id", companyId);
      if (error) throw new Error(`Could not update collaborator company: ${error.message}`);
    }
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
    id: createCollaborationId(),
    company_name: data.company_name,
    company_code: data.company_code,
    collaborator_head_name: data.collaborator_head_name,
    collaborator_head_email: data.collaborator_head_email,
    contact_phone: data.contact_phone,
    address: data.address,
    status: "active",
    created_at: new Date().toISOString(),
  };
  if (await ensureCollaborationSupabaseReady()) {
    const { error } = await supabase.from("collaboration_companies").insert({
      ...newComp,
      created_at: newComp.created_at,
      updated_at: newComp.created_at,
    });
    if (error) throw new Error(`Could not add collaborator company: ${error.message}`);
  }

  companiesStore.push(newComp);
  return [...companiesStore];
}
