"use client";

/**
 * The chat that gets a computer, as a docked widget.
 *
 * It sits bottom-right behind a launcher, the way a support chat does, and
 * fills itself as the reader scrolls past the top of the page: the install
 * command types into the composer, it sends, the tools attach, real output
 * lands, and the launcher's core lights. Scroll past and it folds back to the
 * icon. Clicking the icon opens it at any time.
 *
 * Why it moved out of the middle of the page
 * ------------------------------------------
 * It used to be a pinned, full-viewport stage between the hero and "Husk does
 * two things", which meant the page's centre was occupied by a set-piece the
 * reader had to scroll through rather than read past. Docking it gives that
 * space back to the prose and costs the sequence nothing — the scrub is the
 * same scrub, it just plays in a 22rem panel instead of across the viewport.
 *
 * Nothing here is invented. The command is `MCP_COMMAND`, the same string the
 * hero's install block sets. The transcript is the `uname -sr` / note.txt
 * exchange out of `TRANSCRIPT`, which ran on a real machine. The four tool
 * names come from `MCP_TOOLS` and are captioned "the conversation now has",
 * not "these fired" — the exchange below them is three shell calls, and four
 * names over it would imply four tools ran.
 *
 * Why scroll and not time
 * -----------------------
 * A headline that types itself is lying about latency. A transcript being
 * dragged by the scrollbar is a diagram: the reader sets the clock, it runs
 * backwards as readily as forwards, and it claims nothing about how long the
 * real thing takes. See `brand/UI-PRINCIPLES.md` §3, "Scroll as a clock".
 *
 * SEO, no-JS, and the hiding problem
 * ----------------------------------
 * There is one copy of this content and it ships in the document, visible, in
 * the page flow. `[data-anim="on"]` — set by script after mount — is what
 * lifts that same element out of the flow and into the fixed dock. A crawler,
 * a reader with JS off, a failed hydration and anyone who asked for less
 * motion all get a plain readable transcript in the body of the page instead
 * of a floating widget they cannot open.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { HuskMark } from "@/components/Logo";
import { MCP_COMMAND, MCP_TOOLS, TRANSCRIPT } from "@/lib/content";

const USED_TOOLS = ["shell", "read_file", "write_file", "expose_port"] as const;
const toolWhat = (name: string) => MCP_TOOLS.find((t) => t.name === name)?.what ?? "";

/* Lifted from TRANSCRIPT by matching its text rather than by index — an index
   would silently animate the wrong three lines the first time anyone adds a
   command to that array. */
const EXCHANGE = (() => {
  const i = TRANSCRIPT.findIndex((l) => l.text.includes("uname -sr"));
  return i === -1 ? [] : TRANSCRIPT.slice(i, i + 3);
})();

export function ScrollNarrative() {
  const section = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);
  /* Set once the reader clicks the launcher. From then on the scroll no longer
     closes it — they asked for it open, and having it shut itself under them
     would be the widget arguing with the person using it. */
  const pinnedOpen = useRef(false);

  const toggle = useCallback(() => {
    setOpen((v) => {
      pinnedOpen.current = !v;
      return !v;
    });
  }, []);

  useEffect(() => {
    const root = section.current;
    if (!root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let cancelled = false;
    let cleanup: (() => void) | undefined;

    /* Near-viewport before the library is fetched. A reader who never scrolls
       this far never downloads GSAP. */
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        void start();
      },
      { rootMargin: "400px 0px" },
    );
    io.observe(root);

    async function start() {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([
        import("gsap"),
        import("gsap/ScrollTrigger"),
      ]);
      if (cancelled || !root) return;
      gsap.registerPlugin(ScrollTrigger);

      root.dataset.anim = "on";

      const q = gsap.utils.selector(root);
      const typed = q(".nr-typed")[0] as HTMLElement | undefined;
      const panel = q(".nr-panel")[0] as HTMLElement | undefined;
      /* The transcript is taller than the panel by the time the output lands,
         so the panel follows its own latest line -- which is what a chat does,
         and without it the last line arrives below the fold of a 22rem box. */
      const toBottom = () => {
        if (panel) panel.scrollTop = panel.scrollHeight;
      };
      const full = MCP_COMMAND;
      /* Ships with the command in it, for the no-JS reader. The timeline owns
         it from here, and its first tick may be a scroll event away. */
      if (typed) typed.textContent = "";

      const ctx = gsap.context(() => {
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: root,
            /* No pin. The widget is fixed, so it does not need the page held
               still underneath it — which is the whole reason the centre of
               the page is free again. */
            start: "top 85%",
            /* Long enough that the last beat lands well before the trigger
               goes inactive. At +=1500 the timeline's own duration ran right
               to the boundary, so the panel folded shut while the transcript
               was still filling and the launcher never lit. */
            end: "+=2200",
            scrub: 0.6,
            invalidateOnRefresh: true,
            onToggle: (self) => {
              if (pinnedOpen.current) return;
              setOpen(self.isActive);
            },
          },
        });

        // The command types itself.
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
          0.2,
        );

        // Sent, then what the line added, then the output.
        tl.to(q(".nr-composer"), { opacity: 0.3, duration: 0.2 }, 1.35);
        tl.fromTo(q(".nr-sent"), { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.3 }, 1.35);
        tl.fromTo(q(".nr-gained"), { opacity: 0 }, { opacity: 1, duration: 0.25 }, 1.6);
        tl.fromTo(
          q(".nr-tool"),
          { opacity: 0, x: -8 },
          { opacity: 1, x: 0, duration: 0.26, stagger: 0.13 },
          1.7,
        );
        tl.fromTo(
          q(".nr-line"),
          { opacity: 0, x: -8 },
          { opacity: 1, x: 0, duration: 0.24, stagger: 0.12, onUpdate: toBottom },
          2.35,
        );
        // The machine is attached, and the launcher's core lights to say so.
        tl.fromTo(
          q(".nr-attached"),
          { opacity: 0, y: 8 },
          { opacity: 1, y: 0, duration: 0.35, onUpdate: toBottom },
          3.0,
        );
        tl.to(root, { "--nr-lit": 1, duration: 0.4 }, 3.0);
        /* Trailing slack. The story finishes around 78% of the scrub and the
           rest is the reader looking at a finished panel, rather than the last
           line arriving at the same instant the dock closes. */
        tl.to({}, { duration: 1.1 }, 3.4);
      }, root);

      cleanup = () => {
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
    <section
      ref={section}
      className="narrative"
      aria-label="What one line of install does to a chat"
    >
      <div className="nr-dock" data-open={open ? "true" : "false"}>
        <button
          type="button"
          className="nr-launcher"
          aria-expanded={open}
          aria-controls="nr-panel"
          onClick={toggle}
        >
          <HuskMark size={24} />
          <span className="nr-launcher-label">
            {open ? "Hide the transcript" : "What one line does"}
          </span>
        </button>

        <div className="nr-panel" id="nr-panel">
          <div className="nr-head">
            <span className="nr-title">a chat, before and after one line</span>
            <button
              type="button"
              className="nr-close"
              onClick={toggle}
              aria-label="Hide the transcript"
            >
              <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false">
                <path
                  d="M2 2 L10 10 M10 2 L2 10"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  fill="none"
                />
              </svg>
            </button>
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

            <p className="nr-attached">
              <span className="nr-attached-dot" aria-hidden="true" />a computer, for the
              rest of the conversation
            </p>
          </div>

          <div className="nr-composer">
            <span className="nr-typed">{MCP_COMMAND}</span>
            <span className="nr-caret" aria-hidden="true" />
          </div>
        </div>
      </div>
    </section>
  );
}

export default ScrollNarrative;
