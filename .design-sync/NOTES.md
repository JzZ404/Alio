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
