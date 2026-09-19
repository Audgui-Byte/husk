# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

This file records what changed for people who installed the packages. Repository
housekeeping — CI, workflows, README edits, branch cleanup — lives in the commit log,
not here.

## [Unreleased]

### Fixed

- **On Windows without a working WSL, `husk doctor` said nothing useful and sometimes
  contradicted itself.** The warning written for that case was gated on a test that no
  reachable state could pass, so it had never printed. The `local` provider reported
  "with no WSL" even when WSL was installed and simply not responding, directly beneath
  a line saying the opposite, and told people to `wsl --install` something they already
  had. The fix that would have helped was never shown at all, because hints only
  printed for providers reported as unavailable and `local` is always available.
  `doctor` now distinguishes the two states, gives each its own fix, and says that
  Docker is down for the same reason — its engine runs inside WSL2.
- **`husk import` invented paths for every Claude Code project whose directory had a
  dash in it.** The label was built by turning every `-` in the encoded directory name
  into `/`, so `C--Users-dev-Claude-Code-husk` was offered as
  `C//Users/dev/Claude/Code/husk` — a path that exists nowhere. The encoding cannot be
  reversed, because a dash in it is either a literal dash or a separator and nothing
  records which, so the real working directory is now read from the transcript itself.
  Where a transcript does not carry one, the encoded name is shown as-is rather than
  decoded into a guess
  ([#129](https://github.com/Hotragn/husk/pull/129), thanks
  [@Audgui-Byte](https://github.com/Audgui-Byte))
- **A model given a degraded Windows computer was told it had Linux.** The first tool
  result said the machine was "on the Windows shell", which is a label with no
  consequence attached; the model would still open with `ls -la /work` and then retry
  variations of a command that could not work. It now says what actually differs —
  `$VAR` does not expand and `'single quotes'` are not quotes, both silently at exit 0
  — and that Unix tools may or may not be on `PATH` depending on what else is
  installed. A command that fails because the shell is `cmd.exe` now carries that
  reason with it, rather than only at the top of the session.

## [0.1.3] - 2026-09-16

The browser works on Docker again, and husk stops naming things it does not own.

### Fixed

- **`flavor: full` never had a working browser on `docker` or `podman`.** The image it
  actually landed on was `debian:bookworm`, which ships no Chromium, so the `browser_*`
  tools on a `full` computer had nothing to drive. It resolves to
  `mcr.microsoft.com/playwright:v1.59.1-noble` now.
- **Every flavour tried `ghcr.io/husk-sh/husk-<flavor>` first** — a namespace husk does
  not own and has never pushed to — so the first pull on every fresh install was a
  guaranteed 404. It recovered quietly by substituting the public base image, which
  meant you ran something other than the image your spec named and lost the `huskinfo`
  script with it. Flavours resolve to a public image outright now, and `HUSK_REGISTRY`
  turns the old two-step back on as an opt-in mirror.
- **`husk --version` reported `0.1.0` while you were running 0.1.1.** Four constants
  carried the version by hand and none were bumped with the manifests, so the CLI,
  `husk doctor`, `/health`, `/v1/doctor`, the `X-Husk-Version` header and both outbound
  User-Agent strings all named a release nobody was on.
- The install instructions named `@husk/mcp`. Nothing is published under that scope and
  the scope is not ours, so the command 404'd for everyone who copied it. The published
  name is `@husk-ai/mcp`.
- `computer_info` did not answer the question its own description tells a model to call
  it for, so a model asking what was installed had to fall back to probing with shell
  commands.

### Security

- **Removed every reference to `husk.sh` and the `husk-sh` GitHub organisation.**
  Neither is ours, and both shipped to npm in 0.1.0, 0.1.1 and 0.1.2. The OpenRouter
  attribution header sent `http-referer: https://husk.sh`, and four User-Agent strings
  advertised the same domain to every model provider and every page the browser
  fetched.

## [0.1.2] - 2026-09-16

### Fixed

- **`husk` exited 0 and printed nothing when installed from npm.** The published `bin`
  pointed at a wrapper whose entry-point guard never matched through npm's shim, so the
  command that is the product's entire surface did nothing at all — silently, and with a
  success exit code, on every install of 0.1.1.
- `@husk-ai/mcp` documented a streamable HTTP transport it does not implement. The
  server speaks stdio, and the docs now say only that.
- The `@husk-ai/sdk` readme linked with `../..`, which npm cannot follow, so every
  relative link on its package page was broken.

### Added

- Webhook signature verification tests, covering the replay-window boundary at exactly
  the tolerance and the empty-body case ([#26](https://github.com/Hotragn/husk/pull/26),
  thanks [@EthemKD](https://github.com/EthemKD))
- `engines: { node: ">=20.10" }` on all eleven packages, so npm refuses an unsupported
  Node instead of failing at runtime. `repository`, `homepage` and `bugs` are now
  declared too, which is what makes the npm page link back here.

### Security

- The security disclosure address was `security@husk.sh`, a mailbox at a domain we do
  not control, printed in `SECURITY.md` as the place to send vulnerability reports.
  Disclosures now go through
  [GitHub private vulnerability reporting](https://github.com/Hotragn/husk/security/advisories/new),
  which is the only channel that is monitored.

## [0.1.1] - 2026-09-14

The first version published to npm.

### Changed

- **The npm scope is `@husk-ai/`, not `@husk/`** — `@husk` was already taken on the
  registry. Install commands and import specifiers change. The CLI binary is still
  `husk`, and `husk.yaml` is unchanged.

### Fixed

- Inter-package dependencies still pinned `0.1.0` after the packages themselves were
  bumped to `0.1.1`, so npm could not resolve them locally and fell through to the
  registry, where they did not exist. Installing anything with a sibling dependency —
  `@husk-ai/agent`, `@husk-ai/cli`, `@husk-ai/sdk` — failed.

## [0.1.0] - 2026-09-14

The first version that does the two things on the tin.

### Added

**A computer for agents**

- Five providers behind one `Computer` interface: `docker`, `podman`, `ssh`, `fly`,
  and `local`. `auto` walks them in that order, preferring real isolation over
  guardrails and free over metered, with `local` as the floor that is always there.
- **Real Linux on Windows without Docker.** The `local` provider runs each command
  inside a WSL2 user + mount namespace (`unshare -mr`) that bind-mounts the workspace
  onto `/work`. The agent is uid 0 inside the namespace, files land owned by the real
  user outside it, and the mount disappears when the command exits — so two computers
  never see each other. Falls back to the host shell, loudly, when WSL is absent.
- `ComputerManager.ensure(key)` maps a stable key to a machine, so one conversation
  keeps one filesystem without the caller tracking ids. Concurrent callers share a
  single in-flight create rather than racing into two machines.
- Snapshots commit the image *and* tar the workdir, because `/work` is a tmpfs and a
  commit alone would silently lose everything the agent did.

**A chat becomes a bot**

- Importers for Claude Code JSONL, ChatGPT exports, Cursor, Gemini and pasted
  markdown. Branched threads are reconstructed by walking `parentUuid` from the last
  leaf, so you get the conversation as it actually ran.
- Two distillers. The model-backed one map/reduces over the whole transcript; the
  heuristic one needs no key, no network, and reports an honest confidence with a list
  of what it could not determine.
- `husk.yaml` is the unit of value: readable, diffable, and validated by a zod schema.

**Models**

- Eleven providers, no vendor SDKs — the wire-format translation is the package.
  Anthropic, OpenAI, Google, Groq, OpenRouter, Together, DeepSeek, Mistral, Cerebras,
  Ollama, LM Studio.
- Aliases (`opus`, `sonnet`, `gemma`, `free`, `auto`) keep a spec portable.
- Fallback emits a `warning` event. Silently answering with a weaker model than the one
  requested is worse than failing.

**MCP**

- `claude mcp add husk -- npx -y @husk-ai/mcp` gives Claude Code a computer
  mid-conversation. Seven tools over stdio, and the first tool result states plainly
  that a `local` computer is not a sandbox.

### Security

- Path jail with symlink resolution, environment scrubbing, output caps, process-tree
  kill on timeout, and a command deny list anchored to command position — so
  `grep -r "sudo" .` is not refused, because a deny list that cries wolf gets disabled.
- **The network floor refuses loopback, link-local and RFC1918 even in
  `network.mode: 'full'`.** `full` means the internet, not the cloud metadata endpoint
  at `169.254.169.254` that hands IAM credentials to anything that asks.
- `ask`-mode approval fails closed: no approver wired means the call is denied.
- Budgets — step, cost, token, wall clock — are checked *before* a model call, so a
  ceiling is never breached, only prevented.
- `isolationKind` distinguishes `kernel`, `machine` and `guardrails`. A boolean
  overclaimed for `ssh`, which is isolated from your laptop but not from the box it
  runs on; `husk doctor` now says "isolated from this machine".

### Known gaps

Not a Keep a Changelog section, but shipping a list of what does not work belongs next
to the list of what does.

- The hosted control plane does not exist. `husk serve` is a single-user local daemon.
- `web_search` needs a Brave or Tavily key; without one the tool is not registered
  rather than failing at call time.
- Anthropic's Opus and Sonnet cache-write prices are derived from estimated input
  rates and are marked `estimatedPricing`.

[Unreleased]: https://github.com/Hotragn/husk/compare/v0.1.3...HEAD
[0.1.3]: https://github.com/Hotragn/husk/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/Hotragn/husk/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/Hotragn/husk/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/Hotragn/husk/releases/tag/v0.1.0
