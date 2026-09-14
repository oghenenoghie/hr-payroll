---
name: plutus-button-nav-system
description: 'Canonical button and navigation spec for the Plutus/Wagebook app ("Ledger" design system) — the single variant/size table, label weight, focus and press states, row-action treatment, sidebar active/hover rules, and the Tailwind class map for the shared Button component. Use whenever adding, restyling, or reviewing any button, link-as-button, table row action, form submit, icon button, tab, breadcrumb, or sidebar/nav item in apps/wagebook. Trigger even without the word "button" — a new page header action row, a new table with per-row actions, a confirm dialog trigger, an export control, or any "make this look consistent / more clickable" request qualifies. Supersedes hand-typed className strings at call sites: read this before writing any new control classes.'
---

# Plutus buttons and navigation

Ledger is institutional, dense and flat: warm bone ground, Manrope, `1px solid var(--border)` instead of shadows, `--primary` green for the one committing action. Buttons are where that register is won or lost, because a payroll button commits money and files with a revenue service.

**Everything here uses tokens already declared in `apps/wagebook/src/app/globals.css` and its `@theme inline` block. No new colors, no new radii, no shadows, ever.**

## 1. The rule

**One `Button` component. No hand-typed `className` strings at call sites.**

Before this spec the app carried five button recipes across three heights, two radii and two weights:

| Found | Where |
|---|---|
| `rounded-button bg-primary px-[22px] py-[11px] text-[13px] font-extrabold` | `AuthCard` `SubmitButton` — 41px |
| `rounded-button bg-primary px-[18px] py-[9px] text-[12.5px] font-extrabold` | `ApprovedBillsTable` — 35px |
| `rounded-button border border-border px-[18px] py-[9px] text-[12.5px] font-extrabold` | `bank-reconciliation/[id]` |
| `rounded-control border border-border px-3 py-2 text-[12.5px] font-bold` | `TopBar`, `AppShell` sign-out — wrong radius, wrong weight |
| `text-[12px] font-bold text-primary` | row actions everywhere — no padding, 16px hit target |

If a new control needs a look that isn't in the table below, the answer is a new variant on the shared component, not an inline class string.

## 2. Label type

- **Manrope 800 (`font-extrabold`) on every button**, filled or outlined, at **13px / `leading-[18px]`**.
- **No letter-spacing.** Tracking is for uppercase text only in this system; button labels are sentence case. `tracking-[0.03em]` on a button label is a bug.
- 700 (`font-bold`) is not a button weight. The system already runs bold by default — 800 is its most-used weight — so a 700 label is what reads soft.
- Sentence case, verb first: "Approve pay run", "Save draft", "Reverse run". Never title case, never uppercase.

## 3. Variants

| Variant | Classes | Use |
|---|---|---|
| **primary** | `bg-primary text-white border border-primary hover:bg-primary-dark hover:border-primary-dark` | One per view. The action that commits. |
| **secondary** | `bg-surface text-ink border border-border hover:bg-bg hover:border-ink-soft` | Real actions that are not the commit. |
| **quiet** | `bg-transparent text-ink-soft border border-transparent hover:bg-bg hover:text-ink` | Cancel, dismiss, back. |
| **row** | `bg-transparent text-primary border border-transparent hover:bg-primary-tint` | Every table row action. |
| **danger** | `bg-surface text-bad border border-bad hover:bg-bad-tint` | Reverse, reject, offboard. Outlined, never filled — a filled red button invites the click it should discourage. Never twice on one view. |

The `border` on primary is deliberate: it keeps a filled button and an outlined one the same height when they sit side by side in a header action row.

## 4. Sizes

| Size | Classes | Height | Use |
|---|---|---|---|
| **lg** | `px-6 py-[14px]` | 48px | Default. Page header actions, form submits, anything primary. |
| **md** | `px-[22px] py-3` | 44px | Dense toolbars, inline forms. The mobile touch minimum. |
| **row** | `px-3 py-[9px]` | 38px | Table row actions only. |

Base classes on every size: `rounded-button font-extrabold text-[13px] leading-[18px] whitespace-nowrap disabled:opacity-50`.

`whitespace-nowrap` is not optional — without it a label wraps in a squeezed flex row and the second line renders outside the fill.

`rounded-button` (10px) on buttons. `rounded-control` (9px) is for inputs, badges and icon wells — never a button.

## 5. States

- **Press:** the existing `globals.css` `scale(0.97)` on `button:not(:disabled):active`, with the `prefers-reduced-motion` opt-out. Keep it. No shadow, no color shift.
- **Focus:** `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary` on the base class, plus the global fallback below. **This rule is the one the sheet was missing** — approving a pay run by keyboard must be visibly focused.
  ```css
  button:focus-visible,
  a:focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: 2px;
  }
  ```
- **Disabled:** `disabled:opacity-50`, and **always rendered next to the reason** as a status badge — `bg-bad-tint text-bad` "3 TINs missing", not a bare grey button. A blocked pay run must say why it is blocked.
- **Pending:** keep `FormSubmitButton`'s `useFormStatus` swap to "Working…" and `ConfirmActionButton`'s dialog. Those components stay; they pass `variant`/`size` through instead of a `className`.

## 6. Row actions

A 12px bare text link with no padding is a 16px hit target and reads as body text rather than as a control. Every row action takes the **row** variant and size: 13px/800, `px-3 py-[9px]`, `--primary` text on a `--primary-tint` hover. Destructive row actions take **danger** at row size.

## 7. Navigation

The sidebar shape is correct — 13px items on `--primary-dark`, active item taking a `--primary` pill that slides via `layoutId`. Three corrections:

- **Hover must not equal active.** `hover:bg-primary` on inactive items paints the exact fill the active item wears, so hovering looks like selecting. Use a translucent step (`hover:bg-white/8`) and reserve `bg-primary` for the active pill alone.
- **Active label goes to `font-extrabold`;** inactive stay `font-bold`. Weight carries location even mid-transition.
- **Group headings rest at `text-primary-tint/75`,** not `/60` — 11px at 60% on a dark ground is too low-contrast for a control that collapses a section.

Nav items are 33px at `py-2`. In the mobile drawer, where they are touch targets, use `py-2.5` (38px). TopBar's bell and account chip stay `rounded-control` icon wells but take the same focus ring as everything else.

Tabs and breadcrumbs follow the same logic: the current item is 800, siblings are 700 `text-ink-soft`, and state is carried by weight plus a 2px `--primary` underline — not a filled pill.

## 8. Anti-patterns

1. A `className` string on a button at a call site.
2. `font-bold` (700) on a button label.
3. `letter-spacing` on a sentence-case label.
4. `rounded-control` on a button.
5. A bare `<button className="text-[12px] text-primary">` as a row action.
6. A filled red button for a destructive action.
7. Any `shadow-*`. There are none in this system.
8. Two primaries in one view — if two actions both look like the commit, neither is.
9. A disabled button with no stated reason.
10. `hover:bg-primary` on an inactive nav item.
