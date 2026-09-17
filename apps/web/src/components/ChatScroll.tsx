"use client";

import { useEffect, useRef, useState } from "react";

import { MCP_COMMAND } from "@/lib/content";

/**
 * The chat that gets a computer.
 *
 * A chat window, empty, that fills as the reader scrolls: the install command
 * types into the composer, sends, and the reply attaches a machine to the
 * conversation. It is the page's sentence performed once, by the reader,
 * at their own pace.
 *
 * Scroll position is the clock. Nothing here runs on a timer, which is what
 * separates this from the typewriter UI-PRINCIPLES.md §3.5 bans: a headline
 * that types itself is lying about latency, but a transcript scrubbed by the
 * scrollbar is a diagram the reader is dragging. Scroll back and it un-types.
 *
 * Accessibility: the finished transcript is in the DOM as text from first
 * paint. The scroll states change `aria-hidden` and opacity, never the content,
 * so a screen reader gets the whole exchange at once instead of a sentence
 * being retyped underneath it. Under `prefers-reduced-motion` every stage is
 * simply shown.
 */

/** Stage boundaries as a fraction of the pinned scroll distance. */
const TYPE_FROM = 0.08;
const TYPE_TO = 0.46;
const SEND_AT = 0.52;
const REPLY_AT = 0.62;
const MACHINE_AT = 0.78;

export function ChatScroll() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [p, setP] = useState(0);
  // Starts false, not true. Defaulting to "reduced" made the server render and
  // the first client paint show the finished transcript, which then collapsed
  // to an empty composer the moment the effect ran -- a flash of the ending on
  // every load. Starting closed costs a reader with reduced-motion set one tick
  // before everything appears, and costs everyone else nothing.
  //
  // Nothing is lost without scripting: `.chat-stream` is aria-hidden, and the
  // exchange it depicts is in the DOM as a sentence for assistive tech and for
  // anyone whose JS never runs.
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (reduced) return;
    let raf = 0;
    const read = () => {
      raf = 0;
      const el = hostRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      // 0 when the panel's top reaches the viewport top, 1 one panel-height
      // later. Clamped, so the finished state persists past the section.
      // Travel is measured against the viewport, not the panel's own height.
      // Against its own height the whole story finished inside 400px of
      // scrolling -- the reader hit the end before noticing it had started.
      // A viewport of travel is roughly one deliberate scroll gesture.
      const travelled = window.innerHeight * 0.55 - r.top;
      setP(Math.min(1, Math.max(0, travelled / Math.max(1, window.innerHeight * 0.95))));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(read);
    };
    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [reduced]);

  const done = reduced || p >= 1;
  const typed = done
    ? MCP_COMMAND
    : MCP_COMMAND.slice(
        0,
        Math.round(
          MCP_COMMAND.length *
            Math.min(1, Math.max(0, (p - TYPE_FROM) / (TYPE_TO - TYPE_FROM))),
        ),
      );
  const sent = done || p >= SEND_AT;
  const replied = done || p >= REPLY_AT;
  const machine = done || p >= MACHINE_AT;

  return (
    <div className="chat" ref={hostRef} data-stage={machine ? "machine" : sent ? "sent" : "typing"}>
      <div className="chat-bar">
        <span className="chat-title">a chat, before and after</span>
        <span className="chat-dot" aria-hidden="true" />
      </div>

      <div className="chat-body">
        {/* The whole exchange, once, for assistive tech and for anyone with
            scripting off. The visual stages below are aria-hidden. */}
        <p className="visually-hidden">
          A chat window. The user runs {MCP_COMMAND}. Husk replies that seven
          tools and a browser are connected, and the conversation now has a
          Linux computer: shell, filesystem and ports, with files that persist
          for the rest of the chat.
        </p>

        <div className="chat-stream" aria-hidden="true">
          <div className={`chat-msg chat-user${sent ? " is-in" : ""}`}>
            <span className="chat-who">you</span>
            <code>{MCP_COMMAND}</code>
          </div>

          <div className={`chat-msg chat-bot${replied ? " is-in" : ""}`}>
            <span className="chat-who">husk</span>
            <span>
              Connected. Seven tools and a browser, against a Linux machine that
              did not exist a second ago.
            </span>
          </div>

          <div className={`chat-machine${machine ? " is-in" : ""}`}>
            <div className="chat-machine-head">
              <span className="chat-machine-dot" aria-hidden="true" />
              this conversation now has a computer
            </div>
            <dl className="chat-machine-grid">
              <div>
                <dt>shell</dt>
                <dd>a command, stdout, an exit code</dd>
              </div>
              <div>
                <dt>files</dt>
                <dd>/work, still there next turn</dd>
              </div>
              <div>
                <dt>ports</dt>
                <dd>a URL you can open yourself</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      {/* The composer empties as the message sends, which is the one moment
          the reader has actually caused something. */}
      <div className="chat-composer" aria-hidden="true">
        <span className="chat-prompt">$</span>
        <code className="chat-input">{sent ? "" : typed}</code>
        <span className={`chat-caret${sent ? " is-idle" : ""}`} />
      </div>
    </div>
  );
}
