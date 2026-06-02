export function redirectToExternal(url: string): void {
  globalThis.location.href = url;
}
