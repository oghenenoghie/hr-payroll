# Plutus Technologies — Payroll Platform

**The compliance-native payroll platform for Nigeria and Africa.**

Plutus is a cloud HR and payroll platform built on a single organising idea: **payroll should be correct by construction.** Compliance is not a feature bolted onto generic payroll software — it *is* the product.

Ships as the `wagebook` app inside the `business-platform` monorepo. *Plutus* is the commercial brand; *Wagebook* is the codebase name. (The product was previously branded **GECA Advisory** — that name is retired; treat any surviving reference as legacy.)

---

## Table of contents

1. [Why this exists](#1-why-this-exists)
2. [What it does](#2-what-it-does)
3. [Tech stack](#3-tech-stack)
4. [Repository structure](#4-repository-structure)
5. [Getting started](#5-getting-started)
6. [Environment variables](#6-environment-variables)
7. [The compliance engine](#7-the-compliance-engine)
8. [Statutory reference](#8-statutory-reference)
9. [Data model](#9-data-model)
10. [Design system](#10-design-system)
11. [Testing](#11-testing)
12. [CI/CD](#12-cicd)
13. [Deployment](#13-deployment)
14. [Security and data protection](#14-security-and-data-protection)
15. [Roadmap](#15-roadmap)
16. [Contributing conventions](#16-contributing-conventions)
17. [Legal notice](#17-legal-notice)

---

## 1. Why this exists

Nigeria's payroll compliance landscape changed fundamentally on **1 January 2026**. Four Acts signed in June 2025 — the Nigeria Tax Act (NTA), Nigeria Tax Administration Act (NTAA), Nigeria Revenue Service (Establishment) Act, and Joint Revenue Board (Establishment) Act — replaced the Personal Income Tax Act and rewrote how every employer calculates, withholds and remits tax.

The reform did not simplify payroll. **It raised the cost of getting it wrong:**

- New progressive PAYE bands and a raised tax-free threshold.
- Consolidated Relief Allowance abolished, replaced by a capped rent relief.
- Tax Identification Numbers mandatory for every worker, by law.
- A digitally-enabled Nigeria Revenue Service cross-referencing payroll against bank records, with expanded audit and penalty powers.

Most employers still run payroll on spreadsheets or on tools built for the old code. Plutus is built from the ground up on the new framework: **correct on day one, current for every reform that follows.**

## 2. What it does

### Three pillars

| Pillar | What it covers |
|---|---|
| **Payroll Core** | Multi-frequency runs, itemised digital payslips, arrears, bonuses, 13th-month handling, full audit trails, cumulative recalculation when pay changes mid-year |
| **Compliance Engine** | Automatic PAYE, pension, NHF, NHIS, NSITF, ITF and WHT calculation, filing and remittance tracking — **the differentiator** |
| **People Operations** | Leave, attendance, loans and advances, expenses, benefits, final settlement, employee and manager self-service |

### Screens

Twenty views behind role-based access, plus authentication:

`Setup & Onboarding` · `Overview` · `Payroll Runs` · `Compliance Engine` · `Employees` · `Leave & Attendance` · `Reports` · `Loans & Advances` · `Expenses` · `Benefits` · `Final Settlement` · `Integrations` · `Multi-Country` · `Attendance` · `Manager View` · `Notifications` · `Security & Access` · `PAYE Calculator` · `Payroll Simulation` · `Full Feature Map`

### Roles

| Role | Access |
|---|---|
| **Admin (Super User)** | Company setup, all runs, all employees, reports, integrations, security — all views |
| **Payroll Manager** | Create/process runs, view employees, compliance and reports |
| **HR Manager** | Employees and onboarding, leave and attendance, benefits |
| **Employee** | Self-service payslips, leave requests, expense claims — dedicated surface, not a filtered admin nav |

MFA is required for Admin and Payroll Manager. Role separation is enforced server-side through RLS — the nav filter is presentation only, never the security boundary.

## 3. Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14+ (App Router, RSC) |
| Language | TypeScript, strict |
| Styling | Tailwind CSS + shadcn/ui (Radix), Manrope via `next/font/google` |
| Data, auth, storage, realtime | **Supabase, exclusively** — Postgres, Auth, RLS, Storage, Realtime |
| Money | `packages/ledger` — integer minor units, double-entry |
| Compliance rules | `packages/compliance` — versioned statutory rule sets |
| Shared security | `packages/core` — RLS helpers, `has_org_role()`, `is_org_member()` |
| Batch compute | Python service on Railway |
| Email | Resend |
| CI/CD | GitHub Actions |
| Hosting | Vercel (web) · Railway (workers) · Supabase (all data) |

**Supabase is the entire data layer.** No second database, no alternative Postgres provider, no portability abstraction. Lean on RLS policies, security-definer functions, triggers and `pg_cron` as the correctness mechanism rather than emulating them in application code. Single-provider concentration is accepted deliberately and mitigated with tested point-in-time restore, not with a hedge database that never gets exercised.

**Money is never a float.** NGN has exponent 2 (kobo); use `packages/ledger`'s integer minor-unit handling throughout. Display as `₦` + `toLocaleString('en-NG')`, whole naira, no decimals.

## 4. Repository structure

```
business-platform/
├── apps/
│   └── wagebook/               # Plutus payroll + HR app (Next.js)
│       ├── app/                # routes mirroring the 20 views
│       ├── components/
│       └── lib/
├── packages/
│   ├── core/                   # RLS, org-role security-definer functions
│   ├── ledger/                 # money + double-entry accounting
│   ├── compliance/             # versioned statutory rules engine
│   ├── realtime/
│   └── analytics/
└── .claude/skills/             # committed SKILL.md pause/resume protocol
```

Statutory rule sets live in `packages/compliance` — shared and versioned, never buried inside the app.

## 5. Getting started

### Prerequisites

- Node.js 20+
- **pnpm** (this is a pnpm workspace — do not use `npm install`)
- Supabase CLI
- Python 3.11+ (only if working on the worker tier)

### Setup

```bash
git clone <repo-url>
cd business-platform
pnpm install

cp .env.example .env.local        # then fill in the values — see §6

supabase start                    # local Supabase stack
supabase db reset                 # applies all migrations from scratch

pnpm --filter wagebook dev        # http://localhost:3000
```

### Useful commands

```bash
pnpm --filter wagebook dev           # dev server
pnpm --filter wagebook build         # production build
pnpm typecheck                       # tsc --noEmit, strict
pnpm lint
pnpm test                            # unit + golden tests
pnpm test:golden                     # compliance engine only
pnpm test:e2e                        # Playwright

supabase migration new <name>        # create a migration
supabase db reset                    # re-apply all migrations
supabase db diff                     # inspect pending schema drift
```

### Where to start developing

Build **`packages/compliance` first**, as pure TypeScript with no database, auth or UI. It's the product's entire differentiator, it has zero infrastructure dependencies, and it's where wrong code causes real financial harm — so it deserves to be finished before anything depends on it.

First shippable slice: the engine + its golden tests + the **PAYE Calculator** screen (the only view needing no persistence). That proves the central claim with visible, verifiable arithmetic. Everything else is downstream of the engine being right.

Do *not* start with the Overview dashboard. It's the most satisfying screen to build and the least useful — a read-only projection of data that doesn't exist yet, so you'd build it twice.

## 6. Environment variables

Keep `.env.example` current with every required key and its purpose. Never commit real values — this system handles PII, salary and bank details, so treat every secret as high-sensitivity.

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client-side anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server/worker only — **bypasses RLS**, never expose to the client |
| `DATABASE_URL` | Pooled connection string for the worker tier |
| `RESEND_API_KEY` | Payslip delivery and notifications |
| `NEXT_PUBLIC_APP_URL` | Absolute URL for callbacks and email links |

**Naming consistency matters.** A prior bug in this codebase came from `NEXT_PUBLIC_SUPABASE_ANON_KEY` vs `...PUBLISHABLE_KEY` drift. Pick one spelling, document it, don't alias.

## 7. The compliance engine

This is the product's core and its commercial moat. The design is non-negotiable:

**Rules are data, effective-dated, and centrally versioned.** A `rule_version` (e.g. `NG-2026.1`) carries the complete band table, reliefs, thresholds, and per-scheme rates, bases and deadlines for a validity window `[effective_from, effective_to)`.

- A payroll run **pins** the rule version it used. Results are immutable and reproducible.
- **No magic numbers in code.** Every rate, threshold, band edge and deadline resolves through the rule set. A grep for statutory figures inside calculation code should return nothing.
- A change in the law means a **new rule version + migration + updated golden tests** — never an edit to calculation logic in place.
- Employer-borne costs are modelled explicitly (`borneBy`) so NSITF, ITF and employer pension can never land in an employee's deduction total.

```ts
type RuleVersion = {
  id: string;                    // "NG-2026.1"
  country: "NG";
  effectiveFrom: string; effectiveTo: string | null;
  paye: {
    bands: { upTo: bigint | null; rate: number }[];
    taxFreeThreshold: bigint;
    rentRelief: { rate: number; cap: bigint };
    remittance: { authority: "STATE_IRS"; dueDay: 10 };
  };
  pension: { base: PayComponent[]; employeeRate: number; employerRate: number;
             remittance: { authority: "PFA"; dueWorkingDaysAfterPayment: 7 } };
  nhf:    { base: PayComponent[]; rate: number;
             remittance: { authority: "FMBN"; dueMonthsAfterPayment: 1 } };
  nsitf:  { base: "TOTAL_MONTHLY_PAYROLL"; rate: number; borneBy: "EMPLOYER";
             remittance: { authority: "NSITF"; dueDayOfFollowingMonth: 16 } };
  itf:    { base: "ANNUAL_PAYROLL"; rate: number; borneBy: "EMPLOYER";
             qualifies: (org: Org) => boolean;
             remittance: { authority: "ITF"; dueAnnuallyOn: "04-01" } };
  nhis:   { resolveByScheme: true };
  wht:    { ratesByCategory: Record<string, number>;
             remittance: { dueDayOfFollowingMonth: 21 } };
};
```

**Lock the `RuleVersion` shape before writing the first calculation.** Everything pins to it and historical runs reference it, so changing it later means migrating past runs.

### Derivation order

```
basic / housing / transport   ← actual per-employee components, not a derived split
pensionable   = basic + housing + transport
pension (EE)  = pensionable × 8%
pension (ER)  = pensionable × 10%     ← employer cost, NOT a deduction
nhf           = basic × 2.5%
rent relief   = min(annual rent × 20%, ₦500,000)
chargeable    = max(0, gross − pension(EE) − nhf − rent relief)
PAYE          = Σ (income in band × band rate)
```

Order matters. Applying relief after banding, or taxing gross directly, produces materially wrong numbers.

### Non-negotiable behaviours

- **TIN gating** — flag employees without a valid TIN *before* a run, never after an audit. A run must not silently process a TIN-less employee.
- **Cumulative PAYE** — computed on cumulative annual chargeable income, re-derived whenever pay changes mid-year. Not a naïve monthly slice.
- **State-of-residence routing** — PAYE is collected by each state's IRS; map every employee, generate per-state filing schedules, consolidate evidence across states.
- **Right agency, right deadline** — each scheme has its own base, rate, authority and deadline. Conflating them is the most common error in this domain.
- **Audit-ready by default** — every cycle keeps a full trail; liabilities and filing status reportable by entity, state or country.

## 8. Statutory reference

Nigeria Tax Act 2025, effective 1 January 2026. **Never quote a figure from memory — resolve it from the rule set.**

### PAYE bands (annual chargeable income)

| Band | Rate |
|---|---|
| First ₦800,000 | 0% |
| Next ₦2,200,000 (₦800,001 – ₦3,000,000) | 15% |
| Next ₦9,000,000 (₦3,000,001 – ₦12,000,000) | 18% |
| Next ₦13,000,000 (₦12,000,001 – ₦25,000,000) | 21% |
| Next ₦25,000,000 (₦25,000,001 – ₦50,000,000) | 23% |
| Above ₦50,000,000 | 25% |

Consolidated Relief Allowance is **abolished**. Rent relief is 20% of annual rent, capped at ₦500,000.

### Scheme matrix

| Scheme | Base | Rate | Borne by | Authority | Deadline |
|---|---|---|---|---|---|
| PAYE | Annual chargeable income (cumulative) | 0–25% progressive | Employee | State IRS / NRS | 10th of following month |
| Pension | Basic + housing + transport | 8% EE / 10% ER (min) | Both | Employee's PFA → PenCom | Within 7 **working days** of payment |
| NHF | Basic salary | 2.5% | Employee | FMBN | Within 1 month of payment |
| NHIS/NHIA | Per applicable scheme | Scheme-defined | Both | Applicable health scheme | Per scheme |
| NSITF | Total monthly payroll | 1% | **Employer** | NSITF | Before 16th of following month |
| ITF | Annual payroll | 1% (qualifying employers) | **Employer** | ITF | On/before 1 April annually |
| WHT | Contractor/vendor payment | By service category | Contractor | NRS / State IRS | 21st of following month |

> **Verification rule.** The 2026 reform is recent and guidance is still settling. Deadlines in particular are stated inconsistently across secondary sources — re-confirm against primary agency guidance (NRS, PenCom, FMBN, NSITF, ITF) before go-live, and flag date-sensitivity on any client-facing tax claim.

## 9. Data model

Core entities:

- **Organisation** — name, RC number, company TIN, default pay frequency, default PFA, states of operation
- **Employee** — name, role, state of residence, pay components (basic/housing/transport stored separately), TIN + validity, PFA, leave balance, access role, manager, photo (object path + version + consent timestamp, nullable)
- **PayRun** — period, frequency, scope, status, **pinned rule version**, employee count, gross, net
- **Payslip** — per employee per run: gross, each statutory deduction, net, plus the stored derivation trail
- **StatutoryLiability** — per scheme/period/state: amount, authority, deadline, filing status, remittance evidence
- **Loan / Advance** — type, principal, balance, monthly deduction, status
- **ExpenseClaim** — category, amount, status, taxable/non-taxable handling
- **BenefitEnrollment** — plan, employer cost per month
- **LeaveRequest / AttendanceRecord** — both feed payroll
- **FinalSettlement** — leave payout + gratuity − outstanding loans
- **AuditEvent** — append-only: who, what, when, under which rule version

Payslips and audit events are **append-only**. Corrections are new records, never edits.

### Employee photos

Captured during enrollment in the Add-employee form, not through a later profile-edit flow. Stored in a private Supabase Storage bucket, org-scoped by path (`employee-photos/{org_id}/{employee_id}/{version}.webp`), read restricted to org members and write to HR/Admin or the employee themself.

On upload: **strip EXIF** (phone photos carry GPS), re-encode to square WebP at one canonical size plus a thumbnail, validate the decoded image rather than the declared MIME type, and version the path instead of overwriting.

**A missing photo must never block a payroll run.** TIN is a hard gate because the law requires it; a photo is not. Model it as optional-but-prompted — HR sees an outstanding count and can chase, but the run proceeds. Initials fallback is a permanent state, not a loading placeholder.

## 10. Design system

**"Ledger"** — institutional, dense, flat. It should read like a well-set financial statement, not a consumer SaaS dashboard.

Tokens are authored in **OKLCH** and declared at the root:

```css
--bg: oklch(97% 0.015 95);          --surface: oklch(99% 0.005 95);
--border: oklch(90% 0.02 95);       --ink: oklch(22% 0.02 95);
--ink-soft: oklch(48% 0.02 95);     --primary: oklch(35% 0.08 152);
--primary-dark: oklch(26% 0.07 152); --primary-tint: oklch(94% 0.03 152);
--accent: oklch(62% 0.12 55);       --accent-tint: oklch(93% 0.05 55);
--good: oklch(55% 0.13 152);        --good-tint: oklch(93% 0.05 152);
--warn: oklch(68% 0.14 70);         --warn-tint: oklch(94% 0.05 70);
--bad: oklch(55% 0.17 25);          --bad-tint: oklch(94% 0.06 25);
```

- **One typeface: Manrope**, weights 400–800, but 700/800 dominate. Dense small scale — 11–15px carries the UI, 22–26px for KPI figures. Nothing larger.
- **Uppercase micro-labels** at 11px/700, `--ink-soft`, `0.03em` tracking, are the signature. Tracking is for uppercase only.
- **No box-shadows anywhere.** Depth comes entirely from `1px solid var(--border)` and the `--bg`/`--surface` step. This is the system's defining property.
- **Neutrals are warm** (hue 95), not gray. Substituting true grays flattens the whole design.
- Status is always **saturated text on its matching tint fill**, never colored text on white.
- Default card: `background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 24px`.

Avoid: shadows, true grays, larger type, `--accent` as a secondary brand color, a second typeface, decimal currency, gradients, heavy motion.

## 11. Testing

Payroll is a domain where a wrong number is real financial and legal harm. Testing weights heavily toward calculation correctness.

**Golden tests are the highest priority.** Fixed input → expected statutory output. Required cases:

- Every PAYE band boundary: ₦800,000 · ₦3,000,000 · ₦12,000,000 · ₦25,000,000 · ₦50,000,000, and either side of each
- Worked example: chargeable ₦3,162,000 → ₦359,160
- Rent relief exactly at the ₦500,000 cap, and rent high enough to exceed it; zero rent
- Chargeable income below ₦800,000 → PAYE = 0, never negative
- Mid-year pay change → correct cumulative year-to-date position
- Employee with no TIN → run blocked, not silently processed
- Each scheme against its own base; employer costs absent from employee totals
- Multi-state workforce → per-state liability sums to org total

Plus: **unit** (Vitest) for rule resolution and money math; **integration** for full runs against a seeded DB with RLS enforced and per-tenant isolation verified; **E2E** (Playwright) for runs, payslips, self-service and approval flows; **contract** tests for API routes and disbursement file formats; **property** tests (band tax ≤ chargeable, net ≤ gross, no negative deductions).

**CI must fail if golden tests fail.** Never ship a green build with a broken calculation.

## 12. CI/CD

GitHub Actions, per PR and on merge:

1. Install + cache (pnpm)
2. Typecheck (`tsc --noEmit`, strict)
3. Lint
4. Unit + golden + integration tests — fail-closed
5. Build
6. **Migration check** — assert migrations apply cleanly to a fresh database before any deploy
7. Preview deploy (Vercel) on PR; promote on merge with a manual approval gate for production

Step 6 exists because of a real incident: `core`/`ledger` migrations were never pushed to the live project and the app queried tables that didn't exist. Migrate before deploy, enforced by CI.

## 13. Deployment

| Tier | Platform |
|---|---|
| Web | Vercel |
| Workers, batch payroll, filings, reports | Railway (Python) |
| All data | Supabase |
| Long-running/self-hosted jobs | DigitalOcean droplet (~2vCPU/4GB) |

Disbursement file generation and statutory filing jobs run on the worker tier, **never in request handlers**.

The Python worker connects to Supabase Postgres through the pooler: session mode for anything needing prepared statements or advisory locks, transaction mode for short queries. **Do not open a connection per employee** — pool exhaustion mid-pay-run is the predictable failure. Where the service role is genuinely needed for batch work, scope it narrowly, log every use, and never let a service-role client reach a request handler.

One Supabase project (or branch) per environment. A staging job must never reach production payroll data.

## 14. Security and data protection

Payroll means employee PII, salary, bank details and tax IDs. Treat everything as high-sensitivity.

- **RLS on by default** for every tenant table via `packages/core` helpers. A cross-tenant leak here is catastrophic and reportable.
- **MFA required** for Admin and Payroll Manager roles.
- Least-privilege database roles; no broad admin in application connections.
- Private Storage buckets only, access via RLS-backed signed URLs. Never a public bucket.
- TLS everywhere; secrets never in the repo; encrypt sensitive columns at rest where warranted.
- **Full audit trail per cycle** — who ran what, which rule version, what changed. Simultaneously a compliance control and a product feature.
- **NDPR** awareness for all personal data: consent recorded at capture, documented retention schedule, deletion triggered by the Final Settlement exit flow.
- **Backups with tested restore.** Losing a payroll database is existential. Point-in-time recovery enabled; restores actually exercised, not assumed.
- Access to production payroll data is logged and restricted.

## 15. Roadmap

### Build phases

1. **Compliance engine** — `packages/compliance` with `NG-2026.1`, all seven schemes, golden suite green *before* anything depends on it. Plus the PAYE Calculator screen as the first shippable slice.
2. **Foundation** — app shell, Supabase Auth, org/tenant model, RLS via `core`, CI with migration check, design tokens in Tailwind.
3. **Payroll core** — employees with real pay components, multi-frequency runs, payslips with stored derivation trail, `ledger`-backed postings, cumulative PAYE, TIN gating.
4. **People ops + self-service** — leave, attendance, loans, expenses, benefits, employee and manager portals.
5. **Filing & remittance** — state-of-residence routing, filing schedules, remittance tracking, disbursement files, deadline alerting, dashboards.
6. **Final settlement + simulation** — exit payroll, what-if analysis.
7. **Pan-African** — abstract the rule layer so a new country is a rule set, not a rewrite.

### Markets

| Market | Status | Schemes |
|---|---|---|
| Nigeria | Live | PAYE · Pension · NHF · NHIS · NSITF · ITF · WHT |
| Ghana | Roadmap · Q1 2027 | PAYE · SSNIT pension · Tier 2/3 |
| Kenya | Roadmap · Q3 2027 | PAYE · NSSF · SHIF |

*Nigeria is the proving ground, not the ceiling.* Because the engine is a rules layer over a common core, each new country adds a statutory rule set rather than a new platform. Don't hardcode Nigeria assumptions into the shared core — currency exponent, scheme count, single-tax-authority, and "states" as the only sub-national unit are the usual leaks.

## 16. Contributing conventions

- **pnpm only.** This is a pnpm workspace.
- **Migrations are the only way schema changes ship.** No manual dashboard edits, ever.
- **No statutory figure in application code.** If you're typing a rate, you're in the wrong file.
- **Statutory change = new rule version + migration + golden-test update**, shipped as a discrete, reviewable release. Never a hotfix number-edit.
- Tag releases; changelog notes any `rule_version` change and its effective date.
- Keep `.claude/skills/SKILL.md` current in-repo — it's the pause/resume protocol across sessions.
- Money is integer minor units. If you see a float holding naira, that's a bug.
- Prefer flagging a statutory conflict over silently picking a side.

## 17. Legal notice

Plutus encodes statutory rules; **it does not constitute tax or legal advice** and does not replace a qualified tax professional. Statutory figures are versioned snapshots and must be verified against current primary sources before production use.

Demo and seed data — employees, banks, PFAs, amounts — are illustrative fixtures and must never be presented as real client data or benchmarks.

---

*Plutus Technologies — compliance-native payroll for Nigeria and Africa.*
