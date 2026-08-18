## Building with Alio

Alio is an elder-care copilot with three portals — caregiver, family, and elder. Screens are **mobile-first phone layouts**; the tone is warm, human and calm, never clinical or alarming.

### Setup — no provider needed

Components render standalone: there is no theme provider, context, or router to wrap. Import and use them directly.

`MobileFrame` is the screen shell — it centers a 393×852 phone viewport on desktop and fills the screen on mobile. Put a whole screen inside it.

Two positioning rules that will otherwise bite:

- **`TabBar` positions itself `absolute`.** It must sit inside a positioned ancestor (`MobileFrame` is one). Pass placement via `className`, e.g. `className="bottom-4 left-1/2 -translate-x-1/2"`.
- **`UploadWheel` and `AddRecordModal` are overlays** (`absolute` / `inset-0`). They also need a positioned parent, normally the same frame as the screen behind them.

**Use `Button` for every labeled action** — `variant="primary"` (Save/confirm), `"secondary"` (Cancel/dismiss), `"accent"` (the lime voice action), `"danger"` (stop recording); `size="md"` 48px default or `"sm"` 42px. Don't hand-roll `<button className="...">`; the variant owns color, radius and press feedback, and `className` is for layout only (`flex-1`, a fixed width). Icon-only buttons are `IconBox` (tinted square/pill) or `FloatingAddButton` (the lime FAB) instead.

`VoiceListeningView` is the whole AI voice state — gradient headline, breathing blob, live transcript — driven by one `listening` prop. It positions itself absolutely, so it also needs a positioned parent.

`TabBar`, `ChatListItem` and `LogListItem` render real links. Outside a Next app the bundle renders them as plain `<a href>`, and `TabBar`'s active tab resolves to `/home`; set `window.__ALIO_PATHNAME__` to highlight a different tab.

### Styling idiom: Tailwind utilities from the Alio preset

Style your own layout with Tailwind classes. **Use these families** — they are the design language, and the shipped stylesheet is compiled from them:

| Family | Real names |
|---|---|
| Brand color | `brand-primary` `#5E69F6`, `brand-active` `#4856FF`, `brand-accent` `#C0DA5A` (lime), `brand-tint-1` `#EDEDFC`, `brand-tint-2` `#EAEAF2`, `brand-border` `#D3D5EC` |
| Neutrals | `gray-10` (white), `gray-30` (page bg), `gray-60` (secondary text), `gray-80`, `gray-90`, `gray-100` (primary text) |
| Semantic | `alert` (red `#FF3B30`), `info` (blue `#1C4EAB`) |
| Prefixes | `bg-`, `text-`, `border-`, `fill-`, `stroke-` + any color above |
| Type scale | `text-xs` 10px, `text-sm` 12px, `text-base` 14px, `text-md` 16px, `text-lg` 18px, `text-xl` 20px, `text-2xl` 24px |
| Radii | `rounded-sm` 3px, `rounded`/`rounded-md` 8px, `rounded-lg` 12px, `rounded-xl` 14px, `rounded-2xl` 24px, `rounded-full` |
| Type face | `font-sans` = Century Gothic (the brand face, shipped with the bundle); weights `font-normal` / `font-bold` |
| Voice gradient | `bg-voice-idle` (static ramp), `bg-voice-listening` + `bg-flow` + `animate-voice-flow` (the sliding version) |
| Motion | `animate-voice-flow`, `animate-blob-pulse` |
| Breakpoints | `sm` 640, `md` 768, `lg` 1024 |

Screen backgrounds are `bg-gray-30`; cards are `bg-gray-10` (white) or `bg-brand-tint-1`; the hero status card is `bg-brand-primary` with white text. Standard Tailwind spacing, flex/grid, sizing, shadow and opacity utilities are available too.

**One caveat:** the stylesheet is a compiled Tailwind build, not the full framework. The families above are guaranteed; for an unusual one-off value prefer an inline `style={{ }}` or a `var(--color-*)` token over inventing a class that may not exist. Tokens are also available as CSS variables: `--color-brand-primary`, `--color-gray-30`, `--font-century-gothic`, and the rest of the names above.

### Where the truth lives

- `_ds/<folder>/styles.css` and its imports (`_ds_bundle.css`, `fonts/fonts.css`) — every class and token that actually ships.
- `components/<Name>/<Name>.prompt.md` and `<Name>.d.ts` — the props contract per component. Read these before using a component.

### Idiomatic example

```jsx
<MobileFrame>
  <div className="flex flex-col gap-4 p-5 pb-24">
    <h1 className="text-2xl font-bold text-gray-100">Good morning, Ann</h1>
    <p className="text-sm text-gray-60">Sarah is with Dorothy right now.</p>

    <CaregiverStatusCard
      caregiver={{ id: 'c1', name: 'Sarah Mitchell', visits: 128 }}
      status="arrived"
    />

    <div className="grid grid-cols-2 gap-2">
      <VitalTile label="Heart Rate" value="120 bpm" Icon={IconHeartRate} />
      <VitalTile label="Blood Stutas" value="116/70" Icon={IconBloodPressure} />
    </div>

    <div className="flex gap-2">
      <Button variant="secondary" className="flex-1">Not now</Button>
      <Button className="flex-1">View report</Button>
    </div>
  </div>

  <TabBar variant="family" className="bottom-4 left-1/2 -translate-x-1/2" />
</MobileFrame>
```

Icons are plain SVG components: they default to 24×24 and paint with `currentColor`, so size them with `className="size-5"` (or `width`/`height`) and color them with `text-*`.
