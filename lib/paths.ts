/**
 * Resolves a repository-absolute asset path against the deployment base path.
 *
 * NEXT_PUBLIC_* variables are inlined by Next at build time, so this works in a static export.
 * Kept in sync with next.config.ts, which reads the same variable.
 */
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function assetUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return `${BASE_PATH}${path.startsWith("/") ? path : `/${path}`}`;
}
