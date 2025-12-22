# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## What this repo is
A Next.js (App Router) web app for managing an e-commerce product catalog, backed by Postgres via Prisma.

## Quickstart (from scratch)
1) Install deps:
- `npm ci`

2) Create env file:
- Copy `.env.example` to `.env`
- Set `DATABASE_URL`

3) Start local Postgres:
- `npm run db:up`

4) Initialize DB schema + Prisma client:
- `npm run prisma:migrate -- --name init`
- `npm run prisma:generate`

5) Run the app:
- `npm run dev`
- Open http://localhost:3000

## Common commands (npm)
Install:
- `npm ci`

API smoke tests
- Health:
  - `curl http://localhost:3000/api/health`
  - PowerShell: `Invoke-RestMethod http://localhost:3000/api/health`
- List products (first page):
  - `curl "http://localhost:3000/api/products?page=1&pageSize=50"`
  - PowerShell: `Invoke-RestMethod "http://localhost:3000/api/products?page=1&pageSize=50"`
- Search:
  - `curl "http://localhost:3000/api/products?q=shoe"`
- Trigger Sheets import (uses env vars unless body overrides):
  - `curl -X POST http://localhost:3000/api/import/sheets -H "content-type: application/json" -d "{}"`
  - PowerShell:
    - `Invoke-RestMethod http://localhost:3000/api/import/sheets -Method Post -ContentType application/json -Body '{}'`

Run the app (Next dev server):
- `npm run dev`
- App: http://localhost:3000

Build / run production:
- `npm run build`
- `npm run start`

Lint:
- `npm run lint`
- Lint a single file (pass-through args): `npm run lint -- src/app/page.tsx`

Tests:
- No test script is currently defined in `package.json`.

## Database + Prisma (local Postgres)
Environment:
- Copy `.env.example` to `.env` and set `DATABASE_URL`.

Start/stop Postgres (Docker):
- `npm run db:up`
- `npm run db:down`

Migrate + generate client:
- Run migrations in dev (interactive DB, creates/updates migration files):
  - `npm run prisma:migrate -- --name init`
- Generate Prisma client:
  - `npm run prisma:generate`

Prisma Studio:
- `npm run prisma:studio`

## High-level architecture
### Where things live (big picture)
- Next.js App Router entrypoints are under `src/app` (page/layout + route handlers).
- Server endpoints are implemented as route handlers under `src/app/api/**/route.ts`.
- Prisma schema and migrations are under `prisma/`.

### Request flow
- UI is a single client-side page: `src/app/page.tsx`.
  - Fetches product data from `GET /api/products` with query params `q`, `page`, `pageSize`.
  - Triggers Google Sheets import via `POST /api/import/sheets`.
- API routes live under the Next App Router route handlers:
  - `src/app/api/products/route.ts`
  - `src/app/api/import/sheets/route.ts`
  - `src/app/api/health/route.ts`

### Data model
- Prisma schema: `prisma/schema.prisma`
  - Core model: `Product` (sku is unique; optional price/currency/category/etc).
- Prisma client singleton:
  - `src/lib/prisma.ts` exports `prisma` and uses a global singleton in dev to avoid hot-reload connection churn.

### Product listing API
- `GET /api/products` (`src/app/api/products/route.ts`):
  - Builds a Prisma `where` filter when `q` is present (sku/name/category; case-insensitive contains).
  - Uses `prisma.$transaction` to fetch `total` and paged `items` consistently.
  - Normalizes Prisma `Decimal` (`price`) to string for JSON.

### Google Sheets import
- `POST /api/import/sheets` (`src/app/api/import/sheets/route.ts`):
  - Auth: service account JSON provided by `GOOGLE_SERVICE_ACCOUNT_JSON` or `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64`.
  - Sheet target from body (`spreadsheetId`, `range`) or env (`GOOGLE_SHEETS_SPREADSHEET_ID`, `GOOGLE_SHEETS_RANGE`).
  - First row is treated as headers; headers are normalized (trim/lowercase/remove spaces) to map columns.
  - Upserts `Product` rows in batches (transaction per batch) keyed by `sku`.

## Conventions and configuration worth knowing
- TypeScript path alias:
  - `@/*` maps to `src/*` (see `tsconfig.json`).
- Styling:
  - Tailwind v4 is enabled via `postcss.config.mjs` and imported in `src/app/globals.css`.
- Linting:
  - ESLint uses the Next.js presets (`eslint.config.mjs`).
