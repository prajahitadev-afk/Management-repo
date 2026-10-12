-- ============================================================================
-- PRAJAHITA EMS - COLLABORATION MODULE DATABASE SCHEMA
-- Sector: Marketing Only
-- Hierarchy: 1. Vice Chairman -> 2. President -> 3. Marketing MD
-- Matches the app contract in src/services/collaboration.service.ts
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
  collaborator_company_id UUID REFERENCES collaboration_companies(id),
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
  supporting_document_name TEXT,
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
  submitted_at TIMESTAMPTZ,
  current_approver_role TEXT CHECK (current_approver_role IN ('Vice Chairman', 'President', 'MD-Marketing', 'COMPLETED')),
  vice_chairman_approved BOOLEAN DEFAULT FALSE,
  vice_chairman_approved_at TIMESTAMPTZ,
  vice_chairman_approver_name TEXT,
  president_approved BOOLEAN DEFAULT FALSE,
  president_approved_at TIMESTAMPTZ,
  president_approver_name TEXT,
  marketing_md_approved BOOLEAN DEFAULT FALSE,
  marketing_md_approved_at TIMESTAMPTZ,
  marketing_md_approver_name TEXT,
  rejection_reason TEXT,
  rejected_by_name TEXT,
  rejected_at TIMESTAMPTZ,
  collaborator_decision TEXT CHECK (collaborator_decision IN ('ACCEPTED', 'DECLINED')),
  collaborator_decline_reason TEXT,
  collaborator_accepted_by TEXT,
  collaborator_decision_at TIMESTAMPTZ,
  generated_bill_number TEXT,
  generated_bill_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Collaboration Audit Logs Table
CREATE TABLE IF NOT EXISTS collaboration_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES collaboration_applications(id),
  application_number TEXT NOT NULL,
  user_name TEXT NOT NULL,
  user_role TEXT NOT NULL,
  user_sector TEXT NOT NULL,
  company_name TEXT NOT NULL,
  action TEXT NOT NULL,
  previous_status TEXT,
  new_status TEXT,
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE collaboration_audit_logs
  DROP COLUMN IF EXISTS ip_address,
  DROP COLUMN IF EXISTS device_info;

-- 4. Generated Collaboration Bills Table
CREATE TABLE IF NOT EXISTS collaboration_bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_number TEXT NOT NULL UNIQUE,
  application_id UUID REFERENCES collaboration_applications(id),
  collaborator_company_name TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  product_name TEXT,
  total_amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'ISSUED',
  generated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Demo rows are intentionally not seeded.

