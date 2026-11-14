/**
 * Which URL paths need the logged-in app's data providers (src/AppDataShell). PURE.
 *
 * A path is public when its first segment is listed here; every other path — every app screen, and any
 * path nobody listed — gets the providers. So forgetting to list a new public page costs speed on that
 * page, never correctness; listing an app screen here by mistake would break it, and
 * scripts/test-app-data-paths.mjs fails if a ProtectedRoute path is ever listed.
 */
export const PUBLIC_SEGMENTS: ReadonlySet<string> = new Set([
  '',                       // landing page
  'login', 'register', 'reset-password', 'verify-email', 'email-unsubscribe',
  'about', 'contact', 'faq', 'pricing', 'privacy', 'terms', 'editorial-policy', 'partner',
  'blog', 'author', 'guide', 'glossary', 'help', 'cookbook', 'tools', 'downloads',
  'software', 'cooperative-software',
  'search', 'ask', 'verify-backup',
  'member', 'sadasya',      // member portal — its own auth client, none of the society's app data
]);

export const firstSegment = (pathname: string): string => pathname.replace(/^\/+/, '').split('/')[0] ?? '';

/** True when this path is an app screen (or unknown) and must have the data providers mounted. */
export const needsAppData = (pathname: string): boolean => !PUBLIC_SEGMENTS.has(firstSegment(pathname));
