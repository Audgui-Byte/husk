/**
 * What the hover previews show.
 *
 * One entry per destination, so the three call sites cannot end up describing
 * the same page two different ways. Titles and summaries are quoted from each
 * page's own metadata; the images are the routes' own `opengraph-image`, which
 * is the same PNG the link unfurls to.
 *
 * `/preview/source` is a route handler rather than an `opengraph-image`
 * because its link goes to GitHub and there is no page for the convention to
 * attach to. Same renderer, same pipeline.
 */

export interface Preview {
  href: string;
  image: string;
  title: string;
  summary: string;
  external?: boolean;
}

export const PREVIEWS = {
  pricing: {
    href: "/pricing",
    image: "/pricing/opengraph-image",
    title: "Pricing",
    summary:
      "There is no paid tier and no edition you are not already using.",
  },
  manifesto: {
    href: "/manifesto",
    image: "/manifesto/opengraph-image",
    title: "Why agents need honest sandboxes",
    summary:
      "Guardrails stop accidents. Only isolation stops a prompt-injected model.",
  },
  source: {
    href: "https://github.com/Hotragn/husk",
    image: "/preview/source",
    title: "Hotragn/husk",
    summary: "Apache-2.0. Every claim on this site is checkable against it.",
    external: true,
  },
} satisfies Record<string, Preview>;
