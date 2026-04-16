# LIRE Help — Replit Project

## Overview
LIRE Help is an AI-native operations platform for light industrial real estate (warehouses, distribution centers, flex spaces). It is a multi-tenant SaaS that uses AI agents (powered by Anthropic's Claude) to automate tenant communications, maintenance dispatch, and compliance tracking.

## Architecture

### Stack
- **Frontend:** React 18 + TypeScript, Wouter (routing), TanStack Query, Tailwind CSS
- **Backend:** Node.js + Express, served from `server.ts`
- **Database:** PostgreSQL (Replit built-in) with Drizzle ORM
- **AI:** Anthropic Claude API (`claude-haiku-4-5-20251001`)
- **Build:** Vite (client), esbuild (server)
- **Runtime:** Node.js 20

### Project Structure
```
/client         - React frontend (SPA)
  /src/pages    - Login, dashboard views
  /src/lib      - API clients, auth context
/server         - Express backend modules
  *-routes.ts   - API route handlers
  db.ts         - DB connection (Drizzle)
  storage.ts    - Data access layer
  vite.ts       - Vite dev middleware
/shared         - Shared TypeScript types + Drizzle schema
/public         - Static landing page files
/scripts        - Utility scripts
server.ts       - Main server entry point
vite.config.ts  - Vite config (dev: middleware mode on port 5000)
```

### Ports
- **Development:** Port 5000 (Express serves everything including Vite middleware)
- **Production:** Port 5000 (Express serves built static files from dist/admin)

## Development Workflow

### Running the app
```bash
npm run dev
```
This runs `cross-env NODE_ENV=development tsx server.ts` which starts Express on port 5000. Vite is embedded as middleware.

### Database
- Replit built-in PostgreSQL is used
- Schema is defined in `shared/schema.ts`
- Run `npm run db:push` to sync schema changes
- Initial setup endpoint: `GET /api/setup?key=LIRE2026` (creates tables and seeds demo data)

### Build for production
```bash
npm run build
```
Builds client to `dist/admin/` and bundles server to `dist/index.cjs`.

## Deployment
- Target: **autoscale**
- Build command: `npm run build`
- Run command: `node dist/index.cjs`

## Environment Variables / Secrets Required
- `DATABASE_URL` — PostgreSQL connection string (auto-set by Replit)
- `SESSION_SECRET` — Session signing secret
- `ANTHROPIC_API_KEY` — For AI concierge chat endpoint

## Key Features
- Multi-tenant (subdomain-based isolation)
- AI concierge chat (`/api/chat`)
- Admin dashboard (`/app/`)
- Knowledge base management
- Token usage tracking
- Maintenance request workflows
