# Plutus — Engineering, Stack & Software Lifecycle

Reference for how Plutus is built, tested, shipped, and operated. Read this for any task touching stack choices, repo structure, environments, testing, migrations, CI/CD, releases, hosting, observability, or data protection.

> **Sourcing note:** the investor brief and the design prototype do not specify tooling. This is aligned to Patrick's established `business-platform` monorepo conventions. Plutus is the commercial brand for the Nigeria-first payroll engine that ships as **Wagebook** in `business-platform`. Keep them consistent — don't spin up a parallel stack. Confirm anything that may have drifted before relying on it.

## Table of contents
1. Tech stack
2. Repo placement & structure
3. Environments & configuration
4. Database, migrations & RLS
5. The versioned rules engine (implementation contract)
6. Domain model
7. Testing strategy
8. CI/CD
9. Hosting & deployment
10. Observability & operations
11. Security & data protection
12. Release & change management
13. Build roadmap (phased)

---

## 1. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 14+ (App Router, RSC) | UI + CRUD + API routes |
| Language | TypeScript (strict) | Shared types across packages |
| Styling | Tailwind CSS + shadcn/ui (Radix) | Tokens per `design-system.md`; restrained motion |
| Data / auth / storage | **Supabase** (Postgres + Auth + RLS + Storage + Realtime) | Sole system of record — no second database (see §4) |
| Money / ledger | `packages/ledger` | Integer minor units, double-entry, deferred-constraint triggers |
| Shared security | `packages/core` | RLS helpers, `has_org_role` / `is_org_member` security-definer fns |
| Compliance rules | `packages/compliance` | Versioned statutory rule sets (see §5) |
| Heavy compute | Python service on Railway | Payroll batch runs, report generation, filings |
| Email | Resend | Payslip delivery, notifications |
| CI/CD | GitHub Actions | Lint, typecheck, test, migration check, deploy |
| Hosting | Vercel (web) · Railway (workers) · Supabase (all data) · DigitalOcean droplet (VPS jobs) | |

**Font:** Manrope 400–800 via `next/font/google`, `display: 'swap'`.

**Currency:** NGN has exponent 2 (kobo). Use `packages/ledger`'s integer minor-unit handling — **never floats for money.** Display formatting is `₦` + `toLocaleString('en-NG')`, whole naira, no decimals. Pan-African: resolve exponent per currency (KWD=3, JPY=0); don't assume 2.

## 2. Repo placement & structure

Plutus/Wagebook is an **app inside the `business-platform` monorepo**, not a standalone repo — consistent with the consolidate-into-monorepos preference. Use **pnpm**, not npm.

```
business-platform/
├── apps/
│   └── wagebook/               # Plutus payroll + HR app (Next.js)
│       ├── app/                # routes mirroring the 20 views
│       ├── components/
│       └── lib/
├── packages/
│   ├── core/                   # RLS, org-role security-definer fns
│   ├── ledger/                 # money + double-entry accounting
│   ├── compliance/             # ← versioned statutory rules engine (§5)
│   ├── realtime/
│   └── analytics/
└── .claude/skills/             # committed SKILL.md pause/resume protocol
```

Statutory rule sets belong in `packages/compliance` — shared and versioned, never buried inside the app.

## 3. Environments & configuration

- Environments: **local → preview (per-PR) → staging → production.** Vercel preview deploys per PR; a dedicated Supabase project or branch per environment.
- Secrets in Vercel/Railway env vars and GitHub Actions secrets — **never committed.** Payroll handles PII and bank data; treat every secret as high-sensitivity.
- Env var naming must be consistent (a past bug: `NEXT_PUBLIC_SUPABASE_ANON_KEY` vs `...PUBLISHABLE_KEY`). Pick one and document it.
- Keep a real `.env.example` with every required key and its purpose.

## 4. Database, migrations & RLS

### Supabase is the entire data layer

**Decision: Supabase, exclusively.** Postgres, Auth, RLS, Storage and Realtime all come from one Supabase project per environment. There is no second database, no alternative Postgres provider, and no plan to stay portable between providers. Consequences worth building into the code deliberately:

- **Lean on Postgres and Supabase features rather than abstracting them away.** RLS policies, security-definer functions, triggers, `pg_cron`, and Postgres row-level constraints are the intended mechanism for correctness — not an application-layer emulation kept thin "in case we migrate". Provider-agnostic abstraction is now a cost with no benefit.
- **Auth is Supabase Auth.** `auth.uid()` is available inside RLS policies; org membership and role resolve through `packages/core`'s `has_org_role()` / `is_org_member()` security-definer functions. Don't introduce a parallel session or user table.
- **Storage is Supabase Storage** for generated payslip PDFs, bank disbursement files, statutory filing evidence, employee documents and **employee photos**. These are sensitive: private buckets only, access mediated by RLS-backed signed URLs, never public buckets. Retention policy applies to filing evidence.

**Employee photos specifically.** Captured at enrollment (see `product-and-ia.md` §3). Keep them in their own bucket, org-scoped by path (`employee-photos/{org_id}/{employee_id}/{version}.webp`), with an RLS policy that allows read only to members of that org and write only to HR/Admin or the employee themself. A public bucket of workforce headshots keyed by sequential ID is a straightforward data leak, so this is one place not to take the convenient default.

Processing on upload, before the file is stored:

- **Strip EXIF.** Phone photos carry GPS coordinates and capture timestamps. Storing an employee's home location because HR onboarded them at their kitchen table is an avoidable disclosure.
- Re-encode to WebP, square-cropped, at one canonical size plus a thumbnail. Never serve the original upload.
- Cap accepted file size and validate the decoded image, not the declared MIME type — content-type is attacker-controlled.
- Version the object path rather than overwriting, so the audit trail can reference what was shown at a point in time.

Photos are personal data under NDPR: record consent at capture, and delete on the retention schedule when an employee exits — the exit flow in Final Settlement should trigger it rather than leaving orphaned images indefinitely.
- **Realtime is Supabase Realtime**, feeding the `realtime` package — pay-run status, approval queues, notifications.
- **The Python worker on Railway connects to the same Supabase Postgres**, through the connection pooler. Batch payroll runs are long-lived and transactional, so use session mode for anything needing prepared statements or advisory locks, and transaction mode for short queries. Do not open one direct connection per employee in a run — pool exhaustion during a large pay run is the predictable failure here.
- **The worker must not bypass RLS casually.** Where the service role is genuinely required for batch processing, scope it narrowly, log every use, and never let a service-role client reach a request handler.
- **Environments:** one Supabase project (or branch) per environment, never shared. A staging job must not be able to reach production payroll data.

Single-provider concentration is a real risk — accept it explicitly and mitigate it with §11's tested restore and point-in-time recovery rather than with a hedge database that will never be exercised.

- **Migrations are the only way schema changes ship.** Every change is a checked-in, ordered migration — no manual dashboard edits. (Prior incident: `core`/`ledger` migrations were never pushed to the live project, so the app queried tables that didn't exist. Enforce "migrate before deploy" in CI.)
- **RLS on by default** for every tenant table, via `packages/core` helpers. Multi-tenant payroll data must be isolated per org; a leak here is catastrophic and reportable.
- Role separation from `product-and-ia.md` §2 is enforced **in the database**, not by hiding nav items.
- Postgres-native invariants where possible: deferred-constraint triggers for the ledger, check constraints for statutory bounds, exclusion constraints where overlap prevention is needed.
- Historical reproducibility: pay-run records reference the **rule version** in force at run time, so an old payslip can always be recomputed exactly.

## 5. The versioned rules engine (implementation contract)

This is the product's core and its moat. Non-negotiable design:

- **Rules are data, effective-dated, centrally versioned.** A `rule_version` (e.g. `NG-2026.1`) carries the full band table, reliefs, thresholds, and per-scheme rates, bases and deadlines for a validity window `[effective_from, effective_to)`.
- A payroll run **pins** the rule version it used; results are immutable and reproducible.
- **No magic numbers in code.** Every rate/threshold/band/deadline resolves through the rule set. A grep for statutory figures in calculation code should return nothing.
- Changing the law = adding a new rule version + a migration + updated golden tests. Never editing calculation logic in place.
- Source every figure from `references/nigeria-statutory-compliance.md`; that file mirrors what the rule set must contain, including the §11 errata.

Suggested shape (illustrative):

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

Note that `borneBy` is modelled explicitly. Employer-side costs must never be able to land in an employee's deduction total — encode it in the type system, not in convention.

## 6. Domain model

Core entities, derived from the prototype's data shape:

- **Organisation** — name, RC number, company TIN, default pay frequency, default PFA, states of operation.
- **Department / CostCentre** — required by pay-run scoping ("single department") and by payroll accounting allocation. Currently referenced by the product but not modelled.
- **Branch / Location** — statutory filing is state-scoped, so an employer operating in several states needs locations as first-class records, not a free-text field.
- **JobPosition / Grade / Level** — anchors salary bands, and later compensation review. Thin version acceptable early; don't invent it inside the employee record.
- **Employee** — see the expanded shape below.
- **BankAccount** — bank, account number/NUBAN, account name, verification status. Belongs to the employee; **without it, no disbursement file can be generated.**
- **EmploymentContract** — type (permanent / fixed-term / part-time / intern / consultant), start date, end date, probation period and status, confirmation date, notice period. Drives proration, contract-expiry alerting, and statutory treatment that varies by employment type.
- **Employee** — the record everything else hangs off, and the one most often under-modelled. Group the fields by what depends on them:
  - *Identity:* employee ID/number, full name, date of birth, gender, nationality, marital status.
  - *Contact:* email, phone, residential address, emergency contact / next of kin.
  - *Statutory:* TIN + validity, pension PFA + RSA PIN, NHF number, NHIS scheme, **state of residence** (PAYE routing — distinct from state of origin and from work location).
  - *Employment:* department, branch/location, job position/grade, manager, employment type, date of joining, current lifecycle state.
  - *Pay:* pay components (basic / housing / transport stored separately, never a derived split), pay frequency, bank account, payroll group.
  - *Other:* leave balance, access role, photo (object path + version + consent timestamp, nullable).

  Date of birth is not decoration — it drives pension retirement eligibility. Nationality affects expatriate tax treatment. Date of joining is required for first-period proration.
- **PayRun** — period, frequency (regular / bonus-13th / arrears-off-cycle), scope (all / department / contractors), status, **pinned rule version**, employee count, gross, net.
- **Payslip** — per employee per run: gross, each statutory deduction, net, plus the stored derivation trail that powers the "how?" expander.
- **StatutoryLiability** — per scheme per period per state: amount, authority, deadline, filing status, remittance evidence.
- **Loan / Advance** — type, principal, balance, monthly deduction, status; feeds payroll deductions.
- **ExpenseClaim** — category, amount, status, taxable/non-taxable handling.
- **BenefitEnrollment** — plan, employer cost per month.
- **LeaveRequest / AttendanceRecord** — both feed payroll.
- **FinalSettlement** — leave payout + gratuity − outstanding loans.
- **AuditEvent** — append-only; who did what, when, under which rule version.

Audit events and payslips are append-only. Corrections are new records, never edits.

## 7. Testing strategy

Payroll is a domain where a wrong number is real financial and legal harm, so testing is weighted heavily toward calculation correctness.

- **Golden tests for the compliance engine (highest priority).** Fixed input → expected statutory output. The full required case list lives in `nigeria-statutory-compliance.md` §12: every PAYE band boundary, rent-relief cap edges, zero-rent, sub-threshold income, mid-year pay change, TIN-missing gate, per-scheme base correctness, employer-vs-employee split, multi-state reconciliation.
- **Unit** (Vitest) — rule resolution, money math, per-scheme calculators.
- **Integration** — full pay run against a seeded DB with RLS enforced; verify per-tenant isolation and per-role access.
- **E2E** (Playwright) — run payroll, generate payslips, employee self-service, approval workflows, admin flows.
- **Contract** — API routes and bank disbursement file formats.
- **Property tests** — sum of band tax ≤ chargeable income; net ≤ gross; no negative deductions; employer costs absent from employee totals.
- MSW for external boundaries in component tests.

**CI must fail if golden tests fail.** Never ship a green build with a broken calculation.

## 8. CI/CD

GitHub Actions, per PR and on merge:

1. Install + cache (pnpm)
2. Typecheck (`tsc --noEmit`, strict)
3. Lint
4. Unit + golden + integration tests (fail-closed)
5. Build
6. **Migration check** — assert migrations apply cleanly to a fresh DB before any deploy
7. Preview deploy (Vercel) on PR; promote to staging/prod on merge with a manual approval gate for production

## 9. Hosting & deployment

- **Web:** Vercel (Next.js).
- **Workers / batch payroll / filings / report generation:** Python service on Railway.
- **Data:** Supabase, exclusively — Postgres, Auth, RLS, Storage and Realtime. No alternative or secondary database.
- **VPS-style jobs:** DigitalOcean droplet (~2vCPU/4GB) where long-running workloads are cheaper than serverless.
- Bank disbursement file generation and statutory filing jobs run on the worker tier, never in request handlers.

## 10. Observability & operations

- Structured, audit-grade logs on the worker tier for every pay run and every remittance/filing attempt.
- Track: run status, per-scheme liability computed, filing/remittance status, retries, failures, rule version used.
- **Deadline alerting is a product requirement, not just ops** — monthly PAYE (10th), pension (7 working days from payment), NHF (1 month), NSITF (16th), WHT (21st), ITF (1 April annually). A missed NSITF month carries a 10% penalty.
- Dashboards surface statutory liabilities and filing status by entity, state, and country.

## 11. Security & data protection

Payroll means employee PII, salary, bank details and tax IDs. Treat as high-sensitivity throughout.

- RLS + org-scoping on every tenant table; least-privilege DB roles; no broad admin in application connections.
- **MFA required for Admin and Payroll Manager roles** (product requirement per `product-and-ia.md` §2).
- Encrypt sensitive columns at rest where warranted; TLS everywhere; secrets never in the repo.
- Full audit trail per pay cycle — who ran what, which rule version, what changed. This is simultaneously a compliance control and a product feature.
- NDPR (Nigeria Data Protection) awareness for personal data; document retention and data-residency posture.
- Backups + **tested** restore. Losing a payroll DB is existential. Point-in-time recovery on the Postgres tier.
- Access to production payroll data is logged and restricted.

## 12. Release & change management

- **Statutory change = new versioned rule set + migration + golden-test update**, shipped as a discrete, reviewable release. Never a hotfix number-edit.
- Tag releases; keep a changelog noting any `rule_version` change and its effective date.
- The `.claude/skills/` pause/resume protocol is committed in-repo so sessions can hand off state — keep it current.

## 13. Build roadmap (phased)

1. **Foundation** — monorepo app shell, auth, org/tenant model, RLS via `core`, `.env.example`, CI skeleton with migration check, design tokens wired into Tailwind.
2. **Compliance engine** — `packages/compliance` with `NG-2026.1`; PAYE + all seven schemes; golden test suite green before any UI work depends on it.
3. **Payroll core** — employees, real pay components, multi-frequency runs, payslips with the stored derivation trail, `ledger`-backed postings, cumulative PAYE, TIN gating.
4. **People ops + self-service** — leave, attendance, loans, expenses, benefits, employee and manager portals.
5. **Filing & remittance** — state-of-residence routing, filing schedules, remittance tracking, disbursement files, deadline alerting, dashboards.
6. **Final settlement + simulation** — exit payroll, what-if analysis.
7. **Pan-African** — abstract the rule layer so a second country is a rule set, not a rewrite; add Ghana, then Kenya.
