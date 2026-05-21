---
status: pending
priority: p2
issue_id: '030'
tags: [code-review, telegram, rate-limiting, ux, security]
dependencies: []
---

# P2: No rate-limit or debounce on `generateTelegramLink` — user can spam the button

## Problem Statement

The plan does not include any debounce, loading state guard, or rate-limit on
the "Connect Telegram" and "Get New Link" buttons. While `isPending` from
`useTransition` was planned as a guard (now removed — see todo 021), there is no
replacement. A user who double-clicks or rapidly clicks the button could fire
multiple `generateTelegramLink()` Server Action calls, invalidating each
previous token before the user has a chance to use it.

The backend invalidates the previous token on each POST, so rapid clicks are
harmless from a data integrity standpoint, but create a poor UX (constantly
refreshing countdown, multiple network requests) and could trip backend rate
limits.

## Findings

From `security-sentinel`:

```typescript
// Planned code — no guard
async function handleGenerate() {
  const result = await generateTelegramLink(); // can be called multiple times concurrently
  if (result.error) { toast.error(result.error); return; }
  setLinkData(result.data);
  transition('awaiting');
}

// Button:
<button onClick={handleGenerate}>Connect Telegram</button>
// No disabled state, no isPending guard
```

After todo 021 removes `useTransition`, there is no `isPending` equivalent to
disable the button during the server action call.

## Proposed Solutions

### Option A — Use local `isGenerating` ref + disabled button (Recommended)

```typescript
const isGeneratingRef = useRef(false);

async function handleGenerate() {
  if (isGeneratingRef.current) return;
  isGeneratingRef.current = true;
  try {
    const result = await generateTelegramLink();
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setLinkData(result.data);
    transition('awaiting');
  } finally {
    isGeneratingRef.current = false;
  }
}
```

And disable the button while generating:

```typescript
const [isGenerating, setIsGenerating] = useState(false);

async function handleGenerate() {
  if (isGenerating) return;
  setIsGenerating(true);
  try {
    const result = await generateTelegramLink();
    // ...
  } finally {
    setIsGenerating(false);
  }
}

// Button:
<button onClick={handleGenerate} disabled={isGenerating} aria-busy={isGenerating}>
  {isGenerating ? 'Generating...' : 'Connect Telegram'}
</button>
```

**Pros:** Simple, correct, accessible (`aria-busy`, `disabled`). Prevents
double-submit. State-driven so React re-renders correctly. **Cons:** Slightly
more state. **Effort:** Small. **Risk:** None.

### Option B — Use `useTransition` for `handleGenerate` only (not the poll hook)

```typescript
const [isPending, startTransition] = useTransition();

function handleGenerate() {
  startTransition(async () => {
    const result = await generateTelegramLink();
    // ...
  });
}

// Button:
<button disabled={isPending}>Connect Telegram</button>
```

**Pros:** Uses React's built-in mechanism; `isPending` is a stable subscription
per the React 19 contract for `useTransition` (not a closure capture issue —
this only breaks inside `useEffect` closures, not in event handlers). **Cons:**
Low-priority transition — UI updates are deferred. For a button click response,
this is appropriate. **Effort:** Trivial. **Risk:** None.

## Recommended Action

**Option B** for `handleGenerate` (button click handler — `useTransition` is
correct here; the stale-closure issue from todo 021 only affects `useEffect`
closures, not event handlers). Remove `useTransition` from the _poll hook_
(todo 021) but keep it in the _component_ for `handleGenerate`.

## Technical Details

- **Affected file (planned):**
  `features/user-profile/ui/TelegramLinkSection.tsx`
- **Functions affected:** `handleGenerate`, possibly `handleUnlink`
- **Note:** `handleUnlink` also needs a loading guard — double-clicking unlink
  could fire two DELETE calls

## Acceptance Criteria

- [ ] "Connect Telegram" button is disabled while `generateTelegramLink()` is
      in-flight
- [ ] "Get New Link" button (expired state retry) also disabled while in-flight
- [ ] Button shows loading indicator or text change while disabled
- [ ] `aria-busy={true}` set on button while loading
- [ ] Test: click button twice rapidly → verify `generateTelegramLink` called
      exactly once

## Work Log

- 2026-05-20: Found by security-sentinel during review of Telegram account
  linking plan.
