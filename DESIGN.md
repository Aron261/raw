---
name: Raw
description: A mobile-first PWA for logging strength training and coaching it remotely — the number is the hero.
colors:
  accent-red: "#FF2D2D"
  accent-red-dim: "rgba(255,45,45,0.08)"
  accent-red-border: "rgba(255,45,45,0.22)"
  surface: "#FFFFFF"
  bg: "oklch(97% 0.006 255)"
  surface-2: "oklch(95.5% 0.005 255)"
  surface-3: "oklch(93% 0.005 255)"
  border: "oklch(85% 0.006 255)"
  border-subtle: "oklch(91% 0.005 255)"
  text-primary: "oklch(13% 0.005 255)"
  text-secondary: "oklch(28% 0.005 255)"
  text-dim: "oklch(52% 0.005 255)"
  text-muted: "oklch(54% 0.005 255)"
  text-ghost: "oklch(80% 0.004 255)"
  pr-green: "oklch(55% 0.15 145)"
  border-hover: "oklch(75% 0.007 255)"
  focus-border: "oklch(55% 0.006 255)"
  scrim: "rgba(0,0,0,0.75)"
typography:
  display:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "26px"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.03em"
  metric:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "28px"
    fontWeight: 900
    lineHeight: 1
    letterSpacing: "-0.04em"
  title:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "18px"
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  body:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "-0.025em"
  data:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "14px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  label:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "9px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.1em"
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
    backgroundColor: "{colors.accent-red}"
    textColor: "{colors.surface}"
    rounded: "{rounded.sm}"
    padding: "12px 24px"
  button-secondary:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sm}"
    padding: "12px 24px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text-muted}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
  input-field:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sm}"
    padding: "8px 12px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "16px"
  pr-badge:
    backgroundColor: "{colors.accent-red}"
    textColor: "{colors.surface}"
    rounded: "{rounded.xs}"
    padding: "2px 5px"
---

# Design System: Raw

## 1. Overview

**Creative North Star: "The Honest Instrument"**

Raw is a measuring tool, not an app you "experience." It belongs to the same family as a barbell collar, a stopwatch, or a luggage scale: a stark white field, one decisive red mark, and a number so large you can read it at arm's length with sweaty hands under bright gym light. Every surface answers one question — *did you beat last time?* — and then gets out of the way. The aesthetic is clinical-athletic: the precision of an instrument with none of the coldness of an enterprise dashboard.

The system is **light by default and committed to it**. The body is a faintly cool off-white (`oklch(97% 0.006 255)`), chosen for one reason: it survives daylight and overhead gym fixtures where a dark theme would mirror-glare. Color is rationed to a single signal — the red, `#FF2D2D` — which appears only where it means *act now* (primary CTA), *this is live* (active workout), or *you broke a record* (PR). Restraint everywhere else is what gives the red its authority. Numbers carry the emotion; chrome stays mute.

This system explicitly rejects three things, drawn directly from Raw's anti-references. It is **not a generic SaaS dashboard** — no gradient hero-metric tiles, no pastel chart palettes, no cards-everywhere sameness. It is **not a bloated consumer fitness app** — no confetti, no badge-and-streak spam, no dopamine theatre; a PR is shown by stating it clearly, never by celebrating for its own sake. And it is **not corporate-clinical** — the high contrast and athletic weight (700–900) keep it human and driven, not a spreadsheet in a lab coat.

**Key Characteristics:**
- **Numbers are the content.** Metrics render at 28–30px / weight 900 / `-0.04em`; everything else is supporting scaffolding.
- **One voice of color.** The red occupies well under 10% of any screen and always carries meaning.
- **Light, stark, daylight-proof.** Cool off-white field, near-black ink, no dark mode.
- **System sans only.** Zero web-font payload; instant render in the gym.
- **Thumb-first.** Primary actions live in the bottom reach zone; a fixed glass bottom-nav anchors the spine.
- **Honest motion.** Short (150–320ms), state-bearing, with full `prefers-reduced-motion` fallbacks.

## 2. Colors

A near-monochrome cool-gray ramp carrying a single high-energy red. The neutrals are tinted a hair toward blue (hue 255) so the white reads crisp rather than warm — deliberately *not* the cream/sand AI default.

### Primary
- **Signal Red** (`#FF2D2D`): The one voice. Primary CTA fills ("Empezar entreno"), the live-workout dot and "Live" tag, the PR badge, active bottom-nav state, and goal progress fills below 100%. Never decorative.
- **Signal Red Dim** (`rgba(255,45,45,0.08)`): Tinted wash behind red elements at rest — active nav pill, coach tags, PR callout background. Lets the red register without shouting.
- **Signal Red Border** (`rgba(255,45,45,0.22)`): Hairline edge on red-tinted surfaces (coach cards, "Entreno de hoy" card, error alerts).

### Secondary
- **PR Green** (`oklch(55% 0.15 145)`): The *only* second hue, reserved exclusively for a completed goal (100%) — progress fill, percentage, and motivation line. Earns its rarity; appears nowhere else.

### Neutral
- **Ink** (`oklch(13% 0.005 255)`): Near-black. Primary text, all hero numbers, headings.
- **Ink Soft** (`oklch(28% 0.005 255)`): Secondary data values inside cards (duration, volume on a workout card).
- **Steel** (`oklch(52% 0.005 255)`): Dimmed text — contextual sub-lines. Clears WCAG AA on white (5.5:1).
- **Mist** (`oklch(54% 0.005 255)`): Muted captions and unit labels. Clears AA on white (5.1:1) and on the body (4.6:1) — the lightest color permitted for must-read text.
- **Fog** (`oklch(80% 0.004 255)`): Ghost text — inactive nav, the "×" set separator. Decorative weight only (1.9:1); never load real information here alone.
- **Surface** (`#FFFFFF`): Card and sheet fill, one step above the body.
- **Surface 2 / 3** (`oklch(95.5% / 93% 0.005 255)`): Inset fills — input backgrounds, progress tracks, nested empty-state panels.
- **Border / Border Subtle** (`oklch(85% / 91% 0.006 255)`): Hairline structure. Subtle is the default card edge; the heavier border marks inputs and dividers.

### Named Rules
**The One Voice Rule.** Red is used on ≤10% of any screen and only ever means *act*, *live*, or *record*. If red appears for decoration, delete it. Its rarity is the entire point.

**The Legibility Floor Rule.** Real, must-read information never renders lighter than Mist (`oklch(54%`, ≥4.6:1 on any Raw surface). Fog (`oklch(80%`) is for decoration only — separators, inactive states — never for text a user must read.

## 3. Typography

**Single Family:** the native system sans stack (`system-ui, -apple-system, BlinkMacSystemFont, sans-serif`). No display/body pairing, no web fonts — the instrument loads instantly and renders in the OS's own optimized hinting.

**Character:** One family worked across a wide weight range (500 → 900) and a tight negative tracking (`-0.025em` baseline, down to `-0.04em` on big numbers). The personality lives in the *weight contrast*, not in a typeface choice: muted 500 captions against thunderous 900 metrics. Tabular numerals (`font-variant-numeric: tabular-nums`) lock set/rep/weight columns so digits don't jitter as they change.

### Hierarchy
- **Display** (800, 26px, 1.1, `-0.03em`): Page greeting ("Buenos días, …"). One per screen.
- **Metric** (900, 28–30px, 1.0, `-0.04em`): The hero numbers — weekly count, volume, highlight value. The loudest element on any screen by design.
- **Title** (800, 18px, 1.15, `-0.02em`): Card subjects — the day name on "Entreno de hoy", PR exercise name.
- **Data** (700, 13–14px, `-0.01em`): In-card stat values, set inputs. Often tabular.
- **Body** (500, 11–12px, 1.4): Contextual sentences, sub-lines, microcopy. Cap prose at 65–75ch.
- **Label** (700, 9–10px, `0.1em`, UPPERCASE): Section eyebrows ("Esta semana", "Mis metas"). The *only* place uppercase + letter-spacing is allowed.

### Named Rules
**The Number-As-Hero Rule.** On any screen, the single most important figure is the largest, heaviest, darkest element. If a label or chrome element competes with the number for attention, shrink the chrome.

**The Quiet Caption Rule.** Captions are 500-weight and small, never bold-and-loud. Hierarchy is built by letting the number shout, not by making everything shout.

## 4. Elevation

Raw is **flat by structure, depth by hairline.** Surfaces sit on the body via a 1px border (`border-subtle`) and a one-step background lift (`#FFFFFF` on `oklch(97%)`), not shadows. Shadow is used in exactly two places and both are functional: a faint lift under the chart tooltip (`0 4px 12px rgba(0,0,0,0.06)`) so it reads above the bars, and the backdrop-blur glass of the bottom-nav and modal scrims. There is no ambient drop-shadow vocabulary on cards — the instrument is etched, not floated.

### Shadow Vocabulary
- **Tooltip lift** (`box-shadow: 0 4px 12px rgba(0,0,0,0.06)`): Only on transient floating data (chart tooltip).
- **Glass scrim** (`backdrop-filter: blur(20px)` on nav; `blur(8px)` on modal backdrop): Separates the fixed nav and modal sheets from scrolling content.

### Named Rules
**The Etched-Not-Floated Rule.** Cards earn separation from a 1px `border-subtle` + a one-step surface lift, never a drop shadow. If you reach for `box-shadow` on a card, you've broken the system.

## 5. Components

### Buttons
- **Shape:** 10px radius (`rounded.sm`) for standard buttons; larger CTAs round to 12–14px to match their card context.
- **Primary:** Signal Red fill, white text, `12px 24px`. The `.btn-primary` utility is uppercase / `tracking-widest` / weight-900; inline page CTAs use sentence case at weight 700. Press feedback: `scale(0.97)` + slight opacity drop over 160ms `ease-out`. Disabled drops to 40% opacity.
- **Secondary:** Surface-2 fill, ink text, 1px border. Same press-scale.
- **Ghost:** Transparent, muted text, no border; used for low-stakes inline actions.
- **Active continuation:** When a workout is in progress, the primary action inverts — white fill, red text, **2px red border** — signalling "resume" vs "start fresh."

### Inputs / Fields
- **Style:** Surface-2 fill, 1px `border`, 10px radius, `8px 12px` padding. Number inputs strip spinner chrome and center their text (tabular).
- **Focus:** Border shifts to `oklch(55%)` and a 3px soft ring (`box-shadow: 0 0 0 3px oklch(85%)`) appears — a quiet glow, not a hard outline.

### Cards / Containers
- **Corner Style:** 14–16px (`rounded.md`/16px) for content cards; 20px for modal sheets.
- **Background:** `#FFFFFF` surface on the `oklch(97%)` body.
- **Border:** 1px `border-subtle` at rest. The PR card swaps its top edge for a **3px Signal Red top border** when a record exists — the one sanctioned heavier accent edge, and only on top.
- **Hover (pointer devices only):** Border darkens one step (`oklch(75%)`). Never relied upon on touch.
- **Padding:** 16–20px internal.

### Chips / Tags
- **Coach tag / "Nuevo récord":** Red-dim fill, red text, red-border hairline, pill radius (999px), 8px uppercase label. Small, factual, never animated beyond entry.
- **Live tag:** Red-dim fill + a 5px pulsing red dot (`live-pulse`, 1.5s) + "Live".

### PR Badge (signature component)
A 2px-radius red chip reading "PR", weight 900, that pops in on a new record (`pr-pop`, 350ms scale). The honest celebration: it states the fact and stops.

### Navigation
- **Bottom nav:** Fixed, glass (`blur(20px)`), 1px top border, safe-area padded, max-width 480px centered. 60px tall.
- **Tab item:** A 36px circular icon target stacked over a 9px uppercase label. Active state fills the circle with red-dim + red-border and turns icon + label red; inactive renders in Fog. Stroke-based 18px icons at `strokeWidth 2.2`.

## 6. Do's and Don'ts

### Do:
- **Do** make the most important number the largest, heaviest (900), darkest element on the screen — the Number-As-Hero Rule.
- **Do** ration red to *act / live / record* and keep it under ~10% of any view (the One Voice Rule).
- **Do** put primary actions in the bottom thumb zone and keep tap targets ≥44px.
- **Do** separate cards with a 1px `border-subtle` + surface lift, not a shadow (Etched-Not-Floated).
- **Do** pair every PR/live/record signal with a label or icon, never color alone (sweaty hands, bright light, color-blind users).
- **Do** keep all real, readable text at Steel (`oklch(52%`) or darker.
- **Do** ship a `prefers-reduced-motion` fallback for every animation, so PR and progress feedback read instantly.

### Don't:
- **Don't** build a generic SaaS dashboard — no gradient hero-metric tiles, no pastel chart palettes, no cards-everywhere sameness.
- **Don't** add consumer-fitness dopamine theatre — no confetti, streak spam, or badges. A PR is stated, not celebrated.
- **Don't** drift corporate-clinical — keep the athletic weight and high contrast; this is not enterprise gray.
- **Don't** render must-read text in Fog (`oklch(80%`, 1.9:1) — it fails WCAG AA. Keep readable text at Mist (`oklch(54%`) or darker.
- **Don't** put a colored stripe on the *side* of a card. The only sanctioned heavy accent edge is the PR card's 3px **top** border.
- **Don't** use a second hue. Green is for completed goals only; everything else is the red or the gray ramp.
- **Don't** add a drop shadow to a card or a web font to the bundle.
