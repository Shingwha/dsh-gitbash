# Git Bash

Replaces the PowerShell shell stack with Git Bash on Windows. While this
bundle is installed, the model-facing `bash` tool runs every command through
Git Bash (`bash.exe` from a detected or configured Git for Windows install),
and the `pwsh` tool is removed for every agent.

## What it changes

- The Windows pwsh executor row (`pwsh-sandbox`) is disabled; this plugin
  becomes the single `ctx.shell` provider on win32.
- The official `bash` tool row is re-enabled on the host plane, so every agent
  inherits the same battle-tested tool (background jobs, timeout-to-job
  promotion, sandbox escalation all keep working).
- The `pwsh` tool is removed from every agent while this bundle is active
  (per-agent restriction plus a guard that denies any surviving call); there
  is no option to keep it visible.
- On POSIX the bundle is inert: all inserted rows are disabled there and the
  shipped bash stack is untouched.

## Configuration (Plugins page, `gitbash-shell` row)

All fields are live (volatile): edits apply to new commands and to running
sessions from their next step.

| Field | Default | Meaning |
|---|---|---|
| `bashPath` | empty | Absolute path to `bash.exe`. Empty auto-detects: `Program Files\Git\bin`, `Program Files (x86)\Git\bin`, `LocalAppData\Programs\Git\bin`, then PATH-derived installs. WSL `WindowsApps` aliases are skipped. |
| `promptHint` | `true` | Add a short Git Bash guidance section to the system prompt (paths, `cygpath`, MSYS path conversion, confined-session escalation). |
| `timeoutMs` | `120000` | Default foreground timeout; per-call overrides are capped at 600000 ms. |

Fixed internal budgets (not configurable): 64000 bytes per captured stream with a 64 MiB spill cap, and a 3000 ms kill grace. The workdir falls back to the harness process directory; tool calls normally pass the session directory.

The `Bash tool` row keeps its own form (`enableRunInBackground`,
`promoteOnTimeout`).

## Sandbox

Full-access sessions run Git Bash directly. Under confined modes
(`read-only`, `workspace-write`) the Windows restricted token denies the
named pipe the Cygwin runtime must create during initialization, so a
confined Git Bash always fails before running any command. The executor
classifies that deterministic failure and reports it as an unavailable
sandbox with guidance: retry the exact command once with
`sandbox_permissions: "danger-full-access"` and a justification (the
approval prompt asks the user), or run the session in full access.

### Why this cannot be configured away

DSH's Windows write boundary works by lowering the confined child to **Low
integrity** and labeling only the granted roots Low: Windows' mandatory
integrity check then denies every write outside those roots, and the
restricting-SID list (logon SID + Everyone) stays harmless. A Medium-integrity
restricted token would let `Everyone`-granted writes succeed everywhere, so
the Low-integrity step is the security guarantee itself, not an option. The
global named-pipe namespace lives at Medium integrity, so a Low-integrity
process may not create pipes — and Cygwin must create its signal pipe before
any command runs. No runner flag, no sandbox config, and no custom
`runnerCommand` can change this without dissolving the write boundary, which
is why this plugin does not offer an "unconfined passthrough" switch: silently
upgrading commands would make the session's permission preset a lie. Use a
full-access session for daily bash work, or accept the one-time approval per
command in confined sessions.

## Rollback

Disable this bundle on the Plugins page: the patch layer drops, the pwsh
executor and tool rows return, and the bash tool disappears. No other state
is touched.
