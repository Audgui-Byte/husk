import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { discover } from './discover.js';

/**
 * Discovery run from a repository root used to offer every Markdown doc as
 * an importable transcript. Only chat-shaped Markdown belongs in the list;
 * anything else is explicitly imported by path.
 */

let dir: string | undefined;

afterEach(async () => {
  if (dir) await rm(dir, { recursive: true, force: true });
  dir = undefined;
});

async function cwd(): Promise<string> {
  dir = await mkdtemp(join(tmpdir(), 'husk-discover-'));
  return dir;
}

const CHAT = `# My conversation

## User

how do I reverse a list in python?

## Assistant

Use a slice: \`xs[::-1]\`.
`;

describe('discover', () => {
  it('offers markdown that is actually a pasted chat', async () => {
    const cwdPath = await cwd();
    await writeFile(join(cwdPath, 'chat.md'), CHAT);
    const found = await discover({ cwd: cwdPath, source: 'markdown' });
    expect(found.map((c) => c.path)).toEqual([join(cwdPath, 'chat.md')]);
  });

  it('does not offer ordinary repository docs as transcripts', async () => {
    const cwdPath = await cwd();
    await writeFile(join(cwdPath, 'CHANGELOG.md'), '# Changelog\n\n## 1.0.0\n\n- added things\n');
    await writeFile(join(cwdPath, 'README.md'), '# Project\n\nSome prose about the project.\n');
    const found = await discover({ cwd: cwdPath, source: 'markdown' });
    expect(found).toEqual([]);
  });

  it('still finds explicit transcript files next to the docs', async () => {
    const cwdPath = await cwd();
    await writeFile(join(cwdPath, 'README.md'), '# Project\n\nProse.\n');
    await writeFile(join(cwdPath, 'session.md'), CHAT);
    const found = await discover({ cwd: cwdPath, source: 'markdown' });
    expect(found.map((c) => c.path)).toEqual([join(cwdPath, 'session.md')]);
  });
});
