import type { Metadata, Viewport } from "next";

import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { SITE_DESCRIPTION, SITE_URL } from "@/lib/content";
import "./globals.css";

/**
 * No next/font/google here, and no <link> to a font CDN. The product's claim
 * is that nothing leaves your machine; a third-party font origin on the
 * homepage would contradict it in the first 200ms. The three brand faces are
 * self-hosted from /fonts — see public/fonts/README.md.
 */

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Husk — a real computer for your AI chat",
    template: "%s — Husk",
  },
  description: SITE_DESCRIPTION,
  applicationName: "Husk",
  keywords: [
    "AI agent",
    "MCP",
    "Claude Code",
    "Linux container",
    "Docker",
    "local-first",
    "husk.yaml",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "Husk",
    url: "/",
    title: "Husk — a real computer for your AI chat",
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "Husk — a real computer for your AI chat",
    description: SITE_DESCRIPTION,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "dark light",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0f0b07" },
    { media: "(prefers-color-scheme: light)", color: "#f6f3ed" },
  ],
};

/**
 * Applies a remembered theme before first paint. Without this the page renders
 * dark and then snaps to light, which is a flash of the wrong interface rather
 * than a transition.
 */
const THEME_SCRIPT = `try{var t=localStorage.getItem('husk-theme');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t)}}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        {/* The two faces above the fold, and only those. The mono face is not
            preloaded: the first thing set in it is the install command, which
            sits below the headline, and preloading a third file would delay
            the two that paint first. Latin only — latin-ext is requested by
            unicode-range when a page actually needs it. */}
        <link
          rel="preload"
          as="font"
          type="font/woff2"
          href="/fonts/BricolageGrotesque-latin.woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          as="font"
          type="font/woff2"
          href="/fonts/InstrumentSans-latin.woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
