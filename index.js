import z from '@deepseek-ai/schemastery'
import { ShellExecutor } from '@deepseek-ai/dsh-shell'
import { clampTimeout, deadline, timeoutOf } from '@deepseek-ai/dsh-timeout'
import { SandboxUnavailableError, classifyRunnerFailure, isRunnerSpawnFailure, matchesSignature } from '@deepseek-ai/dsh-sandbox'
import { lstatSync } from 'node:fs'
import { dirname, join } from 'node:path'

// ── Git Bash executable resolution (parameterized, pure function of inputs) ──

/**
 * Whether a candidate can be spawned. lstat opens the entry itself instead of
 * following reparse points, so a Store execution alias is seen where stat hits
 * the target's ACL (mirrors the pwsh-local resolution contract).
 */
function candidateExists(candidate) {
	try {
		const stat = lstatSync(candidate)
		return stat.isFile() || stat.isSymbolicLink()
	} catch {
		return false
	}
}

/**
 * Candidate Git Bash `bash.exe` paths, best-known first: well-known install
 * locations, then PATH-derived entries. PATH entries named `WindowsApps` are
 * skipped so the WSL execution alias never wins.
 */
function candidateGitBashPaths(env = process.env) {
	const programFiles = env.ProgramFiles ?? 'C:\\Program Files'
	const programFilesX86 = env['ProgramFiles(x86)']
	const localAppData = env.LOCALAPPDATA
	const candidates = [join(programFiles, 'Git', 'bin', 'bash.exe')]
	if (programFilesX86 !== undefined) candidates.push(join(programFilesX86, 'Git', 'bin', 'bash.exe'))
	if (localAppData !== undefined) candidates.push(join(localAppData, 'Programs', 'Git', 'bin', 'bash.exe'))
	for (const entry of (env.PATH ?? '').split(';')) {
		const trimmed = entry.trim().replace(/^"|"$/g, '')
		if (trimmed.length === 0) continue
		// A git.exe on PATH (typically <install>\cmd\git.exe) locates the install root.
		if (candidateExists(join(trimmed, 'git.exe'))) candidates.push(join(dirname(trimmed), 'bin', 'bash.exe'))
		// A direct bash.exe on PATH, skipping the WSL WindowsApps execution alias.
		if (!/windowsapps/i.test(trimmed)) candidates.push(join(trimmed, 'bash.exe'))
	}
	return candidates
}

/**
 * Resolve the Git Bash executable this executor spawns.
 * @param configured - an explicit `bashPath` config value, trusted as-is.
 * @returns the first existing candidate on Windows, else `bash` for PATH resolution.
 * @throws when Windows auto-detection finds no Git Bash install.
 */
function resolveGitBashPath(configured, env = process.env, platform = process.platform) {
	if (configured !== undefined && configured.length > 0) return configured
	if (platform === 'win32') {
		const seen = new Set()
		for (const candidate of candidateGitBashPaths(env)) {
			const key = candidate.toLowerCase()
			if (seen.has(key)) continue
			seen.add(key)
			if (candidateExists(candidate)) return candidate
		}
		throw new Error('gitbash: no Git Bash (bash.exe) found; install Git for Windows or set bashPath in the dsh-gitbash configuration')
	}
	return 'bash'
}

// ── Fixed budgets and environment ──

/** Model-friendly environment overrides for Git Bash. */
const ENV_OVERRIDES = {
	NO_COLOR: '1',
	TERM: 'dumb',
	PAGER: 'cat',
	GIT_PAGER: 'cat',
	LC_ALL: 'C.UTF-8',
}
const DEFAULT_GRACE_MS = 3e3
const DEFAULT_MAX_SPILL_BYTES = 64 * 1024 * 1024
const DEFAULT_MAX_OUTPUT_BYTES = 6.4e4
const DEFAULT_MAX_TIMEOUT_MS = 6e5

/** Retry budget for hiding pwsh behind a preset row that activates late. */
const HIDE_RETRY_LIMIT = 100

/**
 * Cygwin/MSYS2 runtimes create a signal pipe during DLL initialization. The
 * confined Windows token denies named-pipe creation, so a confined Git Bash
 * always dies with `couldn't create signal pipe` (STATUS_DLL_INIT_FAILED)
 * before running any command. Classify that deterministic signature as an
 * unavailable sandbox with escalation guidance instead of a cryptic exit.
 */
const SIGNAL_PIPE_MESSAGE = /couldn't create signal pipe/i
const SIGNAL_PIPE_EXIT_CODE = 3221225794 // 0xC0000142 STATUS_DLL_INIT_FAILED
const SIGNAL_PIPE_GUIDANCE =
	'Git Bash cannot initialize under the confined Windows token: the Cygwin runtime needs a named pipe the sandbox denies. Retry the exact command with sandbox_permissions "danger-full-access" and a one-sentence justification, or run the session in full access'

const PWSH_GUARD_REASON =
	'pwsh is superseded by the Git Bash plugin (dsh-gitbash): this composition runs shell commands through Git Bash. Use the bash tool, or disable the dsh-gitbash bundle to restore PowerShell.'

const GITBASH_HINT = [
	'The bash tool runs Git Bash (MSYS2) on this Windows host.',
	'Windows paths (C:\\dir) and POSIX paths (/c/dir) both work; convert between forms with cygpath -w and cygpath -u when a program needs one shape.',
	'Core utilities live under /usr/bin. When invoking native Windows programs from bash, arguments that start with / can be rewritten by MSYS path conversion — prefix the command with MSYS_NO_PATHCONV=1 or double the leading slash for flags.',
	'Under the confined permission presets (read-only, workspace-write) Git Bash cannot start: the sandbox token denies the named pipe Cygwin needs. When a bash call reports that, retry the exact command once with sandbox_permissions "danger-full-access" and a short justification — the one-time approval is the user\'s consent. Full-access sessions need no retry.',
].join('\n')

// ── Small shared helpers (mirrors dsh-pwsh-local) ──

function finalOutput(reader) {
	const read = reader.readFrom(0)
	return {
		text: read.text,
		truncated: read.lossy,
		...read.spillPath !== undefined ? { spillPath: read.spillPath } : {},
	}
}

function assertPositiveFinite(name, value) {
	if (!Number.isFinite(value) || value <= 0) throw new Error(`gitbash: ${name} must be a positive finite number`)
}

function assertServiceableConfig(config) {
	assertPositiveFinite('timeoutMs', config.timeoutMs.get())
}

/**
 * Git Bash executor over `ctx.subprocess`, confined through `ctx.sandbox`.
 * Registers as `ctx.shell` (one provider per composition). Process mechanics
 * follow the shipped dsh-pwsh-local / dsh-pwsh-sandbox pair; argv-level
 * confinement follows dsh-bash-sandbox. While active, the plugin also removes
 * the preset-mounted `pwsh` tool (per-agent restriction plus a guard) and
 * contributes a short Git Bash prompt section.
 */
class GitBashExecutor extends ShellExecutor {
	static inject = ['subprocess', 'sandbox', 'sandboxPolicy', 'tools', 'systemPrompt', 'agents']
	static Config = z.object({
		bashPath: z.string().default('').volatile().description('Path to bash.exe. Empty auto-detects: Program Files\\Git\\bin, Program Files (x86), LocalAppData\\Programs\\Git, then PATH-derived installs; WSL WindowsApps aliases are skipped.'),
		promptHint: z.boolean().default(true).volatile().description('Add a short Git Bash guidance section to the system prompt: native and POSIX paths, cygpath, MSYS argument conversion, and confined-session guidance.'),
		timeoutMs: z.number().default(120000).volatile().description('Default foreground command timeout, in milliseconds; per-call overrides are capped at 600000.'),
	})

	/** The declared executable the current resolved path was probed from. */
	declaredBashPath
	/** The Git Bash executable every command runs through; a changed declared path re-probes on the next read. */
	resolvedBashPath
	/** Per-process confinement facts retained until settlement. */
	processFacts = new Map()
	/** Live agents this plugin manages pwsh visibility for. */
	#agents = new Map()

	constructor(ctx, config) {
		super(ctx)
		this.config = config
		this.declaredBashPath = config.bashPath.get()
		this.mode = ctx.sandboxPolicy.defaultMode

		// While this provider owns ctx.shell, a pwsh tool call would execute
		// PowerShell syntax through Git Bash; the guard denies any such call.
		ctx.tools.guard((exec) => (exec.name === 'pwsh' ? PWSH_GUARD_REASON : undefined))

		// pwsh is removed for every agent: existing ones now, and each agent
		// created later. The guard above covers the brief registration window.
		ctx.on('agent/created', ({ agent }) => this.#admit(agent))
		ctx.on('agent/disposed', ({ agent }) => this.#release(agent))
		ctx.on('app-boot/config-reload', () => this.#resyncAll())
		ctx.effect(() => () => this.#teardown())

		ctx.systemPrompt.section({
			name: 'gitbash-hint',
			order: 1010,
			text: () => (this.config.promptHint.get() ? GITBASH_HINT : ''),
		})

		for (const agent of ctx.agents.list()) this.#admit(agent)
	}

	/** The configured default sandbox mode — the capability fact the tool layer reads. */
	get sandboxMode() {
		return this.mode
	}

	get bashPath() {
		const declared = this.config.bashPath.get()
		if (declared !== this.declaredBashPath) {
			this.resolvedBashPath = resolveGitBashPath(declared)
			this.declaredBashPath = declared
		}
		return this.resolvedBashPath ?? (this.resolvedBashPath = resolveGitBashPath(this.declaredBashPath))
	}

	// ── ShellExecutor contract ──

	/** Resolve a request into a fully-specified spec with the per-call sandbox policy. */
	resolve(request) {
		assertServiceableConfig(this.config)
		const timeoutMs = clampTimeout(request.timeoutMs, this.config.timeoutMs.get(), DEFAULT_MAX_TIMEOUT_MS, 'gitbash: request.timeoutMs')
		const stdoutMaxBytes = request.stdoutMaxBytes ?? DEFAULT_MAX_OUTPUT_BYTES
		assertPositiveFinite('request.stdoutMaxBytes', stdoutMaxBytes)
		return {
			command: request.command,
			workdir: request.workdir ?? process.cwd(),
			timeoutMs,
			onExpiry: request.onExpiry ?? 'kill',
			stdoutMaxBytes,
			...request.signal ? { signal: request.signal } : {},
			...request.stdin !== undefined ? { stdin: request.stdin } : {},
			...request.env !== undefined ? { env: request.env } : {},
			...request.dshEnv !== undefined ? { dshEnv: request.dshEnv } : {},
			sandboxPolicy: request.sandboxPolicy ?? this.ctx.sandboxPolicy.resolve(),
		}
	}

	/** The Git Bash invocation argv for one resolved spec. */
	argv(spec) {
		return [this.bashPath, '--noprofile', '--norc', '-c', spec.command]
	}

	/** Map one resolved spec plus its argv onto a fully-specified subprocess spawn. */
	spawnSpec(spec, stdoutMaxBytes, signal, argv) {
		const collect = (maxBytes) => ({
			maxBytes,
			spill: { maxBytes: DEFAULT_MAX_SPILL_BYTES },
		})
		return {
			argv: [...argv],
			cwd: spec.workdir,
			stdio: {
				stdin: spec.stdin !== undefined ? { data: spec.stdin } : 'ignore',
				stdout: collect(stdoutMaxBytes),
				stderr: collect(DEFAULT_MAX_OUTPUT_BYTES),
			},
			graceMs: DEFAULT_GRACE_MS,
			signal,
			env: {
				...ENV_OVERRIDES,
				...spec.env,
				...spec.dshEnv,
			},
		}
	}

	/** The collect-mode readers the executor itself requested (present by construction). */
	static collected(handle) {
		const { stdout, stderr } = handle.collected
		if (stdout === undefined || stderr === undefined) throw new Error('gitbash: subprocess implementation dropped a requested collect stream')
		return { stdout, stderr }
	}

	async execute(spec) {
		const policy = spec.sandboxPolicy
		const { mode } = policy
		if (mode === 'danger-full-access') {
			return GitBashExecutor.decorateResult(await this.executeArgv(spec, this.argv(spec)), (result) => ({
				...result,
				sandbox: { mode, denied: false },
			}))
		}
		let confined
		const ex = await this.executeArgv(spec, async (signal) => {
			const prepared = await this.confine(spec.command, { ...policy, mode }, signal)
			signal.throwIfAborted()
			confined = prepared
			return prepared.argv
		}, (process) => {
			const facts = confined
			this.processFacts.set(process, {
				mode,
				enforcement: facts.enforcement,
				denialSignatures: facts.denialSignatures,
				runnerFailureRules: facts.runnerFailureRules,
				runnerProgram: facts.argv[0],
				workdir: spec.workdir,
			})
		})
		return GitBashExecutor.decorateResult(ex, (result) => {
			if (confined === undefined) return { ...result, sandbox: { mode, denied: false } }
			const { enforcement, denialSignatures, runnerFailureRules } = confined
			const runnerFailure = classifyRunnerFailure(result.exitCode, result.stderr.text, runnerFailureRules)
			if (runnerFailure !== undefined) throw new SandboxUnavailableError(mode, runnerFailure.detail)
			if (SIGNAL_PIPE_MESSAGE.test(result.stderr.text) || (result.exitCode === SIGNAL_PIPE_EXIT_CODE && /bash|msys|cygwin/i.test(result.stderr.text))) {
				throw new SandboxUnavailableError(mode, SIGNAL_PIPE_GUIDANCE)
			}
			return {
				...result,
				sandbox: {
					mode,
					denied: matchesSignature(result.exitCode, result.stderr.text, denialSignatures),
					enforcement,
				},
			}
		}, (error) => {
			if (spec.signal?.aborted === true) spec.signal.throwIfAborted()
			if (confined !== undefined && isRunnerSpawnFailure(error, confined.argv[0], spec.workdir)) throw new SandboxUnavailableError(mode, String(error))
			throw error
		})
	}

	/**
	* Execute an explicit argv with the lifecycle, environment, output,
	* deadline, and cancellation semantics of this executor (mirrors
	* dsh-pwsh-local's executeArgv).
	*/
	async executeArgv(spec, argvOrPrepare, onStarted) {
		let spawnSignal
		let classify
		let disarm = () => {}
		if (spec.onExpiry === 'kill') {
			const d = deadline(spec.signal, spec.timeoutMs, 'BASH_TIMEOUT')
			spawnSignal = d.signal
			classify = () => {
				const timedOut = timeoutOf(d.signal, 'BASH_TIMEOUT') !== undefined
				return { timedOut, aborted: d.signal.aborted && !timedOut }
			}
			disarm = () => {
				d[Symbol.dispose]()
			}
		} else {
			spawnSignal = spec.signal
			classify = () => ({ timedOut: false, aborted: spec.signal?.aborted === true })
		}
		let argv = []
		let preparationTimedOut = false
		if (typeof argvOrPrepare === 'function') {
			const signal = spawnSignal ?? new AbortController().signal
			const cancelled = Promise.withResolvers()
			const abort = () => {
				cancelled.reject(signal.reason)
			}
			signal.addEventListener('abort', abort, { once: true })
			try {
				argv = await Promise.race([Promise.resolve().then(() => {
					signal.throwIfAborted()
					return argvOrPrepare(signal)
				}), cancelled.promise])
				signal.throwIfAborted()
			} catch (error) {
				if (!classify().timedOut) {
					disarm()
					throw error
				}
				preparationTimedOut = true
			} finally {
				signal.removeEventListener('abort', abort)
			}
		} else argv = argvOrPrepare
		let running
		let syncSpawnError
		try {
			if (!preparationTimedOut) running = this.ctx.subprocess.spawn(this.spawnSpec(spec, spec.stdoutMaxBytes, spawnSignal, argv))
		} catch (error) {
			syncSpawnError = { error }
		}
		const emptyReader = { readFrom: () => ({ text: '', lossy: false, nextOffset: 0 }) }
		const collected = running !== undefined ? GitBashExecutor.collected(running) : { stdout: emptyReader, stderr: emptyReader }
		const spawnThrow = () => syncSpawnError.error
		const spawned = preparationTimedOut ? Promise.resolve({ exitCode: null, signal: null }) : running !== undefined ? running.done : Promise.reject(spawnThrow())
		let providerFailure
		let providerFailureReported = false
		const consumeProviderFailure = () => {
			if (providerFailure === undefined || providerFailureReported) return ''
			providerFailureReported = true
			return providerFailure.note
		}
		const observedStderr = { readFrom: (fromByte) => {
			if (providerFailure === undefined) return collected.stderr.readFrom(fromByte)
			const note = Buffer.from(providerFailure.note, 'utf8')
			return {
				text: note.subarray(Math.min(fromByte, note.length)).toString('utf8'),
				nextOffset: note.length,
				lossy: false,
			}
		} }
		let stdoutOffset = 0
		let stderrOffset = 0
		let resultPromise
		const proc = {
			status: 'running',
			exitCode: null,
			signal: null,
			observed: {
				stdout: collected.stdout,
				stderr: observedStderr,
			},
			done: spawned.then((outcome) => {
				if (proc.status === 'running') proc.status = spawnSignal?.aborted === true || outcome.signal !== null ? 'killed' : 'completed'
				proc.exitCode = outcome.exitCode
				proc.signal = outcome.signal
				this.onProcessDone(proc, collected.stderr.readFrom(0).text, false)
				disarm()
			}, (error) => {
				if (running !== undefined && (proc.status === 'killed' || spawnSignal?.aborted === true)) {
					proc.status = 'killed'
					this.onProcessDone(proc, collected.stderr.readFrom(0).text, false)
					disarm()
					return
				}
				proc.status = 'killed'
				let detail = 'unprintable provider failure'
				try {
					detail = String(error)
				} catch {}
				providerFailure = { error, note: `subprocess failed before reporting an outcome: ${detail}` }
				this.onProcessDone(proc, providerFailure.note, true, error)
				disarm()
			}),
			readOutput: () => {
				const out = collected.stdout.readFrom(stdoutOffset)
				const err = collected.stderr.readFrom(stderrOffset)
				stdoutOffset = out.nextOffset
				stderrOffset = err.nextOffset
				const providerFailureNote = consumeProviderFailure()
				const failureSeparator = err.text.length > 0 && !err.text.endsWith('\n') ? '\n' : ''
				const errText = err.text + (providerFailureNote.length > 0 ? `${failureSeparator}${providerFailureNote}` : '')
				const separator = out.text.length > 0 && !out.text.endsWith('\n') ? '\n' : ''
				return {
					delta: out.text + (errText.length > 0 ? `${separator}[stderr]\n${errText}` : ''),
					lossy: out.lossy || err.lossy,
					...out.spillPath !== undefined ? { stdoutSpillPath: out.spillPath } : {},
					...err.spillPath !== undefined ? { stderrSpillPath: err.spillPath } : {},
				}
			},
			kill: () => {
				if (proc.status !== 'running') return false
				proc.status = 'killed'
				running?.terminate()
				return true
			},
			result: () => {
				resultPromise ??= proc.done.then(() => {
					if (providerFailure !== undefined) throw providerFailure.error
					return {
						exitCode: proc.exitCode,
						signal: proc.signal,
						...classify(),
						timeoutMs: spec.timeoutMs,
						stdout: finalOutput(collected.stdout),
						stderr: finalOutput(collected.stderr),
					}
				})
				return resultPromise
			},
		}
		if (!preparationTimedOut) onStarted?.(proc)
		return proc
	}

	/**
	* Settlement hook: stamp per-process sandbox facts before `done` settles.
	* Full-access processes have no facts; signal deaths are not denials.
	*/
	onProcessDone(proc, stderr, providerRejected, providerError) {
		const facts = this.processFacts.get(proc)
		if (facts !== undefined) {
			this.processFacts.delete(proc)
			const runnerFailed = providerRejected ? isRunnerSpawnFailure(providerError, facts.runnerProgram, facts.workdir) : classifyRunnerFailure(proc.exitCode, stderr, facts.runnerFailureRules) !== undefined
			proc.sandbox = {
				mode: facts.mode,
				denied: !runnerFailed && matchesSignature(proc.exitCode, stderr, facts.denialSignatures),
				enforcement: facts.enforcement,
				...runnerFailed ? { runnerFailed } : {},
			}
		}
	}

	/**
	* Decorate the handle's foreground projection in place, memoized once (mirrors dsh-bash-sandbox).
	*/
	static decorateResult(ex, map, mapError) {
		const base = ex.result.bind(ex)
		let decorated
		ex.result = () => {
			decorated ??= base().then(map, mapError)
			return decorated
		}
		return ex
	}

	/** Wrap one Git Bash command argv via the `ctx.sandbox` provider. */
	confine(command, policy, signal) {
		return this.ctx.sandbox.confine([this.bashPath, '--noprofile', '--norc', '-c', command], policy, signal)
	}

	// ── pwsh tool removal ──

	/** Hide pwsh for one agent; the guard below also denies any call that slips through. */
	#admit(agent) {
		if (this.#agents.has(agent)) return
		const record = { hidden: false, unrestrict: undefined, stopRetry: undefined }
		this.#agents.set(agent, record)
		this.#remove(agent, record)
	}

	#release(agent) {
		const record = this.#agents.get(agent)
		if (record === undefined) return
		record.stopRetry?.()
		this.#agents.delete(agent)
	}

	#teardown() {
		for (const [agent, record] of this.#agents) {
			record.stopRetry?.()
			try {
				record.unrestrict?.()
			} catch {}
		}
		this.#agents.clear()
	}

	#resyncAll() {
		for (const [agent, record] of this.#agents) if (!record.hidden) this.#remove(agent, record)
	}

	/**
	* Remove pwsh from one agent's tool view. The preset's tool-pwsh row
	* activates service-availability driven and may register after the agent
	* exists, so an unknown name schedules a retry on the next registry change
	* (ctx.on returns the disposer; cordis 4 has no ctx.off).
	*/
	#remove(agent, record) {
		if (this.#agents.get(agent) !== record) return true
		try {
			record.unrestrict = agent.ctx.tools.restrict({ deny: ['pwsh'] })
			record.hidden = true
			record.stopRetry?.()
			record.stopRetry = undefined
			return true
		} catch (error) {
			if (!/unknown global tool/.test(String(error))) {
				this.ctx.logger.warn(`gitbash: cannot remove pwsh for an agent: ${String(error)}`)
				record.hidden = true
				return true
			}
			if (record.stopRetry !== undefined) return false
			let attempts = 0
			const onChange = () => {
				attempts += 1
				if (this.#agents.get(agent) !== record || attempts > HIDE_RETRY_LIMIT || this.#remove(agent, record)) {
					record.stopRetry?.()
					record.stopRetry = undefined
				}
			}
			record.stopRetry = this.ctx.on('tools/change', onChange)
			return false
		}
	}
}

export { GitBashExecutor, GitBashExecutor as default, candidateGitBashPaths, resolveGitBashPath }
