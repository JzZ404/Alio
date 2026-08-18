#!/bin/sh
# Compiles the stylesheet that ships to claude.ai/design (cfg.cssEntry).
#
# The DS package ships no CSS of its own — the apps compile Tailwind. This
# reproduces that compile for the DS bundle: same preset, same screens, content
# scanned over the components, both apps, and the authored preview files.
#
# Run this BEFORE package-build.mjs / preview-rebuild.mjs, and re-run it after
# editing any preview: arbitrary utilities used only in a preview
# (e.g. w-[320px]) exist only if that file was scanned.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUTDIR="$ROOT/packages/ui/.ds-css"
mkdir -p "$OUTDIR"
"$ROOT/packages/theme/node_modules/.bin/tailwindcss" \
  -c "$ROOT/.design-sync/tailwind.ds.config.ts" \
  -i "$ROOT/packages/theme/src/globals.css" \
  -o "$OUTDIR/.tw.css"
cat "$ROOT/.design-sync/ds-css-preamble.css" "$OUTDIR/.tw.css" > "$OUTDIR/ds.css"
rm -f "$OUTDIR/.tw.css"
echo "ds.css: $(wc -c < "$OUTDIR/ds.css") bytes"
