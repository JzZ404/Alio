# design-sync notes — @alio/ui → claude.ai/design

Repo-specific gotchas for future syncs. Config lives in `.design-sync/config.json`;
the conventions header prepended to the generated README is `.design-sync/conventions.md`.

## How this repo differs from the converter's defaults

- **No package build.** `@alio/ui` ships TypeScript source (`main: ./src/index.ts`); there is no
  `dist/`. The converter bundles the source barrel directly — pass
  `--entry packages/ui/src/index.ts`. Nothing needs compiling first except the stylesheet (below).
- **`cfg.buildCmd` compiles the stylesheet, not the package.** `sh .design-sync/build-ds-css.sh`
  runs Tailwind over `packages/theme/src/globals.css` with `.design-sync/tailwind.ds.config.ts`
  and prepends `.design-sync/ds-css-preamble.css`, writing `packages/ui/.ds-css/ds.css`
  (gitignored, `cfg.cssEntry` points at it). The apps compile their own Tailwind; the DS package
  ships no CSS, so this reproduces that compile for the bundle.
- **Re-run the CSS build before every `package-build.mjs` / `preview-rebuild.mjs`.** The Tailwind
  content globs include `.design-sync/previews/**`, so an arbitrary utility used only in a preview
  (e.g. `w-[320px]`) does not exist in the stylesheet until the CSS is recompiled. Symptom: a
  preview wrapper collapses to near-zero height.
- **The stylesheet carries a safelist.** `tailwind.ds.config.ts` safelists the token families
  (brand/gray/alert/info colors, spacing, sizing, radii, type scale, layout) so the design agent
  is not limited to classes the two apps happen to use already. Usage-only would be ~38KB; with
  the safelist it is ~105KB. Widen the safelist rather than telling the agent to avoid classes.

## Next.js dependencies — shimmed, deliberately

`TabBar`, `ChatListItem` and `LogListItem` import `next/link`; `TabBar` also imports
`next/navigation`. Bundling real `next` made **every** preview fail with
`ReferenceError: process is not defined` — Next's client code touches `process.env` at module
init, and claude.ai/design is not a Next app.

Fix: `cfg.tsconfig` points at `.design-sync/tsconfig.dssync.json`, whose `compilerOptions.paths`
redirect `next/link` → `.design-sync/shims/next-link.tsx` and `next/navigation` →
`.design-sync/shims/next-navigation.ts`. The converter's tsconfig-paths plugin resolves them at
bundle time. The shims render exactly what Next renders in a browser (`<a href>`) and drop the
routing-only props; component markup is untouched. This also cut the bundle 562KB → 423KB.

`usePathname()` returns `/home` unless `window.__ALIO_PATHNAME__` is set, so TabBar shows Home
active in cards. The app builds never read this tsconfig.

## Fonts

`packages/theme/package.json` declared `"./fonts.css": "./src/fonts.css"` but the file did not
exist — this sync created it (`@font-face` for both Century Gothic TTFs). `cfg.extraFonts` points
at it, and the converter copies the TTFs into `fonts/`.

The converter harvests only `@font-face` rules from an `extraFonts` stylesheet and **drops any
`:root` block**, so `--font-century-gothic` (which the apps get from `next/font/local`) has to be
defined elsewhere: it lives in `.design-sync/ds-css-preamble.css`. Without it every
`font-family: var(--font-century-gothic), ...` declaration is invalid and text renders in the
browser's serif default. Symptom: card text looks like Times.

## Component scope

- 22 components + 36 icons = 58 cards. `packages/ui` exports ~290 generated icons; syncing all of
  them would swamp the picker, so `cfg.componentSrcMap` nulls out the 254 that no app source
  references. The bundle still contains every icon — only the cards and docs are curated.
- The kept 36 are the icons actually used in `apps/**` and `packages/ui/src/*.tsx`. Regenerate the
  list by grepping `\bIcon[A-Za-z0-9_]+` over source (exclude `.next/` — build output references
  every icon and will falsely match all 290).
- **New icons added later are auto-included** as cards unless added to the exclusion map.

## Button + VoiceListeningView extraction (second pass)

`packages/ui` originally had no labeled-button primitive — 28 raw `<button>` elements across 14
components, with three different specs for what was visually the same control. `Button` now owns
that: variants primary/secondary/accent/danger, sizes md 48px / sm 42px, radius from the `lg`
token. Refactored call sites: `AddRecordModal` (Cancel/Save), `TodayStatusCard` (View Notes),
`PressToSpeakButton` (now composes Button for both its states).

Two things that bit during the refactor, both visible only in the render diff:

- **View Notes wrapped to two lines.** The Figma width is a fixed 101px; bold text plus the
  primitive's `px-6` no longer fit. Fixed by giving `Button` `whitespace-nowrap` (labels should
  never wrap) and passing `px-0` at that one call site. Its look intentionally changed from
  42px/normal/black to the canonical 48px/bold/gray-100.
- **PressToSpeakButton got narrower.** Its original `px-9` is wider than `Button`'s `px-6`, so the
  call site passes `px-9` explicitly to keep the pill's original geometry.

Icon-only buttons (`IconBox`, `FloatingAddButton`) and in-row controls (call/chat circles,
chevrons, checkbox rows) were deliberately left alone — they are not labeled buttons.

`VoiceListeningView` extracts the voice state that `apps/caregiver/logs` and `apps/family/ai-check`
duplicated verbatim: gradient headline + `GradientBlob` + live transcript, driven by `listening`.
Both apps now delegate to it. Its gradient hexes moved into `packages/theme` as `voiceGradient`
tokens, exposed through the preset as `bg-voice-idle` / `bg-voice-listening` / `bg-flow` /
`animate-voice-flow`.

**Preset-defined utilities need safelisting.** `animate-blob-pulse` is defined in the preset but
used nowhere in source, so Tailwind emitted nothing and the name in `conventions.md` would have
resolved to nothing. The voice/motion names are now explicitly safelisted in
`tailwind.ds.config.ts`. Anything documented but not used in source needs the same treatment.

**Grades do not track component source.** `package-capture.mjs` keys grades on the preview `.tsx`
and preview-affecting config, so `AddRecordModal` / `TodayStatusCard` / `PressToSpeakButton` all
printed `carried forward` after their implementations changed. Verify refactors by diffing
`_screenshots/*.png` before and after yourself — the grade lifecycle will not catch it.

**Pre-existing type error fixed.** `tailwind-preset.ts` assigned the `as const` readonly tuple
`fontFamily.sans` to Tailwind's mutable `string[]`, so `pnpm -r typecheck` failed on `main` before
any of this work. Now spread (`[...fontFamily.sans]`).

## Preview conventions

- Content comes from `@alio/mock-data` fixtures (SAMPLE_*, INITIAL_CONVERSATION) or real app usage.
- App `/public` assets do not exist in the design environment: previews that need an avatar or a
  photo use inline data-URI SVG stand-ins rather than `/avatars/*.avif` or `/chat/*.jpg`.
- Overlay/full-bleed components carry `cfg.overrides`: `MobileFrame`, `AddRecordModal` and
  `UploadWheel` use `cardMode: single` with an explicit viewport; eight wide components
  (`CalendarWidget`, `CaregiverStatusCard`, `ChatListItem`, `LogListItem`, `PatientCard`,
  `RecordItem`, `TabBar`, `TodayStatusCard`) use `cardMode: column` after `[GRID_OVERFLOW]`.

## Known render warns (expected — not new)

- `[GRID_OVERFLOW]` on the eight components listed above **before** the `cardMode: column`
  override is applied. With the override in place it should not re-fire.
- `GradientBlob` — `Listening` and `Resting` look identical in a still. The only difference is the
  CSS pulse animation, which a screenshot cannot capture. Both cells are correct.
- Interaction-only states are not previewed: `ModeDropdown` and `PatientSwitcher` open their menus
  from internal state with no prop to force them open, so only the closed state is carded.

## Known gaps

- `GradientBlob` still hardcodes its four radial-gradient hexes inline (`#B7AEFE`, `#F9B5C9`,
  `#FFC9A7`, `#C5C9F8`) rather than reading tokens. Left alone deliberately — moving them is a
  no-visual-change refactor, but it was out of scope for the button/voice extraction.
- `AppointmentItem` is exported and carded but used by nothing: `CalendarWidget` renders its
  Upcoming rows with its own inline markup instead of composing it.

## Re-sync risks — what can go stale

- **Preview fixtures are inlined copies.** Preview `.tsx` files hardcode fixture values rather than
  importing `SAMPLE_*`, so edits to `packages/mock-data` will not propagate. If the fixtures change
  meaningfully, re-check the previews.
- **The shims track a Next 14 API surface.** If the apps move to a newer Next whose `Link` or
  navigation hooks change shape, re-check `.design-sync/shims/`.
- **The safelist is hand-written.** New token families added to `packages/theme` (a new color ramp,
  new radii) will not reach the design agent until the safelist in `tailwind.ds.config.ts` and the
  family table in `conventions.md` are updated.
- **`playwright@1.58.x` matches this machine's cached chromium build (1208).** A different machine
  may need a different playwright version — check `~/Library/Caches/ms-playwright/`.
- **Preview grades are local** (`.design-sync/.cache/`, gitignored). Cross-machine carry-forward
  comes from the uploaded `_ds_sync.json`; fetch it to `.design-sync/.cache/remote-sync.json`
  before a re-sync so unchanged components skip re-verification.
