# Application Architecture

## Current application shape

The portal is a React + TypeScript + Vite single-page application backed by Supabase Auth, PostgreSQL, RLS, and database RPCs.

- `src/main.tsx` mounts `AuthProvider` and the app.
- `src/app/App.tsx` owns route parsing, the authenticated shell, navigation, and page selection.
- `src/context/AuthContext.tsx` and `src/hooks/useAuth.ts` own the session/profile boundary.
- `src/pages/` contains route-level pages.
- `src/components/` contains shared UI and department components.
- `src/services/` contains Supabase access and business operations.
- `src/constants/`, `src/types/`, and `src/utils/` contain shared contracts and helpers.
- `supabase/migrations/` contains incremental database changes.

Some areas still use a legacy composition file, especially `src/app/AppImplementation.tsx`. Do not add more unrelated pages or service logic to that file.

## Feature boundaries

New feature work should be organized by business capability:

```text
src/
  app/
    App.tsx
    routes/
    providers/
    layouts/
  components/
    ui/
    layout/
    tables/
    forms/
  features/
    employees/
      pages/
      components/
      services/
      hooks/
      types/
    attendance/
    leave/
    manufacturing/
    marketing/
    transportation/
    research/
    finance/
    collaboration/
    notifications/
    reports/
  services/
    supabase.ts
    permissions.ts
    audit.ts
  constants/
  types/
  utils/
  styles/
```

A feature owns its page composition, business-specific UI, data access, validation, and types. Shared components must remain business-agnostic. Avoid circular imports between features.

## Data access rules

1. UI components call feature services/hooks; they do not issue ad-hoc Supabase mutations.
2. Services use the exact deployed database column names or explicitly map database rows into a stable UI model.
3. Privileged writes use a database RPC with a fixed `search_path`, schema-qualified table/function names, and narrow EXECUTE grants.
4. The database derives the actor from `auth.uid()`; client-supplied IDs are input data, not proof of permission.
5. RLS policies define read scope. SECURITY DEFINER functions enforce write scope and state transitions.
6. Multi-record operations (order creation, payment settlement, final leave approval, production output) run atomically and write history/ledger records in the same transaction.
7. Services return errors explicitly. A failed query must not become an empty list or a zero KPI.

## Workflow consistency

Use one shared vocabulary for each workflow status in TypeScript and SQL. Keep allowed transitions in the database, not only in button visibility. Every approval or settlement should record actor, previous state, next state, timestamp, and optional remarks/reference.

## Migration and release process

- Treat the live Management Supabase project as the current schema baseline until a full bootstrap migration is exported.
- Reconcile live migration history with repository migration files before using automated migration push.
- Review migrations in timestamp order and apply them only to the Management project.
- Test each RPC with an authorized identity and an unauthorized identity.
- Run `npm run check`, CI tests, and a role-based browser smoke test before merge.
- Do not merge a branch whose new RPCs have not been applied and verified in the target database.

## Incremental refactor plan

1. Extract reusable forms, tables, and dialogs from large route-level files. The department form modal and data table are now separate components under `src/components/department/`.
2. Move one business module at a time from `AppImplementation.tsx` into `src/features/<feature>/`, preserving routes and public exports.
3. Consolidate duplicate service helpers into typed, feature-scoped repositories.
4. Add unit tests for pure mapping/validation functions and integration tests for service/RPC contracts.
5. Add Playwright smoke tests for sign-in, role-specific navigation, leave approval, order creation, payment settlement, manufacturing logging, and dispatch.
6. Reduce legacy imports only after all callers have moved and tests pass.
