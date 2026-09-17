import type { NextConfig } from "next";

/**
 * `trailingSlash: false` is Next's default and is written down anyway, because
 * it is the canonical-URL contract the rest of the site is built on: every
 * `sitemap.ts` entry, every `alternates.canonical`, and the 308 a reader gets
 * for `/manifesto/` all assume the no-slash form. A default that changes across
 * a major version would move all of them at once, silently.
 *
 * Deliberately no `vercel.json`. On a Next project Vercel reads redirects,
 * headers, `cleanUrls` and `trailingSlash` from the build output, and declaring
 * them in both places is how a site ends up serving two redirects for one URL.
 * Root Directory — the one setting that actually matters for this monorepo — is
 * a project setting and cannot be expressed in a committed file at all.
 */
const nextConfig: NextConfig = {
  trailingSlash: false,
  poweredByHeader: false,
};

export default nextConfig;
