import clsx from 'clsx';

/**
 * issueCodeLabel — the display string for an issue's code, with an id fallback.
 * Use for non-JSX contexts (SVG <text>, string concatenation). For rendering in
 * the DOM prefer {@link IssueCodeBadge}.
 * @param code - the issue/epic code (e.g. "DEV-14"), or null for personal issues.
 * @param id - numeric id used as the fallback.
 * @returns "DEV-14" when a code exists, otherwise "#14".
 */
export function issueCodeLabel(code: string | null | undefined, id: number) {
  return code ?? `#${id.toString()}`;
}

interface IssueCodeBadgeProps {
  code?: string | null;
  id: number;
  className?: string;
}

/**
 * IssueCodeBadge — monospace chip showing an issue's human-readable code
 * (e.g. "DEV-14"). Falls back to "#{id}" for personal issues without an org
 * (code is null). Display-only — the surrounding name already links to the
 * numeric issue detail route.
 * @param props - Component props.
 * @param props.code - the issue code, or null.
 * @param props.id - numeric id used as the fallback.
 * @param props.className - extra classes.
 * @returns JSX element.
 */
export function IssueCodeBadge({ code, id, className }: IssueCodeBadgeProps) {
  return (
    <span
      className={clsx('font-mono text-xs text-muted-foreground', className)}
    >
      {issueCodeLabel(code, id)}
    </span>
  );
}
