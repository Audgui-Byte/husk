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

  /**
   * Lighthouse flagged "missing source maps for large first-party JavaScript".
   * The bundle is first-party and Apache-2.0 -- the source is already public,
   * so there is nothing here a map could leak, and without one a production
   * stack trace names a minified symbol.
   *
   * The maps are emitted as separate `.map` files and only fetched when a
   * reader opens devtools, so this costs deployment size and nothing on the
   * critical path.
   */
  productionBrowserSourceMaps: true,

  experimental: {
    /**
     * Against the ~146 KiB of unused JavaScript in the same report. These are
     * barrel packages: `import { Canvas } from "@react-three/fiber"` pulls the
     * whole index through the bundler's side-effect analysis. Rewriting each
     * named import to its own module lets tree-shaking see what is actually
     * reachable. `three` is the one that matters -- it is the largest
     * dependency on the site by an order of magnitude.
     */
    optimizePackageImports: ["three", "@react-three/fiber"],
  },
};

export default nextConfig;
