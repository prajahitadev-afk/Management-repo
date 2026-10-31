# Prajahita Management Portal

Prajahita's internal management portal, built with React, TypeScript, Vite and Supabase.

## Requirements

- Node.js 22 or newer
- npm
- Access to the Prajahita Management Supabase project

## Local setup

1. Clone the repository and install dependencies:

   ```bash
   npm ci
   ```

2. Copy the public Supabase configuration template:

   ```bash
   # Windows PowerShell
   Copy-Item .env.example .env.local

   # macOS / Linux
   cp .env.example .env.local
   ```

3. Start the development server:

   ```bash
   npm run dev
   ```

The application uses the Management Supabase project at `https://rysoqgtpbmafoybvylke.supabase.co`. The values in `.env.example` are public browser configuration only. Never put a Supabase `service_role` key, database password, or other secret in a Vite `VITE_*` variable or commit a real local environment file.

## Validation

Run the TypeScript check and production build before opening a pull request:

```bash
npm run check
```

Individual commands are also available:

- `npm run typecheck` — TypeScript validation
- `npm run build` — Vite production build

GitHub Actions runs these checks for pushes and pull requests targeting `main`.

## Supabase notes

- Supabase Auth persists browser sessions and refreshes tokens automatically.
- Database access is controlled by PostgreSQL grants and row-level security policies. Do not treat client-side role checks as a security boundary.
- Apply reviewed SQL migrations to the Management Supabase project only. Do not run schema changes against the separate Shop Supabase project.

## Database migrations

Incremental Management Supabase changes are recorded under `supabase/migrations/`. The repository contains both earlier security/order migrations and the current `premain` workflow migrations for manufacturing, leave balances, payments, and transportation.

These files are **not** a complete initial schema for a brand-new Supabase project. The live Management project also has migration-history entries that were not represented by matching SQL files in the repository during the October 2026 audit. Reconcile that history before using an automated migration push; do not assume the repository migration folder is a clean baseline.

The six new `premain` migrations are committed but have **not yet been applied** to the live Management database. Review them in timestamp order and apply them to the Management project only. Never apply these changes to the separate Shop Supabase project. After applying, verify the RPC signatures, grants, RLS behavior, and advisors before enabling the workflows in production.

## Security

- Keep `.env.local` and other local environment files out of Git.
- Use only the publishable/anon key in the browser.
- Never expose service-role credentials in frontend code.
