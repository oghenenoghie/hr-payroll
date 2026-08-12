# Plutus

Plutus is a compliance-native HR and payroll platform for Nigeria and Africa, shipped as the **Wagebook** app. Payroll correctness isn't a feature bolted on top — every statutory calculation (PAYE, pension, NHF, NHIS, NSITF, ITF, WHT, VAT) is computed from a versioned rule table (`RuleVersion`, e.g. `NG-2026.1`) rather than a hardcoded rate, so figures stay auditable and correct as the law changes.

Beyond payroll, Plutus covers the full employer surface: employees, departments, branches, job grades, org chart, recruitment, leave & attendance, loans & advances, expenses, benefits, performance, learning, and a real accounting layer — vendors/bills (Accounts Payable), customers/invoices (Accounts Receivable), chart of accounts, general ledger, financial statements, bank reconciliation, fixed assets, and budgets — with 11 RLS-enforced roles, an audit log, and salary masking.

## Structure

This is a pnpm monorepo:

- `apps/wagebook` — the Next.js (App Router) product itself.
- `packages/core` — shared Supabase client setup and generated database types.
- `packages/compliance` — the statutory compliance engine: money/rate primitives (`Kobo`, `RATE_SCALE`) and per-scheme calculators (PAYE, pension, NHF, NHIS, NSITF, ITF, WHT, VAT), each sourced from a versioned `RuleVersion`.
- `supabase/migrations` — hand-applied, idempotent SQL migrations (Postgres + Row Level Security).

## Getting started

```bash
pnpm install
pnpm dev          # runs the wagebook app
pnpm typecheck    # across every workspace package
pnpm lint
pnpm build
```

`apps/wagebook` needs a Supabase project and its env vars configured locally (see `apps/wagebook/.env.example` if present) — migrations under `supabase/migrations` are applied by hand, in order, through the Supabase SQL Editor.

## Design system

The product UI follows **Ledger**: OKLCH tokens, flat and bordered (no gradients, no heavy shadows, no decorative motion), dense but readable, status always shown as a filled badge rather than color alone. See `.claude/skills/plutus-payroll-platform/references/design-system.md` for the full token/spacing/badge scale.
