# Git Bash

Replaces the PowerShell shell stack with Git Bash on Windows. While this
bundle is installed, the model-facing `bash` tool runs through Git Bash
(`bash.exe` from a detected or configured Git for Windows install), and
`pwsh` is removed for every agent.

## What it changes

- On Windows, the `bash` tool runs through Git Bash; the shipped PowerShell
  executor is replaced.
- The official `bash` tool is used as-is, so background jobs, timeouts,
  sandbox escalation, and exit codes keep working.
- `pwsh` is removed for every agent.
- On POSIX the bundle does nothing; the shipped bash stack is untouched.

## Configuration (Plugins page)

Edit the fields on the bundle page, then press **Save**. Leaving the page
discards unsaved changes. Enable or disable the bundle with the plugin
page's own switch.

Saved values apply to new commands, and prompt changes apply to running
sessions from their next step.

| Field | Default | Meaning |
|---|---|---|
| `bashPath` | empty | Absolute path to `bash.exe`. Empty auto-detects `Program Files\Git\bin`, `Program Files (x86)\Git\bin`, `LocalAppData\Programs\Git\bin`, then PATH-derived installs. WSL `WindowsApps` aliases are skipped. |
| `timeoutMs` | `120000` | Default foreground timeout; per-call overrides are capped at 600000 ms. |
| `promptHint` | `true` | Add a short Git Bash guidance section to the system prompt. |

## Confined sessions

Full-access sessions run Git Bash directly. Under `read-only` /
`workspace-write`, DSH runs confined children with a Low-integrity token
that cannot create the named pipe Cygwin needs, so Git Bash always fails
before running a command. The executor reports this as an unavailable
sandbox and suggests retrying the command once with
`sandbox_permissions: "danger-full-access"`, or using a full-access session.
The Low-integrity token is the write boundary; bypassing it would make the
permission preset meaningless, so no unconfined switch is offered.

## Rollback

Disable the bundle on the Plugins page: the patch layer drops, the `pwsh`
executor and tool rows return, and the `bash` tool disappears. No other
state is touched.
