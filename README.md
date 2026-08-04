<div align="center">

# Plutus — Compliance-Native Payroll for Nigeria & Africa

**Payroll that is correct by construction.** Compliance isn't a feature bolted onto generic payroll software — it *is* the product.

Built on the Nigeria Tax Act framework effective **1 January 2026**. Ships as the **Wagebook** app.

[![Live](https://img.shields.io/badge/Live-hr--payroll--wagebook.vercel.app-2E6E9E?logo=vercel&logoColor=white)](https://hr-payroll-wagebook.vercel.app)
[![CI](https://img.shields.io/github/actions/workflow/status/oghenenoghie/hr-payroll/ci.yml?label=CI&logo=githubactions&logoColor=white)](https://github.com/oghenenoghie/hr-payroll/actions/workflows/ci.yml)
[![Next.js](https://img.shields.io/badge/Next.js-16-000?logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%2B%20Auth%20%2B%20RLS-3FCF8E?logo=supabase&logoColor=white)](https://supabase.com)
[![pnpm](https://img.shields.io/badge/pnpm-10-F69220?logo=pnpm&logoColor=white)](https://pnpm.io)
[![Tests](https://img.shields.io/badge/tests-Vitest%20golden-6E9F18?logo=vitest&logoColor=white)](https://vitest.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

</div>

---

## Why this exists

Nigeria's payroll compliance landscape changed fundamentally on **1 January 2026**. Four Acts signed in June 2025 — the Nigeria Tax Act, the Nigeria Tax Administration Act, the Nigeria Revenue Service (Establishment) Act, and the Joint Revenue Board (Establishment) Act — replaced the Personal Income Tax Act and rewrote how every employer calculates, withholds, and remits tax.

The reform didn't simplify payroll. It **raised the cost of getting it wrong**: new progressive PAYE bands, a raised tax-free threshold, the Consolidated Relief Allowance replaced by a capped rent relief, mandatory Tax Identification Numbers for every worker, and a digitally-enabled Nigeria Revenue Service that cross-references payroll against bank records.

Most employers still run payroll on spreadsheets or tools built for the old code. **Plutus is built from the ground up on the new framework** — correct on day one, current for every reform that follows.

## Product architecture — three pillars

| Pillar | What it does |
|---|---|
| **Payroll Core** | Multi-frequency runs, itemised digital payslips, arrears, bonuses, 13th-month handling, full audit trails, and cumulative recalculation whenever pay changes mid-year. |
| **Compliance Engine** | Automatic PAYE, pension, NHF, NHIS, NSITF, ITF and withholding-tax calculation, filing, and remittance tracking. **This is the differentiator** — a rules engine over a common payroll core, so rules change centrally as the law changes underneath. |
| **People Operations** | Leave, attendance, loans & advances, expenses, benefits, final settlement, and employee/manager self-service — one system of record. |

## The engineering principle everything hangs on

> **Rules are data, not code. The compliance engine is versioned.**

Rates, reliefs, thresholds, and band edges live in a central, **effective-dated** rule set (`packages/compliance/src/rule-versions/`) — never hardcoded, never scattered as magic numbers. When the law changes, one version bump corrects every payslip going forward, and historical runs remain reproducible against the rules that were in force at the time.

The active rule version is **`NG-2026.1`** (effective `2026-01-01`). Every figure it carries is sourced against primary authorities (NRS, PenCom, FMBN, NSITF, ITF) — never invented. A `grep` for statutory numbers inside calculation code returns nothing.

**Money is integer-only.** All amounts are stored as **kobo** (`bigint`), rates as parts-per-million — no floating point ever touches a payslip. Rounding is explicit and deterministic.

```ts
export type Kobo = bigint;              // minor units, never a float
export const RATE_SCALE = 1_000_000n;   // rates in parts-per-million
```

## Tech stack

| Layer | Choice |
|---|---|
| **Framework** | Next.js 16 (App Router) + React 19 |
| **Language** | TypeScript 5 (strict) |
| **Styling** | Tailwind CSS v4 |
| **Data / Auth** | Supabase — Postgres, Auth, Row-Level Security, Storage |
| **Auth pattern** | Supabase SSR (`@supabase/ssr`), invite-link onboarding, TOTP MFA |
| **Compliance core** | Pure TypeScript, zero runtime deps, integer-money |
| **Testing** | Vitest (golden tests for calculation correctness) |
| **Monorepo** | pnpm workspaces (`pnpm@10.33.0`) |
| **CI** | GitHub Actions (typecheck · lint · test · build · migration replay) |
| **Hosting** | Vercel (web) · Supabase (managed Postgres) |

## Repository layout

```
hr-payroll/                     # root workspace — package "plutus"
├── apps/
│   └── wagebook/               # Next.js 16 app (the Plutus product)
│       └── src/app/
│           ├── (app)/          # authenticated product surface
│           │   ├── payroll/    │   ├── employees/    ├── compliance/
│           │   ├── loans/      │   ├── overtime/      ├── attendance/
│           │   ├── leave/      │   ├── settlements/   ├── benefits/
│           │   ├── expenses/   │   ├── departments/   ├── branches/
│           │   ├── job-grades/ │   ├── policies/      ├── org-chart/
│           │   ├── workflows/  │   ├── billing/       ├── integrations/
│           │   ├── team/       │   ├── notifications/ └── me/  (self-service)
│           └── auth/           # invite / set-password / confirm / callback
├── packages/
│   ├── compliance/             # @plutus/compliance — statutory engine (pure TS)
│   │   └── src/
│   │       ├── schemes/        # paye · pension · nhf · nhis · nsitf · itf · wht
│   │       ├── rule-versions/  # ng-2026.1.ts (effective-dated rule set)
│   │       ├── money.ts        # integer kobo / rate math
│   │       ├── tin-gate.ts     # TIN validation gate
│   │       ├── payslip.ts      # payslip assembly
│   │       └── nuban.ts        # NUBAN account validation
│   └── core/                   # @plutus/core — org roles, RLS helpers, DB types
│       └── src/org-roles.ts    # 7 org roles (see below)
├── supabase/
│   └── migrations/             # 64 ordered SQL migrations (schema + RLS + functions)
├── .github/workflows/ci.yml    # CI pipeline
└── pnpm-workspace.yaml
```

### Organisation roles

Seven role tenancy model, enforced in the database via RLS:

```
admin · payroll_manager · hr_manager · accountant
department_manager · auditor · employee
```

## Compliance engine — what it encodes

The `@plutus/compliance` package computes each statutory scheme independently, with the right base, rate, remittance authority, and deadline per scheme — never conflated:

| Scheme | Borne by | Remittance authority |
|---|---|---|
| **PAYE** | Employee | State Internal Revenue Service |
| **Pension** | Employee + Employer | PFA |
| **NHF** | Employee | FMBN |
| **NHIS** | — | NHIS |
| **NSITF** | Employer | NSITF |
| **ITF** | Employer | ITF |
| **WHT** | Contractor/vendor | Per service category |

Non-negotiable behaviours baked into the engine:

- **TIN gating** — flags workers without a valid Tax Identification Number *before* a run, not after an audit.
- **Cumulative PAYE** — computed on cumulative annual chargeable income, re-derived whenever mid-year pay changes.
- **State-of-residence mapping** — PAYE is collected per state; each employee maps to their state IRS.
- **Employer-side vs employee-side** — NSITF, ITF and employer pension are company costs, modelled separately so payslips stay correct.
- **Audit-ready by default** — every cycle keeps a full trail; liabilities and filing status reportable by entity and state.

## Getting started

### Prerequisites

- Node.js **22+**
- pnpm **10** (`corepack enable` picks up the pinned version automatically)
- A Supabase project (or the Supabase CLI for a local stack)

### Install

```bash
git clone https://github.com/oghenenoghie/hr-payroll.git
cd hr-payroll
pnpm install
```

### Environment

Copy the example and fill in your Supabase credentials:

```bash
cp apps/wagebook/.env.example apps/wagebook/.env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### Database

Apply all migrations to a fresh Supabase database:

```bash
supabase start          # local stack, or:
supabase db push        # against a linked remote project
```

Migrations are **ordered and replayed from scratch in CI** — schema, RLS policies, and Postgres functions all live in `supabase/migrations/`.

### Run

```bash
pnpm dev                # http://localhost:3000
```

## Scripts

Run from the repo root:

| Command | Description |
|---|---|
| `pnpm dev` | Start the Wagebook dev server |
| `pnpm build` | Production build |
| `pnpm test` | Run all package tests (Vitest golden tests) |
| `pnpm lint` | Lint every workspace |
| `pnpm typecheck` | Type-check every workspace |

## Testing

Calculation correctness is protected by **golden tests** in `packages/compliance/test/` — payslip assembly, NUBAN validation, and scheme-by-scheme statutory output are asserted against known-good fixtures. Because the compliance core is pure TypeScript with no runtime dependencies, it tests fast and in isolation from the app and database.

## CI/CD

`.github/workflows/ci.yml` runs on every pull request and push to `main`, in two independent jobs:

1. **Typecheck · lint · test · build** — Node 22 + pnpm, `--frozen-lockfile`.
2. **Migration replay** — spins up a fresh Supabase Postgres + Auth stack and applies every migration in order. A migration that doesn't apply cleanly from scratch fails the build.

## Roadmap

Nigeria is the proving ground, not the ceiling. Because the compliance engine is a rules layer over a common core, each new market adds a statutory rule set — not a new platform.

| Market | Status | Schemes |
|---|---|---|
| 🇳🇬 Nigeria | **Live** | PAYE · Pension · NHF · NHIS · NSITF · ITF · WHT |
| 🇬🇭 Ghana | Roadmap · Q1 2027 | PAYE · SSNIT (Tier 2/3) |
| 🇰🇪 Kenya | Roadmap · Q3 2027 | PAYE · NSSF · SHIF |

## Disclaimer

Plutus **encodes** statutory rules; it does not replace a tax professional. The 2026 reform is recent and guidance is still settling — statutory figures are versioned and effective-dated, and should be confirmed against current primary sources before production use. Any demo data (employees, banks, PFAs, amounts) is illustrative fixtures, not real client data.

## License

Released under the [MIT License](LICENSE) — see the `LICENSE` file for the full text.

---

<div align="center">

Built by **[Patrick Gabriel](https://github.com/oghenenoghie)** · Full-stack developer · Lagos, Nigeria

</div>
