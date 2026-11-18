window.__ModuleLoader__.load({
  id: 'dsh-gitbash',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const UI = require('@deepseek-ai/dsh-client-ui-primitives')
    const NS = 'dsh-gitbash'
    const BUNDLE = 'dsh-gitbash'
    // The Loader entry id is also the settings namespace of this row.
    const SETTINGS = 'gitbash-shell'

    const zh = {
      bashPath: 'bash.exe 路径',
      bashPathHint: '留空自动探测 Git for Windows：Program Files\\Git\\bin、Program Files (x86)\\Git\\bin、LocalAppData\\Programs\\Git\\bin，再从 PATH 推导（跳过 WSL 的 WindowsApps 别名）。',
      timeoutMs: '默认超时（毫秒）',
      timeoutMsHint: '前台命令的默认超时；单次调用可覆盖，上限 600000 毫秒。留空恢复默认。',
      promptHint: '注入 Git Bash 模型提示',
      promptHintHint: '向系统提示加入路径转换、cygpath 与受限会话的升级指引。',
      save: '保存',
      saving: '保存中…',
      saveFailed: '本部署没有接受这些值，已保留供你修改。',
      readOnly: '本部署的设置为只读。',
      unavailable: '该插件当前未加载，暂时无法配置。',
      overridden: '已覆盖',
      reset: '恢复默认',
      invalidNumber: '请输入正数；留空使用默认值。',
    }
    const en = {
      bashPath: 'bash.exe path',
      bashPathHint: 'Empty auto-detects Git for Windows: Program Files\\Git\\bin, Program Files (x86)\\Git\\bin, LocalAppData\\Programs\\Git\\bin, then PATH-derived installs (WSL WindowsApps aliases are skipped).',
      timeoutMs: 'Default timeout (ms)',
      timeoutMsHint: 'Default foreground timeout; a call may override it, capped at 600000 ms. Empty restores the default.',
      promptHint: 'Inject the Git Bash prompt hint',
      promptHintHint: 'Adds path conversion, cygpath, and confined-session guidance to the system prompt.',
      save: 'Save',
      saving: 'Saving…',
      saveFailed: 'The deployment did not accept these values; they were left for you to correct.',
      readOnly: 'Settings are read-only in this deployment.',
      unavailable: 'This plugin is not loaded, so it cannot be configured right now.',
      overridden: 'Overridden',
      reset: 'Reset',
      invalidNumber: 'Enter a positive number, or leave blank to use the default.',
    }

    const STYLES = [
      '.dgb-toggle{display:flex;align-items:center;justify-content:space-between;gap:24px;padding:12px 0;border-top:0.5px solid var(--dsw-alias-border-l2)}',
      '.dgb-toggle-copy{display:flex;flex-direction:column;gap:4px;min-width:0}',
      '.dgb-toggle-title{font-size:13px;font-weight:500;line-height:1.5;color:var(--dsw-alias-label-primary)}',
      '.dgb-toggle-hint{margin:0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}',
    ].join('')

    function formLabels(t) {
      return {
        unavailable: t('unavailable'),
        readOnly: t('readOnly'),
        saveFailed: t('saveFailed'),
        save: t('save'),
        saving: t('saving'),
      }
    }

    /** The staged form fields; each write happens only when SettingsForm saves. */
    function createForm(scope) {
      const form = new UI.SettingsFormModel(scope, [
        UI.settingsTextField('bashPath'),
        {
          ...UI.settingsNumberField('timeoutMs'),
          parse(text) {
            const trimmed = text.trim()
            if (trimmed === '') return { kind: 'clear' }
            const value = Number(trimmed)
            return Number.isFinite(value) && value > 0 ? { kind: 'set', value } : undefined
          },
        },
        {
          field: 'promptHint',
          format: value => (value === false ? 'false' : 'true'),
          parse: text => (text === 'true'
            ? { kind: 'set', value: true }
            : text === 'false' ? { kind: 'set', value: false } : undefined),
        },
      ])
      const state = form.bind(() => ({
        ...form.shell(),
        bashPath: form.field('bashPath'),
        timeoutMs: form.field('timeoutMs'),
        promptHint: form.field('promptHint'),
      }))
      return { state, actions: form.actions(), dispose: () => form.dispose() }
    }

    function Panel(props) {
      const { t } = props
      const state = props.useGitbashSettings(snapshot => snapshot)
      const bashId = React.useId()
      const timeoutId = React.useId()
      const disabled = !state.writable || state.saving
      const fieldLabels = {
        overriddenLabel: t('overridden'),
        resetLabel: t('reset'),
        invalidLabel: t('invalidNumber'),
      }
      const valueField = (id, field, extra) => h(UI.SettingsValueField, {
        id,
        label: t(field),
        hint: t(`${field}Hint`),
        disabled,
        ...fieldLabels,
        ...state[field],
        onEdit: text => props.edit(field, text),
        onReset: () => props.resetField(field),
        ...extra,
      })
      return h(React.Fragment, null,
        h('style', null, STYLES),
        h(UI.SettingsForm, {
          labels: formLabels(t),
          state,
          onSave: props.save,
          onDiscard: props.discard,
        },
          valueField(bashId, 'bashPath', { placeholder: 'C:\\Program Files\\Git\\bin\\bash.exe' }),
          valueField(timeoutId, 'timeoutMs', { numeric: true }),
          h('div', { className: 'dgb-toggle' },
            h('div', { className: 'dgb-toggle-copy' },
              h('span', { className: 'dgb-toggle-title' }, t('promptHint')),
              h('p', { className: 'dgb-toggle-hint' }, t('promptHintHint'))),
            h(UI.Switch, {
              checked: state.promptHint.text === 'true',
              label: t('promptHint'),
              disabled,
              onChange: next => props.edit('promptHint', next ? 'true' : 'false'),
            }))))
    }

    return {
      inject: ['slots', 'locale', 'configForms'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-gitbash: dictionaries')
        const form = createForm(ctx.configForms.get(SETTINGS))
        ctx.effect(() => () => form.dispose(), 'dsh-gitbash: settings form')
        ctx.effect(() => ctx.configForms.whileServed([SETTINGS], () => ctx.slots.inject(
          'plugins.bundle.config',
          () => ctx.slots.register({
            name: 'plugins.bundle.config',
            key: BUNDLE,
            locale: NS,
            inject: () => ({ ...form.actions, hooks: { gitbashSettings: form.state } }),
          }, Panel),
        )), 'dsh-gitbash: settings page')
      },
    }
  },
})
