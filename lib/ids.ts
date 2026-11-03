/**
 * Ids only need to be unique within one browser's saved payload, so a truncated UUID is plenty.
 *
 * `crypto.randomUUID` is undefined outside secure contexts, which includes `http://` previews on
 * a LAN address, so the fallback is not theoretical.
 */
export function newId(prefix: string): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === "function") {
    return `${prefix}-${cryptoApi.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}
