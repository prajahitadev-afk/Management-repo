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

## Security

- Keep `.env.local` and other local environment files out of Git.
- Use only the publishable/anon key in the browser.
- Never expose service-role credentials in frontend code.
