# Plutus — Product, Information Architecture & Messaging

Reference for what Plutus contains, how it is organised, who sees what, and how it is described. Read this when building screens, planning scope, or writing any Plutus deliverable (investor brief, deck, one-pager, landing page, feature copy, GTM plan).

## Table of contents
1. Screen inventory (the 20 views)
2. Roles and access control
3. Setup & onboarding — the three forms
4. Screen-level detail worth preserving
5. The 27-module feature map
6. Integrations
7. Brand voice
8. Investor brief structure
9. Problem framings
10. Business model & moat

---

## 1. Screen inventory (the 20 views)

Each view has a defined title and subtitle. Keep these exact — they are the product's own description of itself.

| id | Nav label | Title | Subtitle |
|---|---|---|---|
| `setup` | Setup & Onboarding | Setup & Onboarding | The forms that configure the compliance engine before any of this demo runs |
| `overview` | Overview | Overview | Workforce, payroll and compliance at a glance |
| `payroll` | Payroll Runs | Payroll Runs | Multi-frequency runs with full audit trail |
| `compliance` | Compliance Engine | Compliance Engine | PAYE, pension, NHF, NHIS, NSITF, ITF & WHT — versioned and current |
| `employees` | Employees | Employees | Directory, TIN status and self-service |
| `leave` | Leave & Attendance | Leave & Attendance | Policies, balances and approvals tied to payroll |
| `reports` | Reports | Reports | Statutory liabilities and audit-ready records by state |
| `loans` | Loans & Advances | Loans & Advances | Requests, repayment schedules and payroll deductions |
| `expenses` | Expenses | Expense Reimbursement | Claims, approvals and taxable/non-taxable handling |
| `benefits` | Benefits | Benefits Administration | Plan enrollment and employer cost per employee |
| `settlement` | Final Settlement | Final Settlement | Exit payroll — gratuity, leave payout and loan clearance |
| `integrations` | Integrations | Integrations | Bank disbursement, accounting sync and open APIs |
| `multicountry` | Multi-Country | Multi-Country Payroll | One core, a new statutory rule set per market |
| `attendance` | Attendance | Attendance | Weekly attendance feeding straight into payroll deductions |
| `manager` | Manager View | Manager Self-Service | Team overview and approvals in one place |
| `notifications` | Notifications | Notifications | System events as they happen across the platform |
| `security` | Security & Access | Security & Access | Role-based access, MFA and audit logs |
| `calculator` | PAYE Calculator | PAYE Calculator | Every figure shown step by step, the way the engine derives it |
| `simulation` | Payroll Simulation | Payroll Simulation | What-if analysis across the whole workforce |
| `featuremap` | Full Feature Map | Full Feature Map | Every payroll & HR capability this platform is built to cover |

Plus **auth screens**: sign-in ("Sign in to your compliance-native payroll workspace") and sign-up ("Set up Plutus for your company in a couple of minutes").

## 2. Roles and access control

Four roles: **Admin (Super User)**, **Payroll Manager**, **HR Manager**, **Employee**.

| Role | Permissions | Nav access |
|---|---|---|
| Admin | Company setup · All payroll runs · All employees · Reports · Integrations & security | All 20 views |
| Payroll Manager | Create/process runs · View employees · Compliance & reports | overview, payroll, compliance, reports, loans, expenses, settlement, calculator, simulation, notifications |
| HR Manager | Employees & onboarding · Leave & attendance · Benefits | overview, setup, employees, attendance, leave, manager, benefits, notifications |
| Employee | Self-service payslips · Leave requests · Expense claims | Dedicated self-service dashboard only |

The Employee role does not get a filtered admin nav — it gets a distinct self-service surface showing leave balance, TIN status, pension PFA, latest payslip breakdown (gross / PAYE / pension / NHF / net), leave requests, expense claims, loans, and benefits.

**MFA is required for all Admin and Payroll Manager roles.** This is stated as a product requirement, not a setting.

Role separation must be enforced server-side via RLS, not just by hiding nav items. The nav filter is presentation; the security boundary is in the database.

## 3. Setup & onboarding — the three forms

These are the inputs that configure everything else. Getting them right is what makes the compliance engine correct downstream.

**1 · Company & statutory registration** — company name, RC number, company TIN, default pay frequency (monthly / bi-weekly / weekly), default pension PFA, states of operation. Drives which state filing schedules and default PFA appear across the platform.

**2 · Add employee** — full name, role/title, state of residence, annual basic, annual housing, annual transport, TIN, pension PFA, **employee photo**. Every field here feeds TIN gating, PAYE, pension and NHF for that employee. Note the three separate pay components — this is where production replaces the demo's 50/30/20 assumption.

### Employee photo capture (enrollment requirement)

**The photo is uploaded at enrollment, in this form** — not bolted on later through a separate profile-editing flow. Capturing it at the point of onboarding is what makes the HR dashboard, directory and approval queues legible; a directory of initials-only placeholders is the failure state this requirement exists to prevent.

Behaviour:

- Upload sits in the Add-employee form with immediate preview and re-crop before save. Accept drag-drop, file picker, and camera capture on mobile — HR often onboards from a phone.
- Square crop, centred on the face, stored at a single canonical size (512×512 is ample) plus a small thumbnail for tables and avatars.
- **A missing photo must never block a payroll run.** This is the important constraint. TIN is a hard gate because the law requires it; a photo is not. Model the photo as optional-but-prompted: HR sees an outstanding-photo count and can chase it, but a pay run proceeds regardless. Conflating the two gates would mean a missing headshot stops people getting paid, which is an absurd failure mode and exactly the kind of thing that gets built by accident when both are "onboarding completeness" fields.
- **Initials fallback** wherever a photo is absent — the prototype already establishes this pattern with the `FN` monogram in the header. The fallback is permanent, not a loading state; some employees will decline and that must remain workable.
- Employees can replace their own photo from self-service; HR can replace anyone's. Both actions are audit-logged.

Where photos surface: employee directory rows, the self-service preview panel, leave and expense approval queues (a manager approving a request should see who), the manager team view, attendance grid rows, and the signed-in user chip in the header.

**3 · Create pay run** — pay period, frequency (monthly regular / bonus / 13th month / arrears / off-cycle), employee scope (all employees / single department / contractors for WHT). Opens a run against every registered employee; the compliance engine applies statutory rules once processed.

## 4. Screen-level detail worth preserving

**Compliance Engine** — displays the seven schemes as a table of name, base, rate, authority, deadline, alongside the PAYE band table and a TIN registration gating panel that lists unregistered workers by name and state.

**Payroll Runs** — run list with period, employee count, gross, net, status. Selecting a run expands a per-employee payslip table (gross, PAYE, pension 8%, NHF 2.5%, net) with a "· how?" expander per employee that shows the full derivation: component split → statutory deductions → chargeable income → band-by-band PAYE → monthly figure. **That expander is the product's core demonstration** — the claim "correct by construction" is only credible because the arithmetic is visible. Preserve it.

**Reports** — statutory liability by state with per-state filing status against each state IRS, plus a full audit trail.

**PAYE Calculator** — standalone, takes annual gross and annual rent, shows the four-step derivation. Carries the explicit caveat that the 50/30/20 split is an assumption and production reads real components.

**Payroll Simulation** — org-wide raise slider showing before/after annual gross payroll, annual org PAYE, and employer pension at 10%. The point is showing statutory cost impact *before* committing.

**Final Settlement** — exit payroll: unused leave payout + gratuity (service-based) − outstanding loan clearance → final settlement payslip.

**Multi-Country** — Nigeria live; Ghana Q1 2027 (PAYE · SSNIT · Tier 2/3); Kenya Q3 2027 (PAYE · NSSF · SHIF). Framing line: *"Nigeria is the proving ground, not the ceiling."*

**Attendance** — weekly grid cycling Present → Late → Absent, explicitly tied to payroll deductions.

## 5. The 27-module feature map

The `featuremap` view enumerates every capability the platform is scoped to cover, grouped into 27 modules. Module names, in order:

Employee Management · Payroll Setup · Salary Structure · Earnings Management · Deductions · Attendance Integration · Leave Management · Overtime Management · Loans & Advances · Tax Management · Benefits Administration · Payroll Processing · Payslips · Direct Deposit & Payments · Expense Reimbursement · Compliance · Employee Self-Service · Manager Self-Service · Reporting & Analytics · Accounting Integration · Workflow & Approvals · Notifications · Security · Multi-Company & Global Payroll · Integrations · Final Settlement · Advanced Features

Roughly 230 individual line items across the 27. The view distinguishes "Live in this demo" from "Roadmap" — **note that the prototype currently flags all 27 as live, which overstates what is explorable.** Before showing this to an investor or client, set the flags honestly; an inflated feature map is the fastest way to lose credibility with a finance buyer who will click into things.

## 6. Integrations

**Bank disbursement** — bulk net-pay files generated automatically once a run is approved. Prototype shows GTBank and Access Bank connected, Zenith not connected.

**Accounting / ERP sync** — payroll journal entries posted after every processed run. QuickBooks and Sage connected, SAP via open API.

**Open APIs & webhooks** — keyed by scope: HRIS sync (employees, read/write), finance webhook (payroll runs, read-only), data warehouse export (compliance & reports, read-only).

All named vendors and connection states are demo fixtures. Real integration status must never be implied from them.

## 7. Brand voice

Confident, precise, institutional — a compliance firm's voice, not a startup's. Leans on inevitability and rigour rather than hype. The visual system (see `design-system.md`) does the same work: flat, dense, bordered, unshowy.

Signature phrasings to stay consistent with:

- "The compliance-native payroll platform for Nigeria and Africa."
- "Payroll should be **correct by construction**."
- "Compliance as the **core feature, not an afterthought** bolted onto generic payroll software."
- "Plutus turns that risk into a product."
- "Nigeria is the **proving ground, not the ceiling**."
- "Correct on day one, current for every reform that follows."
- "Each new country adds a statutory rule set, not a new platform."

Rules: cite the statutory framework precisely — it *is* the credibility. Never overclaim into tax or legal advice. Keep every number sourced from the statutory reference. Don't ship placeholder links. Don't describe roadmap capability in the present tense.

## 8. Investor brief structure

Canonical section order:

1. **Executive Summary** — the 2026 reform reset the landscape; Plutus is built on the new framework; raising to go Nigeria-first → West/East Africa.
2. **The Opportunity** — reform raised the *cost of getting it wrong*; payroll software becomes a compliance necessity, not a convenience.
3. **The Problem** — statutory complexity; a moving target; state-level fragmentation; multi-country ambition vs single-country tools.
4. **The Product** — three pillars (Payroll Core, Compliance Engine, People Operations).
5. **Nigeria Tax & Statutory Compliance Engine** — the differentiator; walk the seven schemes.
6. **Full Feature Set** — the module map, honestly flagged.
7. **Pan-African Expansion** — Ghana then Kenya; rules-layer-over-common-core argument.
8. **Business Model** — per-employee-per-month SaaS, tiered.
9. **The Ask** — three priorities over 18 months.
10. **Why Now, Why Us** — the reform is a rare market-wide trigger event; narrow window to become the default.

Footer treatment: "Plutus Technologies — Investor Brief — Confidential — [Month Year]".

**The Ask — three priorities (18 months):**

1. **Compliance depth** — complete state-by-state PAYE filing integrations; formalise direct remittance partnerships with PenCom-licensed PFAs, FMBN, NSITF, ITF.
2. **Go-to-market** — Lagos-based sales + customer success team to convert mid-market/enterprise off spreadsheets and legacy bureaus.
3. **Pan-African expansion** — stand up Ghana + Kenya statutory rule sets; launch with anchor multinational clients in both markets.

Funding amount, use-of-funds, and projections live in the data room — "available on request".

## 9. Problem framings

- **Statutory complexity** — seven distinct schemes, each with its own base, rate, remittance authority and deadline.
- **A moving target** — 2026 rewrote PAYE bands, replaced CRA with capped rent relief, made TIN mandatory; most tools haven't caught up.
- **State-level fragmentation** — 36 states + FCT each administer PAYE locally; multi-state workforces mean reconciling with multiple authorities every cycle.
- **Multi-country ambition, single-country tools** — expanding employers re-implement compliance from scratch per market, with no unified system of record.

## 10. Business model & moat

- **Pricing:** per-employee-per-month SaaS, tiered by feature depth (core payroll + compliance vs. full HR suite with self-service + multi-country).
- **Wedge:** compliance — the reason a finance leader can't afford spreadsheet payroll in 2026.
- **Moat:** encoded rules, once current, compound in value with every regulatory change absorbed on the client's behalf.
- **Why now:** the 2026 reform is the largest rewrite of Nigerian payroll compliance in a generation, forcing every employer to re-implement tax logic at the same moment — a rare, market-wide trigger event and a narrow window for a compliance-native product to become the default before employers standardise on the wrong tool.
