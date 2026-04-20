# LIRE-Help-v2

**Light Industrial Real Estate Intelligence** — An AI-Powered 24/7 Property Management Platform.  
Spinoff of Host Help. Built by Dehyl SAS.

## Overview
LIRE is an AI-native operations layer for light industrial property portfolios. It handles tenant communications, maintenance dispatch, compliance tracking, and knowledge base management autonomously, escalating only high-stakes issues to humans.

- **Core Thesis**: Eliminate reactive maintenance, 24/7 demands, compliance blindspots, and fragmented data.
- **Target**: U.S. industrial landlords (REITs, regional operators) with 5–50+ properties.
- **Key Features**: Multi-channel inbox, auto-dispatch, compliance timeline, continuous learning KB.
- **Tech Stack**: React (frontend), Node.js/TS (backend), Drizzle ORM, Claude API for AI, Vite/Tailwind.

See [MASTER-PLAN.md](MASTER-PLAN.md) for the full vision, roadmap, and architecture.

## Setup
1. **Clone the repo**:
   ```
   git clone https://github.com/DeHyl/LIRE-Help-v2.git
   cd LIRE-Help-v2
   ```

2. **Install dependencies**:
   ```
   npm install
   ```

3. **Environment variables**:
   Copy `.env.example` to `.env` and fill in your keys (e.g., Claude API, DB connection).

4. **Run locally**:
   - Frontend: `npm run dev` (Vite server at http://localhost:5173)
   - Backend: `npm run server` (check package.json for exact script)
   - Tests: `npm run test` (Vitest)

5. **Deployment**: Configured for Railway (see `railway.toml`). Deploy via Railway CLI or GitHub integration.

## Structure
- **client/**: React frontend (Vite, Tailwind, Wouter routing).
- **server/**: Node.js backend (helpers, middleware, pilots for tenants like Berkeley).
- **shared/**: Utils/types shared between client/server.
- **config/**: Tenant configurations (multi-tenant setup).
- **docs/**: Documentation for clients and superpowers.
- **tests/**: Vitest tests.
- **attached_assets/**: Screenshots and media.

## Contributing
- Fork the repo and create a PR.
- Run `npm run lint` (once set up) before committing.
- Follow the roadmap in MASTER-PLAN.md.

## License
MIT (add if not present—see LICENSE file).

Questions? Open an issue or contact mune100g@gmail.com.
