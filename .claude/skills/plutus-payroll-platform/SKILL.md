---
name: plutus-payroll-platform
description: 'Product, domain, brand, design-system and engineering reference for Plutus Technologies — a compliance-native HR and payroll platform for Nigeria and Africa built on the Nigeria Tax Act framework effective 1 January 2026 (ships as the Wagebook app in the business-platform monorepo). Use for any Plutus work: the statutory compliance engine (PAYE, pension, NHF, NHIS, NSITF, ITF, WHT), modelling employees, pay runs, remittances, loans, benefits or final settlement, building any Plutus screen or applying its design tokens, investor and marketing content, the Ghana/Kenya roadmap, or the build itself (stack, migrations, RLS, testing, CI/CD). Trigger even without the word "Plutus" — Nigerian payroll tax bands, statutory deductions, the 2026 tax reform, TIN gating, cumulative PAYE or state-level PAYE filing all qualify. Supersedes the retired "GECA Advisory" branding. Always consult the statutory reference before writing calculation logic or quoting a rate — figures are versioned and must be sourced, never invented.'
---

# Plutus Technologies — Payroll Platform

Plutus Technologies is a cloud HR + payroll platform whose single organising idea is **payroll should be correct by construction**. Compliance is not a feature bolted onto generic payroll software — it *is* the product. The wedge is Nigeria's 2026 tax reform; the ambition is to become the payroll backbone for employers across West and East Africa.

Positioning line: *"The compliance-native payroll platform for Nigeria and Africa."*

## Naming — read this first

The product was previously branded **GECA Advisory**. That name is retired. Use **Plutus Technologies** in all new work, and treat any surviving GECA reference (older briefs, a `GC` monogram in an old export, a `geca-*` skill) as legacy to be migrated, not as a parallel brand.

Plutus ships as the **Wagebook** app inside Patrick's `business-platform` monorepo. Wagebook is the internal/codebase name; Plutus is the commercial brand. Keep them consistent — the statutory rules in this skill are the same rules Wagebook's engine implements. Do not spin up a parallel stack.

## When to reach for the reference files

- **Any calculation, rate, base, threshold, remittance authority, or deadline** → read `references/nigeria-statutory-compliance.md` **first**. Do not quote a number from memory; that file is the source of truth and is versioned.
- **Building or styling any Plutus screen** — colors, type, spacing, components, layout → read `references/design-system.md`. The system is authored in OKLCH with a specific flat, bordered, dense treatment that is easy to lose by accident.
- **Product scope, information architecture, roles, screen inventory, feature map, brand voice, investor/GTM content** → read `references/product-and-ia.md`.
- **Anything touching the build** — stack, repo structure, environments, migrations, testing, CI/CD, hosting, releases, security/DR → read `references/engineering-and-lifecycle.md`.

## The core thesis (why the product exists)

Nigeria's payroll compliance landscape changed fundamentally on **1 January 2026**. Four Acts signed June 2025 — the **Nigeria Tax Act (NTA)**, **Nigeria Tax Administration Act (NTAA)**, **Nigeria Revenue Service (Establishment) Act**, and **Joint Revenue Board (Establishment) Act** — replaced the Personal Income Tax Act and rewrote how employers calculate, withhold, and remit tax on every employee.

The reform did not simplify payroll — **it raised the cost of getting it wrong**. Employers now face:

- New progressive PAYE bands and a raised tax-free threshold.
- The Consolidated Relief Allowance abolished, replaced by a capped rent relief.
- **Mandatory Tax Identification Numbers** for every worker, by law.
- A digitally-enabled Nigeria Revenue Service (NRS) that cross-references payroll data against bank records, with expanded audit and penalty powers.

Most employers still run payroll on spreadsheets or on tools built for the old code. Plutus is built from the ground up on the new framework. That is the whole pitch: **correct on day one, current for every reform that follows.**

## Product architecture (three pillars)

1. **Payroll Core** — multi-frequency runs, itemised digital payslips, arrears, bonuses, 13th-month handling, and full audit trails, with cumulative recalculation whenever pay changes mid-year.
2. **Compliance Engine** — automatic PAYE, pension, NHF, NHIS, NSITF, ITF and withholding-tax calculation, filing, and remittance tracking. **This is the differentiator.** It is a *rules engine over a common payroll core*, so the rules change centrally as the law changes underneath.
3. **People Operations** — leave, attendance, loans and advances, expenses, benefits, final settlement, employee and manager self-service, in one system of record.

Full screen-by-screen inventory and the 27-module feature map live in `references/product-and-ia.md`.

## The single most important engineering principle

**The compliance engine is versioned; rules are data, not code.** Rates, reliefs, thresholds, and band edges live in a central, effective-dated rule set that updates the moment the NRS or a statutory agency issues new guidance — **no client-side spreadsheet edits, no hardcoded magic numbers scattered through the codebase.** When the law changes, one central version bump corrects every payslip going forward, and historical runs remain reproducible against the rules that were in force at the time.

A grep for statutory figures inside calculation code should return nothing. Changing the law means adding a rule version and a migration, never editing calculation logic.

This is also the commercial moat: *rules, once encoded and kept current, compound in value with every regulatory change absorbed on the client's behalf.*

## Non-negotiable compliance behaviours

These are product requirements, not nice-to-haves:

- **TIN gating.** Every employee must hold a valid Tax Identification Number. The engine flags unregistered workers **before** a payroll run, not after an audit. Do not let a run proceed silently for a TIN-less employee.
- **Cumulative PAYE.** PAYE is computed on cumulative annual chargeable income and re-derived whenever pay changes mid-year — not a naïve monthly slice.
- **State-of-residence mapping.** PAYE is collected by each state's Internal Revenue Service. Map every employee to their state of residence; generate state-specific filing schedules; consolidate remittance evidence across every state an employer operates in.
- **Right agency, right deadline.** Each statutory scheme has its own base, rate, remittance authority, and deadline. Never conflate them — conflation is the single most common error in this domain, and the prototype itself shipped one (see the statutory reference's errata section).
- **Employer-side vs employee-side.** NSITF, ITF and employer pension are company costs, never employee deductions. Model them separately or the payslip is wrong.
- **Audit-ready by default.** Every pay cycle keeps a full trail; statutory liabilities, filing status, and evidence must be reportable by entity, state, or country.
- **Contractor withholding.** WHT on contractor/vendor payments with certificate generation, rates by service category — a gap most payroll-only tools ignore.

## Guardrails for Claude when working on Plutus

- **Never invent or approximate a statutory figure.** If a rate, band, or threshold is needed and isn't in `references/nigeria-statutory-compliance.md`, say so and verify against a current primary source (NRS / PenCom / FMBN / NSITF / ITF) before writing logic that depends on it. Wrong payroll numbers cause real financial and legal harm to real employees.
- **Treat the reference as a snapshot, not gospel forever.** The 2026 reform is recent and guidance is still settling. For high-stakes work (production calculation logic, client-facing tax claims), confirm figures are still current and flag the date-sensitivity to the user.
- **Prefer flagging a conflict over silently picking a side.** When two sources disagree, surface it. That is how the NSITF deadline error was caught.
- **This is not tax or legal advice.** Plutus encodes rules; it doesn't replace a tax professional. Keep that framing in client-facing copy and don't let the product's confidence tip into legal-advice territory.
- **Demo data is demo data.** The prototype's employees, banks, PFAs and amounts are illustrative fixtures. Never present them as real client data or real benchmarks.

## Pan-African expansion (direction, not present scope)

Nigeria is the proving ground, not the ceiling. Because the compliance engine is a rules layer over a common core, **each new country adds a statutory rule set, not a new platform.**

| Market | Status | Statutory schemes |
|---|---|---|
| Nigeria | Live | PAYE · Pension · NHF · NHIS · NSITF · ITF · WHT |
| Ghana | Roadmap · Q1 2027 | PAYE · SSNIT pension · Tier 2/3 |
| Kenya | Roadmap · Q3 2027 | PAYE · NSSF · SHIF |

Deepen the Nigerian moat first, then layer Ghana and Kenya rule sets onto the existing core. When building, don't hardcode Nigeria assumptions into the shared core that would block a second country's rule set — currency exponent, scheme count, single-tax-authority, and "states" as the only sub-national unit are the usual leaks.

## Business model (one line)

Per-employee-per-month SaaS, tiered by feature depth (core payroll + compliance vs. full HR suite with self-service and multi-country). Compliance is the wedge; the encoded-rules moat is the defensibility.
