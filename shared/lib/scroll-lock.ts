// Browser-only module — never import from Server Components
let lockCount = 0;
let savedScrollY = 0;

export function lockScroll(): void {
  if (lockCount++ > 0) return;
  savedScrollY = window.scrollY;
  document.body.style.position = 'fixed';
  document.body.style.top = `-${savedScrollY}px`;
  document.body.style.width = '100%';
  document.body.style.overflowY = 'scroll';
}

export function unlockScroll(): void {
  if (lockCount <= 0) return;
  if (--lockCount > 0) return;
  document.body.style.position = '';
  document.body.style.top = '';
  document.body.style.width = '';
  document.body.style.overflowY = '';
  window.scrollTo(0, savedScrollY);
}
