"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

/**
 * Scroll-triggered entrance.
 *
 * UI-PRINCIPLES.md §3 bans this outright — "the content was already there;
 * animating it in tells the reader the page is a slideshow". This component
 * exists so that rule can be judged against the thing it forbids rather than in
 * the abstract. If this direction is kept, §3 gets rewritten in the same change;
 * if it is dropped, this file goes with it.
 *
 * Two things are not negotiable whatever the aesthetic:
 *
 * - The content ships in the DOM, visible, at first paint. The class is added by
 *   script, so a reader with JS off or a crawler sees the page, not a stack of
 *   `opacity: 0`.
 * - `prefers-reduced-motion` opts out before the observer is ever constructed.
 */
export function Reveal({
  children,
  delayMs = 0,
  className,
}: {
  children: ReactNode;
  delayMs?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Arm only now: before this line the element has no `is-armed` class, so
    // its content is plain visible markup.
    el.classList.add("reveal-armed");

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          el.classList.add("reveal-in");
          io.unobserve(entry.target);
        }
      },
      // Fire a little before the element reaches the fold, so the motion has
      // finished by the time the reader is actually looking at it.
      { rootMargin: "0px 0px -12% 0px", threshold: 0.01 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className={className} style={{ "--reveal-delay": `${delayMs}ms` } as React.CSSProperties}>
      {children}
    </div>
  );
}
