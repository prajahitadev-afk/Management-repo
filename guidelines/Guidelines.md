# Prajahita Management Portal — Engineering & Design Guidelines

These guidelines apply to new work and refactors in the management portal. Preserve existing business behavior unless a change is explicitly part of the task.

## General engineering

- Use React function components and TypeScript. Give exported service functions explicit input and result types.
- Keep pages focused on composition. Move reusable forms, tables, dialogs, and feature logic into their own files.
- Prefer feature-owned folders for new work:
  - `src/features/<feature>/pages`
  - `src/features/<feature>/components`
  - `src/features/<feature>/services`
  - `src/features/<feature>/types`
- Keep existing import paths stable while migrating; use small commits and compatibility exports when moving modules.
- Do not put database access directly inside presentational components. Use a feature service or hook.
- Do not swallow Supabase errors or turn failed requests into zero-valued metrics. Distinguish loading, empty, permission-denied, and error states.
- Validate forms on the client for usability and again in PostgreSQL for correctness and authorization.
- Derive the acting user from `auth.uid()` in privileged database functions. Never trust a client-supplied actor, role, manager, or department as authorization.
- For multi-table business operations, use one database transaction/RPC and write an audit/history record in the same transaction.
- Use SECURITY DEFINER only when necessary; set a fixed `search_path`, schema-qualify objects, validate identity/role/hierarchy, and grant EXECUTE only to required roles.
- Keep RLS enabled. Read policies must reflect the business data scope; authenticated-only is not automatically sufficient.
- Avoid logging customer data, tokens, payment details, or full Supabase response payloads.
- Use semantic HTML, accessible labels, keyboard-operable controls, visible focus, and reduced-motion support.
- Keep commits small and named by intent, for example `fix(leave): debit balance after final approval`.
- Before merging, run `npm run check`, review SQL migrations, and test both allowed and denied role paths.

## Brand and visual system

- Primary green: `#4E8050`
- Deep green: `#3A6040`
- Warm sand: `#EFD7AF`
- Gold accent: `#D4A017`
- Typography: Inter (already loaded through the shared font stylesheet).
- Use the shared CSS variables in `src/styles/theme.css`; do not introduce one-off brand colors when a token exists.
- Keep surfaces clean and restrained. Use consistent spacing, borders, radii, and typography rather than mixing glass cards, opaque cards, and unrelated color systems.
- Use green for primary actions, neutral surfaces for secondary actions, and red only for destructive or error states.
- Charts should use the shared chart palette and clear labels/legends. Do not rely on color alone to communicate status.

## Layout and responsive behavior

- Use a consistent application shell: navigation, top bar, page title/actions, content, and responsive overflow.
- Use CSS grid/flexbox for layout. Avoid absolute positioning for primary page structure.
- On narrow screens, collapse navigation intentionally and make tables horizontally scrollable or provide a card alternative.
- Keep content widths readable; avoid stretching dense forms and tables across the entire viewport.
- Keep dialogs within the viewport, provide a clear close/cancel action, and prevent accidental submission.

## Tables and forms

- Tables need clear headings, consistent alignment, useful empty states, and visible loading/error states.
- For large datasets, add server-side pagination, sorting, and filtering rather than loading all rows indefinitely.
- Forms should show required fields, units, and examples where helpful.
- Use select controls for foreign-key relationships; do not ask users to type opaque UUIDs.
- Disable submit actions while saving and prevent duplicate submissions.
- Confirm irreversible actions such as payment settlement, deletion, or final approval.

## Workflow and status rules

- Keep status vocabularies consistent between UI, TypeScript, and SQL.
- Make transitions explicit and validate allowed previous → next states in the database.
- Record who acted, what changed, when it changed, and any supplied reason/reference.
- Notify the next approver only after the transaction commits.
- Ensure retrying an operation cannot create duplicate orders, payments, approvals, or ledger entries.

## Data and reporting

- Store timestamps consistently and display dates in the user's locale.
- Use date ranges with inclusive, well-defined boundaries.
- Scope reports by the correct business relationship (for example, order creator department, not customer ID).
- Use actual domain columns and relationships; never assume a column exists because a TypeScript interface contains it.
- Keep migration history reconciled with the live Management Supabase project before automated deployment.
