# Project Setup

## Prerequisites

- Node.js 20.x or later
- npm 10.x or later

## Installation

```bash
npm install
```

## Environment Variables

Create a `.env` file in the project root and configure the following values:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Development

```bash
npm run dev
```

## Production Build

```bash
npm run build
```

## Deployment

### Vercel

1. Create a Vercel project and connect this repository.
2. Add the environment variables above in the Vercel project settings.
3. Deploy the project.
4. Confirm the build completes successfully in Vercel.
