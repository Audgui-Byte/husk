"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

import { CoreStatic } from "@/components/CoreStatic";
import type { CoreColors } from "@/components/HuskCore";

/**
 * The hero object: the shell assembles, then scroll opens it.
 *
 * This is the same `HuskCore` the Providers section uses — twenty instanced
 * plates around a lit core — driven by page state instead of by a provider
 * picker. Two motions, and both mean something:
 *
 *   on load   the plates converge out of a scattered ring and seal.
 *             "your chat gets a computer of its own", in geometry.
 *   on scroll the shell opens again across the height of the hero, exposing
 *             the core as the reader reaches the transcript that proves it.
 *
 * Scroll position drives separation directly rather than triggering a canned
 * animation, so it is reversible: scroll back up and the shell closes. That is
 * the difference between choreography and a cutscene.
 *
 * UI-PRINCIPLES.md §3 bans the idle rotation and §8.2 bans the decorative
 * rotating shape. Both are deliberate here and both are on the table in the PR
 * this lands in.
 *
 * Cost: `HuskCore` is two draw calls and ~1.4k triangles. The chunk is lazy and
 * `ssr: false`, with the same SVG the Providers fallback draws standing in
 * until it arrives, so nothing shifts. Under `prefers-reduced-motion` the SVG
 * is all that ever renders and no WebGL context is created.
 */

const HuskCore = dynamic(() => import("@/components/HuskCore"), {
  ssr: false,
  loading: () => <CoreStatic shell="sealed" />,
});

const FALLBACK_COLORS: CoreColors = {
  shell: "#deb076",
  coreDeep: "#005251",
  coreLit: "#42d0cf",
  coreRim: "#8be9e7",
};

function readTokenColors(): CoreColors {
  if (typeof window === "undefined") return FALLBACK_COLORS;
  const cs = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
  return {
    // The same four tokens IsolationViewer reads. Named, not guessed: the
    // glow in this branch spent a revision resolving to `none` because I
    // invented `--color-accent`, which the scale does not define.
    shell: read("--color-primary-fill", FALLBACK_COLORS.shell),
    coreDeep: read("--color-accent-700", FALLBACK_COLORS.coreDeep),
    coreLit: read("--color-accent-fill", FALLBACK_COLORS.coreLit),
    coreRim: read("--color-accent-200", FALLBACK_COLORS.coreRim),
  };
}

/** Scattered at 1, sealed at 0. The entrance runs this to zero. */
const ENTRANCE_FROM = 1;
const ENTRANCE_MS = 1400;

/** Radians per second of idle yaw. Slow enough to read as a lit object. */
const IDLE_YAW = 0.16;

export function HeroObject() {
  const [reduced, setReduced] = useState(true);
  const [colors, setColors] = useState<CoreColors>(FALLBACK_COLORS);
  const [onScreen, setOnScreen] = useState(true);
  const [tabVisible, setTabVisible] = useState(true);

  // Driven at ~24fps; HuskCore lerps between the values it is handed, so the
  // object still moves at display rate without React rendering at display rate.
  const [frame, setFrame] = useState({ separation: ENTRANCE_FROM, exposure: 0, yaw: 0.62 });

  const hostRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef(0);

  useEffect(() => {
    setColors(readTokenColors());
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onMq = () => setReduced(mq.matches);
    mq.addEventListener("change", onMq);

    const onVis = () => setTabVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVis);

    const el = hostRef.current;
    const io = el
      ? new IntersectionObserver((es) => setOnScreen(es.some((e) => e.isIntersecting)), {
          threshold: 0.01,
        })
      : undefined;
    if (el && io) io.observe(el);

    return () => {
      mq.removeEventListener("change", onMq);
      document.removeEventListener("visibilitychange", onVis);
      io?.disconnect();
    };
  }, []);

  // 0 at the top of the page, 1 once the hero has scrolled away.
  useEffect(() => {
    if (reduced) return;
    const read = () => {
      const h = hostRef.current?.closest("section")?.getBoundingClientRect();
      scrollRef.current = h ? Math.min(1, Math.max(0, -h.top / Math.max(1, h.height))) : 0;
    };
    read();
    window.addEventListener("scroll", read, { passive: true });
    window.addEventListener("resize", read);
    return () => {
      window.removeEventListener("scroll", read);
      window.removeEventListener("resize", read);
    };
  }, [reduced]);

  useEffect(() => {
    if (reduced || !onScreen || !tabVisible) return;
    const started = performance.now();
    let raf = 0;
    let last = 0;

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (now - last < 1000 / 24) return;
      last = now;

      // Entrance: cubic ease-out from scattered to sealed.
      const t = Math.min(1, (now - started) / ENTRANCE_MS);
      const eased = 1 - Math.pow(1 - t, 3);
      const entrance = ENTRANCE_FROM * (1 - eased);

      // Scroll re-opens it. The larger of the two wins, so an early scroll
      // never yanks the shell shut mid-entrance.
      const scrolled = scrollRef.current;
      const separation = Math.max(entrance, scrolled * 0.42);

      setFrame({
        separation,
        exposure: scrolled,
        yaw: 0.62 + ((now - started) / 1000) * IDLE_YAW,
      });
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduced, onScreen, tabVisible]);

  return (
    <div ref={hostRef} className="hero-object">
      {reduced ? (
        <CoreStatic shell="sealed" />
      ) : (
        <HuskCore
          separation={frame.separation}
          exposure={frame.exposure}
          yaw={frame.yaw}
          pitch={-0.28}
          pulseKey={0}
          running={onScreen && tabVisible}
          onSettled={() => {}}
          colors={colors}
        />
      )}
    </div>
  );
}
