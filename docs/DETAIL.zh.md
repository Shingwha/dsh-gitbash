# Git Bash

在 Windows 上用 Git Bash 取代 PowerShell shell 栈。安装本 bundle 后，模型侧
`bash` 工具经 Git Bash（自动探测或配置的 Git for Windows 安装中的
`bash.exe`）执行，每个 Agent 的 `pwsh` 工具被移除。

## 变更内容

- Windows 上 `bash` 工具经 Git Bash 执行，官方 PowerShell 执行器被替换。
- 原样复用官方 `bash` 工具，因此后台任务、超时、沙箱升级与退出码保持不变。
- 每个 Agent 的 `pwsh` 工具被移除。
- POSIX 上本 bundle 不生效，官方 bash 栈保持原样。

## 配置（Plugins 页）

在 bundle 页修改字段后点 **保存**；离开页面会丢弃未保存的修改。启用/停用
bundle 请用插件页自己的开关。

保存值对新命令生效，提示类修改从运行中会话的下一步生效。

| 配置 | 默认 | 说明 |
|---|---|---|
| `bashPath` | 空 | `bash.exe` 绝对路径。留空自动探测 `Program Files\Git\bin`、`Program Files (x86)\Git\bin`、`LocalAppData\Programs\Git\bin`，再从 PATH 推导。WSL 的 `WindowsApps` 别名会被跳过。 |
| `timeoutMs` | `120000` | 默认前台超时；单次调用的覆盖上限为 600000 毫秒。 |
| `promptHint` | `true` | 向系统提示加入简短的 Git Bash 使用说明。 |

## 受限会话

全权会话直接运行 Git Bash。在 `read-only` / `workspace-write` 下，DSH 以
Low 完整性令牌运行受限子进程，该令牌无法创建 Cygwin 需要的命名管道，因此
Git Bash 在运行任何命令前就会失败。执行器会报告沙箱不可用，并建议对同一命令
一次性升级 `sandbox_permissions: "danger-full-access"`，或改用全权会话。
Low 完整性令牌就是写边界；绕过它会让权限预设失去意义，所以不提供“非受限
直通”开关。

## 回滚

在 Plugins 页停用本 bundle：patch 层消失，`pwsh` 执行器与工具行恢复，
`bash` 工具消失。不残留其他状态。
