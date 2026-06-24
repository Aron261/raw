---
target: src/pages/Home.jsx
total_score: 27
p0_count: 0
p1_count: 3
timestamp: 2026-06-23T19-38-44Z
slug: src-pages-home-jsx
---
# Critique — src/pages/Home.jsx (Lifter home/dashboard)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Strong: skeleton, saving spinners, Live tag, "Creando…" states |
| 2 | Match System / Real World | 3 | Spanish-first, plain; "1RM estimado" is acceptable lifter jargon |
| 3 | User Control and Freedom | 3 | Modal closes on backdrop; no undo on goal delete |
| 4 | Consistency and Standards | 2 | Primary CTA reimplemented inline in 4 shapes; `.btn-primary` utility bypassed |
| 5 | Error Prevention | 3 | Save disabled until valid; double-click guards; no confirm on goal delete |
| 6 | Recognition Rather Than Recall | 3 | All visible; rotating daily highlight taxes recall slightly |
| 7 | Flexibility and Efficiency | 3 | One-tap start; appropriate for mobile |
| 8 | Aesthetic and Minimalist Design | 3 | Restrained, number-forward; muted grays wash it out |
| 9 | Error Recovery | 2 | Generic "Error al cargar entrenos." with no retry |
| 10 | Help and Documentation | 2 | None, but empty states teach |
| **Total** | | **27/40** | **Acceptable (top of band, near Good)** |

## Anti-Patterns Verdict
LLM assessment: Does NOT look AI-generated. Distinctive, committed, on-brand — number-as-hero, single red accent, etched flat cards, system sans. No gradient text, no decorative glass, no hero-metric SaaS template, no identical card grid. This is real design.
Deterministic scan: 1 finding — `layout-transition` at Home.jsx:1246 (goal progress bar animates `width`). Warning severity. Genuine but minor.
Browser overlay: skipped — dev server not running, no browser automation this run.

## Overall Impression
A confident, well-built screen that honors its own principles — except two it states explicitly in PRODUCT.md and then breaks: WCAG AA contrast and thumb-first placement. The biggest single opportunity is fixing the gray-text contrast floor, which simultaneously fixes the "washed out" feel and the accessibility violation.

## What's Working
- Number-as-hero hierarchy is real: 28-30px / weight-900 metrics dominate; chrome recedes. Exactly the brief.
- Honest feedback: PR shown by stating the fact ("Nuevo récord" + the numbers), no confetti. Empty states teach instead of saying "nothing here."
- State coverage: loading skeleton, saving spinners, double-click guards, live/active inversion of the CTA. Genuinely thorough.

## Priority Issues

- **[P1] Muted text fails WCAG AA**: `text-muted` (oklch 65%) = 3.2:1 on white, used for nearly every caption, unit label, and sub-line (date, "kg de volumen", goal counts, microcopy). Body text needs ≥4.5:1. Contradicts PRODUCT.md's stated AA target and "readable mid-set under bright light."
  - Fix: darken caption text to `text-dim` (oklch 52% = 5.5:1) or darker. Reserve oklch 65%+ for non-essential decoration only.
  - Suggested command: /impeccable colorize

- **[P1] Primary CTA contrast is borderline**: white on `#FF2D2D` = 3.97:1. The page's main "Empezar entreno" renders at 13px bold, which is normal-size text needing 4.5:1 — it fails. PRODUCT.md explicitly says the red "must clear contrast against white surfaces — verify, don't assume."
  - Fix: bump CTA text to ≥14px bold (large-text 3:1 threshold) or darken the red fill on the primary action.
  - Suggested command: /impeccable colorize

- **[P1] No visible keyboard focus indicator on the inline CTAs**: the start/continue/coach buttons style only `:active` (press scale). Keyboard users get no `:focus-visible` ring. Inputs have one; buttons don't.
  - Fix: add a consistent `:focus-visible` ring token across interactive elements.
  - Suggested command: /impeccable harden

- **[P2] Primary CTA sits in the top third, violating thumb-first**: Design Principle 1 says "every primary action lands in the bottom reach zone," but "Empezar entreno" sits just under the header — the hardest place to reach one-handed mid-set.
  - Fix: consider a sticky bottom-anchored start affordance, or confirm the bottom-nav covers this intent.
  - Suggested command: /impeccable layout

- **[P2] Inconsistent button vocabulary**: the start action appears as red-fill/14px-radius, white-with-2px-red-border/14px, transparent/12px, and the EntrenaHoyCard's 10px button — all hand-rolled inline while `.btn-primary` exists unused. Same intent, four looks.
  - Fix: consolidate into 2-3 documented button variants (now captured in DESIGN.md).
  - Suggested command: /impeccable extract

## Persona Red Flags

**Sam (Accessibility)**: Caption text at 3.2:1 is unreadable for low vision. No visible focus ring on the main CTAs — keyboard nav is invisible. GoalModal close "✕" and goal-delete "✕" have no `aria-label` (delete has only `title`). Will struggle to operate the screen.

**Casey (Distracted Mobile)**: The one action she needs mid-set — start/continue — is at the top of the scroll, not the thumb zone. Sweaty-hand tap targets on the set-row inputs (44/56px wide, ~30px tall) are under 44px tall.

**Riley (Stress Tester)**: The daily-rotating highlight means the same screen shows a different metric each day with no way to pin one — looks like a bug to a methodical user. Load error is a dead end ("Error al cargar entrenos.") with no retry.

## Minor Observations
- Goal progress bar animates `width` (Home.jsx:1246) — prefer `transform: scaleX` for smoothness.
- Goals can be created and deleted but not edited.
- Repeated inline `rgba(255,45,45,...)` literals instead of the existing `--c-accent-*` tokens.

## Questions to Consider
- If contrast is raised to AA across the board, does the "stark instrument" feel get stronger (it should — more ink, less haze)?
- Should the primary start action be permanently thumb-anchored, given mid-set is the core moment?
- Does the highlight need to rotate daily, or would a user rather pin the metric they care about?
