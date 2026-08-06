# Plutus

Compliance-native HR & payroll for Nigeria and Africa, built on the 2026
Nigeria Tax Act. PAYE, pension, NHF, NHIS, NSITF, ITF and WHT are modelled
as a versioned rules engine over a common payroll core, so a statutory
change is a rule version bump, never a rewrite of calculation logic.

Ships as the **Wagebook** app — that's the product's internal/codebase
name; Plutus is the commercial brand.

## Structure

This is a pnpm workspace monorepo:

```
apps/
  wagebook/       Next.js 16 app — the actual product (App Router, Supabase, Tailwind)
packages/
  compliance/     The statutory rules engine (PAYE, pension, NHF, NHIS, NSITF, ITF, WHT)
  core/           Shared types, incl. generated Supabase database types
supabase/
  migrations/     Postgres schema, RLS policies, and SQL functions
```

## Getting started

```bash
pnpm install
pnpm dev          # runs apps/wagebook on http://localhost:3000
```

Other root-level scripts run across every workspace package:

```bash
pnpm build
pnpm lint
pnpm test
pnpm typecheck
```

`apps/wagebook` needs Supabase credentials in `.env.local` — see
`apps/wagebook/.env.example`. That app's own [README](apps/wagebook/README.md)
also covers one-time setup for transactional email (Resend via Supabase
Vault).

## Notes for AI agents

This project pins a pre-release Next.js version with breaking API changes
— see [`AGENTS.md`](AGENTS.md) before generating any Next.js code.
