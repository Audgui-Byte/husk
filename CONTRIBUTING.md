# Contributing

## Setup

```bash
npm install
npm run build
npm test
node packages/cli/dist/bin.js doctor
```

Node ≥ 20.10. Nothing else is required — no Docker, no API key. If any of those four
commands needs something you do not have, that is a bug worth reporting on its own.

The two websites sit outside the npm workspace on purpose. `apps/docs` and `apps/web`
each carry their own lockfile and install on demand:

```bash
cd apps/web && npm install && npm run dev
```

Neither shares code with the packages and CI builds neither, so fixing a bug in the
product never downloads Next, three.js or Tailwind — 628 fewer resolved packages in the
default install. `apps/console` stays in the workspace: it imports `@husk-ai/core`,
`@husk-ai/sdk` and `@husk-ai/browser`, and `husk serve` serves its build.

For how the packages fit together, see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Read this first

[`docs/BUILD-CONTRACT.md`](docs/BUILD-CONTRACT.md) is the set of rules every package
obeys. It is short, and it is not optional. The parts that trip people up:

- **ESM only, and relative imports carry `.js`.** NodeNext resolution.
- **No native modules.** Ever. A Windows `npm install` must be clean without a C++
  toolchain, which is worth more than SQLite would be.
- **Dependencies run downhill.** Never sideways, never up, never into another package's
  `src/`. The layers are listed in
  [the build contract](docs/BUILD-CONTRACT.md#dependency-direction) — one copy, because
  a chain written from memory has been wrong in three files at once.
- **Two tsconfigs per package.** `tsconfig.json` for typecheck, `tsconfig.build.json`
  for build. Compiled tests must not ship.

## The values that show up in code review

**Every error is actionable.** Throw `HuskError` with a code and a one-line `hint` that
names the fix. "docker is installed but the daemon is not reachable → start Docker
Desktop" is the standard. "Install Docker" when Docker is already installed is a bug we
have actually shipped and fixed.

**Never claim isolation you do not provide.** `Availability.isolationKind` exists
because a boolean overclaimed for `ssh`. If you add a provider, be precise about what
its boundary actually is, in the code and in `husk doctor`.

**The free path is the default path.** No API key, no Docker, no account: everything
still runs. If a change makes a feature require one of those, it needs a fallback or it
needs to degrade with an explanation.

**Comments explain why.** A comment restating the line below it will be removed in
review. A comment explaining a non-obvious constraint — why `close` and not `exit`, why
`unshare -mr`, why the deny list is anchored to command position — is the point.

## Tests

Vitest, colocated as `src/**/*.test.ts`. Test the logic that would rot silently:
parsers, policy decisions, budget and retry maths, wire-format translation. Do not
write tests that assert a mock was called.

Every test must pass with **no Docker, no API key, no network**. The suite runs on a
laptop and in CI with nothing installed; if your test needs a daemon, it is testing the
daemon.

A test that probes the real machine is the exception and must opt in, gated on
`HUSK_INTEGRATION=1` so the default suite never waits on an external binary:

```bash
HUSK_INTEGRATION=1 npx vitest run packages/cli   # includes the live doctor probe
```

That gate exists because `doctor` shells out to docker, podman and wsl. The smoke test
that asserted only the *shape* of its report took 890 seconds on a loaded machine and
then failed, having asserted nothing about Docker. Inject the prober and hand the test a
fake; a test whose result depends on how fast an external binary answers is not testing
what its name says.

```bash
npx vitest run                       # everything
npx vitest run packages/runtime      # one package
npx vitest run -t "path jail"        # one description
```

`mcp` has one test file against seven source modules, and `adapters` has one against
eight — and MCP is the main way husk actually gets used. That is the thinnest coverage
in the repo and the best place to land a first contribution. The
[test topology diagram](docs/diagrams/16-test-topology.html) has the full picture.

## Before you open a PR

**Branch off `main`, and target `main`.** It is the only base for pull requests.
`dev` is the pre-launch development history, kept for the record and tagged
`history/pre-launch`; it shares no ancestor with `main` and nothing merges into it.

```bash
npm run build:packages && npm run typecheck && npm test
```

Then actually run the thing you changed. `husk doctor`, `husk up`, `husk exec` — the
CLI is the product's face, and a change that typechecks but reads badly in a terminal
is not done.

### Scripts that import the packages

A throwaway script that drives `@husk-ai/*` must live inside the repo, or import
absolute paths into `packages/*/dist`. Node resolves a bare specifier by walking up
from the *script's* directory, so one saved anywhere else — a temp dir, your home
directory — finds no workspace, silently binds the published package from npm, and
happily reports on the released version instead of your branch.

The tell is output that contradicts your diff: a value you deleted still showing up.
This cost a verification pass that reported the wrong answer, and the giveaway was an
image plan naming `debian:bookworm` — a fallback the branch under test had removed.

Tests are safe from this. Vitest resolves from the workspace root, so colocated
`src/**/*.test.ts` always sees your working tree.

### When the tool is lying, not the code

`gh` prefers `GH_TOKEN` from the environment over the credentials `gh auth login`
stored. When that token is the narrower of the two, commands that resolve
organisation data fail on scope rather than on anything you wrote:

```
$ gh pr edit 38 --body-file body.md
GraphQL: Your token has not been granted the required scopes to execute this
query. The 'login' field requires one of the following scopes: ['read:org']
```

`gh pr create` and `gh api` are unaffected — they never touch those endpoints —
so the failure looks specific to one command rather than to the token. Either
use `gh api --method PATCH repos/OWNER/REPO/pulls/N -F body=@body.md`, or
`env -u GH_TOKEN gh ...` to fall back to the stored credentials. `gh auth status`
prints which token is active and what scopes it carries; read it before assuming
the command is at fault.

## Adding a computer provider

Implement `ComputerProvider` from `@husk-ai/core`. Only the container pair share a base
class — `local`, `ssh` and `fly` implement the interface directly, so if yours is not
container-shaped, do the same rather than forcing it through `OciProvider`. See
[provider selection](docs/ARCHITECTURE.md#provider-selection) for the hierarchy.

The bar:

- `isAvailable()` never throws, and distinguishes *not installed* from *installed but
  not running* from *installed and refusing this user*, each with its own hint.
- Set `isolationKind` honestly.
- Reuse `policy.ts` — the path jail, command policy, env scrubbing and `OutputBuffer`
  are shared so a command refused in one place is refused everywhere.
- Tests pass without the underlying tool installed.

Your provider drives the `ComputerState` machine, so handle every transition it can
reach — see [lifecycle](docs/ARCHITECTURE.md#lifecycle). Two states you will not
command: `paused` is reported by docker and fly but husk never sets it, and `error` is
terminal.

<sub>[Provider hierarchy](docs/diagrams/14-uml-provider-hierarchy.html) · [lifecycle](docs/diagrams/15-computer-lifecycle.html) · [core contracts](docs/diagrams/13-uml-core-contracts.html)</sub>

## Adding a model provider

If it speaks the OpenAI dialect, add a configuration to `src/providers/compatible.ts`
— base URL, env var, catalogue slice, any header quirk. Do not copy the OpenAI provider.
If it does not, write the translation properly, as `google.ts` does.

`isAvailable()` must report the exact environment variable in its hint, and must never
throw when the key is missing.

## Commits

Present tense, explain the why in the body when it is not obvious. No emoji, no
Conventional Commits ceremony.

**Say what changed for the person affected, not which files moved.** A reader
scanning `git log` is asking "does this touch me?" -- a subject naming the symptom
answers that, and one naming the module does not. Be specific enough that the
subject is useless for any other commit: a number, a symptom, a count. If the
subject cannot carry the reason, the body does.

Worked examples, all real:

    Stop losing 325 MB every time a destroy fails quietly
    Name what holds the port, and stop four tests flaking under load
    docs: stop claiming a streamable HTTP transport that does not exist

Not `Update CHANGELOG`, not `chore: various fixes`, not `fix: bug in runtime`.
One concern per commit.

The fullest sample of the style is `git log history/pre-launch` -- the 19 pre-launch
commits, which `main`'s squashed history does not preserve.

## Reference

Sixteen diagrams cover the architecture, data flows, contracts and lifecycles —
[`docs/diagrams/`](docs/diagrams/). Each ships a PNG, an SVG, an interactive HTML
viewer with pan/zoom and relationship tracing, and the JSON spec it was generated from.

Worth knowing before a deep change:

| If you are touching | Read |
| --- | --- |
| A tool, or the MCP surface | [one `shell` call end to end](docs/diagrams/12-lld-mcp-shell-call.html) |
| Policy, jails, or redaction | [trust boundaries](docs/diagrams/05-trust-boundaries.html) · [a `shell` call on `local`](docs/diagrams/09-dfd3-shell-call.html) |
| Computer creation or reuse | [inside the computer manager](docs/diagrams/08-dfd2-computer-manager.html) |
| Types in `@husk-ai/core` | [the core contracts](docs/diagrams/13-uml-core-contracts.html) |
| Ports, processes, or `husk serve` | [high-level design](docs/diagrams/11-hld-runtime.html) |

Where a diagram and a doc disagree, the diagram follows the code.
