---
name: Raw
description: A mobile-first PWA for logging strength training and coaching it remotely — print-shop ink meets electric signal. The number is the hero.
colors:
  action: "#FF2E7E"
  action-text: "#C8185A"
  on-action: "#15140F"
  action-dim: "rgba(255,46,126,0.10)"
  action-border: "rgba(255,46,126,0.30)"
  data: "#2438FF"
  record: "#C0EE2E"
  record-ink: "#15140F"
  bg: "#EAE7DE"
  surface: "#F4F2EB"
  surface-2: "#DFDCD2"
  surface-3: "#D5D2C7"
  ink: "#15140F"
  ink-secondary: "#3A3833"
  ink-dim: "#5A584F"
  ink-muted: "#646359"
  ink-ghost: "#9A988E"
  border: "rgba(21,20,15,0.22)"
  border-subtle: "rgba(21,20,15,0.12)"
  scrim: "rgba(21,20,15,0.55)"
typography:
  display:
    fontFamily: "Anton, Archivo, system-ui, sans-serif"
    fontSize: "30px"
    fontWeight: 400
    lineHeight: 0.95
    letterSpacing: "0.01em"
  greeting:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "30px"
    fontWeight: 900
    lineHeight: 1.02
    letterSpacing: "-0.03em"
  metric:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "46px"
    fontWeight: 900
    lineHeight: 0.9
    letterSpacing: "-0.05em"
  title:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.45
    letterSpacing: "-0.01em"
  data:
    fontFamily: "Space Mono, ui-monospace, monospace"
    fontSize: "11px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.08em"
rounded:
  badge: "2px"
  xs: "6px"
  sm: "8px"
  base: "10px"
  md: "12px"
  lg: "14px"
  card: "16px"
  sheet: "20px"
  xl: "24px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
components:
  button-primary:
    backgroundColor: "{colors.action}"
    textColor: "{colors.on-action}"
    rounded: "{rounded.lg}"
    padding: "16px"
  button-secondary:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "16px"
  input-field:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink}"
    rounded: "{rounded.base}"
    padding: "8px 12px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "16px"
  today-card:
    backgroundColor: "{colors.action}"
    textColor: "{colors.on-action}"
    rounded: "{rounded.lg}"
    padding: "16px"
  pr-badge:
    backgroundColor: "{colors.record}"
    textColor: "{colors.record-ink}"
    rounded: "{rounded.xs}"
    padding: "2px 6px"
---

# Design System: Raw

## 1. Overview

**Creative North Star: "Ink & Voltage"**

Raw reads like a risograph print run wired to a stadium scoreboard. The foundation is print: a stark paper-or-ink field, heavyweight type set tight, hairline structure, and flat blocks of one or two spot colors slammed down with conviction — the look of a screen-printed training poster, not a SaaS dashboard. Onto that print foundation Raw runs voltage: a fluorescent pink that means *act*, an electric blue that means *data*, and an acid lime reserved for the one thing worth celebrating — a record. The result is loud where it counts and silent everywhere else, an instrument that still has attitude.

The system ships in **two true modes, not one theme inverted**. Light is "paper" — a warm-grey print stock under gym fluorescents. Dark is "ink" — a near-black panel where the same fluoros glow like a readout. They share one layout, one type system, and one set of role colors; only the spine flips. A boot script resolves the user's `auto/light/dark` choice before first paint, so there is no flash and no wrong-mode greeting.

This explicitly rejects Raw's three anti-references. It is **not a generic SaaS dashboard** — no gradient hero tiles, no pastel charts, no soft cards-everywhere sameness; the surfaces are flat print blocks with hairline edges. It is **not a bloated consumer fitness app** — no confetti, no streak spam; a PR is stated in lime and that is the entire celebration. And it is **not corporate-clinical** — the Anton/Archivo weight and the fluoro palette are unmistakably athletic and human.

**Key Characteristics:**
- **Numbers are the content.** Hero figures run 30–64px at weight 900 with tight negative tracking; everything else recedes.
- **Role-based color, rationed hard.** Pink = act, blue = data, lime = record. Three voices, each with one job.
- **Two real modes.** Paper (light) and ink (dark), auto-resolved, both AA-verified.
- **A committed type voice.** Anton display + Archivo 900 numerals + Space Mono data labels — self-hosted, no system-font fallback look.
- **Flat print structure.** Hairline borders and flat blocks, never drop-shadowed cards.
- **Thumb-first.** Primary actions in the bottom reach zone; a glass bottom-nav spine.

## 2. Colors

A committed, role-based palette (a full-palette strategy, not restrained) sitting on a warm-grey/near-black neutral spine. Every color carries a fixed meaning across every screen. Values below are the **light (paper)** canon; each has a **dark (ink)** counterpart that brightens for legibility on black.

### Primary
- **Action Pink** (light `#FF2E7E` / dark `#FF3D86`): The brand voice and every primary action — CTAs, the "today" card, active nav, send/invite. On light it is a **fill only** (pink-as-text fails on paper — use Action-Text `#C8185A` for the rare pink label). Text on a pink fill is always ink (`on-action`), never white.
- **Action-Text** (light `#C8185A` / dark `#FF3D86`): The darkened pink used only when pink must be text or an icon on the paper background (4.55:1).

### Secondary
- **Data Blue** (light `#2438FF` / dark `#6E7BFF`): Informational — volume figures, chart bars and lines, structural emphasis. The "data" voice, distinct from "act."

### Tertiary
- **Record Lime** (light `#C0EE2E` / dark `#C6FB50`): Reserved exclusively for PRs and records — the rare "earned win" color. Always a fill with ink text (`record-ink`). If lime appears anywhere that isn't a record, it's a bug.

### Neutral
- **Ink** (light `#15140F` / dark `#EFEDE4`): Primary text and hero numbers.
- **Ink Secondary** (`#3A3833` / `#C9C7BC`): In-card secondary values.
- **Ink Dim** (`#5A584F` / `#A2A096`): Sub-lines, mono eyebrows.
- **Ink Muted** (`#646359` / `#86857A`): Captions — the lightest text permitted (AA: ≥4.9:1 light, ≥5.2:1 dark).
- **Ink Ghost** (`#9A988E` / `#5C5B53`): Decoration only — separators, inactive states. Never must-read text.
- **Paper / Ink field** (bg `#EAE7DE` / `#0E0F0C`), **Surface** (`#F4F2EB` / `#161712`), **Surface-2/3** for insets, inputs, tracks.
- **Border / Border-subtle**: hairline structure as translucent ink (light) or paper (dark).

### Named Rules
**The Three Voices Rule.** Color speaks exactly three words — pink *act*, blue *data*, lime *record*. A color used outside its role is removed. Their discipline is what makes them read.

**The Ink-on-Pink Rule.** Text on an Action-Pink fill is always ink (`on-action`), never white — white on this pink fails AA (3.7:1), ink clears it (5.2:1).

**The Legibility Floor Rule.** Must-read text never renders lighter than Ink-Muted (≥4.9:1 in either mode). Ink-Ghost is decoration only.

## 3. Typography

**Display Font:** Anton (with Archivo fallback) — a condensed grotesk for the brand shout.
**Body / Numeral Font:** Archivo (system-ui fallback) — carries everything from 500 captions to 900 hero numbers.
**Data Font:** Space Mono — timestamps, eyebrows, set/rep readouts, anything that should read like an instrument.

**Character:** A print-shop pairing. Anton's compression gives headlines poster-weight; Archivo's wide 900 makes numbers monumental; Space Mono's fixed rhythm makes data feel measured. All self-hosted (subset woff2) so the gym load is fast and the personality never falls back to system sans.

### Hierarchy
- **Display** (Anton, 30–52px, UPPERCASE, line-height ~0.95): The brand shout — "today" card titles, poster moments.
- **Greeting / Page title** (Archivo 900, 30px, `-0.03em`): The top-of-screen address; sentence case for readability.
- **Metric** (Archivo 900, 30–64px, `-0.05em`, often tabular): Hero numbers — volume, counts, records. Loudest element on any screen.
- **Title** (Archivo 800, 18px, `-0.02em`): Card subjects.
- **Body** (Archivo 500, 12–13px): Sentences and microcopy. Cap prose at 65–75ch.
- **Data label** (Space Mono 700, 9–11px, `0.08em`, UPPERCASE): Eyebrows, dates, stat labels — the only place uppercase + tracking lives.

### Named Rules
**The Number-As-Hero Rule.** The single most important figure on a screen is the largest, heaviest, darkest element. Shrink competing chrome, never the number.

**The Mono-Eyebrow Rule.** Small uppercase labels are Space Mono, not Archivo. The instrument speaks its metadata in monospace.

## 4. Elevation

Flat by structure, depth by hairline — print, not paper-float. Surfaces separate via a 1px translucent border plus a one-step background lift, never a drop shadow. The only shadows are functional: the rest-timer pill and chart tooltip lift slightly so they read above content; the bottom-nav and modal sheets use backdrop-blur glass. There is no ambient card-shadow vocabulary.

### Shadow Vocabulary
- **Floating-control lift** (`0 4px 24px rgba(0,0,0,0.16)`): transient overlays only (rest timer).
- **Tooltip lift** (`0 4px 12px rgba(0,0,0,0.06)`): chart tooltips.
- **Glass scrim** (`backdrop-filter: blur(10–20px)`): fixed nav + modal backdrops.

### Named Rules
**The Etched-Not-Floated Rule.** Cards earn separation from a 1px border + a surface lift, never `box-shadow`. Reaching for a card shadow means the system broke.

## 5. Components

### Buttons
- **Shape:** 14px radius (`rounded.lg`) for full-width CTAs; 10px for compact buttons.
- **Primary (action):** Action-Pink fill, ink text (`on-action`), weight 700–900. Press feedback `scale(0.97)` over 160ms `ease-out`. Disabled 40% opacity.
- **Secondary:** Surface-2 fill, ink text, 1px border.
- **Resume / in-progress:** inverted — surface fill, pink text, 2px pink border.
- **Ghost:** transparent, muted text, for low-stakes inline actions.

### Inputs / Fields
- **Style:** Surface-2 fill, 1px border, 10px radius, `8px 12px`. Number inputs strip spinners, centered, tabular.
- **Focus:** a 2px Action-Pink `:focus-visible` outline (app-wide, keyboard only) plus the field's own soft ring.

### Cards / Containers
- **Corner Style:** 14–16px content cards; 20px modal sheets.
- **Background:** Surface on the bg field; 1px `border-subtle` at rest.
- **Today card:** an Action-Pink fill block with ink text and an inverted (ink-fill / pink-text) CTA inside — the one drenched-color surface, earned because it's the day's single most important action.
- **Hover (pointer only):** border darkens one step. Never relied on for touch.

### Chips / Badges
- **PR / record:** Record-Lime fill, ink text, small uppercase — states the win and stops.
- **Coach / live tag:** Action-dim fill, action text, pill radius; live adds a pulsing dot.

### Charts (recharts)
- Volume/data series render in **Data Blue**; grid + axes use neutral hairlines. Colors are supplied as **literal hex per theme** from a JS map (CSS variables don't resolve inside SVG attributes), so charts flip correctly between paper and ink.

### Navigation
- **Bottom nav:** fixed, glass blur, 1px top border, safe-area padded, 480px-centered. Active tab turns Action-Pink; inactive is Ink-Ghost. Stroke icons at `strokeWidth 2.2`.

## 6. Do's and Don'ts

### Do:
- **Do** keep the most important number the largest, heaviest, darkest element (Number-As-Hero).
- **Do** speak color in exactly three voices — pink *act*, blue *data*, lime *record* (Three Voices).
- **Do** use ink text on every pink fill (Ink-on-Pink); reach for Action-Text only when pink must be a label on paper.
- **Do** keep readable text at Ink-Muted or darker; Ink-Ghost is decoration only.
- **Do** supply chart colors as literal hex per theme — CSS vars don't resolve in recharts SVG attributes.
- **Do** separate surfaces with a 1px border + lift, not a shadow (Etched-Not-Floated).
- **Do** keep tap targets ≥44px and primary actions in the thumb zone; pair every record/live signal with a label or icon, never color alone.
- **Do** ship a `prefers-reduced-motion` fallback for every animation; honor the user's theme choice.

### Don't:
- **Don't** build a generic SaaS dashboard — no gradient hero tiles, pastel charts, or soft cards-everywhere sameness.
- **Don't** add consumer-fitness dopamine theatre — no confetti, streak spam, or badges. A PR is stated in lime, not celebrated.
- **Don't** drift corporate-clinical — keep the Anton/Archivo weight and the fluoro palette.
- **Don't** put white text on the Action-Pink fill (fails AA) or render must-read text in Ink-Ghost.
- **Don't** use lime for anything but a record, or spend pink/blue/lime on decoration.
- **Don't** invert one theme to fake the other — light is paper, dark is ink, each tuned on its own.
- **Don't** add a drop shadow to a card, a side-stripe accent border, or a web font beyond the three documented faces.
