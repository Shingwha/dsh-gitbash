# dsh-gitbash

A DeepSeek Harness plugin that runs the `bash` tool through **Git Bash** on Windows instead of PowerShell. While enabled, every agent loses the `pwsh` tool.

English | [中文](README.zh.md)

## What it does

- Runs commands through Git Bash and keeps the official `bash` tool, so background jobs, timeouts, sandbox escalation and exit codes keep working.
- Removes `pwsh` from every agent; disabling the bundle restores the shipped PowerShell stack.
- Auto-detects Git for Windows, skipping WSL `WindowsApps` aliases.

## Requirements

- Windows 10/11 with [Git for Windows](https://gitforwindows.org/).
- DeepSeek Harness `>= 0.2.2-rc.3` with the Web GUI.

## Install

1. **Plugins → Add plugin**, enter `github:Shingwha/dsh-gitbash`, and confirm.
2. Refresh the page once so the settings form loads.

A packed tarball (`npm pack`) works too; pass its absolute path to **Add plugin**. Do not install the directory itself: pnpm links it and the DSH `@deepseek-ai/*` packages will not resolve.

Verify with `uname -s` in a new session: it should report `MINGW64_NT-...`, and `pwsh` should be gone.

## Configuration

Open **Plugins → Git Bash**. Edit the fields, then press **Save**; saved values apply to new commands, and prompt changes apply from the next step. Use the plugin page's own switch to enable or disable the bundle.

| Field | Default | Meaning |
|---|---|---|
| `bashPath` | empty | Absolute path to `bash.exe`. Empty auto-detects `Program Files\Git\bin`, `Program Files (x86)\Git\bin`, `LocalAppData\Programs\Git\bin`, then PATH-derived installs. |
| `timeoutMs` | `120000` | Default foreground timeout. Per-call overrides are capped at 600000 ms. |
| `promptHint` | `true` | Adds a short Git Bash guidance section to the system prompt. |

## Confined sessions

Git Bash cannot start under `read-only` / `workspace-write`: Cygwin needs a named pipe that DSH's Low-integrity sandbox token cannot create. The executor reports this and suggests a one-time `danger-full-access` retry or a full-access session. This is a Windows sandbox limitation, not a setting; see [docs/DETAIL.md](docs/DETAIL.md).

## Uninstall

Disable the bundle on the Plugins page: the patch drops, `pwsh` returns, and `bash` disappears. No other state is touched.

## Development

Edit the sources, run `npm pack`, and install the tarball to test. Bump `version` for each install. Syntax check with `node --check index.js && node --check client.js`.

## License

MIT — see [LICENSE](LICENSE).
