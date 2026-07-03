import { parseApiError } from '@/shared/lib/apiError';

describe('parseApiError', () => {
  it('extracts message and flattens field errors', () => {
    const body = JSON.stringify({
      message: 'Validation failed',
      errors: {
        claude_auth_token: ['The token must be at least 8 characters.'],
      },
    });

    const parsed = parseApiError(body, 'fallback');

    expect(parsed.message).toBe('Validation failed');
    expect(parsed.fieldErrors.claude_auth_token).toBe(
      'The token must be at least 8 characters.',
    );
  });

  it('surfaces meta.error_code from the app envelope', () => {
    const body = JSON.stringify({
      success: false,
      message: 'Credential required',
      meta: { error_code: 'SECOND_BRAIN_CREDENTIAL_REQUIRED' },
    });

    const parsed = parseApiError(body, 'fallback');

    expect(parsed.errorCode).toBe('SECOND_BRAIN_CREDENTIAL_REQUIRED');
    expect(parsed.message).toBe('Credential required');
  });

  it('leaves errorCode undefined when meta is absent', () => {
    const parsed = parseApiError(
      JSON.stringify({ message: 'boom' }),
      'fallback',
    );

    expect(parsed.errorCode).toBeUndefined();
  });

  it('falls back to the provided message on empty or non-JSON input', () => {
    expect(parseApiError('', 'fallback').message).toBe('fallback');
    expect(parseApiError('not json', 'fallback').message).toBe('not json');
  });
});
