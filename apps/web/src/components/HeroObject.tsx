"use client";

/**
 * The gate in front of the hero's WebGL scene.
 *
 * Four things happen here and none of them in `HeroPod` itself, so that the
 * scene file is only ever about the scene:
 *
 *   1. `prefers-reduced-motion` is read before anything is imported. An
 *      entrance is decoration, not a state change, so it is removed rather
 *      than collapsed — and the chunk is never fetched, which is the part a
 *      1ms duration would not have given back.
 *   2. The chunk is `next/dynamic` with `ssr: false`, behind an
 *      IntersectionObserver, so nothing WebGL-shaped is parsed until the hero
 *      is near the viewport.
 *   3. The canvas is *unmounted* when the hero leaves, not just paused. The
 *      isolation viewer further down the page owns a context of its own, and
 *      two live contexts on one document is how a laptop fan starts.
 *   4. The static SVG holds the box at every moment the canvas does not, at
 *      the same aspect ratio, so the column never shifts.
 *
 * Colours are read from the resolved tokens rather than passed as literals,
 * which is what keeps the object on-theme through the theme toggle without a
 * second palette living in TypeScript.
 */

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";

import { HeroPodStatic } from "@/components/HeroPodStatic";
import type { PodColors } from "@/components/HeroPod";

const HeroPod = dynamic(() => import("@/components/HeroPod"), {
  ssr: false,
  loading: () => <HeroPodStatic />,
});

const FALLBACK: PodColors = {
  shell: "#deb076",
  shellDeep: "#a97c46",
  coreLit: "#42d0cf",
  coreRim: "#8be9e7",
  glyph: "#1b1611",
};

function readColors(): PodColors {
  if (typeof window === "undefined") return FALLBACK;
  const cs = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string) => {
    const v = cs.getPropertyValue(name).trim();
    return v.length > 0 ? v : fallback;
  };
  return {
    shell: read("--color-primary-300", FALLBACK.shell),
    shellDeep: read("--color-primary-500", FALLBACK.shellDeep),
    coreLit: read("--color-accent-300", FALLBACK.coreLit),
    coreRim: read("--color-accent-200", FALLBACK.coreRim),
    glyph: read("--color-surface", FALLBACK.glyph),
  };
}

/** The description a screen reader gets instead of the object. */
const LABEL =
  "The Husk mark, opened: a heavy shell and a peeled flap with the lit core between them, beside a terminal caret.";

export function HeroObject() {
  const box = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [colors, setColors] = useState<PodColors>(FALLBACK);
  const [opened, setOpened] = useState(false);
  const pointer = useRef({ x: 0, y: 0 });

  /* The query is read before the observer is built, so a reader who asked for
     less motion never has the chunk requested on their behalf. It is watched,
     not sampled once: the setting can change mid-session. */
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    setColors(readColors());
    const el = document.documentElement;
    const obs = new MutationObserver(() => setColors(readColors()));
    obs.observe(el, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (reduced) return;
    const el = box.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        setVisible(entry.isIntersecting);
        if (entry.isIntersecting) setMounted(true);
      },
      { rootMargin: "200px 0px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [reduced]);

  /* Unmount once the hero is well clear, so only one WebGL context is ever
     live. `mounted` going false is what actually frees it. */
  useEffect(() => {
    if (visible || !mounted) return;
    const id = window.setTimeout(() => setMounted(false), 400);
    return () => window.clearTimeout(id);
  }, [visible, mounted]);

  /* Mutated in place, never reassigned. `HeroPod` is handed this object once
     and reads it inside useFrame; a fresh object on every pointermove would
     leave the scene holding the first one forever. */
  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    pointer.current.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    pointer.current.y = ((e.clientY - r.top) / r.height) * 2 - 1;
  }, []);

  const onPointerLeave = useCallback(() => {
    pointer.current.x = 0;
    pointer.current.y = 0;
  }, []);

  const onOpened = useCallback(() => setOpened(true), []);

  return (
    <div
      ref={box}
      className="hero-object"
      data-opened={opened || reduced ? "true" : "false"}
      onPointerMove={reduced ? undefined : onPointerMove}
      onPointerLeave={reduced ? undefined : onPointerLeave}
    >
      {/* The object's meaning, for anyone not receiving it as pixels. Kept
          outside the conditional so it is in the DOM whichever branch renders. */}
      <p className="visually-hidden">{LABEL}</p>

      {reduced || !mounted ? (
        <HeroPodStatic />
      ) : (
        <HeroPod
          colors={colors}
          running={visible}
          pointer={pointer.current}
          onOpened={onOpened}
        />
      )}
    </div>
  );
}

export default HeroObject;
