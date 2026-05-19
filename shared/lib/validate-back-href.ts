const ALLOWED_BACK_PATHS = [
  '/dashboard/issues/kanban',
  '/dashboard/issues/list',
  '/dashboard/issues/progress',
] as const;

/**
 * Validates and decodes a `from` query param for safe back-navigation.
 * Only allows root-relative paths starting with an issues tab route.
 * Prevents open redirects and path traversal. Returns null for invalid input.
 */
export function validateBackHref(from?: string): string | null {
  if (!from) return null;

  try {
    const decoded = decodeURIComponent(from);
    if (!decoded.startsWith('/')) return null;

    const url = new URL(decoded, 'https://placeholder.invalid');
    const isAllowed = ALLOWED_BACK_PATHS.some((path) => {
      return url.pathname.startsWith(path);
    });

    return isAllowed ? url.pathname + url.search : null;
  } catch {
    return null;
  }
}
