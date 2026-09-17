/**
 * Explaining a command that failed because the computer is not Linux.
 *
 * The stderr fixtures below are verbatim from `cmd.exe /d /s /c` on Windows
 * 10.0.26200 -- the same spawn `@husk-ai/runtime`'s local provider uses --
 * rather than written from memory. The exit code is part of what was measured:
 * an unrecognised command exits **1**, not 9009, which is why this matches on
 * text and why none of these tests assert on a code.
 */
import { describe, expect, it } from 'vitest';
import type { ComputerInfo } from './types/computer.js';
import { explainShellFailure } from './windows-shell.js';

/** Verbatim from cmd.exe. */
const NOT_RECOGNISED =
  "'definitelynotacommand' is not recognized as an internal or external command,\r\noperable program or batch file.";

const info = (labels?: Record<string, string>): ComputerInfo => ({
  id: 'cmp_test',
  name: 'test',
  provider: 'local',
  state: 'running',
  image: 'husk-base',
  workdir: '/work',
  createdAt: '2026-01-01T00:00:00.000Z',
  lastUsedAt: '2026-01-01T00:00:00.000Z',
  spec: { provider: 'local', ...(labels ? { labels } : {}) },
});

const degraded = (kind: 'wsl-broken' | 'wsl-absent') =>
  info({ 'husk.shell': 'windows', 'husk.degradation': kind });

describe('explaining a shell failure on a degraded Windows host', () => {
  it('says the machine is the problem, not the command', () => {
    const why = explainShellFailure(degraded('wsl-broken'), NOT_RECOGNISED);
    expect(why).toMatch(/cmd\.exe, not Linux/);
  });

  it('tells the model to stop retrying', () => {
    // The observed failure mode is a model trying the same command with
    // different flags. Nothing about the flags was ever the problem.
    const why = explainShellFailure(degraded('wsl-absent'), NOT_RECOGNISED);
    expect(why).toMatch(/Retrying it with different flags will not help/);
  });

  it('carries the fix that matches the state', () => {
    expect(explainShellFailure(degraded('wsl-broken'), NOT_RECOGNISED)).toMatch(/wsl --shutdown/);
    expect(explainShellFailure(degraded('wsl-absent'), NOT_RECOGNISED)).toMatch(/wsl --install/);
  });

  it('recognises the PowerShell wording too', () => {
    const ps = "grep : The term 'grep' is not recognized as the name of a cmdlet, function, ...";
    expect(explainShellFailure(degraded('wsl-absent'), ps)).not.toBeNull();
  });
});

describe('when it should stay quiet', () => {
  it('says nothing on a healthy computer', () => {
    // The overwhelming majority of runs. A note here would be noise on every
    // failing test command a model ever runs.
    expect(explainShellFailure(info({ 'husk.shell': 'wsl:Ubuntu' }), NOT_RECOGNISED)).toBeNull();
    expect(explainShellFailure(info(), NOT_RECOGNISED)).toBeNull();
  });

  it('says nothing about a command that genuinely failed', () => {
    // A degraded host still runs real programs, and most of what fails on it
    // fails for ordinary reasons. Claiming otherwise would send the model
    // chasing WSL over a failing build.
    const real = "cat: nonexist.txt: No such file or directory";
    expect(explainShellFailure(degraded('wsl-broken'), real)).toBeNull();
    expect(explainShellFailure(degraded('wsl-broken'), '')).toBeNull();
  });

  it('declines rather than guesses on a non-English Windows', () => {
    // Windows localises this message. Recognising only the English one means
    // a German host gets no explanation, which is worse than a day and better
    // than a wrong explanation attached to an unrelated failure.
    const german = "Der Befehl \"grep\" ist entweder falsch geschrieben oder konnte nicht gefunden werden.";
    expect(explainShellFailure(degraded('wsl-broken'), german)).toBeNull();
  });
});
