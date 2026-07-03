export interface ParsedApiError {
  message: string;
  fieldErrors: Record<string, string>;
  /**
   * Machine-readable backend error code from the envelope's `meta.error_code`
   * (e.g. `SECOND_BRAIN_CREDENTIAL_REQUIRED`). Undefined when absent — lets
   * actions branch on the exact domain error rather than the message string.
   */
  errorCode?: string;
}

/**
 * parseApiError parses a Laravel-style error payload into a flat structure.
 * Supports `{ message, errors }` validation payloads, the app envelope's
 * `meta.error_code`, and generic string bodies.
 * @param text - raw response text.
 * @param fallback - fallback message.
 * @returns ParsedApiError.
 */
export function parseApiError(
  text: string,
  fallback = 'Request failed. Please try again.',
): ParsedApiError {
  if (!text) {
    return { message: fallback, fieldErrors: {} };
  }

  try {
    const json = JSON.parse(text) as {
      message?: string;
      error?: string;
      errors?: Record<string, string[] | string>;
      meta?: { error_code?: string } | null;
    };
    const fieldErrors = Object.fromEntries(
      Object.entries(json.errors ?? {}).map(([field, value]) => {
        return [field, Array.isArray(value) ? (value[0] ?? '') : value];
      }),
    );

    return {
      message: json.message ?? json.error ?? fallback,
      fieldErrors,
      errorCode: json.meta?.error_code,
    };
  } catch {
    return { message: text || fallback, fieldErrors: {} };
  }
}
