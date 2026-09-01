# IRL Design System

This repository uses a lightweight central design system. New pages should use these shared tokens and primitives before adding page-specific values.

## Source of truth

- `src/styles/tokens.css` — brand colours, semantic colours, typography, spacing, layout widths, radii, shadows and motion.
- `src/styles/global.css` — global reset plus reusable IRL layout, typography, button, chip, card and section-heading classes.
- Page CSS files should contain layout/composition that is specific to that page, and should consume the shared `--irl-*` variables.

## Brand palette

- Ink: `--irl-ink` (`#071a2d`)
- Ink soft: `--irl-ink-soft` (`#172738`)
- Cream: `--irl-cream` (`#f5f1e9`)
- Cream light: `--irl-cream-light` (`#faf8f4`)
- Gold: `--irl-gold` (`#b98742`)
- Gold dark: `--irl-gold-dark` (`#95672e`)
- Sage: `--irl-sage` (`#a9b7a3`)

Use semantic variables such as `--irl-text`, `--irl-text-muted`, `--irl-border` and `--irl-surface` where possible rather than raw palette values.

## Typography

- Display: `--irl-font-display` — Georgia / Times fallback.
- Body/UI: `--irl-font-body` — Inter / system sans fallback.
- Shared heading classes: `.irl-display`, `.irl-display--large`, `.irl-display--section`.
- Shared supporting copy: `.irl-lede`.
- Shared small uppercase label: `.irl-eyebrow`.

## Layout

Use `.irl-container` for standard page content and `.irl-container--narrow` for narrow editorial/form content. Standard vertical sections use `.irl-section`.

Do not create arbitrary page max-widths unless the layout genuinely needs one that is not covered by the system.

## UI primitives

Available shared classes:

- `.irl-button`
  - `.irl-button--primary`
  - `.irl-button--secondary`
  - `.irl-button--light`
  - `.irl-button--ghost-light`
- `.irl-chip`
- `.irl-card`
- `.irl-section-heading`

Page-specific CSS may compose these primitives, but should not recreate the same button, chip, card or typography patterns under a new class name.

## Rules for new pages

1. Use existing `--irl-*` tokens before adding a new value.
2. If a value will be reused across pages, add it to `tokens.css`, not the page stylesheet.
3. Prefer semantic variables over hard-coded colours.
4. Keep page CSS focused on layout and page-specific composition.
5. Reuse global button, chip, container and typography classes.
6. Preserve keyboard focus states and responsive behaviour.
7. Avoid adding new fonts or dependencies without an explicit design decision.

## Current signed-out reference

The `/` landing page (`src/LandingPage.tsx`) is the first page built entirely against this design-system layer and should be treated as the current reference for public IRL pages.
