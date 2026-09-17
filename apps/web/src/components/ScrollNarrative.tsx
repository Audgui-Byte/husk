"use client";

/**
 * The page's one set-piece: a chat that gets a computer, scrubbed by scroll.
 *
 * It sits between the hero and "Husk does two things" and carries no heading
 * of its own, because it is not a tenth section — it is the animated form of
 * the story those two already tell in prose. Four beats:
 *
 *   1. an empty chat, caret waiting
 *   2. the install command typing itself into the composer
 *   3. the command sent, tool calls firing, real output landing
 *   4. the chat coming apart, its pieces converging into the husk mark
 *
 * Nothing here is invented. The command is `MCP_COMMAND`, the same string the
 * hero's install block sets. The tool names are `MCP_TOOLS`. The transcript is
 * the `uname -sr` / note.txt exchange out of `TRANSCRIPT`, which ran on a real
 * machine. This site's whole argument is that it shows real output; a fake
 * transcript in the one animated moment would be the worst possible place to
 * break that.
 *
 * Why scroll and not time
 * -----------------------
 * A headline that types itself is lying about latency. A transcript being
 * dragged by the scrollbar is a diagram: the reader sets the clock, it runs
 * backwards as readily as forwards, and it cannot claim anything about how
 * long the real thing takes.
 *
 * SEO, no-JS, and the hiding problem
 * ----------------------------------
 * Every line of that content is real text, server-rendered, visible on
 * arrival. The initial states that beats 1-3 animate *from* live behind
 * `[data-anim="on"]`, and that attribute is set by script after mount — so a
 * crawler, a reader with JS off, and a failed hydration all get the whole
 * transcript as a plain readable block instead of a stack of opacity: 0.
 *
 * GSAP is imported inside the effect rather than at module scope. The brief
 * for this asked for `next/dynamic` with `ssr: false`, which would have taken
 * the text out of the HTML along with the animation; importing the library
 * lazily keeps the payload off the critical path and the content in the
 * document, which is what `ssr: false` was being asked for in the first place.
 */

import { useEffect, useRef } from "react";

import { MCP_COMMAND, MCP_TOOLS, TRANSCRIPT } from "@/lib/content";
import { CORE_OUTLINE, FLAP_OUTLINE, SHELL_OUTLINE, type Vec2 } from "@/lib/husk-pod";

/* What the one line adds to the conversation -- not what this exchange fired.
   The exchange below is three shell calls; captioning it with four tool names
   would imply four tools ran, which is the kind of small lie this site does
   not get to tell. The heading above the list says "now has" for that reason.
   Names come from MCP_TOOLS so a rename upstream cannot leave this animating
   a tool that no longer exists. */
const USED_TOOLS = ["shell", "read_file", "write_file", "expose_port"] as const;
const toolWhat = (name: string) => MCP_TOOLS.find((t) => t.name === name)?.what ?? "";

/* The exchange, lifted from TRANSCRIPT by matching its text rather than by
   index -- an index would silently animate the wrong three lines the first
   time anyone adds a command to that array. */
const EXCHANGE = (() => {
  const i = TRANSCRIPT.findIndex((l) => l.text.includes("uname -sr"));
  return i === -1 ? [] : TRANSCRIPT.slice(i, i + 3);
})();

const MARK_SIZE = 32;
function markPath(outline: Vec2[]): string {
  return (
    outline
      .map(([x, y], i) => {
        const px = MARK_SIZE / 2 + x * (MARK_SIZE / 2);
        const py = MARK_SIZE / 2 - y * (MARK_SIZE / 2);
        return `${i === 0 ? "M" : "L"}${px.toFixed(2)} ${py.toFixed(2)}`;
      })
      .join(" ") + " Z"
  );
}

export function ScrollNarrative() {
  const section = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = section.current;
    const stageEl = stage.current;
    if (!root || !stageEl) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let cancelled = false;
    let cleanup: (() => void) | undefined;

    /* Near-viewport before the library is fetched. On a reader who never
       scrolls this far, GSAP is never downloaded at all. */
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        void start();
      },
      { rootMargin: "300px 0px" },
    );
    io.observe(root);

    async function start() {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([
        import("gsap"),
        import("gsap/ScrollTrigger"),
      ]);
      if (cancelled || !root || !stageEl) return;
      gsap.registerPlugin(ScrollTrigger);

      root.dataset.anim = "on";

      const q = gsap.utils.selector(root);
      const typed = q(".nr-typed")[0] as HTMLElement | undefined;
      const full = MCP_COMMAND;
      /* Ships with the command in it, for the no-JS reader. The timeline owns
         it from here, and its first tick is at progress 0 -- which may be a
         scroll event away, so empty it now rather than flashing the finished
         string. */
      if (typed) typed.textContent = "";

      const ctx = gsap.context(() => {
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: root,
            start: "top top",
            /* An explicit distance, with pinSpacing on, so ScrollTrigger owns
               the scroll length. The first build gave the section a fixed
               300vh and turned pinSpacing off, which double-counted: "bottom
               bottom" then resolved 900px before the timeline finished and the
               pin released mid-beat-four. It also left a reader with JS off
               scrolling through two viewports of empty section. */
            end: "+=2400",
            pin: stageEl,
            scrub: 0.6,
            invalidateOnRefresh: true,
          },
        });

        // Beat 2 -- the command types itself. Stepped, so each frame lands on a
        // whole character and the caret never sits mid-glyph.
        tl.to(
          { i: 0 },
          {
            i: full.length,
            ease: "none",
            duration: 1.1,
            onUpdate() {
              if (!typed) return;
              const n = Math.round(this.targets()[0].i as number);
              typed.textContent = full.slice(0, n);
            },
          },
          0.15,
        );

        // Beat 3 -- sent, then the tools, then the output.
        tl.to(q(".nr-composer"), { opacity: 0.35, duration: 0.2 }, 1.3);
        tl.fromTo(
          q(".nr-sent"),
          { opacity: 0, y: 14 },
          { opacity: 1, y: 0, duration: 0.3 },
          1.3,
        );
        tl.fromTo(
          q(".nr-tool"),
          { opacity: 0, y: 10 },
          { opacity: 1, y: 0, duration: 0.28, stagger: 0.14 },
          1.6,
        );
        tl.fromTo(
          q(".nr-line"),
          { opacity: 0, x: -8 },
          { opacity: 1, x: 0, duration: 0.24, stagger: 0.12 },
          2.25,
        );

        // Beat 4 -- the chat comes apart and the mark assembles out of it.
        tl.to(q(".nr-chat"), { opacity: 0, scale: 0.94, duration: 0.5 }, 3.1);
        tl.fromTo(
          q(".nr-mark"),
          { opacity: 0, scale: 0.72 },
          { opacity: 1, scale: 1, duration: 0.6 },
          3.25,
        );
        /* Each piece converges from where it would be if the chat had come
           apart -- same motif as the hero object, same three outlines. */
        tl.fromTo(
          q(".nr-piece-shell"),
          { xPercent: -34, yPercent: 10, rotate: -12, opacity: 0 },
          { xPercent: 0, yPercent: 0, rotate: 0, opacity: 1, duration: 0.6 },
          3.25,
        );
        tl.fromTo(
          q(".nr-piece-flap"),
          { xPercent: 38, yPercent: -12, rotate: 16, opacity: 0 },
          { xPercent: 0, yPercent: 0, rotate: 0, opacity: 1, duration: 0.6 },
          3.3,
        );
        tl.fromTo(
          q(".nr-piece-core"),
          { scaleY: 0.2, opacity: 0 },
          { scaleY: 1, opacity: 1, duration: 0.45 },
          3.55,
        );
        tl.fromTo(
          q(".nr-caption"),
          { opacity: 0, y: 10 },
          { opacity: 1, y: 0, duration: 0.35 },
          3.7,
        );
      }, root);

      /**
       * The anchor the mark converges on is measured, never hardcoded.
       *
       * ScrollTrigger fires `refresh` on resize, on breakpoint changes and
       * whenever the pin is recalculated, so this re-reads the stage box each
       * time and re-points the transform origin at its real centre. A fixed
       * coordinate is right at exactly one viewport width.
       */
      const anchor = () => {
        const r = stageEl.getBoundingClientRect();
        const markEl = q(".nr-mark")[0] as HTMLElement | undefined;
        if (!markEl || r.width === 0) return;
        const m = markEl.getBoundingClientRect();
        const ox = r.width / 2 - (m.left - r.left);
        const oy = r.height / 2 - (m.top - r.top);
        markEl.style.transformOrigin = `${ox.toFixed(1)}px ${oy.toFixed(1)}px`;
      };
      anchor();
      ScrollTrigger.addEventListener("refresh", anchor);

      cleanup = () => {
        ScrollTrigger.removeEventListener("refresh", anchor);
        ctx.revert();
        delete root.dataset.anim;
        if (typed) typed.textContent = full;
      };
    }

    return () => {
      cancelled = true;
      io.disconnect();
      cleanup?.();
    };
  }, []);

  return (
    <section ref={section} className="narrative" aria-label="How the install goes">
      <div ref={stage} className="narrative-stage">
        <div className="nr-chat">
          <div className="nr-head">
            <span className="nr-dot" aria-hidden="true" />
            <span className="nr-title">a chat, before and after one line</span>
          </div>

          <div className="nr-body">
            <p className="nr-sent">
              <span className="nr-who">you</span>
              <code className="nr-cmd">{MCP_COMMAND}</code>
            </p>

            <p className="nr-gained">the conversation now has</p>
            <ul className="nr-tools">
              {USED_TOOLS.map((name) => (
                <li className="nr-tool" key={name}>
                  <span className="nr-tool-name">{name}</span>
                  <span className="nr-tool-what">{toolWhat(name)}</span>
                </li>
              ))}
            </ul>

            <pre className="nr-out">
              {EXCHANGE.map((line) => (
                <span className={`nr-line nr-line-${line.kind}`} key={line.text}>
                  {line.text}
                </span>
              ))}
            </pre>
          </div>

          <div className="nr-composer">
            <span className="nr-typed">{MCP_COMMAND}</span>
            <span className="nr-caret" aria-hidden="true" />
          </div>
        </div>

        {/* The mark, assembling out of what the chat came apart into. Same
            three outlines as the hero object, from the same tables. */}
        <div className="nr-mark" aria-hidden="true">
          <svg viewBox={`0 0 ${MARK_SIZE} ${MARK_SIZE}`} focusable="false">
            <path className="nr-piece nr-piece-shell" d={markPath(SHELL_OUTLINE)} />
            <path className="nr-piece nr-piece-flap" d={markPath(FLAP_OUTLINE)} />
            <path className="nr-piece nr-piece-core" d={markPath(CORE_OUTLINE)} />
          </svg>
          <p className="nr-caption">a computer, for the rest of the conversation</p>
        </div>
      </div>
    </section>
  );
}

export default ScrollNarrative;
