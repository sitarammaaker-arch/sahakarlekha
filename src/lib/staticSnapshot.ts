/**
 * The prerendered static body (scripts/prerender-guide.mjs) captured BEFORE React's createRoot
 * replaces #root. Loading states on the same URL (route-chunk Suspense fallback, the blog article
 * waiting for its body chunk) keep showing it, instead of swapping a fully readable page for a
 * spinner / "लेख लोड हो रहा है…" and back again.
 */
let snap: { path: string; html: string } | null = null;

const norm = (p: string) => p.replace(/\/+$/, '') || '/';

/** Call once in main.tsx, before createRoot(). */
export function captureStaticSnapshot(root: HTMLElement | null): void {
  const html = root?.innerHTML.trim() ?? '';
  snap = html ? { path: norm(window.location.pathname), html } : null;
}

/** The captured static HTML when `pathname` is the URL the page was served for, else null. */
export function staticSnapshotFor(pathname: string): string | null {
  return snap && snap.path === norm(pathname) ? snap.html : null;
}
