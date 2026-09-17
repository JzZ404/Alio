import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Guards against the defect that shipped twice from this package:
 * `useFamilyMessages.ts` first, then `MessageActionSheet.tsx` — a module that
 * calls a React hook but has no `'use client'` directive. Every app in this
 * monorepo re-exports this package through one barrel (`src/index.ts`), so a
 * Server Component that imports anything from `@alio/ui` pulls in the whole
 * barrel's module graph. One un-marked hook-using module anywhere in that
 * graph fails every request through a Server Component, not just the screen
 * that actually renders it — unit tests and typecheck both pass regardless,
 * since only a real Next render surfaces it.
 *
 * `SRC_ROOT` is derived from this file's own location, not `process.cwd()`,
 * so the scan works the same regardless of where `vitest` is invoked from.
 */
const SRC_ROOT = dirname(fileURLToPath(import.meta.url));

const HOOK_PATTERN =
  /\b(useState|useEffect|useCallback|useRef|useMemo|useLayoutEffect|useReducer|useSyncExternalStore|useTransition|useDeferredValue|useImperativeHandle)\b/;

const DIRECTIVE_PATTERN = /^(['"])use client\1;?$/;

function collectSourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'icons') continue;

    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(fullPath));
      continue;
    }

    if (!entry.isFile()) continue;

    const ext = extname(entry.name);
    if (ext !== '.ts' && ext !== '.tsx') continue;
    if (entry.name.endsWith('.test.ts') || entry.name.endsWith('.test.tsx')) continue;

    files.push(fullPath);
  }
  return files;
}

function firstNonEmptyLine(source: string): string | null {
  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.length > 0) return trimmed;
  }
  return null;
}

describe('client-directive guard', () => {
  it("requires 'use client' as the first line of every file that touches a React hook", () => {
    const offenders: string[] = [];

    for (const filePath of collectSourceFiles(SRC_ROOT)) {
      const source = readFileSync(filePath, 'utf8');
      if (!HOOK_PATTERN.test(source)) continue;

      const firstLine = firstNonEmptyLine(source);
      if (firstLine !== null && DIRECTIVE_PATTERN.test(firstLine)) continue;

      offenders.push(join('src', relative(SRC_ROOT, filePath)).split('\\').join('/'));
    }

    expect(offenders, `expected 'use client' in: ${offenders.join(', ')}`).toEqual([]);
  });
});
