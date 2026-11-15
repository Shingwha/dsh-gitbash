# dsh-gitbash

一个 DeepSeek Harness（DSH）插件：**在 Windows 上用 Git Bash 取代 PowerShell 作为模型 shell 工具**。插件启用期间，所有 Agent 的命令都经 Git Bash（Git for Windows 的 `bash.exe`）执行，`pwsh` 工具被移除，模型在 Windows 上获得 POSIX shell。

[English](README.md) | 中文

## 特性

- **Git Bash 驱动的 `bash` 工具**，覆盖全部 Agent 预设（`standard`、`ptc`、`cordis`、`minimal`）。
- **PowerShell 被移除**：插件启用时，`pwsh` 会从每个 Agent 的工具列表中被 restrict 移除，另有 guard 兜底拒绝任何漏网调用并给出原因。
- **一个开关控制一切**：Plugins 页启用/停用本 bundle。停用即完整回退官方 PowerShell 栈。
- **Plugins 页控制面板**：总开关、`bash.exe` 路径覆盖、默认超时、模型提示开关。
- **复用官方能力**：CLI 侧原样复用官方 `dsh-tool-bash`，后台任务、超时转后台、沙箱升级、退出码契约全部保留。
- 自动探测 Git for Windows 安装位置，绝不误选 WSL 执行别名。

## 环境要求

- Windows 10/11。
- 已安装 [Git for Windows](https://gitforwindows.org/)（默认路径 `C:\Program Files\Git\bin\bash.exe`）。
- DeepSeek Harness `>= 0.2.2-rc.3`，且带 Web GUI（有 Plugins 页）。

## 安装

在 Plugins 页：

1. **Plugins → Add plugin**。
2. 粘贴仓库简写 `github:Shingwha/dsh-gitbash`（或 `git+https://github.com/Shingwha/dsh-gitbash.git`）并确认。
3. 出现 `Git Bash` bundle 且已启用；**刷新一次页面**，让浏览器加载控制面板。

备选方式：在仓库里执行 `npm pack` 得到 `dsh-gitbash-<version>.tgz`，把绝对路径传给 **Add plugin**。

> 本地目录安装会变成 pnpm 的 `link:` 安装，链接包无法解析 DSH 内置的 `@deepseek-ai/*` 包。请使用 git spec 或打包后的 tarball。

验证：让 Agent 执行 `uname -s`，应输出 `MINGW64_NT-...`；工具列表里不再有 `pwsh`；**Plugins → Git Bash** 能看到控制面板。

## 配置

面板位于 **Plugins → Git Bash**。所有字段即时生效：新命令立即采用新值，提示类修改从运行中会话的下一步生效。

| 配置 | 默认 | 说明 |
|---|---|---|
| Git Bash 模式（总开关） | 开 | 启用/停用整个 bundle。关闭即恢复官方 PowerShell 栈。 |
| `bashPath` | 空 | `bash.exe` 绝对路径。留空自动探测：`Program Files\Git\bin`、`Program Files (x86)\Git\bin`、`LocalAppData\Programs\Git\bin`，再从 PATH 推导；跳过 WSL 的 `WindowsApps` 别名。 |
| `promptHint` | `true` | 向系统提示注入 Git Bash 指引（Windows/POSIX 路径、`cygpath`、MSYS 参数转换、受限会话升级提示）。 |
| `timeoutMs` | `120000` | 默认前台超时；单次调用的覆盖上限为 600000 毫秒。 |

内部固定预算（不可配置）：每个输出流 64000 字节、溢写文件上限 64 MiB、终止宽限 3000 毫秒。bash 工具行保留官方自带表单（`enableRunInBackground`、`promoteOnTimeout`）。

## 实现方式

bundle patch 做三处组合变更（仅 Windows）：

1. 禁用 `pwsh-sandbox` 执行器行——一个组合只允许一个 `ctx.shell` 提供者。
2. 插入 `gitbash-shell` 行：本插件实现 `ShellExecutor` 缝，每条命令以 `<bash.exe> --noprofile --norc -c <command>` 启动，会话策略要求受限时经 `ctx.sandbox.confine()` 包装。
3. 重新启用 host 面的官方 `tool-bash` 行，让所有 Agent 继承同一个经过验证的 bash 工具。

对每个 Agent（`agent/created`、激活时已存在的、以及经 `tools/change` 重试覆盖的迟到注册），插件执行 `agent.ctx.tools.restrict({ deny: ['pwsh'] })` 并为 `pwsh` 注册单调 guard。POSIX 上所有插入行均禁用，官方 bash 栈不受影响。

## 沙箱限制（Windows 必读）

Cygwin/MSYS2 初始化运行时必须创建命名管道，而 DSH 的 Windows 写边界用 **Low 完整性令牌**运行受限子进程，Low 进程无法创建命名管道。因此 Git Bash 无法在 `read-only` / `workspace-write` 权限预设下启动；执行器会把它确定性地报告为沙箱不可用，并提示模型对同一命令一次性升级 `sandbox_permissions: "danger-full-access"`（一次审批），或改用全权会话。全权会话不受影响。

这是限制模型本身的属性，不是配置问题：放宽令牌等于重新打开"Everyone 可随处写"，所以插件不提供绕过选项。

## 卸载 / 回退

在 Plugins 页停用（或移除）本 bundle：patch 层消失，官方 `pwsh-sandbox` 与 `tool-pwsh` 行恢复，`bash` 工具消失，不残留其他状态。

## 开发

```
├── package.json        # bundle 清单：dsh.bundle.patch + dsh.client
├── cordis.patch.yml    # 组合变更（行）
├── index.js            # Host 半：GitBashExecutor（ctx.shell）、pwsh 移除、提示段
├── client.js           # Client 半：Plugins 页控制面板（plugins.bundle.config/row.config）
├── locale/*.json       # 插件管理页标题/描述（en、zh）
├── docs/DETAIL.md      # 插件详情页文档
└── icon.svg
```

- 修改源码后 `npm pack`，安装生成的 tarball 进行测试（已安装包会被热替换；替换的包可能需要重启一次）。
- 语法检查：`node --check index.js && node --check client.js`。
- Client 半是纯 JavaScript（`window.__ModuleLoader__.load`），无需构建步骤。
- 版本管理：每次安装前递增 `package.json` 的 `version`，因为加载器按包名缓存模块代际。

## 许可

MIT —— 见 [LICENSE](LICENSE)。
