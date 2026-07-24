# Plutus — Feature Backlog & Scope Discipline

Derived from two comprehensive HRMS/payroll feature taxonomies (July 2026), **triaged against the Plutus thesis rather than adopted wholesale.**

## How to use this file

Those source taxonomies describe a *horizontal* enterprise HRMS — roughly 800 line items spanning ATS, LMS, talent management, health and safety, asset tracking, travel booking and more. Plutus's entire moat is the opposite shape: **vertical depth in Nigerian statutory compliance.** A finance buyer chooses Plutus because its PAYE is provably correct under the 2026 Act, not because it also books flights.

So this file is a **triaged backlog, not a roadmap commitment.** Read it when scoping, prioritising, or deciding whether an incoming feature request belongs in the product. The `Not doing` section is as load-bearing as the rest — scope discipline is the strategy here, and a pre-revenue product that scopes 38 modules ships none of them.

**Standing rule:** nothing in this file outranks phase 1 in the build roadmap. The compliance engine and its golden tests come first regardless of how compelling anything below looks.

## Table of contents
1. Correctness gaps — highest priority
2. Genuine platform gaps
3. Deepens the existing moat
4. Adjacent, deferred
5. Not doing
6. Open strategic questions

---

## 1. Correctness gaps — highest priority

These are places where the current engine spec is **incomplete in ways that produce wrong money**. They outrank every feature in this document and belong in phases 1–3. Each needs golden tests alongside the cases in `nigeria-statutory-compliance.md` §12.

### Proration

Not currently specified anywhere, and it applies to a large share of real pay runs:

- **New hire mid-period** — partial month from start date. **Built.**
- **Termination mid-period** — partial month to last working day. **Built:** Final Settlement now pays prorated regular basic/housing/transport for the days between the employee's last regular pay run and their last working day (sourced from the auto-logged status-change history), pensionable and NHF-able like ordinary pay, combined into one cumulative-PAYE calculation together with leave payout and gratuity — previously a silent gap where a terminated employee was never paid for days worked in their unfinished final period. Rent relief is not re-prorated for that stub period (disclosed simplification).
- **Mid-month salary change** — split period across two rates. Still not built — needs an effective-dated compensation history model, a larger data-model change than the other three.
- **Unpaid leave and absence** — partial-period deduction. **Built.**

Proration interacts directly with **cumulative PAYE**: a prorated month changes year-to-date chargeable income, which changes the marginal band the next month falls into. Getting proration right but recomputing cumulatively wrong (or vice versa) produces plausible-looking payslips that are wrong by material amounts. Decide and document the proration basis — calendar days, working days, or a 30-day convention — because the three give different answers and the choice must be consistent across the engine.

### Net-to-gross (gross-up)

Currently the engine only computes gross → net. Gross-up is common in Nigerian senior and expatriate contracts where the employer bears the tax. It requires **iterative solving**, because PAYE is progressive: the tax depends on gross, and gross depends on the tax. Implement as a converging solve with an explicit tolerance and iteration cap, and test it at band boundaries where a small gross change crosses a rate step.

### Retroactive pay and the rule-version question

**This is a genuinely open question and must not be guessed at.** If arrears are paid in July 2026 for work performed in December 2025 — under the previous Personal Income Tax Act regime — which rule version applies?

- Taxed in the **period of receipt** (current rules), or
- Attributed to the **period earned** (the rules then in force)?

The answer determines whether `RuleVersion` pinning is per-run or per-earning-period, which is a foundational data-model decision that is expensive to reverse. **Resolve with a Nigerian tax professional before building retroactive pay**, and record the answer with its source in the statutory reference.

### Payroll reversal and correction

The skill establishes payslips and audit events as append-only, but doesn't specify what happens when a finalised run is wrong:

- Reversal of a finalised run — and what that does to **already-remitted** statutory liabilities.
- Correcting-entry mechanics through `packages/ledger` (never an edit in place).
- Whether a reversal after a filing deadline requires an amended filing, per scheme.

This is the hardest correctness area in payroll and the most likely to be discovered in production. Specify it before it's needed.

### Payroll locking and finalisation

Missing from the state model: `draft → preview → validated → approved → locked → paid`. Once locked, a run must be immutable and its rule version frozen. Reopening must be an explicit, audited action, not an edit.

### Other calculation scenarios needing golden tests

- Leave encashment and its tax treatment. **Built:** cashing out unused annual leave for money while still employed (distinct from Final Settlement's termination-only leave payout). Taxable, non-pensionable, same daily-rate convention as unpaid leave/overtime/new-hire proration, combined into the run's single cumulative-PAYE calculation (never a separate call). Approval atomically checks and decrements the employee's current balance in one security-definer function (`review_leave_encashment_request`) — an over-request is rejected and rolled back cleanly, never partially applied.
- 13th month / bonus interaction with cumulative PAYE (a bonus can push the year into a higher band).
- Termination payments: gratuity is taxable under the new Act; severance treatment.
- Overtime and shift premiums entering the PAYE base.
- Loan deduction ordering against statutory deductions when net pay would go negative — **decide the priority order explicitly**, since statutory deductions cannot be skipped. **Closed:** the priority is statutory (never skipped) → loans (already capped against remaining net) → benefits (previously unenforced — a benefit enrollment's employee cost is now skipped in its entirety, earliest-enrolled first, if it can't be fully covered by what loans left behind, rather than partially charged). `payslips.net_kobo >= 0` is now also a database check constraint, not just an application-level invariant.

## 2. Genuine platform gaps

Real absences from the current spec, in rough priority order.

### HR core — the part that blocks payroll

Plutus is described as an HR *and* payroll platform, but the HR side is currently thin, and the thinness is not evenly distributed. Some of it is legitimately deferred product surface. Some of it is **data payroll cannot run without**, which makes it phase-2/3 work rather than a later HR module.

**Blocking — build before or alongside payroll runs:**

| Missing | Why payroll breaks without it |
|---|---|
| **Bank account details** | Disbursement files are a documented feature, but nothing in the model holds bank, NUBAN or account name. You cannot pay anyone. This is the sharpest hole. |
| **Departments / cost centres** | Pay-run scoping already offers "single department", and payroll accounting needs cost-centre allocation. Both reference an entity that doesn't exist. |
| ~~**Branches / locations**~~ | Statutory filing is state-scoped; multi-state employers need locations as records, not free text. **Built:** an org-scoped `branches` catalog (name, state, address), employees optionally assigned to one, with directory search/filter. The `state` field is a work-location record only — it does not drive PAYE routing, which stays keyed off each employee's own `state_of_residence`, per this same table's note that residence/origin/work location are three different things. |
| **Employment type + dates** | Proration needs date of joining and last working day. Contract vs permanent changes statutory treatment. |
| **Employee master data** | DOB (pension eligibility), nationality (expatriate treatment), and state of residence vs state of origin vs work location — three different things, and PAYE routes on residence. |
| **Lifecycle state** | Active / probation / suspended / on unpaid leave / exited determines whether an employee is included in a run at all, and how they're prorated. |

**Near-blocking — needed for the product to be usable, not for the arithmetic to be correct:**

~~Employment contracts and contract-expiry alerting~~ **(built: employment_type — permanent/contract/intern, descriptive only, not wired into PAYE/pension/NHF, since contract-vs-permanent statutory treatment is a genuinely open question — plus contract_end_date, surfaced as an Expired/Ends soon/Active contract badge in the employee directory; "alerting" here is a badge checked on page load, not a scheduled push notification, since this app has no background job runner to fire one)** · employee documents repository · ~~probation tracking and confirmation~~ **(built: probation_end_date + a confirmed flag, surfaced as an Overdue/Ends soon/On probation badge in the employee directory; deliberately not wired into payroll math — Nigerian law doesn't condition PAYE/pension/NHF on probation status)** · organisation chart and reporting hierarchy · job grades and salary bands · employee directory search and filtering · ~~company policies with acknowledgement~~ **(built: admin/HR-authored policy documents, org-wide read + per-employee `policy_acknowledgements`; editing a policy is a timestamp bump, not a versioned document history, which staleness-checks every prior acknowledgement and re-notifies every linked employee to re-acknowledge; status is computed on page load, not a scheduled reminder push, since this app has no background job runner)**.

**Legitimately deferred** — see §4. Recruitment/ATS, performance, learning, talent, engagement, employee relations, health and safety, assets, travel and HR service desk are all real HRMS modules, and none of them is needed for a correct payslip.

The distinction is worth holding onto when scoping. "HR" in the source taxonomies is one undifferentiated 20-module block; for Plutus it splits cleanly into *employee data payroll depends on* (urgent, small, unglamorous) and *HR process modules* (large, deferrable, each a product in its own right). Build the first, defer the second, and don't let the word "HR" blur them together.

### SaaS billing and metering — *the notable one*

The business model is **per-employee-per-month**, but no module meters employees, tracks subscriptions, enforces plan limits, or invoices. This is the gap that stops Plutus taking money. Needs: tenant/company registration and self-serve org onboarding, active-employee metering per billing period, subscription plans and tiers, feature flags for tiered gating, invoicing and payment, trial periods, upgrade/downgrade/cancellation.

Note the metering subtlety: "employees" for billing means *active in the period*, which must reconcile with — but is not identical to — the headcount a pay run processes. Define it precisely or every invoice is arguable.

One prerequisite is now in place: `employee_status_history` records every status transition (old value, new value, who changed it, when — auto-logged by a database trigger, never client-written), so a period's active headcount is finally reconstructable from real history rather than a mutable current-value field with no memory of when it changed. Metering itself — the actual per-period calculation, plans, invoicing, payment — is still entirely unbuilt; this only removes the specific data-model blocker the note above calls out.

### Field-level security and salary masking

Currently RLS isolates tenants and roles gate screens, but nothing masks salary within an authorised role. An HR Manager may legitimately need employee records without seeing executive compensation. Given how sensitive payroll is, field-level permissions and salary masking are closer to table stakes than to a premium feature.

### Workflow and approval engine

The prototype has approvals scattered per feature (leave, expenses, loans). A **configurable** engine — multi-level, sequential and parallel, conditional, role- and department-based, with delegation, escalation, reminders and SLA tracking — is a foundational architectural choice. Cheaper to build once early than to retrofit across eight modules later.

### Employee lifecycle as an explicit spine

The source taxonomy's lifecycle model is a genuinely useful organising frame the current spec lacks:

```
Applicant → Offer → Onboarding → Probation → Confirmed →
Transfer/Promotion → Salary change → Performance → Exit → Final settlement → Offboarding
```

Plutus currently covers the tail (final settlement) and part of the middle. Modelling lifecycle **state transitions** explicitly — rather than as loose flags on the employee record — makes proration, contract expiry, probation tracking and offboarding fall out naturally instead of being bolted on.

### Onboarding and offboarding process

Enrollment currently means one form. Real onboarding is a checklist with states: documentation, contract signing, probation tracking, confirmation. Offboarding likewise: notice period, exit checklist, asset return, ~~**access revocation**~~ **(built: the app layout gate reads the linked employee's `status` on every request — not a cached session claim — and redirects to `/account-revoked` the instant it's `terminated`, regardless of `org_membership` role. The page re-checks live on load too, so a reinstated employee isn't stuck behind a stale gate. This is the specific login-retention risk closed, not the surrounding checklist)**, clearance, final settlement, experience letter. Notice period, exit checklist, asset return, clearance and experience letter remain unbuilt.

### Notifications and alerting

Deadline alerting is already a stated product requirement, but there's no notification infrastructure to deliver it. Needs email, in-app, and scheduled reminders, covering statutory deadlines, contract and probation expiry, approvals pending, and payroll events.

### Payroll accounting depth

`packages/ledger` handles double-entry, but the spec doesn't cover cost-centre / department / branch / project allocation, accrued payroll, or payroll liability tracking. These are what make the accounting integration genuinely useful to a finance team rather than a raw journal dump.

### Document generation and e-signature

Salary certificates, employment letters, contracts, tax documents. High-frequency HR requests, and templated generation is cheap relative to the goodwill it buys.

## 3. Deepens the existing moat

Extensions of things Plutus already does, aligned with the compliance-native positioning.

- **Annual tax reconciliation and tax certificates** — year-end reconciliation, employee tax certificates, annual returns. The natural completion of the compliance engine, and a strong renewal hook.
- **Government filing portal integrations** — direct submission to state IRS portals, PenCom, FMBN. Deepens the moat considerably; also the hardest integration work.
- **Payroll variance and anomaly detection** — flag month-over-month anomalies before a run is approved. A natural fit for the "correct by construction" thesis: catching a fat-fingered salary before it's paid is worth more than reporting it after.
- **Payroll register and reconciliation reports** — standard finance-team expectations.
- **Bank account validation** — validate account/NUBAN details before disbursement rather than discovering failures in a returned batch.
- **Failed payment tracking and reconciliation** — currently disbursement files are generated but nothing tracks what actually settled.
- **Attendance → payroll deduction rules** — the prototype ties attendance to payroll visually; the deduction rules themselves need specifying.
- **Multi-currency** — required for the pan-African roadmap. `packages/ledger` already resolves exponent per currency; don't let NGN assumptions leak into the core.

## 4. Adjacent, deferred

Legitimate HRMS functionality that isn't the wedge. Revisit once compliance depth is unambiguous and there's revenue.

Recruitment/ATS · Performance management · Learning and development · Talent management and succession · Employee engagement and surveys · Employee relations and disciplinary cases · Health and safety · Asset management · Travel and business trips · HR service desk · Shift and roster management · Timesheets and project time tracking · Mobile app · AI assistant features.

Each is a product in its own right. Building any of them shallowly makes Plutus look like a thin Workday clone instead of the most correct payroll engine in Nigeria — which is a much worse position to compete from.

## 5. Not doing

Explicit rejections, recorded so they don't get re-litigated:

- **Biometric, RFID and facial-recognition attendance.** Hardware integration, a support burden, and unrelated to compliance. Integrate with existing devices later if a customer demands it; don't own the hardware problem.
- **Generic multi-country "tax engines" as a configuration surface.** Plutus's moat is *maintained, correct* rule sets, not a toolkit where customers configure their own tax rules. Configurable tax logic is how you sell inaccuracy as flexibility. Each country gets a curated rule set, authored and maintained by Plutus.
- **Schema-per-tenant multi-tenancy.** Already decided: Supabase with RLS row-level isolation. Don't reopen it.
- **Django / NestJS backends.** The source taxonomies suggest these. Plutus is Next.js + Supabase, and Django is rejected for three specific reasons, not by default:
  1. **It fights RLS.** Tenant isolation lives in Postgres policies keyed on `auth.uid()` from Supabase Auth. Django connects as one privileged user and expects to be the authority on permissions, so the path of least resistance moves the security boundary out of the database — the wrong direction when a leak means one employer seeing another's salaries.
  2. **It risks a second compliance engine.** `packages/compliance` is TypeScript. A Django backend either reimplements PAYE in Python — two implementations, drifting, golden tests covering one — or crosses a language boundary per payslip.
  3. **Its main advantage doesn't apply.** Django Admin's value is auto-generated back-office CRUD. Plutus's HR screens are customer-facing surfaces styled with the Ledger system; you would never ship Django Admin to a client. And pointed at customer data it bypasses the RLS doing tenant isolation, so the one feature that justifies Django is the one that breaks the security model.

  What replaces the real need: **Supabase Studio** for internal data inspection, `supabase gen types typescript` so the CRUD layer stays schema-synced rather than hand-written, and **shadcn/ui + react-hook-form + zod** for the form-heavy HR surface.

  **Still open, and a separate decision:** the stack lists a Python worker on Railway running "batch payroll runs" while the compliance engine is TypeScript — those cannot both be true without duplicating the engine. Resolve by running batch in a Node worker (cleanest, engine stays in one language), moving the engine to Python as a service, or dropping the Python tier until something genuinely needs it. Rejecting Django does not resolve this.
- **Corporate card integration, travel booking, flight/hotel APIs.** Far outside the wedge.

## 6. Open strategic questions

Flagging rather than resolving, since these are business decisions.

### Kuwait / GCC — the notable divergence

The original `business-platform` scope for Wagebook was **Nigeria + Kuwait/GCC** (PIFSS, indemnity, WPS). The Plutus prototype and investor brief drop Kuwait entirely for Nigeria → Ghana → Kenya. The uploaded taxonomy's **Visa, Work Permit & Government Documents** module is explicitly framed as GCC-critical — passport, visa, work permit, residence permit, Civil ID, expiry tracking, sponsor information, government reporting.

Whether that module matters depends on a decision that hasn't been recorded anywhere: **is Kuwait/GCC still in scope, or was it superseded by the pan-African thesis?** The two markets pull the product in different directions — GCC needs heavy visa/sponsorship document tracking and end-of-service indemnity; West/East Africa needs multi-state tax authority routing. Both are buildable, but not simultaneously at this stage, and the answer changes what phase 7 looks like.

Worth noting the pan-African story is also the stronger investor narrative, since it turns one reform into a repeatable rules-layer play. If Kuwait is being kept warm for personal or commercial reasons, that's legitimate — but record it as a decision rather than leaving two roadmaps in circulation.

### Others

- **Contractor/gig workforce depth.** WHT is handled, but full contractor management (onboarding, invoicing, 1099-equivalent reporting) is unscoped. Nigeria's gig economy makes this a plausible wedge extension.
- **Employee count sweet spot.** Whether Plutus targets SMEs (20–100 employees, self-serve, low touch) or mid-market/enterprise (500+, implementation-led) changes almost everything downstream — pricing, onboarding, integration depth, support model. The investor brief implies mid-market/enterprise; the product's self-serve setup flow implies SME.
- **Payroll bureau / accountant channel.** Nigerian SMEs often outsource payroll to accounting firms. A multi-client bureau view could be a faster distribution channel than direct sales — and would need explicit multi-org switching that the current single-org model doesn't have.
