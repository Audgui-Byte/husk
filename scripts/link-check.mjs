#!/usr/bin/env node
/**
 * The link check.
 *
 * Every other guard here watches code. This one watches the prose, because the
 * prose has the same failure mode and nothing was looking: a link is a fact
 * about where something lives, written in a file that has no idea when that
 * somewhere moves.
 *
 * `README.md` pointed at a `CONTRIBUTORS.md` that has never existed in this
 * history. Nothing failed and nothing warned, because the only way to find it
 * was to click it -- which is the one thing a reviewer reading a diff does not
 * do.
 *
 * Anchors are the other half, and the worse half. A `#anchor` is a copy of
 * another file's heading text, and GitHub drops you at the top of the page
 * when it stops matching rather than telling you it missed. A stale anchor
 * reads exactly like a working link.
 *
 * Scope is every tracked markdown file that a contributor is steered through,
 * discovered from `git ls-files` rather than a list kept here -- a list would
 * be one more copy to drift, and a new document would quietly start out
 * unchecked. Excluded: `docs/diagrams/` is generated, and `apps/` sits outside
 * the workspace with its own build to answer for its own links.
 *
 * External URLs are not checked. A guard that reaches the network fails for
 * reasons that have nothing to do with the commit under test, and a guard that
 * fails for unrelated reasons is one people learn to re-run rather than read.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * `.github/` belongs to the infrastructure owner and `apps/` to the sites, so
 * a break there is not this check's to fail on.
 */
const SKIP = [/^apps\//, /^\.github\//, /^docs\/diagrams\//];

const FILES = execFileSync('git', ['ls-files', '*.md'], { cwd: ROOT, encoding: 'utf8' })
  .split('\n')
  .filter(Boolean)
  .filter((f) => !SKIP.some((re) => re.test(f)))
  .sort();

/**
 * GitHub's anchor rule: lowercase, drop everything that is not a word
 * character, space or hyphen, then spaces to hyphens. Backticks and the em
 * dash both vanish, so `## Husk — releasing` is `#husk--releasing`.
 */
const anchorFor = (heading) =>
  heading
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');

/**
 * Fenced blocks hold example links that are not this repo's to resolve, and so
 * do blockquotes: `brand/voice-examples.md` quotes a specimen onboarding note
 * that links to an `isolation.md` the sample is imagining, not one we owe the
 * reader. Quoted copy is someone else's sentence, including its links.
 */
const stripQuoted = (txt) => txt.replace(/^```[\s\S]*?^```/gm, '').replace(/^\s*>.*$/gm, '');

const source = new Map();
for (const f of FILES) source.set(f, stripQuoted(readFileSync(join(ROOT, f), 'utf8')));

const headings = new Map();
for (const [f, txt] of source) {
  headings.set(f, new Set([...txt.matchAll(/^#{1,6}\s+(.+)$/gm)].map((m) => anchorFor(m[1]))));
}

const failures = [];
let checked = 0;
const fail = (label, hint) => failures.push({ label, hint });

for (const [f, txt] of source) {
  const abs = join(ROOT, f);

  for (const m of txt.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
    const target = m[1].replace(/`/g, '');
    if (/^(https?:|mailto:|tel:)/.test(target)) continue;
    checked++;

    const [path, anchor] = target.split('#');

    // A bare `#anchor` points inside the file it is written in.
    if (!path) {
      if (!headings.get(f).has(anchor)) fail(`${f} -> #${anchor}`, `no heading in ${f} makes that anchor`);
      continue;
    }

    const resolved = resolve(dirname(abs), path);
    if (!existsSync(resolved)) {
      fail(`${f} -> ${target}`, `${relative(ROOT, resolved).split('\\').join('/')} does not exist`);
      continue;
    }

    // Only files this check parsed can have their anchors verified. A link
    // into a generated diagram or a directory is checked for existence alone,
    // which is better than implying a check that did not run.
    if (!anchor || statSync(resolved).isDirectory()) continue;
    const rel = relative(ROOT, resolved).split('\\').join('/');
    if (headings.has(rel) && !headings.get(rel).has(anchor)) {
      fail(`${f} -> ${target}`, `no heading in ${rel} makes #${anchor}`);
    }
  }
}

/* ---------------------------------------------------------------------------- */

for (const f of failures) console.error(`  BROKEN ${f.label}\n         fix: ${f.hint}`);
console.log(
  `\n${checked - failures.length} of ${checked} internal links resolve, across ${FILES.length} tracked documents`,
);
process.exit(failures.length ? 1 : 0);
