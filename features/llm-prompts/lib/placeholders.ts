// No /g flag on the constant — avoids stateful lastIndex bugs in loops.
// Construct fresh regexes with /g at each call site.
// [a-zA-Z_] for the first char (no digits), \w for subsequent chars (letters, digits, underscore)
export const PLACEHOLDER_PATTERN = /\{[a-zA-Z_]\w*\}/;

export interface TextSegment {
  text: string;
  isToken: boolean;
}

const MAX_SEGMENTS = 500;

function pushTextSegment(segments: TextSegment[], text: string): void {
  segments.push({ text, isToken: false });
}

function pushTokenSegment(segments: TextSegment[], text: string): void {
  segments.push({ text, isToken: true });
}

/**
 * buildSegments — splits text into plain and token segments for highlight rendering.
 * Caps at MAX_SEGMENTS to prevent performance issues on huge prompts.
 * @param text - The prompt text to segment.
 * @param pattern - Pattern without the /g flag — a fresh /g copy is constructed internally.
 * @returns Array of TextSegment objects.
 */
export function buildSegments(text: string, pattern: RegExp): TextSegment[] {
  const segments: TextSegment[] = [];
  let lastIndex = 0;
  // eslint-disable-next-line security/detect-non-literal-regexp
  const re = new RegExp(pattern.source, 'g');
  let match: RegExpExecArray | null;
  let count = 0;

  while ((match = re.exec(text)) !== null) {
    if (count >= MAX_SEGMENTS) {
      pushTextSegment(segments, text.slice(lastIndex));

      return segments;
    }

    if (match.index > lastIndex) {
      pushTextSegment(segments, text.slice(lastIndex, match.index));
      count++;
    }

    pushTokenSegment(segments, match[0]);
    count++;
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    pushTextSegment(segments, text.slice(lastIndex));
  }

  return segments;
}

/**
 * extractPlaceholders — returns deduplicated list of all {placeholder} tokens in text.
 * @param text - The prompt text to scan.
 * @returns Array of unique placeholder strings including braces.
 */
export function extractPlaceholders(text: string): string[] {
  // eslint-disable-next-line security/detect-non-literal-regexp
  const re = new RegExp(PLACEHOLDER_PATTERN.source, 'g');

  return [...new Set([...text.matchAll(re)].map((m) => {
    return m[0];
  }))];
}

/**
 * diffPlaceholders — returns placeholders present in original but missing from current.
 * @param original - Placeholders in the original prompt.
 * @param current - Placeholders in the current (edited) prompt.
 * @returns Array of removed placeholder strings.
 */
export function diffPlaceholders(original: string[], current: string[]): string[] {
  const currentSet = new Set(current);

  return original.filter((p) => {
    return !currentSet.has(p);
  });
}
