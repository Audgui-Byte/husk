import type { Metadata } from "next";
import Link from "next/link";

import { CodeBlock, CommandBlock } from "@/components/CodeBlock";
import { ChatScroll } from "@/components/ChatScroll";
import { HeroObject } from "@/components/HeroObject";
import { Reveal } from "@/components/Reveal";
import { IsolationViewer } from "@/components/IsolationViewer";
import { StaticTerminal } from "@/components/StaticTerminal";
import { TerminalReplay } from "@/components/TerminalReplay";
import {
  BROWSER_TOOLS,
  ONBOARDING,
  BROWSER_TOOL_COUNT,
  DISTILL,
  DOCTOR,
  HUSK_YAML,
  MCP_COMMAND,
  MCP_TOOLS,
  PROVIDERS,
  REPO_URL,
} from "@/lib/content";

export const metadata: Metadata = {
  title: "Husk — a real computer for your AI chat",
  alternates: { canonical: "/" },
};

export default function Home() {
  return (
    <main id="main">
      {/* -------------------------------------------------------------- hero */}
      <section
        className="container hero hero-anim"
        aria-labelledby="hero-title"
        style={{ position: "relative" }}
      >
        <div className="grid12 hero-grid">
          <div className="hero-copy">
            <h1 id="hero-title" className="h-hero">
              Your AI chat gets a real computer of its own.
            </h1>
            <p className="lead" style={{ marginTop: "var(--space-6)" }}>
              Files, a browser, and somewhere to run code. It can build things,
              look stuff up online and keep your work as you go. Turn a chat you
              already had into a bot that does the job again tomorrow.
            </p>

            {/* 42rem, not 40. JetBrains Mono is wider than the fallback stack
                the 40rem cap was measured against, so the real face pushed the
                install command 4px past its box the moment the fonts landed —
                a scrollbar on the one string that matters, caused by fixing
                something else. */}
            <div style={{ marginTop: "var(--space-8)", maxWidth: "42rem" }}>
              <CommandBlock command={MCP_COMMAND} size="lg" />
            </div>

            <div className="hero-actions" style={{ marginTop: "var(--space-4)" }}>
              <a className="btn btn-primary btn-lg" href="#mcp">
                What that command does
              </a>
              <a
                className="btn btn-secondary btn-lg"
                href={REPO_URL}
                rel="noreferrer noopener"
              >
                Read the source
              </a>
            </div>

            <p className="meta" style={{ marginTop: "var(--space-6)" }}>
              Free. No account, no card. Apache-2.0 · works with Claude Code,
              Cursor, Zed, or anything speaking MCP
            </p>
          </div>

          <div className="hero-figure">
            <ChatScroll />
          </div>
        </div>

        {/* The proof, directly under the claim. "A real computer" is a sentence
            anyone can write; this is twenty seconds of one running on a laptop
            that had neither Docker nor an API key, and it refuses a command at
            the end rather than pretending.

            Full bleed because it has to be: globals.css only gives `.term-wide`
            16px mono at the width the bleed provides, and a terminal in a grid
            column is a terminal with a scrollbar. The isolation viewer used to
            hold this slot and answers "how contained is it?" — question three,
            asked by nobody who has not already decided to try the thing. It now
            sits in Providers, where the reader is asking it. */}
        <div className="bleed" style={{ marginTop: "var(--space-12)" }}>
          <div className="container container-2xl">
            <TerminalReplay />
          </div>
        </div>

        <p
          className="small"
          style={{ marginTop: "var(--space-4)", maxWidth: "var(--measure-prose)" }}
        >
          That ran on a Windows laptop with no Docker and no API key. The local
          provider found WSL2 and gave it a real kernel and a real{" "}
          <code className="inline">/work</code>. Then it refused a command that
          would not have been recoverable, and said what to change if the refusal
          was wrong.
        </p>
      </section>

      {/* ---------------------------------------------------------- two jobs */}
      <section className="container section" aria-labelledby="jobs-title">
        <Reveal>
          <div className="section-head">
            <p className="eyebrow">what it does</p>
            <h2 id="jobs-title" className="h-section">
              Husk does two things.
            </h2>
            <p className="prose" style={{ marginTop: "var(--space-4)" }}>
              One binary. The first job hands a machine to an agent that does not
              have one. The second takes a conversation you already finished and
              keeps it running.
            </p>
          </div>
        </Reveal>

        <div className="stack-16">
          <div className="grid12">
            <div className="col-5">
              <h3 className="h-sub">It gives an agent a computer.</h3>
              <div className="prose" style={{ marginTop: "var(--space-4)" }}>
                <p>
                  A computer is a disposable Linux machine: shell, filesystem,
                  ports, snapshots. Nothing is spun up until a tool actually
                  needs one, and a stable key maps a conversation to the same
                  machine, so its files survive across tool calls without you
                  tracking ids.
                </p>
                <p>
                  A cold <code className="inline">docker version</code> takes
                  about 800 ms, so provider probes are cached for 30 seconds. An
                  agent that creates four machines in a row pays that once.
                </p>
              </div>
            </div>
            <div className="col-7">
              <StaticTerminal
                title="husk doctor · first run"
                lines={DOCTOR}
                label="Output of husk with no arguments on a machine that has never run it"
              />
            </div>
          </div>

          <div className="grid12" id="chat-to-bot">
            <div className="col-7">
              <StaticTerminal
                title="chat → husk.yaml → service"
                lines={DISTILL}
                label="Commands that turn a chat transcript into a running bot"
              />
            </div>
            <div className="col-5 order-first-sm">
              <h3 className="h-sub">
                It turns a chat you already had into a bot.
              </h3>
              <div className="prose" style={{ marginTop: "var(--space-4)" }}>
                <p>
                  Husk reads a Claude Code, ChatGPT or Cursor transcript, walks{" "}
                  <code className="inline">parentUuid</code> back from the last
                  leaf to get the conversation as it actually ran rather than
                  every dead end, and writes a{" "}
                  <code className="inline">husk.yaml</code> you can diff.
                </p>
                <p>
                  The distiller runs with no API key. It mines the instructions
                  you kept repeating, the answers you did not correct, and the
                  tools you actually used, then reports what it could not
                  determine instead of inventing it.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- mcp */}
      <section className="container section" aria-labelledby="mcp-title" id="mcp">
        <div className="grid12">
          <div className="col-7">
            <p className="eyebrow">the whole install</p>
            <h2 id="mcp-title" className="h-section">
              One line gives Claude Code a machine.
            </h2>

            <div style={{ marginTop: "var(--space-8)" }}>
              <CommandBlock command={MCP_COMMAND} size="lg" />
            </div>

            <div className="prose" style={{ marginTop: "var(--space-6)" }}>
              <p>
                There is no second step and no config file to edit. Claude Code
                gets twenty tools against a real Linux machine — a shell, the
                filesystem, ports, and a browser — and that filesystem persists
                for the rest of the conversation. The same server
                speaks streamable HTTP, so Cursor, Zed and anything else that
                talks MCP get the same thing.
              </p>
              <p>
                The first tool result tells the model how isolated it is,
                because a model that believes it is contained when it is not
                will take risks it otherwise would not.
              </p>
            </div>
          </div>

          <div className="col-5">
            <h3 className="footer-heading" style={{ marginTop: "var(--space-4)" }}>
              the computer
            </h3>
            <ul className="rule-list">
              {MCP_TOOLS.map((tool) => (
                <li key={tool.name}>
                  <span className="rl-term">{tool.name}</span>
                  <span className="rl-desc">{tool.what}</span>
                </li>
              ))}
            </ul>

            <h3 className="footer-heading" style={{ marginTop: "var(--space-8)" }}>
              the browser
            </h3>
            <ul className="rule-list">
              {BROWSER_TOOLS.map((tool) => (
                <li key={tool.name}>
                  <span className="rl-term">{tool.name}</span>
                  <span className="rl-desc">{tool.what}</span>
                </li>
              ))}
            </ul>
            <p className="small" style={{ marginTop: "var(--space-3)" }}>
              {BROWSER_TOOL_COUNT} in all. A real Chromium inside the computer,
              driven by structured page text rather than pixels — which is why an
              agent can use it without seeing.
            </p>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------ onboarding */}
      <section className="container section" aria-labelledby="start-title" id="start">
        <Reveal>
          <div className="section-head">
            <p className="eyebrow">after the one line</p>
            <h2 id="start-title" className="h-section">
              Three things to ask it first.
            </h2>
            <p className="prose" style={{ marginTop: "var(--space-4)" }}>
              The install is one line and then nothing tells you what changed.
              These are the three that show you the computer is real, in the
              order that makes the point fastest.
            </p>
          </div>
        </Reveal>

        <ol className="steps">
          {ONBOARDING.map((step, i) => (
            <Reveal key={step.ask} delayMs={i * 90}>
              <li className="step">
                <span className="step-n" aria-hidden="true">
                  {i + 1}
                </span>
                <div>
                  <p className="step-ask">&ldquo;{step.ask}&rdquo;</p>
                  <p className="step-what">{step.what}</p>
                </div>
              </li>
            </Reveal>
          ))}
        </ol>
      </section>

      {/* ------------------------------------------------------- providers */}
      <section
        className="container section"
        aria-labelledby="providers-title"
        id="providers"
      >
        <Reveal>
          <div className="section-head">
            <p className="eyebrow">containment</p>
            <h2 id="providers-title" className="h-section">
              <code className="inline">husk doctor</code> tells you which one you
              have.
            </h2>
            <p className="prose" style={{ marginTop: "var(--space-4)" }}>
              Two of the five providers are not isolated in any meaningful sense.{" "}
              <code className="inline">Availability.isolated</code> is on the
              provider interface so that no part of this product ever has to be
              vague about which two.
            </p>
          </div>
        </Reveal>

        <div className="table-scroll" tabIndex={0} role="region" aria-labelledby="providers-title">
          <table className="data">
            <caption>
              Isolation, cost and the mechanism behind each claim. Never the
              word &ldquo;secure&rdquo; on its own.
            </caption>
            <thead>
              <tr>
                <th scope="col">provider</th>
                <th scope="col">isolation</th>
                <th scope="col">mechanism</th>
                <th scope="col">cost</th>
                <th scope="col">when it wins</th>
              </tr>
            </thead>
            <tbody>
              {PROVIDERS.map((p) => (
                <tr key={p.id}>
                  <th scope="row">{p.id}</th>
                  <td>
                    <span className={`iso iso-${p.isolationKind}`}>
                      <span className="iso-glyph" aria-hidden="true">
                        {p.isolationKind === "kernel"
                          ? "[#]"
                          : p.isolationKind === "none"
                            ? "[!]"
                            : "[?]"}
                      </span>
                      <span className="iso-word">{p.isolation}</span>
                    </span>
                  </td>
                  <td>{p.mechanism}</td>
                  <td>{p.cost}</td>
                  <td>{p.when}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="small" style={{ marginTop: "var(--space-4)", maxWidth: "var(--measure-prose)" }}>
          Husk never silently substitutes a weaker provider for the one you
          asked for. Asking for <code className="inline">--provider docker</code>{" "}
          with the daemon down is an error, not a downgrade.
        </p>

        {/* The viewer answers "how contained is the one I got?", which is a
            question you only have once the table above has given you the word
            for it. It spent the first release in the hero, three sections
            before anyone was asking. */}
        <div className="grid12" style={{ marginTop: "var(--space-12)" }}>
          <div className="col-5">
            <IsolationViewer />
          </div>
          <div className="col-7">
            <div
              className="callout"
              style={{ maxWidth: "var(--measure-prose)" }}
            >
              <p>
                <span className="callout-code">guardrails, not a sandbox</span>
                The local provider pins the working directory, resolves every
                path through <code className="inline">realpath</code> and refuses
                escapes, strips credential-shaped environment variables, caps
                output, and kills the process tree on timeout. That stops
                accidents. It will not stop an adversary, and a prompt-injected
                model is closer to an adversary than to an accident.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- husk.yaml */}
      <section
        className="container section"
        aria-labelledby="yaml-title"
        id="husk-yaml"
      >
        <div className="grid12">
          <div className="col-4">
            <p className="eyebrow">the unit of value</p>
            <h2 id="yaml-title" className="h-section">
              What comes out is a file you can read.
            </h2>
            <div className="prose" style={{ marginTop: "var(--space-4)" }}>
              <p>
                Deliberate key order, block scalars, and a provenance header
                naming the transcript it came from. The file is optimised for
                review rather than for machines, because the first thing you
                will do with it is disagree with a line and change it.
              </p>
              <p>
                <Link href="/#chat-to-bot">Distil one</Link>, edit it, then run
                it on the CLI or serve it over HTTP, Discord, Slack or cron. The
                same file runs against Opus or against a local Gemma by changing
                one word.
              </p>
            </div>
          </div>
          <div className="col-8">
            <CodeBlock
              title="triage.yaml"
              source={HUSK_YAML}
              what="husk.yaml"
            />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- free */}
      <section className="container section" aria-labelledby="free-title" id="free">
        <div className="grid12">
          <div className="col-7">
            <p className="eyebrow">cost</p>
            <h2 id="free-title" className="h-section">
              The free path is the same path everything else is built on.
            </h2>
            <div className="prose" style={{ marginTop: "var(--space-6)" }}>
              <p>
                The local provider is the primitive. Docker, Podman, SSH and Fly
                are plugins behind the same interface, which means there is no
                code path in Husk that requires an account, a card or a network
                connection. Nothing is gated, nothing expires, and there is no
                edition of this product you are not already using.
              </p>
              <p>
                There is no telemetry either. Not off by default — absent. No
                analytics, no crash reporter, no phone-home; the only network
                calls Husk makes are to the model provider you configured and to
                a registry when you pull an image. You can check that claim the
                same way we do, by reading the repository.
              </p>
              <p>
                <Link href="/pricing">
                  What a hosted tier would have to add before it was worth
                  charging for
                </Link>
                .
              </p>
            </div>
          </div>

          <div className="col-5">
            <h3 className="footer-heading" style={{ marginTop: "var(--space-4)" }}>
              what free means here
            </h3>
            <ul className="rule-list">
              <li>
                <span className="rl-term">no account</span>
                <span className="rl-desc">
                  nothing to sign up for, nothing to log in to
                </span>
              </li>
              <li>
                <span className="rl-term">no key</span>
                <span className="rl-desc">
                  Ollama runs gemma, qwen or llama on your machine for nothing
                </span>
              </li>
              <li>
                <span className="rl-term">no Docker</span>
                <span className="rl-desc">
                  the local provider works without it, and says what you gave up
                </span>
              </li>
              <li>
                <span className="rl-term">no telemetry</span>
                <span className="rl-desc">
                  absent from the codebase, not disabled by a flag
                </span>
              </li>
              <li>
                <span className="rl-term">Apache-2.0</span>
                <span className="rl-desc">
                  fork it, ship it, run it inside your company
                </span>
              </li>
            </ul>
          </div>
        </div>
      </section>
    </main>
  );
}
