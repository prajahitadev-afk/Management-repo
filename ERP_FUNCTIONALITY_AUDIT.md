> **Superseded historical audit (September 2026).** This file records an earlier static review and contains claims that are no longer current. Use [COMPLETE_SYSTEM_AUDIT_REPORT.md](./COMPLETE_SYSTEM_AUDIT_REPORT.md) for the 31 October 2026 repository/database audit and current implementation status.

# ERP Functionality Audit

## Audit Basis

This audit is based on static inspection of the current workspace, the Vite production build, route/import tracing, Supabase query tracing, and the SQL scripts present in the repository. No changes were made to existing source files and no live Supabase credentials or end-to-end browser data session were available, so database connectivity is assessed from code paths, not from production records.

The production build completes successfully. It emits a warning for a duplicate `Managing Director` key in [employee.service.ts](src/services/employee.service.ts#L15). The worktree already contained unrelated modified and untracked employee/RBAC files; they were audited in place.

## IMPLEMENTATION ORDER BY IMPACT

This order is dependency-aware. Each priority should be completed and validated before starting the next one. Within a priority, items are ordered by the amount of downstream rework they prevent.

### Priority 1: System-breaking issues

1. **Consolidate the two root app implementations.** Make [App.tsx](src/app/App.tsx) and [AppImplementation.tsx](src/app/AppImplementation.tsx) have one authoritative routing/rendering path. This is the first task because every route, permission, form, and dashboard test is otherwise testing potentially different behavior.
2. **Resolve route state and recovery-flow contradictions.** Define one route contract for `/`, `/login`, `/profile`, `/organization`, employee subroutes, and `/reset-password`; align recovery URL detection between [App.tsx](src/app/App.tsx#L139-L151), [AuthContext.tsx](src/context/AuthContext.tsx#L113-L164), and [ResetPasswordPage.tsx](src/pages/ResetPasswordPage.tsx#L14-L30).
3. **Establish a reproducible validation baseline.** Add an executable test/check strategy for build, route resolution, auth states, and uncaught promise errors before functional changes begin. The current build passes but has no automated behavioral coverage.
4. **Remove the duplicate `Managing Director` key and fail CI on build warnings.** This is low behavioral impact by itself, but it must be cleared early so later validation output is trustworthy.

**Gate:** one root implementation, one route map, recovery/login routes render deterministically, and build/test checks are repeatable.

### Priority 2: Database connectivity issues

1. **Create one canonical database contract.** Verify deployed tables, columns, foreign keys, unique constraints, storage bucket/policies, attendance composite key, hierarchy constraints, and all required RPCs against the SQL scripts. Do this before modifying UI mutation behavior.
2. **Reconcile query/model mismatches.** Resolve `programs.name` versus `title`, `drivers` versus `profiles` aliases, notification `read` versus `is_read`, profile leave-field alternatives, and order/bill/transport status vocabularies.
3. **Move authorization to the database boundary.** Verify or implement RLS/RPC checks for actor identity, role, department, hierarchy, and ownership across employees, bills, attendance, orders, transport, notifications, and audit logs. Client-side navigation must remain presentation only.
4. **Unify status transition contracts.** Use shared, database-aligned status values and validate every allowed transition server-side, including bill approval, order progression, and delivery progression.
5. **Make cross-table operations atomic.** Replace the separate dispatch creation/order update sequence with one transaction/RPC; ensure bill mutation plus history, and attendance approval plus attendance write, cannot leave split states.
6. **Verify failure semantics.** Stop silently converting query errors to empty/zero data in marketing, community impact, and program hooks; return distinguishable error states so connectivity failures cannot look like valid empty datasets.

**Gate:** every observed table/RPC query succeeds against the deployed schema, unauthorized writes are rejected server-side, and cross-table workflows are atomic or recoverable.

### Priority 3: Forms not saving

1. **Test and repair the highest-risk mutations first:** employee creation/update/status changes, bill create/update/approval, order creation, dispatch creation, and attendance submission.
2. **Unify attendance save behavior.** Decide whether the primary attendance page submits directly or creates approval records, then route all relevant roles through that one workflow with audit history.
3. **Repair dispatch save consistency.** Ensure the delivery, assignment, order status, tracking entry, and notifications either all succeed or the user receives a recoverable failure state.
4. **Harden bill saves.** Validate amount/date/department/reasons, preserve old status/history, and ensure attachment upload failures do not leave misleading bill records.
5. **Harden employee saves.** Derive actor identity from the session, validate email/phone/code uniqueness and hierarchy cycles, and ensure auth/profile rollback removes partial records.
6. **Complete master-data form coverage.** Either add standalone CRUD for products, customers, vehicles, drivers, programs, and impact, or explicitly mark them read-only and remove unsupported edit affordances.
7. **Add mutation-level tests.** For each form, verify create, edit, delete/soft-delete, validation rejection, database refresh, duplicate submission, and partial-failure behavior.

**Gate:** each supported form has a tested success path, visible failure path, validation contract, and refreshed database-backed state.

### Priority 4: Broken navigation

1. **Publish the canonical route table** from the single root implementation and use it for parsing, navigation, sidebar highlighting, direct URLs, and access checks.
2. **Fix valid routes currently rejected or duplicated:** `/profile`, `/organization` versus `/employees/organization`, and `/employees/attendance`.
3. **Make unauthorized direct URLs deterministic.** Redirect or render a consistent access-denied page without silently falling back unknown paths to dashboard.
4. **Expose or remove orphan routes.** Every supported route should have a menu/action entry or a documented direct-link purpose; every menu item should resolve to a live page.
5. **Add navigation tests by role.** Cover direct URL access, browser back/forward, hash/path transitions, mobile menu navigation, profile actions, and unauthenticated routes.

**Gate:** every menu link and documented direct URL resolves to exactly one live page, and unknown/unauthorized paths have intentional behavior.

### Priority 5: Static dashboards

1. **Replace or clearly label hardcoded login metrics** (`240+`, `14,800`, `14`, `252`) and the hardcoded 2025 copyright text.
2. **Correct dashboard definitions before styling:** active employees versus today-present employees, bill status coverage, five-day attendance semantics, community active-program count, and transport delayed counts.
3. **Fix report/dashboard filters:** especially Marketing department filtering by `customer_id`, department normalization, and transportation naming.
4. **Connect read-only domains where the business requires them.** Add program/impact/product/customer data maintenance or document that dashboards are intentionally read-only.
5. **Make loading/error/empty states distinct** for every card and chart so a failed query cannot appear as a legitimate zero.
6. **Add dashboard data tests.** Use fixtures for each role and status combination, including empty, delayed, failed-query, and partially populated datasets.

**Gate:** every dashboard card has a documented query and definition, no known fake statistic remains, and failure/empty states are distinguishable.

### Priority 6: Code cleanup

1. Remove dead compatibility app/page paths only after route tests pass.
2. Remove or consolidate unused hooks, feature barrels, diagnostic components, and duplicate profile/auth helpers after usage is confirmed.
3. Split the large [AppImplementation.tsx](src/app/AppImplementation.tsx) into page/service-owned modules without changing public behavior.
4. Normalize shared role, department, and status constants across TypeScript and SQL.
5. Add pagination/server-side filtering for large datasets and improve report PDF encoding/faithfulness.
6. Normalize realtime notification payloads through the same mapper as initial loads.
7. Remove production console logging of operational/RPC payloads and enforce lint/type/build checks in CI.

## REWORK-MINIMIZING SEQUENCE

1. **Baseline:** capture current build output, route inventory, SQL/RPC inventory, and representative role/form expectations.
2. **Stabilize architecture:** choose the live root, consolidate routes, and fix recovery/profile navigation.
3. **Stabilize contracts:** verify schema, relationships, RPC signatures, status values, RLS, and actor authorization.
4. **Stabilize transactions:** make dispatch, attendance approval, bill history, and employee rollback consistent.
5. **Repair forms:** fix save/refresh/error behavior against the verified contracts, then add mutation tests.
6. **Repair navigation:** validate every role and direct URL against the now-authoritative root.
7. **Repair dashboards:** correct definitions and replace static/fallback-looking values using stable queries.
8. **Clean up:** remove dead code and refactor only after behavior is protected by tests.

This sequence minimizes rework because it prevents form fixes from being rewritten after schema/RLS changes, prevents dashboard fixes from targeting the wrong root or status model, and delays deletion/refactoring until route and behavior coverage proves the code is unused.

## WORKING FEATURES

### Application and authentication

- The actual entry point is [main.tsx](src/main.tsx), which mounts [App.tsx](src/app/App.tsx) under `AuthProvider`.
- Supabase email/password login, logout, session lookup, auth-state subscription, and profile loading are implemented in [AuthContext.tsx](src/context/AuthContext.tsx#L42-L216).
- Recovery URLs are routed to [ResetPasswordPage.tsx](src/pages/ResetPasswordPage.tsx); password length and confirmation validation are present, and `auth.updateUser` is called.
- Supabase configuration fails fast when `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` is missing in [supabase.ts](src/lib/supabase.ts#L1-L16).

### Live pages and modules

The live root renders the named page components exported by [AppImplementation.tsx](src/app/AppImplementation.tsx), not the default `App` function at the bottom of that file.

- **Dashboard:** `useDashboard` loads profiles, attendance, bills, leave values, subordinate profiles, orders, deliveries, and community impact through [dashboard.service.ts](src/services/dashboard.service.ts#L166-L470). Role-specific dashboard layouts and the employee KPI widget are rendered from real query results.
- **Attendance:** the live dashboard attendance view reads employee/attendance records, permits non-worker status edits, persists with an `attendance` upsert, and reloads data in [AppImplementation.tsx](src/app/AppImplementation.tsx#L1410-L1457). CSV export is implemented.
- **Bills:** [bills.service.ts](src/services/bills.service.ts#L207-L649) implements read, create, draft/resubmit update, status transitions, history insertion, attachment upload, signed attachment viewing, and exports. [useBills.ts](src/hooks/useBills.ts#L1-L79) refreshes state after mutations.
- **Marketing orders:** orders and order items are read from Supabase, normalized, filtered, and displayed. Order approval/rejection updates the order and sends notifications.
- **Create order:** [CreateOrderPage.tsx](src/app/CreateOrderPage.tsx#L220-L430) reads customers/products, can create a customer, validates customer/items/stock, and calls `create_order_with_items` transactionally. Low-stock and pending-approval notifications are triggered.
- **Transport:** shipment metrics, shipment rows, fleet status, delivery reports, tracking, status transitions, confirmation, OTP helpers, and CSV export are implemented in [transport.service.ts](src/services/transport.service.ts#L119-L400). The create-dispatch flow creates a delivery/assignment through `create_delivery_with_assignment`.
- **Employees:** directory filtering, role-aware visibility, employee creation, profile update, suspend/activate, deletion, reporting-chain lookup, and employee attendance summaries are implemented in [employee.service.ts](src/services/employee.service.ts#L170-L800) and [EmployeeDirectoryPage.tsx](src/pages/employees/EmployeeDirectoryPage.tsx#L1-L220).
- **Employee profile:** own-profile edit, validation, department-history display, and refresh after save are implemented in [EmployeeProfilePage.tsx](src/pages/employees/EmployeeProfilePage.tsx#L1-L150).
- **Organization chart:** hierarchy read/tree construction, filtering, employee selection, and supervisor assignment are implemented in [OrganizationChartPage.tsx](src/pages/employees/OrganizationChartPage.tsx#L1-L138) and [employee-hierarchy.service.ts](src/services/employee-hierarchy.service.ts#L40-L162).
- **KPI workflow:** KPI read, assignment, progress update, review, role scoping, validation, and dashboard display are implemented in [employee-kpi.service.ts](src/services/employee-kpi.service.ts#L1-L95) and [EmployeeKpiWidget.tsx](src/components/EmployeeKpiWidget.tsx#L1-L150).
- **Attendance approvals:** subordinate markable employees, approval submission/history, and approve/reject RPC calls are implemented in [attendance-approval.service.ts](src/services/attendance-approval.service.ts#L1-L59). The employee attendance page consumes this hook.
- **Audit log:** filtering by search/action/actor/date and actor-name enrichment are implemented in [AuditLogPage.tsx](src/pages/AuditLogPage.tsx#L1-L30) and [audit-log.service.ts](src/services/audit-log.service.ts#L1-L44).
- **Notifications:** notification reads, realtime inserts/updates/deletes, mark read/unread/all, forwarding, escalation recipient lookup, and event-specific notification helpers are implemented in [notification.service.ts](src/services/notification.service.ts#L1-L520) and [useNotifications.ts](src/hooks/useNotifications.ts#L1-L77).
- **Reports:** attendance, bills, marketing, transport, and community-impact reports query Supabase and support CSV, XLSX, and PDF export in [reports.service.ts](src/services/reports.service.ts#L45-L500).

### Shared UI and infrastructure

- Navigation, sidebar visibility, role labels, status badges, buttons, login UI, chart components, and dashboard cards are centralized in [AppImplementation.tsx](src/app/AppImplementation.tsx#L260-L700).
- Feature barrel modules under [src/features](src/features) correctly re-export hooks/services for attendance, bills, employees, marketing, reports, and transport.
- Build output proves imports resolve and the bundle can be produced; it does not prove RLS, RPC deployment, or live query success.

## PARTIALLY WORKING FEATURES

- **Attendance approval path is split:** the live `AttendancePage` in `AppImplementation.tsx` directly upserts `attendance`, while the separate employee attendance page uses approval RPCs. These are two different workflows and can produce inconsistent audit/approval behavior.
- **Dispatch creation is not atomic:** after the delivery RPC succeeds, the order status update is attempted separately and any failure is only logged. A delivery can therefore exist while the order remains `Approved`.
- **Transport confirmation/status permissions rely on client-side checks plus table/RPC behavior:** the service checks role/driver identity, but the UI and direct Supabase calls are not one unified server-side workflow.
- **Bill permissions are inconsistent by layer:** navigation allows bills from level 3, while approval logic allows only the department MD or Vice Chairman. `updateBill` and `createBill` accept actor metadata from callers rather than deriving every authorization decision server-side.
- **Employee editing is self/role scoped in UI, but service mutations also accept caller IDs:** security depends on RLS/RPC policies being correctly deployed. Static code cannot prove that policy coverage.
- **Customer and product data loads but has no general CRUD module:** customer creation exists only inside create-order; products are read-only through [products.service.ts](src/services/products.service.ts#L1-L12).
- **Programs/outreach loads without error state:** [usePrograms.ts](src/hooks/usePrograms.ts#L1-L12) and [useCommunityImpact.ts](src/hooks/useCommunityImpact.ts#L1-L15) call promises without catch/loading state, so failures silently appear as empty data.
- **Marketing dashboard catches query errors and returns zero values:** this avoids a crash but makes a failed API indistinguishable from an empty database in [marketing.service.ts](src/services/marketing.service.ts#L88-L151).
- **Community impact metrics use impact-row count as `activePrograms`, not a count of active programs:** [communityImpact.service.ts](src/services/communityImpact.service.ts#L24-L58).
- **Report department filtering for Marketing compares `customer_id` to a department string:** this is almost certainly the wrong dimension in [reports.service.ts](src/services/reports.service.ts#L189-L205).
- **Transport report status logic checks `Delayed`, while transport status normalization defines no `Delayed` status:** delayed totals can remain zero even when date-based delay logic exists.
- **Notification realtime payloads are inserted directly as `NotificationRecord` without normalization:** realtime rows expose `is_read`, while the normalized model uses `read`; new realtime notifications may display as unread incorrectly or inconsistently.
- **Profile update UI does not expose role editing, although profile service supports role assignment:** role administration is split between modules.
- **Employee deletion attempts a client-side Supabase auth admin delete when available:** an anon client normally cannot perform admin deletion; cleanup may be skipped and leave orphaned auth users.

## BROKEN FEATURES

- **Build warning / duplicate key:** [employee.service.ts](src/services/employee.service.ts#L15-L25) declares `Managing Director` twice. The build succeeds, but one declaration is silently overwritten.
- **Recovery detection is internally inconsistent:** [App.tsx](src/app/App.tsx#L139-L151) treats any `type=recovery`, access token, or refresh token as recovery, while [ResetPasswordPage.tsx](src/pages/ResetPasswordPage.tsx#L14-L30) sets `hasRecovery` only when both `type=recovery` and access token are present. This can render a reset screen that cannot validate its own recovery state.
- **Two root app implementations create dead behavior and route drift:** [App.tsx](src/app/App.tsx) and the default root function in [AppImplementation.tsx](src/app/AppImplementation.tsx#L3200-L3395) implement different route synchronization and page rendering. Only the former is imported by [main.tsx](src/main.tsx).
- **`usePrograms` and `useCommunityImpact` can produce unhandled promise rejections:** their effects call service promises without error handling.
- **The live root's `organization` handling is inconsistent with employee subroutes:** `/employees/organization` sets `page` to `organization` in [App.tsx](src/app/App.tsx#L80-L87), while employee route state is reset to `directory`; direct navigation depends on the separate page switch rather than one coherent employee route state.
- **Potential schema/query break in community reports:** reports select `programs(name)` while [outreach.service.ts](src/services/outreach.service.ts#L11-L19) models `title`; if the deployed table has only `title`, the report query fails.
- **Potential schema/query break in transport driver joins:** transport queries use `drivers:profiles` in some places and `drivers` in others. The result depends on deployed foreign-key relationship names and is not consistently represented.
- **No automated tests are present in `package.json`;** build-only validation leaves runtime query, permission, form, and route failures untested.

## STATIC FEATURES

- Login-side statistics are hardcoded (`240+`, `14,800`, `14`, `252`) in [AppImplementation.tsx](src/app/AppImplementation.tsx#L410-L435).
- Login copyright text is hardcoded to 2025 despite the current audit date being 2026.
- Attendance shift is hardcoded to `Administration` in [attendance.service.ts](src/services/attendance.service.ts#L75-L96).
- Create-order expected delivery is always seven days from creation; create-dispatch expected delivery defaults to three days. These are defaults, not database-derived business rules.
- Report PDF generation is a client-created text/bar PDF, not a server-generated or chart-faithful document.
- Some service fallbacks return empty arrays or zero metrics after errors, making static-looking empty dashboards possible without visible failure.
- `ATTEND_WEEK` in [AppImplementation.tsx](src/app/AppImplementation.tsx#L235-L241) is initialized with zeroes; it is a default/fallback constant, not a database source.

## UNUSED CODE

- The default `App` function in [AppImplementation.tsx](src/app/AppImplementation.tsx#L3200-L3395) is not the application root imported by [main.tsx](src/main.tsx); its route logic and duplicate page shell are effectively dead code.
- Compatibility page wrappers under [src/pages](src/pages) mostly re-export implementations from `AppImplementation.tsx`; they are useful aliases but do not represent independent page implementations.
- `src/TestSupabase.tsx` is a diagnostic/test component and is not imported by the live entry point.
- `useCustomers`, `useProducts`, `useOrders`, and `useDeliveries` expose read hooks, but the current live ERP screens primarily use feature-specific hooks/services instead; their consumption should be verified before removal.
- `profile.service.ts` provides profile CRUD-style helpers, while the live auth context and employee profile paths duplicate profile loading/update responsibilities.
- `features/*/index.ts` barrels are not visibly imported by the live app; consumers import hooks/services directly.

## UNUSED TABLES

The repository does not contain a complete base schema dump, so “unused” means “no observed frontend reference in this workspace,” not “safe to drop.”

- No strong candidate for a completely unused table was found among the tables referenced by the current SQL scripts and services.
- `roles` is queried by the Admin page in [AppImplementation.tsx](src/app/AppImplementation.tsx#L2831-L2845), but no clear write path or role-management table workflow was found; it is read-only/possibly legacy.
- `employee_department_history`, `employee_hierarchy`, `employee_kpis`, and `audit_logs` are used by the newer employee/RBAC UI and SQL scripts.
- `programs` and `program_impact` are used by reporting/dashboard code, but no visible create/update/delete UI was found; they are backend/read integrations without complete frontend CRUD.
- `products`, `customers`, `vehicles`, and `drivers` are used as lookup/master data. Products and customers lack standalone management pages; vehicles/drivers are created inline during dispatch only.

## UNUSED ROUTES

### Reachable routes from live `App.tsx`

`/`, `/login`, `/attendance`, `/bills`, `/marketing`, `/transport`, `/admin`, `/reports`, `/notifications`, `/employees`, `/employees/attendance`, `/employees/organization`, `/employees/:id`, `/organization`, `/audit`, `/profile`, and `/reset-password` are represented in route parsing or navigation.

### Route findings

- `/organization` is parsed as a top-level page, while the sidebar route map uses `/employees/organization`; both render the organization chart but are duplicate URLs.
- `/employees/attendance` is parsed but is not clearly exposed as a dedicated sidebar item; it is reachable only by direct URL or code navigation.
- `/profile` is parsed and reachable from profile actions, but it is not a `NAV_ITEMS` entry; `safeNavAccess("profile")` returns false when direct navigation sets page to profile. This can show Access Denied for a valid profile route.
- `/login` is parsed, but `handleNav` maps the login page to `/` and authentication state also controls login rendering. Route semantics are duplicated.
- `/audit` is rendered by live `App.tsx`, but the duplicate root implementation also has separate route logic; behavior differs depending on which root is used.
- Unknown paths silently fall back to dashboard, hiding dead links and missing-route errors.

## DASHBOARD AUDIT

### Live dashboard cards and sources

- Employee totals, active/suspended totals, role counts: real `profiles` query, with active defined from today’s attendance in [dashboard.service.ts](src/services/dashboard.service.ts#L166-L210); this is not the same as `profiles.status` active count.
- Bill pending/approved/rejected/revenue cards: real `bills` query, but statuses are hardcoded to a narrower set (`Pending Approval`, `Approved`, `Rejected`, `Returned for Correction`). Legacy/`Draft`/`Reviewed` values may be omitted or misclassified.
- Weekly attendance: real `attendance` query for five generated dates; “week” is five days and has no explicit timezone policy.
- Leave balance/taken: real profile query with multiple fallback column names; missing columns or nulls become zero.
- Orders/deliveries/revenue trend: real orders/deliveries queries in dashboard service.
- Community impact: real `program_impact` query, but metric labels and active-program calculation are derived approximations.
- Supervisor team cards: real direct `reports_to` query only; indirect descendants are not included in that dashboard summary.
- KPI widget: real `employee_kpis` and hierarchy/profile queries, with role-specific filtering.
- Login cards are static and are not dashboard database cards.

### Broken or misleading dashboard risks

- Query errors on the dashboard render only “Failed to load dashboard data,” without field-level diagnostics.
- Zero-value fallback implementations in marketing/community services can make failed queries look like real zeros.
- Department scope compares normalized department strings in some paths but raw strings in others, especially transportation naming.

## FORMS AUDIT

| Form | Create | Edit | Delete | Validation | Database result |
|---|---|---|---|---|---|
| Login | N/A | N/A | N/A | Browser input only; auth error alert | Supabase Auth sign-in |
| Password reset | N/A | N/A | N/A | 8-char minimum and match | Supabase Auth update |
| Create order/customer | Yes via RPC / insert | No order edit UI found | No | Customer names, item presence, stock, UUID checks | Order/items transaction; customer insert |
| Dispatch/vehicle/driver | Yes via RPC / inserts | No master-data edit UI | No | Required selections/names; dates have no cross-field validation | Delivery assignment RPC; separate order update |
| Attendance | Upsert from live dashboard | Same upsert | No | Future date disabled; unmarked becomes Absent; no server-side form validation shown | Direct `attendance` upsert |
| Attendance | Direct attendance update/insert | Profile-first daily grid | Yes | Employee/date/status are persisted directly | `attendance` |
| Bill | Yes; draft or pending | Yes through `updateBill` | No delete path found | Amount/status/note checks are incomplete at UI level | `bills` plus `bill_history`; attachments in storage |
| Employee | Yes | Yes | Soft-delete then delete path | Employee code/designation/hierarchy validation; email/phone are required in create UI but format not validated | Auth/profile/audit/hierarchy/RPC paths |
| Employee profile | N/A | Own profile; reporting relationship for authorized roles | No | Employee code/designation/level validation | `profiles`, department history, role/department RPCs |
| Supervisor assignment | N/A | Yes via RPC | Separate hierarchy delete service, no visible delete UI | Self-assignment blocked; role-level filtering is UI-side | `employee_hierarchy` |
| KPI | Yes assignment | Progress/review | No | Employee/metric/target/month/year checks | KPI RPCs and table |
| Audit filters | N/A | Filters only | N/A | Date/search filters have no range validation | Read-only `audit_logs` |

## PERMISSION AUDIT

Role levels are implemented in [AppImplementation.tsx](src/app/AppImplementation.tsx#L150-L185) and navigation is filtered by [AppImplementation.tsx](src/app/AppImplementation.tsx#L521-L540).

| Role group | Navigation access observed | Risks |
|---|---|---|
| Worker | Dashboard, attendance, employees, organization, notifications | Attendance page has separate worker read-only behavior, but direct route/service access still depends on RLS. |
| Supervisor | Worker pages plus reports | Approval and employee visibility depend on hierarchy rows; missing hierarchy can reduce visibility to self. |
| Manager / Chief Manager | Bills, marketing, transport, employee modules, reports | Manager can submit bills but cannot approve; UI/service rules are split. |
| General Manager | Manager modules and broader employee scope | Bill approval navigation is available through module, but bill service does not allow GM approval despite some legacy constants naming GM. |
| Department MD | Manager modules plus department-scoped behavior | Department string normalization differs between services; `MD-Transport` versus `Transportation` is a recurring risk. |
| Managing Director | MD-level pages, department/employee scope | Generic `Managing Director` is not treated as department-specific in every service. |
| Vice President | Organization-wide navigation except Admin/Audit restrictions as coded | Direct routes rely on client-side `navAccess`; database policy coverage is unverified. |
| Vice Chairman | Highest normal role; audit/admin available | Several server calls still accept actor IDs from callers; RLS/RPC policies must enforce identity. |
| Admin | Admin page only through `canViewAdmin` | `ROLE_LEVEL` maps `Admin` to 9 in [AppImplementation.tsx](src/app/AppImplementation.tsx#L160-L171), but other role maps omit Admin; behavior is inconsistent across services. |

### Permission gaps

- Authorization is primarily client-side navigation plus service checks; no complete RLS/policy audit can be proven from the partial SQL scripts.
- Audit page visibility is level 7, while `Admin` is allowed by `canViewAdmin` but not by the level-based `navAccess` path unless explicitly handled; this should be verified for Admin users.
- Direct URLs can reach route parsers even when sidebar entries are absent; `safeNavAccess` blocks some but not all page semantics consistently.
- Create order and create dispatch are opened from manager-level pages but the create components themselves do not receive a role and do not enforce role authorization locally.

## DATABASE AUDIT

### Observed tables and operations

| Table | Frontend use | Reads | Writes | Assessment |
|---|---|---|---|---|
| `profiles` | Extensive | Auth/profile, employees, hierarchy, reports, notifications | Employee/profile status and fields | Core integration; policy and column compatibility are critical. |
| `attendance` | Extensive | Dashboard, attendance, reports, employee summaries | Live upsert | Working path, but bypasses approval workflow in the main dashboard. |
| `attendance` | Employee attendance page | Daily records/history | Direct update/insert | Unified profile-first attendance path. |
| `bills` | Bills/dashboard/reports | List/detail/report | Insert/update/status | Broad CRUD except delete; status names are not fully consistent. |
| `bill_history` | Bills/reports | History/report | Insert on bill mutations | Audit history depends on every mutation succeeding after the bill update. |
| `orders` | Marketing/create order/transport/reports | Lists/details/metrics | RPC create; status updates | Core integration; some status updates are non-atomic. |
| `order_items` | Order/report/marketing | Joined order items/product totals | RPC create | No standalone edit/delete UI. |
| `customers` | Marketing/create order/reports | Lookup/list/joins | Inline insert only | No standalone CRUD. |
| `products` | Create order/marketing | Lookup/list/joins | No observed frontend write | Read-only master data. |
| `deliveries` | Transport/dashboard/reports | Metrics/list/detail/tracking | RPC create; status/confirmation/OTP updates | Broad workflow; join names and transition rules need live verification. |
| `delivery_assignments` | Transport/reports | Fleet/report joins | RPC create | No standalone assignment editing. |
| `delivery_tracking` | Transport | History | Insert tracking events | Working code path, subject to RLS. |
| `vehicles` | Create dispatch/transport | Lookup/fleet | Inline insert | No edit/delete UI. |
| `drivers` / `profiles` driver alias | Create dispatch/transport | Lookup/joins | Inline insert in `drivers` | Schema relationship naming is inconsistent across queries. |
| `programs` | Outreach/report/dashboard | List/report | No observed frontend writes | Read-only/disconnected CRUD. |
| `program_impact` | Community/report/dashboard | Metrics/trend | No observed frontend writes | Read-only/disconnected CRUD. |
| `employee_hierarchy` | Employee/org/KPI/attendance | Tree, visibility, subordinate list | Upsert/RPC/delete service | Core hierarchy integration. |
| `employee_department_history` | Employee profile | History | Department-assignment RPC | No direct UI to browse all history. |
| `employee_kpis` | Dashboard/KPI widget | List/scoped list | KPI RPCs | Core KPI integration. |
| `audit_logs` | Audit page | Filtered list/actors | Employee service insert and SQL triggers/functions as available | Read/write path exists; completeness depends on all mutations using audited paths. |
| `notifications` | Header/page/realtime | User list/count | Insert/read-state/forward | Core integration; realtime normalization mismatch risk. |
| `roles` | Admin page | Role list | No clear write path | Likely legacy/read-only or incomplete admin integration. |
| Supabase Storage `bill-attachments` | Bills | Signed URLs | Upload | Bucket, policies, and cleanup are not represented in the repository. |

### Foreign-key and schema risks

- The repository has feature SQL scripts rather than one complete canonical schema, so missing foreign keys cannot be exhaustively determined.
- Query joins require relationships between `orders-customers`, `orders-order_items`, `order_items-products`, `deliveries-orders`, `deliveries-vehicles`, `deliveries-drivers/profiles`, `delivery_assignments-deliveries`, hierarchy/profile users, bill history/bills, and program impact/programs. A missing relationship causes PostgREST query failures.
- `drivers` is queried both as a table and as a `profiles` alias; the deployed schema must make both assumptions true or one path will fail.
- `programs` is modeled with `title` in [outreach.service.ts](src/services/outreach.service.ts#L3-L19) but reports select `name`; this indicates schema/model drift.
- Profile fields such as leave balances, `reports_to`, employee fields, and status are assumed by many services and feature SQL files; deployment order matters.

## HIGH PRIORITY FIXES

1. Consolidate routing and root rendering into one app implementation; remove or quarantine the duplicate root to eliminate route and permission drift.
2. Replace client-side authorization assumptions with verified Supabase RLS/RPC authorization for employee, bill, attendance, order, transport, notification, and audit writes.
3. Make dispatch creation plus order-status synchronization one transaction/RPC, or surface and reconcile failed order updates instead of logging them.
4. Reconcile schema/query contracts: `programs.name` versus `title`, driver table versus profile alias, notification `read` versus `is_read`, and all order/bill/transport status vocabularies.
5. Unify attendance submission and approval so the primary attendance UI cannot bypass the approval/audit workflow unintentionally.
6. Add end-to-end tests with a test Supabase project or mocked query layer for login, every route, role matrix, CRUD forms, RPC return values, and status transitions.
7. Remove the duplicate object key in `employee.service.ts` and treat build warnings as CI failures.

## MEDIUM PRIORITY FIXES

1. Add loading/error handling to `usePrograms` and `useCommunityImpact`; stop converting service failures into indistinguishable zero/empty states.
2. Add standalone master-data CRUD or explicitly label products, customers, vehicles, drivers, programs, and impact as read-only modules.
3. Add field validation for email, phone, amount, dates, date ordering, duplicate codes/numbers, and required rejection/return reasons.
4. Derive actor identity and role from the authenticated session inside mutation services/RPCs rather than trusting caller-supplied actor metadata.
5. Normalize role/dept/status constants into shared modules used by navigation, services, reports, and SQL.
6. Add explicit profile route navigation or remove `/profile` from route parsing; expose `/employees/attendance` intentionally if it is a supported route.
7. Add database migration/schema verification for storage bucket policies, foreign keys, unique constraints, attendance composite keys, and hierarchy cycle prevention.
8. Replace hardcoded login statistics, attendance shift, and year text with database/configuration values or clearly marked static branding.

## LOW PRIORITY FIXES

1. Remove unused compatibility hooks/barrels and diagnostic components after usage is confirmed.
2. Improve report PDF generation and ensure currency/text encoding is faithful.
3. Add pagination/server-side filtering for large employee, order, bill, notification, and audit datasets.
4. Add realtime normalization through the same mapper used by initial notification loads.
5. Split the very large `AppImplementation.tsx` into page and service-owned modules to reduce regression risk.
6. Remove console logging of RPC payloads/errors in production paths where payloads may contain operational data.
