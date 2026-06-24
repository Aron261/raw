---
target: src/pages/Home.jsx
total_score: 30
p0_count: 0
p1_count: 0
timestamp: 2026-06-24T00-34-25Z
slug: src-pages-home-jsx
---
# Critique — src/pages/Home.jsx (re-run after colorize/harden/extract/polish)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Skeleton, spinners, Live tag, "Creando…" — strong |
| 2 | Match System / Real World | 3 | Spanish-first, plain language |
| 3 | User Control and Freedom | 3 | Error now recoverable (Reintentar); still no undo on delete |
| 4 | Consistency and Standards | 3 | CTA variants now documented + token discipline restored |
| 5 | Error Prevention | 3 | Save gated until valid; double-click guards |
| 6 | Recognition Rather Than Recall | 3 | All visible; daily-rotating highlight still taxes recall |
| 7 | Flexibility and Efficiency | 3 | One-tap start, right for mobile |
| 8 | Aesthetic and Minimalist Design | 4 | Contrast fix sharpened the stark-instrument look |
| 9 | Error Recovery | 3 | Retry button added; copy could still name the cause |
| 10 | Help and Documentation | 2 | None, but empty states teach |
| **Total** | | **30/40** | **Good (was 27, Acceptable)** |

## Anti-Patterns Verdict
LLM: Still not AI-generated — committed, distinctive, on-brand. Contrast fix removed the only "washed out" tell.
Detector: 0 findings on Home.jsx (was 1). Clean.

## What's Working
- All must-read text now clears WCAG AA (captions 5.1:1, chart labels 5.5:1).
- Keyboard focus is visible app-wide; icon buttons have accessible names.
- Load error is no longer a dead end — Reintentar re-fetches.
- Progress bar is GPU-animated and announced as a progressbar.

## Priority Issues (remaining)
- **[P2] Primary CTA sits in the top third**, against thumb-first Principle #1. → /impeccable layout
- **[P2] Set-row inputs ~30px tall** (<44px touch target) for mid-set use. → /impeccable adapt
- **[P3] Daily-rotating highlight** can't be pinned; reads like a changing bug to methodical users. → /impeccable clarify

## Persona Red Flags
**Sam (a11y):** Now has visible focus rings, AA contrast, labeled controls — major improvement. Residual: set inputs are short targets.
**Casey (mobile):** Core start action still above the thumb zone; set inputs short.
**Riley:** Load error recovers now; rotating highlight still surprising.

## Questions to Consider
- Should the start action become permanently thumb-anchored?
- Pin the highlight metric vs. rotate daily?
