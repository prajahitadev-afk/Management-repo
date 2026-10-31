# Prajahita Management Portal — Current Engineering Audit

**Audit date:** 31 October 2026  
**Audited branch:** `premain`  
**Baseline:** `main` at `a2503a84b597d8c335e01721a154630a65319ad8`  
**Scope:** React/Vite application, Supabase schema and policies, workflow services, department forms, and current branch changes.

> This report supersedes the September 2026 audit. That document incorrectly described Leave, Manufacturing, Marketing, Transportation, and R&D as absent. These modules now have code and database objects; the remaining question is whether each workflow is secure, connected to the deployed schema, and verified end to end.

## Executive summary

The repository is a functioning ERP-style portal with authentication, role-aware navigation, employee administration, attendance, leave, bills, orders, marketing, manufacturing, transportation, R&D, collaboration, notifications, reporting, and audit-log surfaces.

The latest maintenance pass on `main` stabilized the portal and added Supabase hardening plus CI checks. The new `premain` branch is addressing specific gaps found by comparing TypeScript services against the live database contract.

**Important deployment distinction:** the new SQL migration files listed below are committed to `premain`, but they have **not** been applied to the live Supabase project. Until they are reviewed and applied, the corresponding new RPC calls will fail against the live database. Do not merge or deploy the branch as a fully operational release before that database step and role-based testing are complete.

## Work completed on `premain`

| Area | Change | Verification status |
|---|---|---|
| Manufacturing defects | Replaced empty-result stubs with database reads and authenticated reporting/review RPC calls; maps the deployed `defect_quantity` and `reported_at` columns | Code committed; migration not applied |
| Manufacturing writes | Added RPC-backed batch creation, output logging, working-hours logging, target create/update, and batch status updates; aligned service models to actual column names | Code committed; migration not applied |
| Manufacturing UI | Added supervisor review action and batch selectors for output/defect/hours forms | Vercel preview check passed for the UI commit |
| Leave | Final approver now deducts the matching leave balance in the same transaction and writes a balance-ledger record | Migration committed; not applied or live-tested |
| Payments | Added authorized Pending → Paid/Failed settlement, atomic order payment-status update, and payment history; removed raw payment/customer debug logging and narrowed lookup queries | Code committed; migration not applied |
| Transportation | Aligned trip, distance, fuel, delay, and target services to the deployed schema; added RPC-backed writes and trip selectors for log forms | Code committed; migration not applied |
| Marketing reports | Department filtering now uses the order creator's profile department instead of incorrectly comparing `customer_id` with a department name | Code committed; Vercel preview check passed for the report commit |

### New migrations committed on this branch

- `supabase/migrations/20261031230000_manufacturing_defect_workflow.sql`
- `supabase/migrations/20261031230100_manufacturing_write_workflows.sql`
- `supabase/migrations/20261031230200_manufacturing_batch_options.sql`
- `supabase/migrations/20261031230300_leave_balance_debit_ledger.sql`
- `supabase/migrations/20261031230400_payment_status_workflow.sql`
- `supabase/migrations/20261031230500_transport_trip_and_log_workflows.sql`

The RPCs derive the acting user from `auth.uid()`, validate role/hierarchy/department scope, and are granted to `authenticated` rather than `anon`/PUBLIC. The six migration files were also checked together in a transaction against the connected Management database and explicitly rolled back; the DDL/function definitions completed without SQL errors and no persistent schema changes were made. The SQL still requires review and execution against the intended Management Supabase project.

## Current module assessment

| Module | Current implementation | Remaining verification / work |
|---|---|---|
| Authentication & profiles | Supabase email/password auth, session persistence, profile loading, password recovery | Test expired sessions, disabled users, recovery links, and profile/auth rollback with real accounts |
| Employee administration | Directory, profile, hierarchy, role/department assignment, employee KPI workflows | Test uniqueness, hierarchy-cycle prevention, rollback, and every role/department combination |
| Attendance | Database-backed attendance pages, employee summaries, CSV export | Consolidate direct attendance writes with any approval path; verify timezone and duplicate-day behavior |
| Leave | Submission, update/cancel, approval chain, history, notifications, balances | Apply balance-ledger migration; test all approval levels, insufficient balances, rejection, cancellation, and concurrent approvals |
| Bills / Finance | Bill submission, approval, history, attachment upload/view, exports | Separate bill approval from actual payment settlement; add reconciliation, receipts, partial payments, and finance reporting if required |
| Orders | Transactional order/item/pending-payment creation and status-transition RPC | Test stock validation, duplicate submissions, customer ownership, and all status transitions |
| Payments | Listing plus new manual settlement RPC/UI | Apply migration; test permissions, order/payment atomicity, failure path, and history. This is manual settlement, not a payment-gateway integration |
| Manufacturing | Batch/output/defect/hours/target services and department UI | Apply migrations; test output/actual quantity atomicity, batch lifecycle, defect review, supervisor scope, and worker forms |
| Marketing | Leads, campaigns, conversions, targets, order/customer reporting | Test lead assignment, campaign lifecycle, conversion totals, role scoping, and empty/error states |
| Transportation | Delivery/dispatch workflow plus trip/fuel/distance/delay/target module | Apply migration; test trip lifecycle and logs. Reconcile trip/fleet records with the separate delivery/vehicle/driver workflow |
| R&D | Projects, experiments, samples, logs, milestones, targets | Test create/update/ownership/approval flows and connect reports to real records |
| Collaboration | Company/application approval chain, audit records, generated collaboration bill | Test company ownership, each approval role, collaborator accept/decline, and bill idempotency |
| Notifications | Header, notifications page, read state, realtime helpers | Normalize realtime payloads and test each workflow event and unread count |
| Audit logs | Audit page and selected RPC/service audit writes | Add consistent database-side coverage for all sensitive mutations |
| Reports | Attendance, bills, marketing/orders, transport, community impact | Verify report definitions, department filters, timezone/date boundaries, and failure vs empty states |

## Live Supabase observations

The connected Management database currently contains the domain tables for manufacturing, marketing, transport, R&D, leave, payments, orders, collaboration, and employee management. All inspected public tables had RLS enabled.

The latest snapshot showed no operational rows in several business domains (including leave requests/history, payments, manufacturing outputs/defects/hours, marketing leads/campaigns/conversions, transport trips/logs, and R&D projects/experiments/samples/logs/milestones). A zero-row table does not prove a feature is broken; it means live operational behavior still needs seeded/test records and end-to-end verification.

Manufacturing schema details were especially important:
- `manufacturing_batches` stores `batch_code`, `planned_quantity`, `created_by`, and `assigned_supervisor` (not the names previously assumed by the service).
- `manufacturing_outputs` requires a `batch_id`.
- `manufacturing_defects` stores `defect_quantity` and `reported_at`.
- `manufacturing_working_hours` requires a `batch_id` and stores actual work-hour rows.
- Manufacturing tables currently expose scoped SELECT policies; writes must go through the new server-validated RPCs.

Transportation similarly stores trip origin/destination and trip code in `transport_trips`; distance and fuel logs are keyed by `trip_id`, with values in `distance_km` and `fuel_litres`. The service/UI now use this contract rather than writing unsupported columns.

## Security and data-integrity priorities

1. Apply and verify the new RPC migrations before enabling their UI actions in production.
2. Re-run Supabase security and performance advisors after applying migrations. Prior observations included SECURITY DEFINER function warnings, disabled leaked-password protection, RLS initplan warnings, permissive policies, unindexed foreign keys, and unused indexes.
3. Review all SECURITY DEFINER functions for explicit identity/role checks, fixed `search_path`, and narrow EXECUTE grants.
4. Review broad authenticated read policies on orders, payments, and customer data; authenticated-only access is not automatically appropriate row-level authorization.
5. Keep all cross-table status changes atomic and record actor, old/new state, and timestamp.
6. Never place service-role credentials in Vite client variables.

## Architecture and quality work still required

- `src/app/AppImplementation.tsx` remains a large, difficult-to-maintain module. Split it into feature-owned pages/components only after preserving the current routes with tests.
- Standardize shared role, department, and status constants between TypeScript and SQL.
- Consolidate duplicate transportation concepts: delivery dispatch/fleet assignment and trip/fuel/distance logging must share clear IDs and lifecycle rules.
- Add unit and integration tests for services/RPC contracts, then Playwright or equivalent role-based end-to-end coverage.
- Extend CI beyond typecheck/build to run automated tests and dependency/security checks.
- Add distinct loading, empty, permission-denied, and query-error states; never turn a failed query into a believable zero metric.
- Update this audit whenever a migration or workflow is shipped.

## Release gate

Do not call the portal fully complete until:
- all six new migrations are reviewed and applied to the Management Supabase project;
- every RPC has been tested with an allowed user and a denied user;
- leave, payment, manufacturing, and transportation transactions are verified against live rows;
- all department routes/forms have success, validation, and failure-path tests;
- CI runs typecheck, build, and automated tests;
- the production deployment and environment configuration are verified.

**Current conclusion:** the project has substantial working functionality and the `premain` branch is improving real backend gaps. It is not yet production-complete or fully verified end to end.
