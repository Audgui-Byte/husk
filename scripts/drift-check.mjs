#!/usr/bin/env node
/**
 * The drift check.
 *
 * Some facts in this repo are written down in more than one place, because the
 * alternative is worse: the docs site cannot import from `packages/core`, and a
 * stylesheet cannot import a stylesheet it has to ship standalone. Duplication
 * is the trade, and this script is the price of it.
 *
 * It exists because of two bugs that shipped. `http-referer: https://husk.sh`
 * went out in an attribution header for months with a test asserting the same
 * wrong literal -- two files agreeing with each other and with nothing else.
 * And `husk --version` still prints a version no package is on.
 *
 * A duplicated fact with no check is a fact that is already wrong and has not
 * been noticed yet. Every invariant below is one a human would otherwise have
 * to remember.
 *
 * The goal is not fewer copies. `REPO_URL` lives in both site config files, and
 * two small Next apps each owning their own constants file is normal --
 * extracting one string into a shared package would couple `apps/*` to
 * `packages/*` for no other reason than to have one copy of it. This check
 * exists so duplication can be safe, not so duplication can be avoided. The
 * copies do not need to be fewer; they need to be observable to each other.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

/** The single source of truth for the version. Everything else must agree. */
export const VERSION = JSON.parse(read('package.json')).version;

/**
 * A browser User-Agent carries major.minor only. Patch-level churn is a
 * fingerprinting signal and tells a server nothing it can act on.
 */
const MAJOR_MINOR = VERSION.split(".").slice(0, 2).join(".");

/**
 * The two sites live outside the npm workspace, so a typo in either must not
 * gate a runtime fix -- that is the friction scoping the install just removed.
 * Their invariants run under `--sites` as a separate, non-required CI job:
 * visible, not blocking.
 */
const SITES_ONLY = process.argv.includes("--sites");

const failures = [];
const passes = [];

/**
 * `file` must contain `needle` verbatim.
 *
 * `hint` names the fix, the way `HuskError` does -- a failure that does not say
 * what to edit just moves the puzzle.
 */
function contains(file, needle, hint) {
  const label = `${file} contains ${JSON.stringify(needle)}`;
  if (read(file).includes(needle)) passes.push(label);
  else failures.push({ label, hint });
}

/** `file` must NOT contain `needle` -- for facts that were wrong and stay wrong. */
function absent(file, needle, hint) {
  const label = `${file} is free of ${JSON.stringify(needle)}`;
  if (!read(file).includes(needle)) passes.push(label);
  else failures.push({ label, hint });
}

/** Two files must be byte-identical. Vendored copies drift silently otherwise. */
function identical(source, copy) {
  const label = `${copy} is byte-identical to ${source}`;
  if (read(source) === read(copy)) passes.push(label);
  else failures.push({ label, hint: `cp ${source} ${copy}` });
}

/* -----------------------------------------------------------------------------
   The design system. `brand/tokens.css` is the source; each app ships a copy
   because a Next app cannot import a stylesheet from outside its own tree.
-------------------------------------------------------------------------------- */
for (const copy of [
  'apps/console/src/styles/tokens.css',
  'apps/docs/src/styles/tokens.css',
  'apps/web/src/styles/tokens.css',
]) {
  identical('brand/tokens.css', copy);
}

/* -----------------------------------------------------------------------------
   Project identity. husk.sh and the husk-sh GitHub org belong to someone else;
   both were shipped in attribution headers and a security contact.
-------------------------------------------------------------------------------- */
for (const file of [
  'SECURITY.md',
  'CODE_OF_CONDUCT.md',
  'packages/core/src/config.ts',
  'packages/core/src/browse.ts',
  'packages/models/src/http.ts',
  'packages/models/src/providers/compatible.ts',
]) {
  absent(file, 'husk.sh', 'that domain is not ours; use the repo URL');
  absent(file, 'husk-sh/', 'that GitHub org is not ours; use Hotragn/husk');
}

/* -----------------------------------------------------------------------------
   The version. package.json is the source; every file below hardcodes it.

   Each assertion pins the version *fragment*, never the whole literal. The
   invariant is "the version here matches the manifests", not "this string is
   exactly this" -- a check that fires when someone legitimately edits the URL
   or adds a field is a check someone disables.
-------------------------------------------------------------------------------- */
if (!SITES_ONLY) {
  const bump = `package.json is on ${VERSION}; bump this to match`;
  contains("packages/cli/src/version.ts", `VERSION = '${VERSION}'`, bump);
  contains("packages/core/src/index.ts", `HUSK_VERSION = '${VERSION}'`, bump);
  contains("packages/core/src/config.ts", `husk/${VERSION}`, bump);
  contains("packages/models/src/http.ts", `husk/${VERSION}`, bump);
  contains("packages/core/src/browse.ts", `husk-browser/${MAJOR_MINOR}`, bump);
  // docs/API.md is the control-plane contract, not a website: the example
  // payload has to show the version the server actually returns.
  contains("docs/API.md", `"version": "${VERSION}"`, bump);
}

/* -----------------------------------------------------------------------------
   The sites. Non-required: run with `--sites`.
-------------------------------------------------------------------------------- */
if (SITES_ONLY) {
  for (const file of ["apps/docs/src/lib/site.ts", "apps/web/src/lib/content.ts"]) {
    absent(file, "husk.sh", "that domain is not ours; use the repo URL");
    absent(file, "husk-sh/", "that GitHub org is not ours; use Hotragn/husk");
  }
  contains(
    "apps/docs/src/lib/site.ts",
    `HUSK_VERSION = '${VERSION}'`,
    `package.json is on ${VERSION}; the docs must not describe an older one`,
  );
}

/* ---------------------------------------------------------------------------- */

for (const p of passes) console.log(`  ok    ${p}`);
for (const f of failures) console.error(`  DRIFT ${f.label}\n        fix: ${f.hint}`);
console.log(`\n${passes.length} ok, ${failures.length} drifted (version ${VERSION})`);
process.exit(failures.length ? 1 : 0);
