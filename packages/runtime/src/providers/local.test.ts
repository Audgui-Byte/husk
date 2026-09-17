/**
 * The local provider's honesty about isolation.
 *
 * This is the one claim in husk that must never drift optimistically. The build
 * contract says the local provider is guardrails only and never to claim
 * isolation it does not provide, and `husk doctor` renders whatever this
 * returns. A boolean flipped here would quietly tell someone their
 * prompt-injected agent was sandboxed.
 *
 * It lived as a subprocess assertion in the CLI smoke tests, where it shared a
 * describe block with tests that probed docker and podman and so inherited
 * their latency and their flake. The invariant belongs next to the code that
 * owns it.
 *
 * `isAvailable()` calls `detectShell()`, which on Windows spawns `wsl.exe -l -q`
 * once, capped at 8s and cached. That is bounded and unavoidable if the version
 * label is to be real; on posix it does no I/O at all. The isolation fields
 * asserted below are literals either way.
 */
import { describe, expect, it } from 'vitest';
import { LocalProvider, windowsHint, windowsReason } from './local.js';
import type { ShellPlan } from './local.js';

describe('the local provider', () => {
  it('is always available, because the free path depends on it', async () => {
    const a = await new LocalProvider().isAvailable();
    expect(a.available).toBe(true);
  });

  it('never claims isolation it does not have', async () => {
    const a = await new LocalProvider().isAvailable();
    expect(a.isolated).toBe(false);
    expect(a.isolationKind).toBe('guardrails');
  });

  it('names the mechanism rather than saying "not isolated" and stopping', async () => {
    const a = await new LocalProvider().isAvailable();
    // "Isolated" on its own is meaningless, and so is its negation: a user who
    // reads "not isolated" still does not know what to do about it.
    expect(a.reason).toBeTruthy();
    expect(a.hint).toBeTruthy();
    expect(`${a.reason} ${a.hint}`).toMatch(/guard|sandbox|Docker|wsl/i);
  });

  /**
   * Taken as plans rather than through `isAvailable()`, because reaching the
   * degraded states for real means breaking WSL on the machine running the
   * test. The states themselves are set in one place, `detectShell`, from a
   * single fact: whether `wsl.exe -l -q` listed a distro.
   */
  describe('what it tells a Windows user', () => {
    const plan = (degradation?: 'wsl-broken' | 'wsl-absent'): ShellPlan => ({
      kind: degradation ? 'windows' : 'wsl',
      degradation,
      label: 'irrelevant to these assertions',
    });

    it('does not tell someone to install the WSL they already have', () => {
      // The "install Docker" bug, one provider over: a fix naming a step the
      // user has already taken reads as the tool not having looked.
      expect(windowsHint(plan('wsl-broken'))).toMatch(/wsl --shutdown/);
      expect(windowsHint(plan('wsl-broken'))).not.toMatch(/wsl --install/);
      expect(windowsHint(plan('wsl-absent'))).toMatch(/wsl --install/);
    });

    it('does not claim WSL is absent from a machine that has it', () => {
      // `reason` used to be one hardcoded sentence saying "with no WSL" for
      // both states, printed directly beneath a `version` line that said WSL
      // was installed and not responding. Two answers, adjacent lines.
      expect(windowsReason(plan('wsl-broken'))).toMatch(/installed but not answering/);
      expect(windowsReason(plan('wsl-broken'))).not.toMatch(/no WSL/);
      expect(windowsReason(plan('wsl-absent'))).toMatch(/no WSL/);
    });

    it('says nothing when the shell is a real Linux one', () => {
      expect(windowsReason(plan())).toBeNull();
      expect(windowsHint(plan())).toBeNull();
    });
  });

  it('does not advertise isolation in its own description', async () => {
    const p = new LocalProvider();
    expect(p.description).toMatch(/not isolated/i);
    expect(p.priority).toBe(10);
  });
});
