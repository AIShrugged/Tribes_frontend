---
status: pending
priority: p1
issue_id: '022'
tags: [code-review, telegram, security, url-validation, open-redirect]
dependencies: []
---

# P1: `validateTelegramUrl` allows any `.me` TLD — open redirect / phishing vector

## Problem Statement

The planned `validateTelegramUrl` function in `TelegramLinkSection.tsx` checks
`parsed.hostname.endsWith('.me')` to validate the Telegram deep link returned by
the backend. This is insufficient: any `.me` TLD domain (e.g., `evil.me`,
`telegram.evil.me`, `t.me.attacker.com`) would pass the check. If the backend is
ever compromised or a SSRF bug exists, the frontend would redirect users to
attacker-controlled Telegram-lookalike URLs.

The fix is a one-line change — use exact hostname matching instead.

## Findings

From `security-sentinel`, `kieran-typescript-reviewer`:

```typescript
// Planned code — VULNERABLE
function validateTelegramUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.hostname.endsWith('.me');
    //                                                        ^^^^^^^^^^^^
    // 'evil.me'        → passes ✗
    // 't.me.evil.com'  → fails (not .me TLD) but...
    // 'telegram.evil.me' → passes ✗
  } catch {
    return false;
  }
}
```

Attack scenarios:

1. `https://evil.me/spodial_bot?start=token` — passes `.endsWith('.me')`
2. `https://telegram.evil.me/...` — passes (subdomain of evil.me)
3. SSRF/MITM on backend — can serve any `.me` URL

## Proposed Solutions

### Option A — Exact hostname match (Recommended)

```typescript
const ALLOWED_TELEGRAM_HOSTS = new Set(['t.me', 'telegram.me']);

function validateTelegramUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'https:' &&
      ALLOWED_TELEGRAM_HOSTS.has(parsed.hostname)
    );
  } catch {
    return false;
  }
}
```

**Pros:** Exact allowlist — only real Telegram domains pass. Easy to extend if
Telegram adds domains. **Cons:** None. **Effort:** Trivial (3 lines). **Risk:**
None — stricter is safer.

### Option B — Hardcode `t.me` only

```typescript
function validateTelegramUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.hostname === 't.me';
  } catch {
    return false;
  }
}
```

**Pros:** Even simpler, single known domain. **Cons:** Doesn't handle
`telegram.me` if Telegram uses it as a redirect base. **Effort:** Trivial.
**Risk:** None.

## Recommended Action

**Option A** — Use `ALLOWED_TELEGRAM_HOSTS = new Set(['t.me', 'telegram.me'])`.
Export the constant so it can be tested independently. Both `t.me` and
`telegram.me` are official Telegram domains; the allowlist approach is
forward-compatible.

## Technical Details

- **Affected file (planned):**
  `features/user-profile/ui/TelegramLinkSection.tsx`
- **Function:** `validateTelegramUrl`
- **Attack class:** Open redirect / phishing (CWE-601)
- **Note:** Even though the URL comes from the backend (trusted),
  defense-in-depth validation on the frontend prevents exploitation if the
  backend is compromised or has a bug.

## Acceptance Criteria

- [ ] `validateTelegramUrl` uses exact hostname matching, not `.endsWith()`
- [ ] `ALLOWED_TELEGRAM_HOSTS` constant is exported for testability
- [ ] `validateTelegramUrl('https://evil.me/bot')` returns `false`
- [ ] `validateTelegramUrl('https://telegram.evil.me/bot')` returns `false`
- [ ] `validateTelegramUrl('https://t.me/bot?start=token')` returns `true`
- [ ] `validateTelegramUrl('https://telegram.me/bot?start=token')` returns
      `true`
- [ ] Unit tests cover all four cases above

## Work Log

- 2026-05-20: Found by security-sentinel and kieran-typescript-reviewer during
  review of Telegram account linking plan.
