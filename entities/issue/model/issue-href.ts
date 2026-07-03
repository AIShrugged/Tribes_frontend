/**
 * issueHrefSegment — the URL segment for an issue detail link. Prefers the
 * human-readable code (e.g. "DEV-960") so links read as
 * /dashboard/issues/DEV-960, falling back to the numeric id for personal issues
 * without a code. The detail route accepts both and canonicalizes a numeric id
 * to the code form when one exists.
 * @param issue - object carrying the issue id and optional code.
 * @returns the path segment (code when present, otherwise the stringified id).
 */
export function issueHrefSegment(issue: {
  id: number;
  code?: string | null;
}): string {
  return issue.code ?? String(issue.id);
}
