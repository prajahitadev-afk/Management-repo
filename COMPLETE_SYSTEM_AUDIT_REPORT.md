# Prajahita Employee Management System
# Complete System Audit Report

**Audit date:** 2026-09-03  
**Method:** Static inspection of the repository's SQL, React/TypeScript source, routes, services, hooks, and package scripts. `npm run build` was executed successfully. No live Supabase project, production schema, credentials, seeded data, or end-to-end browser session was available; therefore live connectivity, deployed foreign keys, indexes, RLS behavior, and external Shop Database synchronization are **not proven**.

## SYSTEM HEALTH SCORE

**Overall: 42%**

This is an evidence-weighted delivery score, not a code-coverage percentage. Core employee, attendance, KPI, billing, internal order, notification, reporting, and transport surfaces exist. The score is reduced by the absence of complete leave, manufacturing, R&D, payment, and external shop-sync implementations; split workflows; and unverified database authorization.

## WORKING FEATURES

- Supabase email/password authentication, session loading, logout, auth-state subscription, and password reset UI exist in `src/context/AuthContext.tsx` and `src/pages/ResetPasswordPage.tsx`.
- Employee directory, profile editing, employee status changes, hierarchy view, supervisor assignment, department assignment, and employee attendance summaries exist in `src/pages/employees/` and `src/services/employee*.service.ts`.
- Roles and hierarchy levels are represented in `src/app/AppImplementation.tsx`, with role assignment RPC support in `supabase_role_assignment.sql`.
- Attendance records can be read, entered, summarized, and exported from `src/services/attendance.service.ts`, `src/pages/employees/AttendancePage.tsx`, and the live app.
- Employee KPI assignment, progress updates, reviews, scoping, and dashboard display exist in `src/services/employee-kpi.service.ts`, `supabase_employee_kpis.sql`, and `src/components/EmployeeKpiWidget.tsx`.
- Bills support list, create/update, status changes, history, attachments, signed URLs, approvals, and exports through `src/services/bills.service.ts` and the Bills screen.
- Internal customer lookup/creation, product lookup, order/item display, order approval/rejection, stock decrement, and order reporting exist in `src/app/CreateOrderPage.tsx`, `src/services/orders.service.ts`, and `src/services/marketing.service.ts`.
- Transport supports delivery creation, driver/vehicle selection, assignment, tracking, status updates, confirmation, OTP generation/verification, fleet summaries, exports, and delivery notifications in `src/app/CreateDispatchPage.tsx` and `src/services/transport.service.ts`.
- Notifications support read/unread state, realtime subscription, forwarding, escalation lookup, and event helper functions in `src/services/notification.service.ts` and `src/hooks/useNotifications.ts`.
- Reports exist for attendance, bills, marketing/order metrics, transport, and community impact in `src/services/reports.service.ts`.
- Audit-log viewing and selected employee/KPI/attendance/role audit writes exist in `src/pages/AuditLogPage.tsx`, `src/services/audit-log.service.ts`, and the employee/RBAC SQL scripts.
- The production bundle compiles with Vite. Current build warning: duplicate `Managing Director` object key in `src/services/employee.service.ts`.

## PARTIALLY WORKING FEATURES

### Core master modules

| Module | Database tables | Backend APIs | Frontend | Widgets/reports | Permissions | Notifications/audit | Data flow |
|---|---|---|---|---|---|---|---|
| Users / Employees | `profiles` assumed and heavily used; base schema absent | Employee/profile services and Supabase queries exist | Directory, profile, organization pages exist | Dashboard employee cards and KPI widget exist | Client role gates plus incomplete/unverified RLS | Selected mutations audit; no universal trigger coverage | Mostly working, but auth/profile rollback and direct-ID writes are risks |
| Roles | `profiles.role`, `roles` read path; role table write path absent | `assign_employee_role` RPC exists | Admin RBAC surface exists | Role-aware dashboard/navigation exists | Role list omits department-specific MD roles in SQL RPC | Role changes audit through RPC | Partially working; UI and SQL role vocabularies drift |
| Departments | Hardcoded `src/constants/departments.ts`; history table exists | `assign_employee_department` RPC exists | Department selectors/history exist; no standalone department master page | Department-scoped cards exist | Department checks vary by raw string | Assignment audit exists; no department CRUD audit | Incomplete; no canonical department table/master flow |
| Notifications | `notifications` plus Phase 2.6 columns/index | Notification service/helpers/realtime exist | Header and Notifications page exist | Notification count exists | Owner select policy exists; insert policies are permissive | Leave event types exist but no leave producer | Partially working; `read` vs `is_read` realtime mismatch |
| Audit Logs | `audit_logs` with some indexes/policies | Read service plus selected inserts/RPC writes | Audit page exists | No audit dashboard | Select policy is broad; complete actor authorization unverified | Not comprehensive; direct table mutations can bypass it | Partially working |
| Attendance | `attendance` | Direct update/insert path | Main attendance and employee attendance pages exist | Summary/cards and CSV exist | Profile-first merge with direct attendance persistence | Database-backed attendance path | Implemented |
| Employee Hierarchy | `employee_hierarchy`, department history | Supervisor assignment RPC and service exist | Organization chart exists | KPI/subordinate scoping uses hierarchy | RLS is authenticated/broad in places | Assignment audit exists | Mostly working, subject to deployed RLS |
| Employee KPI | `employee_kpis` with indexes | Assignment/progress/review RPCs | KPI widget and employee workflows exist | KPI widget exists; no standalone report | Hierarchy and role checks are split | Review path is auditable through RPC | Mostly working |

### Shop / order integration

The repository implements an **internal order workflow**, not a demonstrated database-to-database Shop sync.

- **Orders:** partially working. `orders` is queried and created through `create_order_with_items`; approval and status updates exist. The service sends `p_created_by`, while `supabase_phase2_setup.sql` declares no matching RPC parameter, so creation can fail with an RPC signature error.
- **Order items:** partially working. Created transactionally from JSON and displayed through joins. No standalone edit/delete flow.
- **Customers:** partially working. Read and inline create exist; no standalone customer CRUD/master page. Customer RLS insert/select policies use `true`.
- **Payments:** **missing**. No `payments` table definition, payment service, payment API, payment UI, payment status flow, or payment report was found. Bill payment-like statuses are not a payments integration.
- **Notifications:** order approval/rejection and inventory shortage helpers exist; delivery notification helpers exist.
- **Sync timestamps:** **missing/not proven**. `created_at`/`updated_at` fields are used for internal records, but no external source ID, `synced_at`, sync job, webhook, cursor, retry state, or Shop Database connector was found.
- **Foreign keys/indexes:** some relationships are required by PostgREST joins and some indexes are declared in feature SQL, but no canonical schema exists to verify that all deployed keys/indexes are present. No broken live FK could be tested.
- **Dispatch consistency:** the delivery RPC sets the order to `Dispatched`, while `CreateDispatchPage.tsx` separately updates the order to `Created`; this can leave an incorrect status and is not atomic.

### Marketing

Partially working under the repository rule. Order/customer/product metrics, approvals, exports, and a Marketing page exist. The required Marketing module is **not complete** because there are no campaign, lead, conversion, opportunity, promotion, budget, or campaign-analytics tables/APIs/UI. Query failures in `marketing.service.ts` become empty/zero metrics, masking outages. Department filtering in `reports.service.ts` compares `customer_id` to a department value.

### Transportation

Partially working, but not fully accepted as a complete transportation management module. Deliveries, tracking, assignments, vehicles, drivers, OTP, status changes, fleet summaries, and reports exist. Fuel usage, distance travelled, route planning, maintenance, compliance, and dedicated driver/delay analytics are missing. The code alternates between `drivers` and `drivers:profiles` relationships, and OTP SMS delivery is not implemented; OTP is only handled in-app.

### Community/programs

Read-only program and impact data is referenced by dashboard/report code, but no complete CRUD surface exists. `programs` is modeled with `title` in `outreach.service.ts` while reports select `name`, creating schema/query drift.

## MISSING FEATURES

### Leave management

**Status: NOT IMPLEMENTED under the requested acceptance rule.**

- No `leave_requests` table or leave balance transaction table.
- No leave submission service/API/RPC.
- No complete Supervisor -> Manager -> CM -> GM -> MD approval chain.
- No leave request page or approval queue. “Apply Leave” is a dashboard label only.
- Leave notification event type constants exist, but no request workflow creates them.
- No complete leave audit trail. The `Leave` attendance status and profile balance fields are not leave management.

### Manufacturing

**Status: NOT IMPLEMENTED under the requested acceptance rule.**

- No production, soap batch, work order, defect, quality metric, working-hour, target, or output tables.
- No manufacturing service/API/RPC or production mutation workflow.
- No manufacturing worker, supervisor, manager, CM, GM, or MD UI screens.
- No production widgets, production-vs-target reports, notifications, or complete audit flow.
- Department names, product stock, role labels, and marketing text do not constitute this module.

### R&D

**Status: NOT IMPLEMENTED under the requested acceptance rule.**

- No experiment, sample, project, milestone, research-progress, innovation-report, or product-development tables.
- No R&D service/API/RPC or mutation workflow.
- No worker, supervisor, manager, CM, GM, or MD R&D screens/widgets/reports.
- `MD-RD` and “Research & Development” labels are organizational metadata only.

### Other missing or incomplete capabilities

- External Shop Database sync, sync monitoring, retry/reconciliation, source IDs, and sync timestamps.
- Payments and payment reconciliation.
- Standalone master-data administration for customers, products, vehicles, drivers, programs, and departments.
- Database-authoritative permission coverage for all writes.
- Comprehensive database-trigger audit logging.
- Automated tests, linting, typecheck, migration runner, and CI validation. `package.json` contains only `dev` and `build` scripts.

## CRITICAL ISSUES

1. **Leave is absent end-to-end.** The requested multi-level submission, approval, notification, and audit workflow cannot be performed.
2. **Manufacturing and R&D are absent operational modules.** No corresponding tables, APIs, and UI screens exist.
3. **Payments and external Shop synchronization are absent.** Orders are internal records, not proof of cross-database sync.
4. **Order creation RPC mismatch:** `src/services/orders.service.ts` supplies `p_created_by`, but `supabase_phase2_setup.sql` declares/grants a function without that parameter.
5. **Dispatch is non-atomic and can overwrite status:** the RPC sets `Dispatched`, then the page separately writes `Created`.
6. **Attendance has two conflicting write paths:** direct attendance upsert can bypass the approval/audit path.
7. **Security depends heavily on client navigation and permissive policies:** several SQL policies use `true`; security-definer RPCs do not consistently validate role, ownership, driver, vehicle, or order authority.
8. **Role vocabulary drift:** TypeScript supports `MD-Manufacturing`, `MD-Marketing`, `MD-Transport`, and `MD-RD`, while `assign_employee_role` rejects them.
9. **Potential query contract breaks:** driver relationship aliases differ, and `programs.name` conflicts with the `title` model.
10. **Audit completeness is not guaranteed:** direct updates to core tables are not covered by universal database triggers.
11. **Build warning:** duplicate `Managing Director` key in `src/services/employee.service.ts` silently overwrites one value.
12. **Failure masking:** marketing/community data loaders convert query errors to empty or zero results; users can see a false healthy dashboard.

## DATABASE REVIEW

### Tables Existing or Referenced

`profiles`, `roles`, `attendance`, `bills`, `bill_history`, `orders`, `order_items`, `customers`, `products`, `deliveries`, `delivery_assignments`, `delivery_tracking`, `vehicles`, `drivers`, `notifications`, `programs`, `program_impact`, `employee_hierarchy`, `employee_department_history`, `employee_kpis`, and `audit_logs` are referenced by source or feature SQL. Feature SQL explicitly creates or alters only a subset; a base schema is not included.

### Tables Missing

`payments`, `leave_requests`, `leave_approvals` or equivalent workflow history, `leave_balance_transactions`, `production_batches`, `production_work_orders`, `production_outputs`, `production_defects`, `production_quality_metrics`, `production_targets`, `manufacturing_working_hours`, `marketing_campaigns`, `marketing_leads`, `marketing_conversions`, `marketing_opportunities`, `marketing_budgets`, `rd_projects`, `rd_experiments`, `rd_samples`, `rd_milestones`, `rd_progress`, `shop_sync_runs`, and external-record mapping/sync tables.

### Incomplete or unverified

- No canonical migration/schema file proves all required columns, foreign keys, unique constraints, or indexes.
- Required joins include orders-customers, orders-order_items, order_items-products, deliveries-orders, deliveries-vehicles, deliveries-drivers/profiles, assignment-delivery, bill-history, hierarchy-profiles, and program-impact-programs.
- Known index declarations cover selected audit, hierarchy, KPI, approval, and notification lookups; full production index coverage is unverified.
- RLS exists on selected tables but has permissive policies and is not comprehensive across all referenced tables.

## API REVIEW

### Working or substantially implemented APIs

- Authentication/profile: `src/context/AuthContext.tsx`, `src/services/auth.service.ts`, `profile.service.ts`.
- Employees, hierarchy, department assignment, roles, and KPIs: corresponding services plus RPCs in `supabase_*` SQL.
- Attendance reads/direct writes and attendance approval RPC calls.
- Bills: read/create/update/status/history/attachments.
- Orders/customers/products: reads, inline customer create, order RPC, approval/rejection.
- Transport: delivery/assignment/tracking/status/confirmation/OTP/report services.
- Notifications and audit-log reads/writes.
- Attendance, bills, marketing, transport, and community reports.

### Missing APIs

Leave submission/approval/escalation APIs; manufacturing production/defect/quality/target APIs; R&D experiment/sample/milestone APIs; payment APIs; Shop sync/webhook/reconciliation APIs; campaign/lead/conversion APIs; standalone master-data CRUD APIs; complete audit-trigger APIs.

### Broken or risky APIs

`create_order_with_items` call/signature mismatch; non-atomic dispatch/order update; conflicting attendance save paths; inconsistent transport relationship names; permissive security-definer/RLS contracts; caller-supplied actor IDs; silent error-to-empty fallbacks.

## FRONTEND REVIEW

### Working pages

Dashboard, login, password reset, attendance, employee directory, employee profile, employee attendance, organization chart, bills, marketing/orders, transport/delivery, notifications, reports, admin/RBAC, audit log, create order, and create dispatch pages are represented in the live app or its imported page components.

### Missing pages

Leave submission, leave approval queue/history; manufacturing worker production, supervisor quality/team output, manager targets, CM/GM analytics, and MD strategy pages; R&D worker experiments/samples, supervisor progress, manager milestones, CM/GM reports, and MD oversight pages; payment management/reconciliation; Shop sync monitoring; campaign/lead management; standalone department/customer/product/fleet master pages.

### Dashboard widgets

Existing: employee counts, attendance summaries, bills, orders/revenue, deliveries, notifications, community impact, role/department cards, and employee KPI widget. Missing: leave pipeline/balance transactions, production output/defects/targets, marketing campaign funnel/conversions, transport fuel/distance/route efficiency, R&D progress/milestones, payments, and sync health.

## ROLE PERMISSION REVIEW

This matrix reflects observable UI/service intent, not verified database authorization. A feature is marked working only where a usable surface exists; it does not mean the entire requested module is complete.

### Worker

- ✓ Working: login, own profile, attendance entry/read, notifications, dashboard, limited employee visibility.
- ✗ Missing: leave submission workflow, manufacturing worker workflow, marketing leads/conversions, transport fuel/distance workflow, R&D experiments/samples, payments.

### Supervisor

- ✓ Working: subordinate visibility where hierarchy exists, attendance approval path, KPI review path, notifications, reports access as routed.
- ✗ Missing: leave approval chain, manufacturing team output/quality, marketing team performance, transport driver/delay analytics, R&D team progress.

### Manager

- ✓ Working: bills, orders/marketing metrics, dispatch/transport surfaces, employee/hierarchy/KPI scope, reports.
- ✗ Missing: leave approval, manufacturing targets vs actual, campaign analytics, fleet operations, R&D milestones, payments/sync administration.

### CM

- ✓ Working: role labels and some dashboard/report access; shared order/bill/transport surfaces are present according to route rules.
- ✗ Missing: leave approval, manufacturing manager performance, marketing efficiency, route efficiency, research progress, complete CM-specific widgets/reports.

### GM

- ✓ Working: broad employee/dashboard/report access and selected order/bill/notification paths.
- ✗ Missing: leave approval, department production analytics, marketing department analytics, logistics analytics, innovation reports, payment reconciliation, sync oversight.

### MD

- ✓ Working: department-specific MD labels/navigation for Manufacturing, Marketing, Transport, and R&D; shared dashboard/report surfaces.
- ✗ Missing: every requested department MD operational dashboard/workflow, final leave approval, production strategy dashboard, revenue/growth analytics, transportation oversight, and product-development oversight.
- ✗ Risk: department-specific MD role names are not accepted by the role-assignment SQL RPC.

## NOTIFICATION, REPORT, AND AUDIT COVERAGE

| Area | Existing | Missing / risk |
|---|---|---|
| Notifications | Bills, orders, deliveries, attendance escalation, employee events, inventory shortage, realtime/read state | Leave producers, manufacturing/R&D/payment/sync events; realtime payload normalization; SMS OTP delivery |
| Reports | Attendance, bills, marketing/order, transport, community impact; CSV/XLSX/PDF exports | Leave, manufacturing, R&D, payments, sync, campaign funnel, fuel/distance; some filters/query columns are inconsistent |
| Audit logs | Viewer, actor filters, selected employee/KPI/attendance/role writes | Universal triggers, leave/production/R&D/payment/sync trail, guaranteed atomic history, complete server authorization |

## DATA FLOW AND DATABASE SYNC VERDICT

- **Core HR:** mostly connected to Supabase, with split attendance workflow and unverified RLS.
- **Orders:** customer -> order -> order items -> stock decrement -> approval notification -> dispatch is represented, but RPC mismatch and non-atomic dispatch make the flow unreliable.
- **Payments:** no flow exists.
- **External Shop sync:** no connector, inbound/outbound job, source key, `synced_at`, retry, reconciliation, or sync-status UI exists. Verdict: **not implemented**.
- **Manufacturing, Marketing domain, Transport domain, R&D:** only transport has a partial operational flow; manufacturing and R&D are not implemented; marketing is an order analytics surface rather than the requested CRM/campaign module.
- **Leave:** no end-to-end flow exists.

## FINAL IMPLEMENTATION ROADMAP

### Priority 1 (Critical)

1. Add canonical migrations and verify the deployed schema: `payments`, leave tables/workflow history, manufacturing tables, marketing campaign/lead tables, R&D tables, Shop sync tables, all required foreign keys, unique constraints, and indexes.
2. Implement leave end to end: `leave_requests` and approval-history tables; service/RPCs for submit, Supervisor/Manager/CM/GM/MD decisions; `LeavePage` and approval queue; notifications; atomic balance updates; audit logs.
3. Implement manufacturing end to end: production batches/work orders/outputs/defects/quality/working-hours/targets tables; `manufacturing.service.ts`; role-scoped worker/supervisor/manager/CM/GM/MD pages; widgets, reports, notifications, and audit trail.
4. Implement R&D end to end: projects/experiments/samples/milestones/progress tables; `research.service.ts`; role-scoped screens/widgets/reports, notifications, and audit trail.
5. Implement payments and Shop sync: `payments`, external IDs, `shop_sync_runs`, `synced_at`, retry/error state; server webhook/job/RPC APIs; reconciliation and sync-monitoring UI.
6. Fix order/dispatch contracts: align `create_order_with_items` with `src/services/orders.service.ts`, and make delivery, assignment, tracking, order status, and notifications one transaction/RPC.
7. Make authorization server authoritative: replace permissive policies, derive actor from `auth.uid()`, validate hierarchy/department/ownership in RPCs, and add RLS tests.

### Priority 2 (Important)

1. Unify attendance into one approval-aware path and audit every accepted/rejected change.
2. Add standalone CRUD pages/services for departments, customers, products, vehicles, drivers, campaigns, and programs where required.
3. Reconcile role, department, status, notification, driver relationship, and program column contracts across SQL and TypeScript.
4. Add transport fuel, distance, route efficiency, delay, maintenance, and compliance data/workflows.
5. Add leave/manufacturing/R&D/payment/sync report exports and role-specific dashboard widgets.
6. Replace silent empty/zero error fallbacks with visible loading/error/empty states.
7. Add comprehensive database-trigger or transaction-level audit coverage and notification producers.

### Priority 3 (Optional)

1. Consolidate `src/app/App.tsx` and `src/app/AppImplementation.tsx` into one authoritative route/render path.
2. Add automated unit, integration, RLS, RPC, route, role-matrix, and browser workflow tests; add `test`, `lint`, and `typecheck` scripts and CI.
3. Fix the duplicate role-map key, remove production RPC payload logging, and split the oversized app implementation.
4. Add pagination/server-side filtering, richer PDF reports, realtime notification normalization, and sync health trends.

## AUDIT CONCLUSION

The current repository is a partially implemented employee and operations portal, not a complete Prajahita Employee Management System under the stated acceptance criteria. The highest-value existing foundation is employee management plus partial attendance, KPI, billing, order, notification, reporting, and transport functionality. Leave management, manufacturing, R&D, payments, and external Shop Database synchronization must be implemented and tested end to end before the system can be considered complete.
