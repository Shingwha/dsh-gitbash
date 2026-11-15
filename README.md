# dsh-gitbash

A DeepSeek Harness (DSH) plugin that **replaces the Windows PowerShell shell tool with Git Bash**. While enabled, every agent runs commands through Git Bash (`bash.exe` from Git for Windows) and the `pwsh` tool is removed, so the model works in a POSIX shell on Windows.

English | [中文](README.zh.md)

## Features

- **Git Bash-backed `bash` tool** for every agent preset (`standard`, `ptc`, `cordis`, `minimal`).
- **PowerShell removed** while the plugin is active: the `pwsh` tool is restricted out of every agent's tool list, and a guard denies any late call with an explanation.
- **One switch to rule it**: enable or disable the bundle on the Plugins page. Disabling fully restores the shipped PowerShell stack.
- **Control panel on the Plugins page**: master switch, `bash.exe` path override, default timeout, and the model prompt-hint toggle.
- **Keeps the official capabilities**: the shipped `dsh-tool-bash` consumer is reused unchanged, so background jobs, timeout-to-background promotion, sandbox escalation, and the exit-code contract all keep working.
- Auto-detects Git for Windows; WSL execution aliases are never picked.

## Requirements

- Windows 10/11.
- [Git for Windows](https://gitforwindows.org/) installed (`C:\Program Files\Git\bin\bash.exe` by default).
- DeepSeek Harness `>= 0.2.2-rc.3` with the Web GUI (Plugins page available).

## Install

From the Plugins page:

1. **Plugins → Add plugin**.
2. Paste the repository spec `github:Shingwha/dsh-gitbash` (or `git+https://github.com/Shingwha/dsh-gitbash.git`) and confirm.
3. The `Git Bash` bundle appears as enabled; **refresh the page** once so the browser loads the control panel.

Alternative — install a packed tarball: `npm pack` in a checkout produces `dsh-gitbash-<version>.tgz`; pass its absolute path to **Add plugin**.

> Local-directory installs become pnpm `link:` installs, and a linked package cannot resolve the `@deepseek-ai/*` packages that ship inside DSH. Use the git spec or a packed tarball instead.

Verify it works: ask an agent to run `uname -s`; it should report `MINGW64_NT-...`, the `pwsh` tool should no longer be present, and **Plugins → Git Bash** shows the control panel.

## Configuration

The panel lives at **Plugins → Git Bash**. All fields are live: edits apply to new commands, and prompt changes apply to running sessions from their next step.

| Field | Default | Meaning |
|---|---|---|
| Git Bash mode (master switch) | on | Enables or disables the whole bundle. Off restores the shipped PowerShell stack. |
| `bashPath` | empty | Absolute path to `bash.exe`. Empty auto-detects: `Program Files\Git\bin`, `Program Files (x86)\Git\bin`, `LocalAppData\Programs\Git\bin`, then PATH-derived installs; WSL `WindowsApps` aliases are skipped. |
| `promptHint` | `true` | Adds a short Git Bash guidance section to the system prompt (native/POSIX paths, `cygpath`, MSYS argument conversion, confined-session escalation). |
| `timeoutMs` | `120000` | Default foreground timeout. Per-call overrides are capped at 600000 ms. |

Fixed internal budgets: 64000 bytes per captured stream with a 64 MiB spill cap, and a 3000 ms kill grace. The bash tool row keeps its own official form (`enableRunInBackground`, `promoteOnTimeout`).

## How it works

The bundle patch makes three composition changes (Windows only):

1. Disables the `pwsh-sandbox` executor row, because one composition admits exactly one `ctx.shell` provider.
2. Inserts the `gitbash-shell` row: this plugin implements the `ShellExecutor` seam and spawns every command as `<bash.exe> --noprofile --norc -c <command>`, confined through `ctx.sandbox.confine()` when the session policy requires it.
3. Re-enables the official `tool-bash` row on the host plane so every agent inherits the same battle-tested bash tool.

On every agent (`agent/created`, existing agents at activation, and late registrations via a `tools/change` retry) the plugin applies `agent.ctx.tools.restrict({ deny: ['pwsh'] })` and registers a monotonic guard for the `pwsh` name. On POSIX every inserted row is disabled and the shipped bash stack is untouched.

## Sandbox limitation (read this on Windows)

Cygwin/MSYS2 creates a named pipe while initializing its runtime, and DSH's Windows write boundary runs confined children with a **Low-integrity token** that cannot create one. As a consequence, Git Bash cannot start under the `read-only` and `workspace-write` permission presets; the executor reports this deterministically as an unavailable sandbox and tells the model to retry the exact command once with `sandbox_permissions: "danger-full-access"` (one approval), or to use a full-access session. Full-access sessions run Git Bash without restriction and are unaffected.

This is a property of the confinement model, not a configuration bug: loosening the token would reopen "Everyone can write anywhere", so no option is offered to bypass it.

## Uninstall / rollback

Disable the bundle on the Plugins page (or remove it). The patch layer drops, the shipped `pwsh-sandbox` and `tool-pwsh` rows return, and the `bash` tool disappears. No other state is touched.

## Development

```
├── package.json        # bundle manifest: dsh.bundle.patch + dsh.client
├── cordis.patch.yml    # composition changes (rows)
├── index.js            # Host half: GitBashExecutor (ctx.shell), pwsh removal, prompt section
├── client.js           # Client half: Plugins page control panel (plugins.bundle.config/row.config)
├── locale/*.json       # Plugin-manager title/description (en, zh)
├── docs/DETAIL.md      # Detail document shown on the plugin page
└── icon.svg
```

- Edit the sources, then `npm pack` and install the produced tarball to test a change (installed packages hot-replace; a replaced package may need one restart).
- Syntax checks: `node --check index.js && node --check client.js`.
- The Client half is plain JavaScript (`window.__ModuleLoader__.load`); no build step is required.
- Versioning: bump `version` in `package.json` for every install, because the loader caches a package generation by name.

## License

MIT — see [LICENSE](LICENSE).
