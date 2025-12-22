# Product Catalog Admin
One-page e-commerce product management web app.

## Local setup
1) Create a local env file:
- Copy `.env.example` to `.env`
- Set `DATABASE_URL`

2) Start Postgres:
```bash
npm run db:up
```

3) Create tables + generate Prisma client:
```bash
npm run prisma:migrate -- --name init
npm run prisma:generate
```

4) Run the app:
```bash
npm run dev
```

Open http://localhost:3000

## Import from Google Sheets (skeleton)
This repo includes a server endpoint that reads product rows from Google Sheets and upserts into Postgres:
- `POST /api/import/sheets`

Required env vars (see `.env.example`):
- `GOOGLE_SERVICE_ACCOUNT_JSON` OR `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64`
- `GOOGLE_SHEETS_SPREADSHEET_ID`
- `GOOGLE_SHEETS_RANGE` (defaults to `Products!A1:Z`)

Your sheet needs headers at least: `sku`, `name`.
Optional headers: `description`, `price`, `currency`, `imageUrl`, `category`, `stock`, `active`.
