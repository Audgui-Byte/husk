# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

This file records what changed for people who installed the packages. Repository
housekeeping — CI, workflows, README edits, branch cleanup — lives in the commit log,
not here.

## [Unreleased]

### Added

- Webhook signature verification tests, covering the replay-window boundary at exactly
  the tolerance and the empty-body case ([#26](https://github.com/Hotragn/husk/pull/26),
  thanks [@EthemKD](https://github.com/EthemKD))
- `engines: { node: ">=20.10" }` on all eleven packages, so npm refuses an
  unsupported Node instead of failing at runtime. `repository`, `homepage` and `bugs`
  are now declared too, which is what makes the npm page link back here.

### Fixed

- **`husk --version` reported `0.1.0` while you were running 0.1.1.** Four constants
  carried the version by hand and none were bumped with the manifests, so the CLI,
  `husk doctor`, `/health`, `/v1/doctor`, the `X-Husk-Version` header and both
  outbound User-Agent strings all named a release nobody was on. A drift check in CI
  now fails the build if they diverge again.
- **`flavor: full` never had a working browser on `docker` or `podman`.** The image
  it actually landed on was `debian:bookworm`, which ships no Chromium, so the
  `browser_*` tools on a `full` computer had nothing to drive. It resolves to
  `mcr.microsoft.com/playwright:v1.59.1-noble` now.
- Every flavour tried `ghcr.io/husk-sh/husk-<flavor>` first — a namespace husk does
  not own and has never pushed to — so the first pull on every fresh install was a
  guaranteed 404. It recovered quietly by substituting the public base image, which
  meant you ran something other than the image your spec named and lost the
  `huskinfo` script with it. Flavours resolve to a public image outright now, and
  `HUSK_REGISTRY` turns the old two-step back on as an opt-in mirror.
- `@husk-ai/mcp` documented a streamable HTTP transport it does not implement. The
  server speaks stdio, and the docs now say only that.
- The install instructions named `@husk/mcp`. Nothing is published under that scope
  and the scope is not ours, so the command 404'd for everyone who copied it. The
  published name is `@husk-ai/mcp`.

### Security

- **Removed every reference to `husk.sh` and the `husk-sh` GitHub organisation.
  Neither is ours, and both shipped to npm in 0.1.0 and 0.1.1.** The OpenRouter
  attribution header sent `http-referer: https://husk.sh`, four User-Agent strings
  advertised the same domain to every model provider and every page the browser
  fetched, and the security disclosure address was `security@husk.sh` — a mailbox at
  a domain we do not control, printed in `SECURITY.md` as the place to send
  vulnerability reports. Disclosures now go through
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

[Unreleased]: https://github.com/Hotragn/husk/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/Hotragn/husk/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/Hotragn/husk/releases/tag/v0.1.0
