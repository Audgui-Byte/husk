/**
 * Explaining a command that failed because the computer is not Linux.
 *
 * On a Windows host whose WSL is not working, the `local` provider runs
 * commands through `cmd.exe /d /s /c`. The session's opening note says so
 * once. Everything after that is on its own: a model that asked for `grep`
 * three hundred turns later gets a bare failure with no connection to a
 * sentence it read at the start, and the most common recovery is to retry the
 * same command with slightly different flags.
 *
 * `HuskError` carries a `hint` for exactly this, but a command that runs and
 * exits non-zero is not an error husk threw -- it is an `ExecResult`, and
 * `ExecResult` is a contract with no room for advice. So the explanation is
 * produced here and attached by whichever tool layer is rendering the result.
 *
 * Lives in core because both `@husk-ai/mcp` and `@husk-ai/agent` need it and
 * `agent` does not depend on `runtime`. It reads only `ComputerInfo`, which is
 * core's own type, and it is pure.
 *
 * ## What is actually different, measured
 *
 * Checked against `cmd.exe /d /s /c` on Windows 10.0.26200, the same spawn the
 * provider uses:
 *
 * | written | cmd.exe does |
 * | --- | --- |
 * | `echo a && echo b` | works -- `&&` and `\|\|` are supported |
 * | `echo $HOME` | prints `$HOME`, exit 0 |
 * | `echo 'quoted'` | prints `'quoted'`, exit 0 -- `'` is not a quote |
 * | `for f in *; do ...; done` | `f was unexpected at this time.`, exit 1 |
 * | `grep foo .` | works *if* Git for Windows is on PATH, else not recognised |
 *
 * Two things follow, and both are counter-intuitive.
 *
 * The missing-command case is the mild one. It is loud, it names the command,
 * and a model can act on it. Worse are `$VAR` and `'...'`: they do not fail,
 * they produce a wrong answer at exit 0, and nothing downstream can tell.
 *
 * And "POSIX tools are unavailable" is simply false on a developer machine.
 * Git for Windows puts `cat`, `sed`, `grep`, `chmod` and `uname` on PATH, so
 * the available command set depends on what else the user has installed.
 * Claiming they are all missing is the same category of error as claiming
 * isolation husk does not provide, pointed the other way.
 */
import type { ComputerInfo } from './types/computer.js';

/**
 * cmd.exe's rejection of an unknown command.
 *
 * Matched on text because there is no code to match on: `cmd.exe /c
 * definitelynotacommand` exits **1**, indistinguishable from a real program
 * failing. (9009 is what `cmd` reports in some other invocations; it is not
 * what this spawn produces, and building on it would have been building on a
 * remembered number instead of a measured one.)
 *
 * The text is localised by Windows, so this recognises the English message and
 * quietly declines on a German or Japanese host rather than guessing. A missed
 * explanation is a worse day; a wrong one is a wrong day for everybody.
 */
const NOT_RECOGNISED =
  /is not recognized as an internal or external command|is not recognized as the name of a cmdlet/i;

/**
 * A line to append to a failed command's output, or `null` when husk has
 * nothing useful to add.
 *
 * Returns `null` for every computer that is not a degraded Windows one, so
 * callers can append unconditionally.
 */
export function explainShellFailure(info: ComputerInfo, stderr: string): string | null {
  const degradation = info.spec.labels?.['husk.degradation'];
  if (!degradation) return null;
  if (!NOT_RECOGNISED.test(stderr)) return null;

  const fix =
    degradation === 'wsl-broken'
      ? 'WSL is installed on this host but not answering -- `wsl --shutdown` usually revives it'
      : 'this host has no WSL -- `wsl --install` would give it one';

  return (
    '[husk] This computer is running cmd.exe, not Linux, so that command does not exist here. ' +
    'Retrying it with different flags will not help. ' +
    `Tell the user their husk computer is degraded: ${fix}.`
  );
}
