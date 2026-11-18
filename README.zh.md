# dsh-gitbash

一个 DeepSeek Harness 插件：在 Windows 上用 **Git Bash** 运行 `bash` 工具，取代 PowerShell。插件启用期间，每个 Agent 都看不到 `pwsh` 工具。

[English](README.md) | 中文

## 功能

- 通过 Git Bash 执行命令，并复用官方 `bash` 工具；后台任务、超时、沙箱升级和退出码保持不变。
- 移除每个 Agent 的 `pwsh` 工具；停用插件后完整恢复官方 PowerShell 栈。
- 自动探测 Git for Windows，跳过 WSL 的 `WindowsApps` 别名。

## 环境要求

- Windows 10/11，已安装 [Git for Windows](https://gitforwindows.org/)。
- DeepSeek Harness `>= 0.2.2-rc.3`，带 Web GUI。

## 安装

1. **Plugins → Add plugin**，输入 `github:Shingwha/dsh-gitbash` 并确认。
2. 刷新一次页面，让设置表单加载。

也可以 `npm pack` 后把 tarball 的绝对路径传给 **Add plugin**。不要直接选插件目录：pnpm 会装成 link，DSH 内置的 `@deepseek-ai/*` 包无法解析。

验证：在新会话执行 `uname -s`，应输出 `MINGW64_NT-...`，且工具列表里没有 `pwsh`。

## 配置

打开 **Plugins → Git Bash**：修改字段后点「保存」。保存值对新命令生效，提示类修改从下一步生效。启用/停用整个 bundle 用插件页自己的开关。

| 配置 | 默认 | 说明 |
|---|---|---|
| `bashPath` | 空 | `bash.exe` 绝对路径。留空自动探测 `Program Files\Git\bin`、`Program Files (x86)\Git\bin`、`LocalAppData\Programs\Git\bin`，再从 PATH 推导。 |
| `timeoutMs` | `120000` | 默认前台超时；单次调用上限 600000 毫秒。 |
| `promptHint` | `true` | 向系统提示注入 Git Bash 使用说明。 |

## 受限会话

Git Bash 无法在 `read-only` / `workspace-write` 下启动：Cygwin 需要创建命名管道，而 DSH 的 Low 完整性沙箱令牌不允许。执行器会明确报告，并建议对同一命令一次性升级 `danger-full-access`，或改用全权会话。这是 Windows 沙箱的限制，不是配置项；细节见 [docs/DETAIL.md](docs/DETAIL.md)。

## 卸载

在 Plugins 页停用：patch 消失，`pwsh` 恢复，`bash` 消失，不残留其他状态。

## 开发

修改源码后 `npm pack`，用 tarball 安装测试；每次安装递增 `version`。语法检查用 `node --check index.js && node --check client.js`。

## 许可

MIT —— 见 [LICENSE](LICENSE)。
