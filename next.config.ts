import type { NextConfig } from "next";

// Static hosting target. Set NEXT_PUBLIC_BASE_PATH when the site is served from a sub-path
// (e.g. GitHub Pages project sites: /genshin-randomiser). Cloudflare Pages and user/org
// GitHub Pages serve from the root, so the default of "" is correct there.
// Application code reads the same env var directly in lib/paths.ts — NEXT_PUBLIC_* values are
// inlined at build time, so the two always agree.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  basePath: basePath || undefined,
  // No Node server at runtime, so no image optimiser either.
  images: { unoptimized: true },
  // Emit out/index.html as a directory index; friendlier for static hosts.
  trailingSlash: true,
  reactStrictMode: true,
};

export default nextConfig;
