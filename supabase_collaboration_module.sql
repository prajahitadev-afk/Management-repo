-- ============================================================================
-- PRAJAHITA EMS - COLLABORATION MODULE DATABASE SCHEMA
-- Sector: Marketing Only
-- Hierarchy: 1. Vice Chairman -> 2. President -> 3. Marketing MD
-- ============================================================================

-- 1. Collaborator Companies Table
CREATE TABLE IF NOT EXISTS collaboration_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  company_code TEXT NOT NULL UNIQUE,
  collaborator_head_name TEXT NOT NULL,
  collaborator_head_email TEXT NOT NULL UNIQUE,
  contact_phone TEXT,
  address TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Collaboration Applications Table
CREATE TABLE IF NOT EXISTS collaboration_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_number TEXT NOT NULL UNIQUE,
  collaborator_company_id UUID REFERENCES collaboration_companies(id) ON DELETE SET NULL,
  collaborator_company_name TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  product_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC NOT NULL CHECK (unit_price >= 0),
  total_amount NUMERIC NOT NULL CHECK (total_amount >= 0),
  currency TEXT NOT NULL DEFAULT 'INR',
  shipping_transport TEXT,
  delivery_location TEXT NOT NULL,
  payment_terms TEXT NOT NULL,
  required_date DATE NOT NULL,
  notes TEXT,
  supporting_document_url TEXT,
  
  -- Status Flow: DRAFT -> SUBMITTED -> PENDING INTERNAL APPROVAL -> APPROVED BY PRAJAHITA -> AWAITING COLLABORATOR ACCEPTANCE -> COLLABORATION ACCEPTED / DECLINED - ORDER CANCELLED
  status TEXT NOT NULL DEFAULT 'PENDING INTERNAL APPROVAL' CHECK (
    status IN (
      'DRAFT',
      'SUBMITTED',
      'PENDING INTERNAL APPROVAL',
      'APPROVED BY PRAJAHITA',
      'AWAITING COLLABORATOR ACCEPTANCE',
      'COLLABORATION ACCEPTED',
      'DECLINED - ORDER CANCELLED'
    )
  ),
  
  submitted_by_id UUID,
  submitted_by_name TEXT NOT NULL,
  
  -- Approval Hierarchy tracking: 1. Vice Chairman -> 2. President -> 3. Marketing MD
  current_approver_role TEXT CHECK (current_approver_role IN ('Vice Chairman', 'President', 'MD-Marketing', 'COMPLETED')),
  vice_chairman_approved BOOLEAN DEFAULT FALSE,
  vice_chairman_approved_at TIMESTAMPTZ,
  vice_chairman_approver_id UUID,
  
  president_approved BOOLEAN DEFAULT FALSE,
  president_approved_at TIMESTAMPTZ,
  president_approver_id UUID,
  
  marketing_md_approved BOOLEAN DEFAULT FALSE,
  marketing_md_approved_at TIMESTAMPTZ,
  marketing_md_approver_id UUID,
  
  rejection_reason TEXT,
  rejected_by_name TEXT,
  rejected_at TIMESTAMPTZ,
  
  -- Collaborator Decision (ACCEPT or DECLINE)
  collaborator_decision TEXT CHECK (collaborator_decision IN ('ACCEPTED', 'DECLINED')),
  collaborator_decline_reason TEXT,
  collaborator_accepted_by TEXT,
  collaborator_decision_at TIMESTAMPTZ,
  
  -- Generated Final Bill / Order Number e.g. PRJ-BILL-2026-00452
  generated_bill_number TEXT,
  generated_bill_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Collaboration Audit Logs Table
CREATE TABLE IF NOT EXISTS collaboration_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID REFERENCES collaboration_applications(id) ON DELETE CASCADE,
  user_id UUID,
  user_name TEXT NOT NULL,
  user_role TEXT NOT NULL,
  user_sector TEXT NOT NULL,
  company_name TEXT NOT NULL,
  action TEXT NOT NULL,
  previous_status TEXT,
  new_status TEXT,
  details TEXT,
  ip_address TEXT DEFAULT '127.0.0.1',
  device_info TEXT DEFAULT 'Prajahita EMS Workstation',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Generated Collaboration Bills Table
CREATE TABLE IF NOT EXISTS collaboration_bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_number TEXT NOT NULL UNIQUE,
  application_id UUID REFERENCES collaboration_applications(id) ON DELETE CASCADE,
  collaborator_company_name TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  total_amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'ISSUED',
  generated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sample Data Insertion
INSERT INTO collaboration_companies (company_name, company_code, collaborator_head_name, collaborator_head_email, contact_phone, address, status)
VALUES 
  ('ABC TRADING COMPANY', 'ABC-001', 'Rajesh Sharma', 'head@abctrading.com', '+91 98200 11223', 'Mumbai, Maharashtra', 'active'),
  ('GLOBAL SOAP DISTRIBUTORS', 'GSD-002', 'Anita Kulkarni', 'head@globalsoap.com', '+91 98333 44556', 'Pune, Maharashtra', 'active'),
  ('WESTERN MAHARASHTRA LOGISTICS', 'WML-003', 'Vikram Patel', 'head@wmlogistics.com', '+91 98444 77889', 'Nagpur, Maharashtra', 'active')
ON CONFLICT (company_code) DO NOTHING;
