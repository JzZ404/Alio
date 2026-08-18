/**
 * `next/navigation` stand-in for the design-system bundle — see next-link.tsx.
 *
 * `usePathname()` drives TabBar's active-tab pill. Outside a Next app there is
 * no route, so it reports `/home` (the app's landing tab) unless a host page
 * sets `window.__ALIO_PATHNAME__`.
 */
const FALLBACK_PATHNAME = '/home';

export function usePathname(): string {
  const override = (globalThis as { __ALIO_PATHNAME__?: string }).__ALIO_PATHNAME__;
  return override ?? FALLBACK_PATHNAME;
}

export function useRouter() {
  const noop = () => {};
  return { push: noop, replace: noop, back: noop, forward: noop, refresh: noop, prefetch: noop };
}

export function useSearchParams(): URLSearchParams {
  return new URLSearchParams();
}

export function useParams(): Record<string, string> {
  return {};
}

export function useSelectedLayoutSegment(): string | null {
  return null;
}

export function redirect(_url: string): void {}
export function notFound(): void {}
