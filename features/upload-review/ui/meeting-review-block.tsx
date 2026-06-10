/**
 * Read-only notice that a meeting effectiveness review was generated but is held until approval.
 * The full review content lives on the meeting; here we only confirm it will be delivered on approve.
 */
export function MeetingReviewBlock({ reviewId }: { reviewId: number | null }) {
  if (reviewId == null) {
    return null;
  }

  return (
    <section className='rounded-md border border-border bg-muted/30 p-3 text-sm text-muted-foreground'>
      A meeting effectiveness review was generated and will be delivered to the
      team channels after approval.
    </section>
  );
}
