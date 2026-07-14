# Product

## Register

product

## Users

Two linked roles, both first-class:

- **Lifters** — people training in the gym who log workouts set-by-set on their phone. Their context is physical: standing between sets, sweaty hands, bright or uneven ambient light, short attention windows. The job is to record what just happened (reps, weight), see whether it beats last time, and move on without fighting the UI.
- **Trainers** — coaches who build routines, assign them to clients, monitor progress, and message back and forth. Their context is review-and-respond: scanning a client's recent sessions, spotting stalls or PRs, adjusting the plan, replying in chat.

The relationship between the two — assigned routines, shared history, live chat, unread signals — is core, not a bolt-on. Raw serves both the solo logging loop and the coaching loop equally.

## Product Purpose

Raw is a mobile-first PWA for logging strength training and coaching it remotely. It exists to make in-gym logging fast and honest, and to give trainers a clear, low-friction window into what their clients are actually doing. Success looks like: a lifter logs a full session without thinking about the app, immediately sees whether they progressed, and a trainer can act on that data the same day.

## Sections

Raw is a hub of sections; the home screen is a poster-style index (one live number per section) and each section opens its own world:

- **Entreno** — the original app: dashboard, active workout logging, history, routines, stats. The only section with a bottom tab bar (Menú · Inicio · + · Historial · Rutinas).
- **Nutrición** — meals with macros (P/C/G + kcal, auto-computed from macros when omitted) against daily targets, per-day view with day navigation.
- **Longevidad** — supplement stack with a daily taken-checklist, and bloodwork results by marker with reference ranges and per-marker trends.
- **Social** — planned (friends, workout feed, shared PRs); currently a declared placeholder.
- **Coach** — the trainer panel, reachable from the hub for trainers.

Other sections are single-screen with a back-to-menu header; the global "+ Empezar" workout action stays reachable from the hub (FAB) and the training tab bar.

## Brand Personality

**Unfiltered · Precise · Driven.**

- **Voice**: direct, plain, Spanish-first. No motivational fluff, no exclamation-mark hype. It states facts — weight, reps, whether it's a PR — and gets out of the way.
- **Tone**: confident and earned. Raw respects that the work happens in the gym, not in the app. It celebrates a PR by showing it clearly, not by throwing confetti.
- **Emotional goal**: the lifter should feel like they're using an honest instrument — something that tells them the truth about their progress under effort and bright light. The trainer should feel in control and informed.

## Anti-references

- **Generic SaaS dashboard** — cards-everywhere layouts, gradient hero-metric tiles, pastel chart palettes, the look of every other web app. Raw is an app, but it must not read as interchangeable SaaS.
- **Bloated consumer fitness apps** — cluttered, ad-heavy, over-gamified, badge-and-streak-spam. Raw earns its motivation from real numbers, not dopamine theatre.
- **Corporate / clinical** — sterile enterprise gray, medical-record sterility. Raw is athletic and human, not a spreadsheet wearing a lab coat.

## Design Principles

1. **Thumb-first, glanceable.** Every primary action lands in the bottom reach zone; the most important number on any screen is readable at arm's length, mid-set, without zooming.
2. **The number is the hero.** Weight, reps, PRs, deltas vs. last time — data is the content. Chrome recedes; figures lead. No decoration competes with the number that matters.
3. **Honest feedback over hype.** Progress is shown by truthful comparison (beat it / matched it / fell short), not by celebration for its own sake. Earned signals only.
4. **Two roles, one spine.** Lifter and trainer views share the same visual language and data model; the coaching layer feels like the same app seen from the other side, never a separate product.
5. **Stark, not loud.** High contrast and a single decisive accent (the red) do the work. Restraint everywhere else so the accent always means something.

## Accessibility & Inclusion

- Target **WCAG 2.1 AA**. Body text ≥4.5:1; large/numeric display ≥3:1. The action accent (steel in Slate, pink in Riso) must clear contrast against both surfaces and any tinted state — verify, don't assume.
- **Designed for hostile conditions**: bright gym lighting and outdoor sun, one-handed use, sweaty or gloved fingers. Tap targets ≥44px; never rely on hover; never rely on color alone to signal PR vs. regular set (pair with label/icon).
- Honor `prefers-reduced-motion` — progress and PR feedback must read instantly without animation.
- Spanish-first copy; keep strings translatable and avoid idioms that don't localize.
