/**
 * The strings husk puts on the wire about itself.
 *
 * These were three hardcoded literals until the version and the repository
 * were given one home each. The tests below are about the derivation holding,
 * because every way it can break is quiet: a wrong User-Agent is not an error
 * anywhere, it is just a slightly wrong line in somebody else's access log.
 */
import { describe, expect, it } from 'vitest';
import { FETCH_SCRIPT } from './browse.js';
import { HUSK_BROWSER_USER_AGENT, HUSK_REPO, HUSK_USER_AGENT, HUSK_VERSION } from './identity.js';

describe('the user agents', () => {
  it('carry the version this package is on', () => {
    expect(HUSK_USER_AGENT).toBe(`husk/${HUSK_VERSION} (+${HUSK_REPO})`);
  });

  it('carry major.minor only when a web server is reading them', () => {
    // A browser User-Agent that moves every patch is a fingerprinting signal
    // and tells a server nothing it could act on.
    const [major, minor] = HUSK_VERSION.split('.');
    expect(HUSK_BROWSER_USER_AGENT).toBe(`husk-browser/${major}.${minor} (+${HUSK_REPO})`);
    expect(HUSK_BROWSER_USER_AGENT).not.toContain(HUSK_VERSION);
  });

  it('name a repository, not a domain nobody owns', () => {
    // `husk.sh` shipped in four user agents for months. The URL is asserted
    // against the root manifest by the drift check; this asserts the shape.
    expect(HUSK_REPO).toMatch(/^https:\/\/github\.com\/[^/]+\/[^/]+$/);
    expect(HUSK_REPO).not.toMatch(/\.git$/);
  });
});

describe('the fetch script written into a computer', () => {
  it('has the user agent substituted, not the expression', () => {
    // The quiet failure this exists for: stop the template interpolating and
    // every site husk visits receives the literal text of the expression as a
    // User-Agent. Nothing in husk notices; the only evidence is in somebody
    // else's access log.
    expect(FETCH_SCRIPT).toContain(`"User-Agent": "${HUSK_BROWSER_USER_AGENT}"`);
    expect(FETCH_SCRIPT).not.toContain('${');
  });

  // What this does not catch: someone writing the current UA back as a
  // literal. It equals the derived string today, so both assertions above
  // still pass, and the drift assertion that used to cover it is gone -- on
  // purpose, because it was the one that could never fail. The version test
  // higher up is what breaks, and only at the next bump. Said plainly rather
  // than left as an implied guarantee.

  it('is still a syntactically plausible python program', () => {
    // Interpolating into an embedded script can produce something that builds
    // and typechecks and is not a program.
    expect(FETCH_SCRIPT).toContain('import json, re, sys');
    expect(FETCH_SCRIPT).toContain('urllib.request.Request(url, headers={');
  });
});
