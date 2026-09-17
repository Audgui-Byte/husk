/**
 * What an MCP client is told when the computer is not Linux.
 *
 * Three surfaces promise Linux and none of them can see a computer when they
 * are written: the server instructions and the tool descriptions are both
 * fixed before anything is created, because nothing is created until the first
 * tool call. On a Windows host with no working WSL all three are wrong, and
 * the model plans against them before any tool result can say otherwise.
 *
 * The instructions are sent once at initialize, so they stopped promising.
 * The tool list can be re-sent, so it is corrected.
 */
import { describe, expect, it } from 'vitest';
import { TOOLS, toolsFor } from './tools.js';

const shellIn = (tools: ReturnType<typeof toolsFor>) => {
  const t = tools.find((x) => x.name === 'shell');
  if (!t) throw new Error('no shell tool');
  const props = t.inputSchema.properties as Record<string, { description?: string }>;
  return { description: t.description, command: props.command?.description ?? '' };
};

describe('the tool list a healthy computer gets', () => {
  it('is the list itself, not a copy of it', () => {
    // Identity, not deep equality: a rebuilt array on the common path would be
    // work done on every list request for no one's benefit.
    expect(toolsFor(false)).toBe(TOOLS);
  });

  it('still promises Linux, because that is still true', () => {
    expect(shellIn(toolsFor(false)).description).toMatch(/your Linux computer/);
    expect(shellIn(toolsFor(false)).command).toMatch(/sh -c/);
  });
});

describe('the tool list a degraded Windows computer gets', () => {
  const degraded = toolsFor(true);

  it('stops claiming Linux in the description a model reads first', () => {
    const shell = shellIn(degraded);
    expect(shell.description).not.toMatch(/Linux computer/);
    expect(shell.description).toMatch(/NOT Linux/);
  });

  it('stops claiming sh -c, which is the instruction the model follows', () => {
    // `sh -c` is not a label, it is a statement about how the string will be
    // interpreted -- the model quotes and escapes against it.
    const shell = shellIn(degraded);
    expect(shell.command).not.toMatch(/sh -c/);
    expect(shell.command).toMatch(/cmd\.exe/);
  });

  it('names the silent differences, not just the loud one', () => {
    expect(shellIn(degraded).description).toMatch(/\$VAR does not expand/);
    expect(shellIn(degraded).description).toMatch(/single quotes are not quotes/);
  });

  it('changes nothing else about the surface', () => {
    // A tool that vanished or gained a required argument here would be a
    // different failure: the client re-reads this list mid-session, and a
    // model that had already planned a call would find the tool gone.
    expect(degraded.map((t) => t.name)).toEqual(TOOLS.map((t) => t.name));
    for (const t of degraded) {
      if (t.name === 'shell') continue;
      expect(t).toBe(TOOLS.find((x) => x.name === t.name));
    }
  });

  it('keeps the shell tool arguments identical', () => {
    const before = TOOLS.find((t) => t.name === 'shell')?.inputSchema as Record<string, unknown>;
    const after = degraded.find((t) => t.name === 'shell')?.inputSchema as Record<string, unknown>;
    expect(Object.keys(after.properties as object).sort()).toEqual(
      Object.keys(before.properties as object).sort(),
    );
    expect(after.required).toEqual(before.required);
  });
});
