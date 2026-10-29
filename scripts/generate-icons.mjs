#!/usr/bin/env node
/**
 * Generates React components from the SVG files in packages/ui/icons/.
 * - Caesarzkn UI icons: "Icon Name=Search, Style=False, Size=24px.svg" → IconSearch (outline) / IconSearchFilled
 * - Medical icons: "Stethoscope.svg" → IconStethoscope
 * Normalizes black/dark fills + strokes to `currentColor` so they recolor via CSS `color`.
 *
 * Run: node scripts/generate-icons.mjs
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = join(REPO_ROOT, 'packages/ui/icons');
const OUT_DIR = join(REPO_ROOT, 'packages/ui/src/icons');

function toPascalCase(name) {
  return name
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('');
}

function parseFilename(filename) {
  const noExt = filename.replace(/\.svg$/i, '');
  const m = noExt.match(/^Icon Name=(.+), Style=(True|False), Size=\d+px$/);
  if (m) {
    const baseName = toPascalCase(m[1]);
    const filled = m[2] === 'True';
    return { name: `Icon${baseName}${filled ? 'Filled' : ''}`, category: 'ui' };
  }
  return { name: `Icon${toPascalCase(noExt)}`, category: 'medical' };
}

function normalizeSvgInner(svgContent) {
  // Strip outer <svg> wrapper
  const innerMatch = svgContent.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i);
  let inner = innerMatch ? innerMatch[1] : svgContent;

  // Kebab-case → camelCase JSX attrs
  inner = inner
    .replace(/\bfill-rule\b/g, 'fillRule')
    .replace(/\bclip-rule\b/g, 'clipRule')
    .replace(/\bclip-path\b/g, 'clipPath')
    .replace(/\bfill-opacity\b/g, 'fillOpacity')
    .replace(/\bstroke-width\b/g, 'strokeWidth')
    .replace(/\bstroke-linecap\b/g, 'strokeLinecap')
    .replace(/\bstroke-linejoin\b/g, 'strokeLinejoin')
    .replace(/\bstroke-miterlimit\b/g, 'strokeMiterlimit')
    .replace(/\bstroke-opacity\b/g, 'strokeOpacity')
    .replace(/\bstroke-dasharray\b/g, 'strokeDasharray')
    .replace(/\bxlink:href\b/g, 'xlinkHref');

  // Normalize colors to currentColor — black, near-black, and brand-active blue
  const colorReplacements = [
    [/fill="#231F20"/gi, 'fill="currentColor"'],
    [/fill="#000000"/gi, 'fill="currentColor"'],
    [/fill="#000"/gi, 'fill="currentColor"'],
    [/fill="black"/gi, 'fill="currentColor"'],
    [/fill="#4856FF"/gi, 'fill="currentColor"'],
    [/stroke="#231F20"/gi, 'stroke="currentColor"'],
    [/stroke="#000000"/gi, 'stroke="currentColor"'],
    [/stroke="#000"/gi, 'stroke="currentColor"'],
    [/stroke="black"/gi, 'stroke="currentColor"'],
    [/stroke="#4856FF"/gi, 'stroke="currentColor"'],
  ];
  for (const [re, rep] of colorReplacements) inner = inner.replace(re, rep);

  return inner.replace(/\s+/g, ' ').trim();
}

function generateComponent(componentName, inner) {
  return `export function ${componentName}(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      ${inner}
    </svg>
  );
}`;
}

function main() {
  const files = readdirSync(SRC_DIR).filter((f) => f.toLowerCase().endsWith('.svg'));
  console.log(`Processing ${files.length} SVG files...`);

  const ui = [];
  const medical = [];
  const skipped = [];

  // custom.tsx wins. Its icons are hand-corrected versions of SVGs that are
  // still sitting in the source folder — keyboard.svg carries a hardcoded
  // #5E69F6 stroke this script does not normalize, and chatswitch.svg has a
  // 12x12 viewBox that needs scaling. Generating them again would re-export
  // the same names the barrel already takes from './custom' (TS2308) and
  // reintroduce the bugs the hand-authored copies fix.
  const customSrc = readFileSync(join(OUT_DIR, 'custom.tsx'), 'utf8');
  const handAuthored = new Set(
    [...customSrc.matchAll(/export function (Icon\w+)/g)].map((m) => m[1]),
  );
  const seenNames = new Set(handAuthored);

  for (const file of files) {
    try {
      const { name, category } = parseFilename(file);
      if (handAuthored.has(name)) {
        skipped.push({ file, reason: `hand-authored in custom.tsx: ${name}` });
        continue;
      }
      if (seenNames.has(name)) {
        skipped.push({ file, reason: `duplicate name: ${name}` });
        continue;
      }
      seenNames.add(name);
      const raw = readFileSync(join(SRC_DIR, file), 'utf8');
      const inner = normalizeSvgInner(raw);
      const code = generateComponent(name, inner);
      if (category === 'ui') ui.push({ name, code });
      else medical.push({ name, code });
    } catch (err) {
      skipped.push({ file, reason: err.message });
    }
  }

  // Sort alphabetically for stable output
  ui.sort((a, b) => a.name.localeCompare(b.name));
  medical.sort((a, b) => a.name.localeCompare(b.name));

  const header = `/* AUTO-GENERATED — DO NOT EDIT.
 * Source: packages/ui/icons/
 * Regenerate: pnpm icons:generate
 */
import type { SVGProps } from 'react';

`;

  // UI icons file
  writeFileSync(
    join(OUT_DIR, 'ui.gen.tsx'),
    header + ui.map((i) => i.code).join('\n\n') + '\n',
  );
  console.log(`✓ Wrote ${ui.length} UI icons to packages/ui/src/icons/ui.gen.tsx`);

  // Medical icons file
  writeFileSync(
    join(OUT_DIR, 'medical.gen.tsx'),
    header + medical.map((i) => i.code).join('\n\n') + '\n',
  );
  console.log(`✓ Wrote ${medical.length} medical icons to packages/ui/src/icons/medical.gen.tsx`);

  // Barrel index (preserves custom-icon re-export)
  const indexContent = `/* Generated icons + custom additions. Re-run: node scripts/generate-icons.mjs */
export * from './ui.gen';
export * from './medical.gen';
export * from './custom';
`;
  writeFileSync(join(OUT_DIR, 'index.ts'), indexContent);
  console.log(`✓ Wrote barrel index.ts`);

  if (skipped.length) {
    console.log(`\nSkipped ${skipped.length}:`);
    skipped.forEach((s) => console.log(`  - ${s.file}: ${s.reason}`));
  }
  console.log(`\nTotal: ${ui.length + medical.length} icon components generated.`);
}

main();
