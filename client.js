window.__ModuleLoader__.load({
  id: 'dsh-gitbash',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const NS = 'dsh-gitbash'
    const BUNDLE = 'dsh-gitbash'
    const ROW_KEY = BUNDLE + '#gitbash-shell'

    const zh = {
      title: 'Git Bash',
      intro: '用 Git Bash（MSYS2）驱动 bash 工具取代 PowerShell。设置修改后立即生效。',
      status: '状态',
      version: '版本',
      masterTitle: 'Git Bash 模式',
      masterHint: '开启后由本插件接管 shell 执行；关闭即回到官方 PowerShell。',
      masterOn: '已启用：命令经 Git Bash 执行；pwsh 工具已从工具列表中移除。',
      masterOff: '已停用：已完整回退官方 PowerShell。本面板随插件停用而消失，可在插件列表中重新启用。',
      masterState: '已启用',
      masterStateOff: '已停用',
      promptHint: '注入 Git Bash 模型提示',
      promptHintHint: '向系统提示注入路径转换、cygpath 与受限会话的升级指引。',
      bashPath: 'bash.exe 路径',
      bashPathHint: '留空自动探测：Program Files\\Git\\bin → Program Files (x86) → LocalAppData\\Programs\\Git → PATH 推导（跳过 WSL 的 WindowsApps 桩）。',
      timeoutMs: '默认超时（毫秒）',
      timeoutMsHint: '单条前台命令的默认超时；模型可按次覆盖，上限 600000 毫秒。',
      save: '保存',
      saving: '保存中…',
      reload: '重新读取',
      saved: '已保存，立即生效。',
      conflict: '配置已被其他窗口修改，已重新读取；请再保存一次。',
      loadError: '读取配置失败。',
      saveError: '保存失败。',
      apply: '应用到所有 Agent 预设（standard / ptc / cordis / minimal）。',
      note: '提示：受限权限会话（read-only / workspace-write）中 Cygwin 无法创建命名管道，bash 会给出明确错误并提示一次性升级为全权执行；全权会话无此限制。',
      dirty: '有未保存的修改。',
      togglesImmediate: '开关即时保存；路径与超时点「保存」生效。',
    }
    const en = {
      title: 'Git Bash',
      intro: 'Runs the bash tool through Git Bash (MSYS2) instead of PowerShell. Changes apply immediately.',
      status: 'Status',
      version: 'Version',
      masterTitle: 'Git Bash mode',
      masterHint: 'On: this plugin owns shell execution. Off: back to the shipped PowerShell.',
      masterOn: 'Enabled: commands run through Git Bash; the pwsh tool is removed from the tool list.',
      masterOff: 'Disabled: fully reverted to the shipped PowerShell. This panel disappears with the plugin; re-enable it from the plugin list.',
      masterState: 'Enabled',
      masterStateOff: 'Disabled',
      promptHint: 'Inject the Git Bash prompt hint',
      promptHintHint: 'Adds path conversion, cygpath, and confined-session escalation guidance to the system prompt.',
      bashPath: 'bash.exe path',
      bashPathHint: 'Empty auto-detects: Program Files\\Git\\bin, Program Files (x86), LocalAppData\\Programs\\Git, then PATH-derived installs (WSL WindowsApps aliases are skipped).',
      timeoutMs: 'Default timeout (ms)',
      timeoutMsHint: 'Default foreground timeout; the model may override per call, capped at 600000 ms.',
      save: 'Save',
      saving: 'Saving…',
      reload: 'Reload',
      saved: 'Saved; applies immediately.',
      conflict: 'Configuration changed elsewhere; reloaded. Save again to overwrite.',
      loadError: 'Failed to read the configuration.',
      saveError: 'Failed to save.',
      apply: 'Applies to every agent preset (standard / ptc / cordis / minimal).',
      note: 'Note: in confined sessions (read-only / workspace-write) Cygwin cannot create the named pipe it needs, so bash reports a clear error and suggests a one-time full-access escalation; full-access sessions are unaffected.',
      dirty: 'Unsaved changes.',
      togglesImmediate: 'Switches save immediately; path and budget fields save with the button.',
    }

    const STYLES = [
      '.dgb-root{display:flex;flex-direction:column;gap:14px;font-size:13px;color:var(--dsw-alias-label-primary)}',
      '.dgb-intro{color:var(--dsw-alias-label-secondary);line-height:1.5}',
      '.dgb-status{display:flex;flex-wrap:wrap;gap:8px 18px;align-items:center;padding:10px 12px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-2)}',
      '.dgb-dot{width:8px;height:8px;border-radius:50%;display:inline-block;margin-right:6px}',
      '.dgb-on-dot{background:var(--dsw-alias-state-success-primary)}',
      '.dgb-off-dot{background:var(--dsw-alias-state-idle-primary)}',
      '.dgb-row{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:10px 12px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-1)}',
      '.dgb-row-main{display:flex;flex-direction:column;gap:4px;min-width:0;flex:1}',
      '.dgb-label{font-weight:600}',
      '.dgb-hint{color:var(--dsw-alias-label-secondary);line-height:1.5}',
      '.dgb-switch{position:relative;width:40px;height:22px;border-radius:11px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);cursor:pointer;flex:none;transition:background .15s}',
      '.dgb-switch[aria-checked="true"]{background:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary)}',
      '.dgb-switch:disabled{opacity:.5;cursor:default}',
      '.dgb-knob{position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:var(--dsw-alias-bg-base);transition:left .15s}',
      '.dgb-switch[aria-checked="true"] .dgb-knob{left:20px}',
      '.dgb-field{display:flex;flex-direction:column;gap:4px;min-width:0}',
      '.dgb-field input{height:30px;padding:0 8px;border:1px solid var(--dsw-alias-border-l1);border-radius:6px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit}',
      '.dgb-compact{width:260px;flex:none}',
      '.dgb-compact-num{width:130px;flex:none}',
      '.dgb-actions{display:flex;gap:10px;align-items:center;flex-wrap:wrap}',
      '.dgb-btn{height:30px;padding:0 14px;border-radius:6px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);cursor:pointer;font:inherit}',
      '.dgb-btn-primary{background:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-bg-base)}',
      '.dgb-btn:disabled{opacity:.5;cursor:default}',
      '.dgb-error{color:var(--dsw-alias-state-error-primary)}',
      '.dgb-ok{color:var(--dsw-alias-state-success-primary)}',
      '.dgb-note{color:var(--dsw-alias-label-secondary);line-height:1.5}',
    ].join('\n')

    function Switch(props) {
      return h('button', {
        type: 'button',
        role: 'switch',
        'aria-checked': props.checked ? 'true' : 'false',
        'aria-label': props.label,
        className: 'dgb-switch',
        disabled: props.disabled === true,
        onClick: () => props.onChange(!props.checked),
      }, h('span', { className: 'dgb-knob' }))
    }

    function Row(props) {
      return h('div', { className: 'dgb-row' },
        h('div', { className: 'dgb-row-main' },
          h('span', { className: 'dgb-label' }, props.title),
          props.hint ? h('span', { className: 'dgb-hint' }, props.hint) : null),
        props.children)
    }

    function findNamespace(view) {
      if (!view || !Array.isArray(view.namespaces)) return undefined
      return view.namespaces.find((ns) =>
        typeof ns.ns === 'string' && (ns.ns.indexOf('gitbash-shell') !== -1 || ns.ns.indexOf('dsh-gitbash') !== -1))
    }

    function errorMessage(error) {
      if (error === undefined || error === null) return undefined
      if (typeof error === 'string') return error
      if (typeof error.message === 'string') return error.message
      try { return JSON.stringify(error) } catch { return String(error) }
    }

    function PanelInner(props) {
      const remote = props.remote
      const t = props.t
      const [view, setView] = React.useState(undefined)
      const [bundle, setBundle] = React.useState(undefined)
      const [draft, setDraft] = React.useState(undefined)
      const [busy, setBusy] = React.useState(false)
      const [error, setError] = React.useState(null)
      const [notice, setNotice] = React.useState(null)

      const load = React.useCallback(() => {
        let cancelled = false
        setError(null)
        Promise.resolve()
          .then(() => Promise.all([remote.settings.describe(), remote.pluginManager.listBundles()]))
          .then((results) => {
            if (cancelled) return
            const describe = results[0]
            const list = results[1]
            if (describe && describe.ok === false) {
              setError(errorMessage(describe.error) || t('loadError'))
              return
            }
            const ns = findNamespace(describe && describe.ok ? describe.value : undefined)
            setView(ns)
            setDraft(ns && ns.value !== undefined ? { ...ns.value } : {})
            if (list && list.ok) setBundle((list.value || []).find((item) => item.name === BUNDLE))
          })
          .catch((reason) => { if (!cancelled) setError(errorMessage(reason) || t('loadError')) })
        return () => { cancelled = true }
      }, [remote, t])

      React.useEffect(() => load(), [])

      if (view === undefined && error === null) {
        return h('div', { className: 'dgb-root' }, h('span', { className: 'dgb-hint' }, t('status') + '…'))
      }
      if (view === undefined) {
        return h('div', { className: 'dgb-root' },
          h('div', { className: 'dgb-error' }, error),
          h('div', { className: 'dgb-actions' },
            h('button', { type: 'button', className: 'dgb-btn', onClick: load }, t('reload'))))
      }

      const value = draft === undefined ? (view.value || {}) : draft
      const enabled = bundle !== undefined && bundle.enabled === true
      const dirty = JSON.stringify(value) !== JSON.stringify(view.value || {})

      const updateDraft = (patch) => {
        setNotice(null)
        setDraft({ ...(draft === undefined ? (view.value || {}) : draft), ...patch })
      }

      const write = (patch) => {
        if (busy) return
        setBusy(true)
        setError(null)
        setNotice(null)
        Promise.resolve()
          .then(() => remote.settings.update(view.ns, patch, view.revision))
          .then((result) => {
            if (result && result.ok === false) {
              const message = errorMessage(result.error)
              setError(result.error && result.error.code === 'settings/conflict' ? t('conflict') : (message || t('saveError')))
              load()
              return
            }
            const next = result && result.ok ? result.value : undefined
            if (next !== undefined) {
              setView(next)
              setDraft(next.value !== undefined ? { ...next.value } : {})
            }
            setNotice(t('saved'))
          })
          .catch((reason) => { setError(errorMessage(reason) || t('saveError')) })
          .then(() => setBusy(false))
      }

      const setBundleEnabled = (enabledNext) => {
        if (busy) return
        setBusy(true)
        setError(null)
        setNotice(null)
        Promise.resolve()
          .then(() => remote.pluginManager.setBundleEnabled(BUNDLE, enabledNext))
          .then((result) => {
            if (result && result.ok === false) {
              setError(errorMessage(result.error) || t('saveError'))
              return
            }
            setNotice(enabledNext ? t('saved') : t('masterOff'))
            load()
          })
          .catch((reason) => { setError(errorMessage(reason) || t('saveError')) })
          .then(() => setBusy(false))
      }

      const save = () => {
        const patch = {
          bashPath: typeof value.bashPath === 'string' ? value.bashPath : '',
          promptHint: value.promptHint !== false,
          timeoutMs: Number(value.timeoutMs),
        }
        if (!Number.isFinite(patch.timeoutMs) || patch.timeoutMs <= 0) {
          setError(t('saveError'))
          return
        }
        write(patch)
      }

      const toggle = (key, next) => {
        if (busy) return
        updateDraft({ [key]: next })
        write({ [key]: next })
      }

      return h('div', { className: 'dgb-root' },
        h('div', { className: 'dgb-intro' }, t('intro')),
        h('div', { className: 'dgb-status' },
          h('span', null,
            h('span', { className: enabled ? 'dgb-dot dgb-on-dot' : 'dgb-dot dgb-off-dot' }),
            h('strong', null, t('masterState') + '：'),
            enabled ? t('masterOn') : t('masterOff')),
          bundle && bundle.version ? h('span', { className: 'dgb-hint' }, t('version') + ' ' + bundle.version) : null),
        h(Row, { title: t('masterTitle'), hint: t('masterHint') },
          h(Switch, { checked: enabled, disabled: busy, label: t('masterTitle'), onChange: (next) => setBundleEnabled(next) })),
        h(Row, { title: t('promptHint'), hint: t('promptHintHint') },
          h(Switch, { checked: value.promptHint !== false, disabled: busy || !enabled, label: t('promptHint'), onChange: (next) => toggle('promptHint', next) })),
        h(Row, { title: t('bashPath'), hint: t('bashPathHint') },
          h('div', { className: 'dgb-field dgb-compact' },
            h('input', {
              type: 'text',
              value: value.bashPath === undefined || value.bashPath === null ? '' : String(value.bashPath),
              placeholder: 'C:\\Program Files\\Git\\bin\\bash.exe',
              disabled: busy || !enabled,
              onChange: (e) => updateDraft({ bashPath: e.target.value }),
            }))),
        h(Row, { title: t('timeoutMs'), hint: t('timeoutMsHint') },
          h('div', { className: 'dgb-field dgb-compact-num' },
            h('input', {
              type: 'number',
              value: value.timeoutMs === undefined || value.timeoutMs === null ? '' : String(value.timeoutMs),
              disabled: busy || !enabled,
              onChange: (e) => updateDraft({ timeoutMs: Number(e.target.value) }),
            }))),
        h('div', { className: 'dgb-hint' }, t('togglesImmediate')),
        h('div', { className: 'dgb-actions' },
          h('button', { type: 'button', className: 'dgb-btn dgb-btn-primary', disabled: busy || !dirty, onClick: save },
            busy ? t('saving') : t('save')),
          h('button', { type: 'button', className: 'dgb-btn', disabled: busy, onClick: load }, t('reload')),
          dirty ? h('span', { className: 'dgb-hint' }, t('dirty')) : null,
          notice ? h('span', { className: 'dgb-ok' }, notice) : null,
          error ? h('span', { className: 'dgb-error' }, error) : null),
        h('div', { className: 'dgb-note' }, t('apply')),
        h('div', { className: 'dgb-note' }, t('note')))
    }

    function Panel(props) {
      return h(React.Fragment, null,
        h('style', null, STYLES),
        h(PanelInner, props))
    }

    return {
      inject: ['slots', 'locale', 'remote', 'remote.pluginManager', 'remote.settings'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-gitbash: dictionaries')
        const t = ctx.locale.bind(NS)
        const face = () => ({ remote: ctx.remote, t })
        ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({
          name: 'plugins.bundle.config',
          key: BUNDLE,
          locale: NS,
          inject: face,
        }, Panel))
        ctx.slots.inject('plugins.row.config', () => ctx.slots.register({
          name: 'plugins.row.config',
          key: ROW_KEY,
          locale: NS,
          inject: face,
        }, Panel))
      },
    }
  },
})
