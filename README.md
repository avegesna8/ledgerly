# Ledgerly

A personal finance ledger designed to explain where every dollar is, how it moved, and what it was spent on.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The current build uses seeded in-memory demo data in `lib/data.ts`. A production-oriented PostgreSQL schema is included in `prisma/schema.prisma`.

## Current vertical slice

- Responsive overview and net-worth dashboard
- Account and money-location inventory
- Transaction ledger with reconciliation states
- Analytics and budget views
- Needs-review workflow
- Initial immutable/raw, normalized, and enriched database foundation

## Next implementation stages

1. Connect Prisma to PostgreSQL, add authentication, and replace demo data with server queries.
2. Add manual account and transaction CRUD with audit history.
3. Add CSV/bank ingestion and transfer matching.
4. Add receipt upload, OCR extraction, and transaction matching.
5. Add categorization rules, allocations, reimbursements, and safe natural-language queries.
