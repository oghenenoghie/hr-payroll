# Plutus — Visual Design System

Extracted from the Claude Design standalone-HTML export of the Plutus Technologies payroll prototype (July 2026). These are measured values from the shipped artifact, not proposals.

**Design system name: "Ledger."** Institutional, dense, flat. It should read like a compliance instrument — a well-set financial statement — not like a consumer SaaS dashboard.

## Table of contents
1. Color tokens
2. Color semantics — what each token is for
3. Typography
4. Shape, spacing and elevation
5. Component patterns
6. Layout
7. Anti-patterns
8. Tailwind / CSS variable setup

---

## 1. Color tokens

Authored in **OKLCH**. Keep OKLCH as the canonical form — it is what the source uses, it keeps the tint ramps perceptually even, and the hue values are shared deliberately (95 for neutrals, 152 for greens). The hex column is a convenience for tools that can't take OKLCH; it is derived, not authoritative.

| Token | OKLCH | ≈ Hex | Role |
|---|---|---|---|
| `--bg` | `oklch(97% 0.015 95)` | `#F8F5EA` | App background — warm bone, never pure white |
| `--surface` | `oklch(99% 0.005 95)` | `#FDFCF8` | Cards, panels, table surfaces |
| `--border` | `oklch(90% 0.02 95)` | `#E2DED0` | Every separation in the UI |
| `--ink` | `oklch(22% 0.02 95)` | `#1D1B10` | Primary text |
| `--ink-soft` | `oklch(48% 0.02 95)` | `#615E51` | Labels, secondary text, meta |
| `--primary` | `oklch(35% 0.08 152)` | `#104625` | Brand green — buttons, active nav, headers |
| `--primary-dark` | `oklch(26% 0.07 152)` | `#002D12` | Deeper green — emphasis, sidebar, micro-labels |
| `--primary-tint` | `oklch(94% 0.03 152)` | `#DDF1E1` | Brand-tinted fills |
| `--accent` | `oklch(62% 0.12 55)` | `#BD7138` | Burnt orange — sparing highlight only |
| `--accent-tint` | `oklch(93% 0.05 55)` | `#FFE0C9` | Accent fill |
| `--good` | `oklch(55% 0.13 152)` | `#22864A` | Filed, approved, compliant, connected |
| `--good-tint` | `oklch(93% 0.05 152)` | `#D0F2D8` | Success badge fill |
| `--warn` | `oklch(68% 0.14 70)` | `#CE871B` | Pending, due soon, roadmap |
| `--warn-tint` | `oklch(94% 0.05 70)` | `#FFE6C8` | Warning badge fill |
| `--bad` | `oklch(55% 0.17 25)` | `#C13C3B` | Missing TIN, overdue, rejected |
| `--bad-tint` | `oklch(94% 0.06 25)` | `#FFDCD7` | Error badge fill |

**The tint pairing is structural.** Every semantic color has a matching `-tint` at ~93–94% lightness. Status is always communicated as *saturated text on its own tint fill* — never colored text on white, never a bare colored dot.

**Neutrals are warm, not gray.** All neutrals sit at hue 95 with 0.005–0.02 chroma. Substituting true grays (`#F5F5F5`, `#666`) kills the character of the system immediately — it is the most common way this design gets flattened.

**`--primary` and `--good` share hue 152.** The brand green and the success green are deliberately the same family at different lightness/chroma. Don't drift the brand toward teal or the success toward lime.

## 2. Color semantics — what each token is for

Measured usage across the prototype, which tells you the intended weighting:

- `background: var(--bg)` — 66 uses. `var(--surface)` — 62. These two carry the entire canvas.
- `border: 1px solid var(--border)` — **109 uses.** This single declaration is the workhorse of the whole system.
- `var(--primary)` background — 15 uses, almost entirely primary buttons and the active nav item.
- `--accent` is genuinely rare. It is a seasoning, not a secondary brand color. If an accent appears more than once or twice per screen, it's wrong.

Compliance status mapping, applied consistently:

| Meaning | Text | Fill |
|---|---|---|
| Filed / approved / TIN valid / connected / live | `--good` | `--good-tint` |
| Pending / awaiting approval / roadmap / due | `--warn` | `--warn-tint` |
| Missing TIN / overdue / rejected | `--bad` | `--bad-tint` |
| Neutral / not connected / informational | `--ink-soft` | `--bg` |

## 3. Typography

**One family: Manrope.** No serif pairing, no secondary face. Loaded at weights 400–800, but usage is heavily top-weighted: 800 (163 uses) and 700 (146) dominate; 400/500/600 are comparatively rare. This is a UI that is bold by default and uses regular weight as the exception.

```css
font-family: 'Manrope', sans-serif;
```

**Scale — small and dense.** The prototype is a data product; the type is sized for information density, not marketing.

| Size | Weight | Use |
|---|---|---|
| 10.5px | 800 | Smallest micro-label, uppercase, tracked |
| 11px | 700 | Section labels, table headers, badges (most common size) |
| 11.5–12.5px | 700 | Secondary labels, meta text, badge text |
| 13–13.5px | 700/800 | Body text, table cells, button text |
| 14–15px | 700/800 | Emphasised body, card titles, primary buttons |
| 17–20px | 800 | Card headline figures, view titles |
| 22–26px | 800 | KPI numbers, page display headings |

There is no 32px+ type anywhere. The largest thing on screen is a KPI figure, not a headline.

**Uppercase micro-labels are the signature.** 92 instances. The recipe:

```css
font-size: 11px;
font-weight: 700;          /* 800 when on --primary-dark */
color: var(--ink-soft);    /* or var(--primary-dark) for emphasis */
text-transform: uppercase;
letter-spacing: 0.03em;
```

Tracking is only ever applied to uppercase text: `0.03em` standard, `0.04em` for the tightest small sizes, `0.02em` occasionally. **Never track lowercase body text.**

Line-height is left at browser default for UI text; `1.5`–`1.6` is set explicitly only for genuine paragraphs.

## 4. Shape, spacing and elevation

**Elevation: there is none.** Zero `box-shadow` declarations in the entire prototype. Depth is expressed purely through `1px solid var(--border)` and the `--bg` / `--surface` contrast step. This is the most distinctive property of the system and the easiest to break — a designer or an LLM adding a "subtle shadow for polish" destroys the institutional flatness that makes it read as a financial instrument.

**Radii** (a deliberate, narrow set):

| Radius | Use |
|---|---|
| 4–6px | Tiny inline chips |
| 8–9px | Badges, small controls, inputs |
| 10px | Buttons |
| 12px | Inner/nested panels |
| 14px | **Default card radius** — the most common value |
| 16px | Large containers, auth cards |
| 50% | Avatars only |

**Padding:**

| Value | Use |
|---|---|
| `24px` | Standard card / section padding (most common) |
| `20px` | Compact card |
| `32px` | Auth card, generous container |
| `12px 14px` / `11px 13px` | Inputs and small controls |
| `11px 22px` / `13px 22px` | Buttons |
| `5px 12px` | Badges |

**Gaps:** `8px` (most common, tight groups), `12px`, `14px`, `16px`, `20px`, `22px` for major section separation.

There is no strict 4/8px grid — values like 11px, 13px, 22px appear deliberately. Match the table above rather than rounding to a theoretical scale.

## 5. Component patterns

**Card** — the base unit of every screen:

```css
background: var(--surface);
border: 1px solid var(--border);
border-radius: 14px;
padding: 24px;
```

**Primary button:**

```css
background: var(--primary);
color: white;
font-size: 13px;      /* 14px for large */
font-weight: 800;
padding: 11px 22px;   /* 13px 22px for large */
border-radius: 10px;
cursor: pointer;
```

**Status badge:**

```css
background: var(--good-tint);   /* semantic tint */
color: var(--good);             /* matching saturated */
font-size: 11px;
font-weight: 700;
text-transform: uppercase;
letter-spacing: 0.03em;
padding: 5px 12px;
border-radius: 9px;
```

**Input:**

```css
background: var(--surface);
border: 1px solid var(--border);
border-radius: 9px;
padding: 11px 13px;
font-size: 13px;
```

**Avatar** — the only place `border-radius: 50%` is used. Employee photo, square-cropped, object-fit cover. Sizes: 24px in table rows and approval queues, 32px in the header user chip, 44–56px in the self-service and employee detail panels. Always `1px solid var(--border)` around the circle, consistent with the borders-not-shadows rule.

**Initials fallback** — when no photo exists, render the same circle filled `--primary-tint` with the initials in `--primary-dark`, 800 weight, sized to roughly 40% of the avatar diameter, uppercase, `0.03em` tracking. This is a permanent state, not a placeholder: some employees will never supply a photo, and the fallback must look deliberate rather than broken. The prototype's `FN` header monogram is the reference implementation.

**Data table** — the most important composite in the product. Uppercase 11px `--ink-soft` headers; `1px solid var(--border)` row separators; cell padding around `10–13px 4px`; numeric columns right-aligned; monetary values formatted `₦` + `toLocaleString('en-NG')`, always whole naira, never decimals. Where rows represent people, lead with a 24px avatar + name in a single cell rather than adding a separate photo column.

**KPI tile** — uppercase micro-label, then a 22–26px/800 figure, then an 11px `--ink-soft` sub-caption. Three or four across.

## 6. Layout

- **Full-height app shell**, `display:flex; height:100vh; overflow:hidden` — the shell never scrolls; content panes scroll internally.
- **Persistent left sidebar** on `--primary-dark` carrying the brand lockup, a "viewing as" role switcher, and the nav list. Active item takes a `--primary` fill.
- **Content header** with view title + subtitle (both defined per view — see `product-and-ia.md`), plus a persistent compliance-status chip.
- **Auth screens** are centered single cards, 380px wide, 16px radius, 32px padding, on `--bg`.
- Design tokens are declared on the app root element as inline custom properties, so the whole tree inherits them.

## 7. Anti-patterns

Things that break this system, in rough order of how often they get done by accident:

1. **Adding box-shadows.** There are none. Borders only.
2. **Swapping warm neutrals for true gray.** Hue 95 is doing real work.
3. **Scaling type up.** This is a dense data UI; 16px body text makes it a different product.
4. **Using `--accent` as a secondary brand color.** It's a rare highlight.
5. **Colored status text without its tint fill.** Status is always a filled badge.
6. **Tracking lowercase text.** Letter-spacing is for uppercase only.
7. **Introducing a second typeface.** Manrope alone, with weight carrying the hierarchy.
8. **Decimal currency.** Whole naira, `en-NG` locale grouping, `₦` prefix.
9. **Gradients, glassmorphism, heavy motion.** None of these exist here; the register is institutional restraint.

## 8. Tailwind / CSS variable setup

Declare tokens once at the root, then reference through `var()` — matching how the prototype does it:

```css
:root {
  --bg: oklch(97% 0.015 95);
  --surface: oklch(99% 0.005 95);
  --border: oklch(90% 0.02 95);
  --ink: oklch(22% 0.02 95);
  --ink-soft: oklch(48% 0.02 95);
  --primary: oklch(35% 0.08 152);
  --primary-dark: oklch(26% 0.07 152);
  --primary-tint: oklch(94% 0.03 152);
  --accent: oklch(62% 0.12 55);
  --accent-tint: oklch(93% 0.05 55);
  --good: oklch(55% 0.13 152);
  --good-tint: oklch(93% 0.05 152);
  --warn: oklch(68% 0.14 70);
  --warn-tint: oklch(94% 0.05 70);
  --bad: oklch(55% 0.17 25);
  --bad-tint: oklch(94% 0.06 25);
}
```

For Tailwind, map these into `theme.extend.colors` as `bg`, `surface`, `border`, `ink`, `ink-soft`, `primary`, `primary-dark`, `primary-tint`, `accent`, `accent-tint`, `good`, `good-tint`, `warn`, `warn-tint`, `bad`, `bad-tint`, each pointing at its `var()`. Extend `borderRadius` with the 9/10/12/14/16px set and `fontFamily.sans` with Manrope. Load Manrope 400–800 via `next/font/google` with `display: 'swap'`, subsetting to latin unless a market needs more.

Because Tailwind's default palette and radii will otherwise leak in, prefer the named tokens over arbitrary values, and don't reach for `shadow-*` at all.
