# Plutus — HR Modules Specification

The HR side of the platform, specified to the same depth as payroll. Read this when building any HR screen, modelling HR data, or deciding how far to take an HR module.

## The organising principle

Plutus is not a horizontal HRMS with payroll attached. **HR modules earn their place by feeding payroll**, and that determines both priority and depth. A module that produces a payroll input gets built properly; a module that doesn't gets deferred or omitted, regardless of how standard it looks on a competitor's feature grid.

This gives four tiers, which is the structure of this file:

| Tier | Relationship to payroll | Treatment |
|---|---|---|
| **1 · Foundation data** | Payroll reads it directly | Build first — payroll cannot run without it |
| **2 · Payroll-feeding processes** | Produces earnings or deductions | Build properly, with calculation tested |
| **3 · Surrounding processes** | Wraps payroll operationally | Build pragmatically |
| **4 · Deferred** | No payroll linkage | Not now — see `feature-backlog.md` §4 |

---

## ⚠ Statutory HR rules belong in the rules engine

**The single most important point in this file.** The compliance engine currently versions *tax* rules. But Nigerian employment law is equally statutory and equally load-bearing on payroll:

- **Leave entitlement minimums** — annual, sick, maternity — set by the Labour Act.
- **Notice periods**, which scale with length of service and drive terminal pay.
- **Terminal benefits** — gratuity, severance, end-of-service treatment.
- **Working hours and overtime** provisions.
- **Public holidays**, which are federally declared and change year to year.

These are exactly as prone to silent drift as tax bands, and they flow straight into money: leave encashment, maternity pay, notice pay and final settlement are all payroll outputs. **Treat them the same way** — effective-dated, versioned in `packages/compliance`, sourced, never hardcoded, covered by golden tests.

Apply the skill's standing guardrail without exception: **do not invent or approximate a Labour Act figure.** Entitlement days, notice periods and maternity duration must be resolved from the Act or a current authoritative source and recorded with that source before any calculation depends on them. A leave balance that's wrong by two days is a real underpayment on encashment.

Extend `RuleVersion` accordingly — a `labour` block alongside `paye`, `pension` and the rest, rather than a separate parallel mechanism.

---

## Tier 1 · Foundation data

Payroll reads these directly. Covered in the domain model in `engineering-and-lifecycle.md` §6; this is the product-surface view.

### Organisation structure

- **Departments / cost centres** — pay-run scoping already offers "single department"; payroll accounting needs cost-centre allocation.
- **Branches / locations** — statutory filing is state-scoped, so locations are records, not free text. A location carries its state, which drives PAYE routing defaults.
- **Job positions, grades, levels** — anchor salary bands and later compensation review.
- **Reporting hierarchy / org chart** — determines approval routing and manager self-service scope. Model the manager relationship on the employee record; derive the chart rather than storing it separately.
- **Multi-entity** — a group operating several registered companies needs each with its own RC number, TIN and filing obligations. Decide early whether an org is one company or a group; retrofitting is painful.

### Employee master data

Full field list in the domain model. The HR-surface requirements:

- Directory with search and filter by department, location, status, and TIN validity.
- Profile view segmented into identity / contact / statutory / employment / pay, with **field-level permissions** — an HR Manager may see the record without seeing compensation.
- Change history on every field, since salary and statutory changes are audit-relevant.
- Bulk import for onboarding an employer's existing workforce. This is the single most important adoption feature in the product — a 300-employee company will not hand-key its staff. Support CSV with validation, a preview diff, and per-row error reporting rather than all-or-nothing failure.

### Employee lifecycle

Model as **explicit states with audited transitions**, not loose booleans:

```
Applicant → Offer → Onboarding → Probation → Confirmed
   → (Transfer | Promotion | Salary change | Suspension | Unpaid leave)
   → Notice → Exited → Final settlement → Offboarded
```

Payroll consequences of state, which is why this matters more here than in a generic HRMS:

| State | Payroll behaviour |
|---|---|
| Onboarding (pre-start) | Excluded from runs |
| Probation | Included; entitlements may differ |
| Confirmed | Normal |
| Suspended | Configurable — with or without pay |
| Unpaid leave | Included at zero or prorated; statutory treatment still applies |
| Notice | Included; final period prorated to last working day |
| Exited | Excluded from regular runs; eligible for final settlement only |

Transfers between departments or locations mid-period affect cost-centre allocation and, if the location's state differs, PAYE routing. Both need effective dates, not just a current value.

---

## Tier 2 · Payroll-feeding processes

These generate earnings or deductions. Each needs its calculation tested to the same standard as tax.

### Leave management

**Payroll linkage:** unpaid leave deductions, leave encashment on exit, maternity pay, leave liability accrual.

- **Leave types** — annual, sick, maternity, paternity, compassionate/bereavement, study, unpaid, plus employer-defined custom types. Each type carries: paid/unpaid, statutory or discretionary, accrual method, carry-forward rule, encashable or not, and whether it counts toward pensionable pay.
- **Entitlement and accrual** — annual entitlement, accrual basis (monthly accrual vs annual grant), pro-rata entitlement for mid-year joiners and leavers, and carry-forward with an expiry rule.
- **Balance and liability** — current balance per type, and an org-level **leave liability** figure, since accrued untaken leave is a real balance-sheet obligation and a genuine finance-team need.
- **Application and approval** — request, multi-level approval, cancellation, half-day and (optionally) hourly granularity, blackout periods.
- **Calendars** — public holidays (federal, and state-level where applicable) and weekend definitions, because leave duration is counted in working days.
- **Encashment** — leave payout on exit or by policy. This is a payroll earning with tax treatment, so it belongs in the compliance engine, not in the leave module's own arithmetic.

Statutory minimums per the warning above: entitlement, sick leave and maternity duration are Labour Act matters. Source them; don't default them.

### Time and attendance

**Payroll linkage:** absence deductions, late deductions, overtime earnings.

- Capture: web and mobile clock-in/out, plus manual entry and bulk upload for employers without devices. Biometric/RFID/facial recognition is explicitly **not** built (see `feature-backlog.md` §5) — integrate with an employer's existing devices via import if demanded.
- Attendance policies: working hours, grace periods, break handling, flexible and remote arrangements.
- Exception handling: late arrival, early departure, missing punch, regularisation requests with approval.
- **Overtime** — rate multipliers, approval before payment, and inclusion in the PAYE base. Overtime is taxable and is excluded from the NSITF base; the two treatments differ, which is exactly the sort of conflation the compliance engine exists to prevent.
- Deduction rules must be explicit and configurable per employer: what converts an absence into a deduction, and at what rate.

### Compensation management

**Payroll linkage:** it *is* the pay components payroll reads.

- Salary structures, bands and pay grades tied to job position.
- **Effective-dated salary history** — every change carries an effective date, reason, and approver. Payroll reads the rate in force for the period, which is what makes mid-period changes and retroactive pay tractable.
- Increments, merit increases, promotions, adjustments — all as new effective-dated records, never edits.
- Total compensation statement per employee: gross, employer pension, employer statutory costs, benefits value. Good for retention conversations and a natural upsell surface.

### Benefits administration

**Payroll linkage:** employee deductions and employer costs.

- Plan catalogue with employer/employee cost split, eligibility rules, and enrolment windows.
- **Dependents** — required for health scheme enrolment and cost calculation.
- Enrolment, changes, renewal; claims tracking where the scheme requires it.
- Each plan declares its payroll treatment: pre-tax or post-tax, taxable benefit-in-kind or not. Benefits-in-kind are taxable under the Nigeria Tax Act, so this flag is a compliance decision, not a display preference.

### Loans, advances and expenses

Already in the product; the depth that's missing:

- **Loans** — eligibility rules, interest calculation, repayment schedule and installment derivation, early repayment, restructuring, balance tracking, and clearance at exit.
- **Deduction ordering** — the priority rule when net pay would go negative. Statutory deductions cannot be skipped, so loan recovery must yield. Decide and document the order explicitly (this is also flagged in `feature-backlog.md` §1).
- **Expenses** — categories, policy limits, receipt upload, multi-level approval, and the choice per claim of payroll reimbursement vs direct bank payment. Reimbursements are generally non-taxable; that classification must be explicit per category.

---

## Tier 3 · Surrounding processes

Operationally necessary; build pragmatically rather than exhaustively.

### Onboarding

Currently one form. Real onboarding is a tracked checklist: preboarding, document collection, contract issue and signature, statutory registration (TIN, PFA/RSA PIN, NHF), bank details capture, photo, system access provisioning, orientation, and probation tracking through to confirmation.

The statutory registration steps deserve emphasis — **TIN gating already blocks payroll**, so onboarding is where that gate is satisfied. An onboarding flow that doesn't chase TIN, PFA and bank details is producing employees payroll can't process.

### Offboarding

Resignation or termination, notice period tracking, last working day, exit checklist, asset return, **access revocation**, clearance, and handoff into final settlement. Access revocation matters disproportionately: an offboarded employee retaining a payroll login is a security incident, and it should be automatic on the Exited transition rather than a checklist item someone forgets.

Also triggers the photo/document retention deletion noted in the engineering reference.

### Documents and e-signature

Employment contracts, offer letters, salary certificates, experience and relieving letters, warning and termination letters, tax documents. Template-driven generation, versioning, expiry tracking with alerts (contracts, and for GCC scope, permits), access control, and audit trail.

Salary certificates and employment letters are the highest-frequency HR request in Nigerian practice; templated self-service generation removes a recurring HR burden cheaply.

### Workflow and approval engine

Build **once, configurable**, rather than per-module. Single and multi-level, sequential and parallel, conditional on amount or type, role- or department-based routing, delegation, escalation, reminders, SLA tracking, and a full approval history.

Covers: leave, overtime, expenses, loans, salary changes, promotions, transfers, terminations, employee data changes, and payroll approval itself. Eight modules needing approvals is the argument for doing this early — retrofitting a workflow engine across existing features is materially harder than starting with one.

### Self-service

- **Employee** — profile view and permitted edits, payslip history and download, tax documents, leave request and balance, attendance, expense claims, loan requests and balance, benefits and enrolment, policy acknowledgement, and HR requests.
- **Manager** — team roster, team attendance and leave calendar, approvals queue, team payroll summary (subject to field-level masking), and team analytics.

Self-service is the main lever on support cost per client, which matters directly to a per-employee-per-month model.

### Policies

Policy repository with versioning, publishing, employee acknowledgement and acknowledgement tracking. Cheap to build, and it's the artefact an auditor asks for.

---

## Tier 4 · Deferred

No payroll linkage. Recruitment/ATS · performance management · learning and development · talent and succession · engagement and surveys · employee relations and disciplinary cases · health and safety · asset management · travel · HR service desk · shift and roster management · project timesheets.

Each is a product in its own right. Building any shallowly makes Plutus look like a thin horizontal HRMS rather than the most correct payroll engine in Nigeria — a much weaker position. Revisit when compliance depth is unambiguous and there's revenue. See `feature-backlog.md` §4 and §5.

---

## HR reporting

Reports that follow from Tier 1–3 data and are genuinely asked for:

- **Workforce** — employee master, headcount by department/location/type, new hires, exits, turnover and attrition rate, demographics, tenure.
- **Leave** — balances, utilisation, history, and **leave liability** (the one finance actually needs).
- **Attendance** — daily and monthly summaries, late arrivals, absence, overtime, exceptions.
- **Compliance-adjacent** — TIN validity coverage, contract expiry, probation due, missing statutory registrations, missing bank details. These are the HR reports that protect payroll, and they're the ones a compliance-native product should lead with rather than bury.

Export to CSV/PDF; scheduled delivery where useful. Keep report definitions server-side so they respect RLS and field-level masking — a report is a common route around access control if generated client-side.
