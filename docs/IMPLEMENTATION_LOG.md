# `premain` Implementation Log

**Base branch:** `main`  
**Working branch:** `premain`  
**Branch relationship at last check:** 43 commits ahead of `main`, 0 commits behind.  
**Database target:** Management Supabase project only.

This log groups the branch commits by the implementation headings used in their commit messages.

## 1. Manufacturing defect workflow

- Replaced empty defect query stubs with reads from `manufacturing_defects`.
- Mapped the deployed `defect_quantity` and `reported_at` columns into the UI model.
- Added authenticated report and review RPCs with worker/manager hierarchy checks.
- Added a supervisor review action and severity selection in the department UI.

**Migration:** `20261031230000_manufacturing_defect_workflow.sql`

## 2. Manufacturing production and batch workflow

- Mapped batch service models to `batch_code`, `planned_quantity`, `created_by`, and `assigned_supervisor`.
- Added atomic batch creation, output logging, working-hour logging, target creation, and batch status update RPCs.
- Output logging now increments batch actual quantity in the same transaction and prevents exceeding the planned quantity.
- Added a scoped batch lookup RPC and select controls instead of asking users to type batch UUIDs.
- Connected the department UI to batch-linked output, defect, and working-hour operations.

**Migrations:**
- `20261031230100_manufacturing_write_workflows.sql`
- `20261031230200_manufacturing_batch_options.sql`

## 3. Leave balance accounting

- Added a leave-balance transaction ledger.
- Final approval debits the matching Casual, Sick, Earned, or Unpaid balance in the same transaction as the approval.
- Insufficient balance blocks final approval; the approval status/history changes roll back with it.
- Added indexes and a scoped read policy for the ledger.

**Migration:** `20261031230300_leave_balance_debit_ledger.sql`

## 4. Payment settlement

- Removed raw payment/order/customer debug logging.
- Reduced payment lookup queries to the relevant order/customer IDs.
- Added a permission-aware payment page with confirmation for irreversible settlement actions.
- Added atomic Pending → Paid/Failed updates that synchronize `payments.status` and `orders.payment_status`.
- Added a payment status history ledger.

**Migration:** `20261031230400_payment_status_workflow.sql`

This is a manual settlement workflow; it is not an external payment-gateway integration.

## 5. Transportation trip and log workflow

- Mapped trip, distance, fuel, delay, and target services to the deployed table schema.
- Trips now use trip code, origin, destination, driver profile, date, and status.
- Distance/fuel/delay logs are associated with a trip ID and derive the driver from the trip.
- Added RPC-backed trip, distance, fuel, delay, and target writes with department/hierarchy checks.
- Updated forms to use trip selectors for distance, fuel, and delay records.

**Migration:** `20261031230500_transport_trip_and_log_workflows.sql`

The separate delivery/vehicle/driver workflow still needs a planned integration pass with these trip records.

## 6. Reports and dates

- Marketing report department filters now use the order creator's profile department, not a customer ID.
- Date-only input is preserved in local calendar time.
- Timestamp queries include the entire selected end date.
- Bill reports distinguish bills explicitly marked Paid from bills merely Approved.

## 7. UI structure and design foundations

- Extracted `DepartmentFormModal` and `DepartmentDataTable` into reusable components under `src/components/department/`.
- Added shared global focus, reduced-motion, root-layout, and native dark-control styles.
- Added the global stylesheet to the shared stylesheet entry point.
- Replaced the template design guidelines with Prajahita brand and engineering conventions.
- Added `docs/ARCHITECTURE.md` describing current boundaries and the incremental feature-folder refactor path.

## 8. Documentation

- Replaced the stale September audit with a current October engineering audit.
- Marked the old ERP functionality audit as superseded.
- Updated README migration guidance to call out migration-history drift and the fact that these new migrations are not applied yet.

## Verification

- The six new migration files were submitted together to the connected Management database inside a transaction that was explicitly rolled back. The DDL/function definitions completed without SQL errors; no schema changes from that validation transaction were retained.
- Vercel preview checks reported success for the main manufacturing, transportation, report, payment, and component-refactor code commits. The latest commit status should be checked again before merge.
- The repository's CI workflow runs TypeScript and production-build checks on its configured triggers. No comprehensive unit, integration, or browser E2E suite exists yet.
- No new migration has been applied to the live Supabase database, and no live workflow rows were created during this branch work.

## Required before merge

1. Reconcile live Supabase migration history with repository files.
2. Review and apply all six migrations to the Management Supabase project only.
3. Test each new RPC with both authorized and unauthorized identities.
4. Exercise leave approval at every level, insufficient balances, and duplicate/concurrent requests.
5. Exercise manufacturing batch/output/defect/hours flows with real test accounts.
6. Exercise payment settlement and verify order/payment/history atomicity.
7. Exercise trip lifecycle and logs; define how trip records relate to delivery/vehicle assignments.
8. Run TypeScript/build CI and add automated service/RPC/E2E coverage.
9. Re-run Supabase security/performance advisors and address findings.
