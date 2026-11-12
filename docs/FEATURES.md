# CachyOS / KDE 完整功能配置

由 `aur/feature-policy.json` 生成。审阅基线：`685ef54d05ae054bce932566399a79fa8282b43d`。

共 52 个模块：随包安装 34，需满足条件后另行选择 10，明确排除 8。

“已安装”表示能力及相应入口已打包，不表示已授权、已连接、正在录制或已下载外部模型。设置 → 通用 → 社区功能可查看安装状态和子功能；运行时状态需在相应功能中查看。

上游新增/删除模块、已审阅 manifest 改变、依赖/冲突、必需能力组缺失、原生程序缺失、包与更新器配置不一致都会阻止构建。签名校验和补丁接受检查保持开启。更新策略必须同时修改清单与配置并通过测试。

| 模块 | 构建分类 | 原因与使用条件 |
| --- | --- | --- |
| `account-switcher` | conditional | 会强制文件凭据存储并影响共享 CLI 登录；需用户另行选择凭据迁移。 |
| `agent-workspace` | enabled | 提供工作区设置与技能；后端需在界面另行安装，安装本包不会启动隐藏桌面。 |
| `api-key-model-visibility` | enabled | API Key 模式显示 CLI 返回的非隐藏模型；保留模型访问权限检查。 |
| `api-key-service-tier` | enabled | 提供 API Key Fast/serviceTier 选择能力；需服务商支持，不自动选择付费加速。 |
| `appshots` | conditional | 当前安全目标截图路径不支持本机 KDE；等待上游支持。原生电脑操作截图另已包含。 |
| `authenticated-proxy` | conditional | 需要带凭据的代理配置；未建立该需求，避免自动改写 Electron 网络路径。 |
| `authored-message-visibility` | enabled | 保留用户编写的消息在历史记录中的可见性。 |
| `automation-extensions` | enabled | 补齐自动化编辑与运行入口；任务仍由用户创建。 |
| `browser-proxy` | enabled | 向浏览器助手传递已明确配置的代理环境，不创建或改写代理配置。 |
| `chatgpt-dil-markdown-fallback` | enabled | 补齐 Markdown 回退显示。 |
| `chatgpt-dots-any-country` | excluded | 移除地区可见性门槛不能授予服务端权限，不作为本发行版完整性要求。 |
| `chatgpt-sidebar-separate-history` | enabled | 提供 ChatGPT 与 Codex 历史分组。 |
| `chronicle-skysight` | enabled | 提供活动记忆入口及本地后端；必须运行时主动开启才录制。 |
| `codex-micro` | conditional | 仅适用于配套硬件，当前未确认设备。 |
| `community-features-in-gui-settings` | enabled | 在设置中展示已安装与未安装功能、子功能、依赖和冲突。 |
| `community-profile-isolation` | excluded | 会改变 CODEX_HOME、登录和历史配置；本次保留用户现有桌面及 CLI 数据。 |
| `computer-use-linux` | enabled | 包含 Linux 原生电脑操作、窗口选择和全部原生辅助程序；保留运行时权限。 |
| `copilot-reasoning-effort` | conditional | 仅适用于 Copilot 认证，当前使用 API 认证。 |
| `desktop-identity` | enabled | 正确识别社区版桌面入口；发行版保留用户要求的官方图标。 |
| `desktop-new-window` | enabled | 补齐桌面新窗口入口。 |
| `directory-only-working-tree-watch` | enabled | 使用有界目录监听及固定版本 Watchbound；与浅层监听方案二选一。 |
| `filesystem-root-follow-ups` | enabled | 修复根目录项目的后续操作。 |
| `flatpak-chrome-native-messaging` | conditional | 仅适用于 Flatpak Chrome；当前为原生 Chrome。 |
| `fork-sidebar-fallback` | enabled | 提供分叉会话侧栏回退。 |
| `frameless-titlebar` | excluded | 仅为无边框外观偏好，保留 KDE 原生窗口装饰。 |
| `global-dictation` | enabled | 提供全局听写与原生辅助程序；麦克风和快捷键按使用时授权。 |
| `global-dictation-gnome` | excluded | GNOME 专用；目标环境为 KDE Wayland。 |
| `linux-performance-workarounds` | conditional | 针对已复现性能问题的动画降级策略；本机尚无对应诊断。 |
| `mcp-helper-reaper` | enabled | 回收已确认失去所属 Codex 进程的 MCP 助手；不回收活跃会话。 |
| `model-picker-default-presets` | conditional | 必须提供用户认可的模型与推理强度组合，不能代替用户编造。 |
| `nix-store-bundled-marketplace-permissions` | excluded | Nix 内部模块，不适用于 pacman 包。 |
| `node-repl-reaper` | enabled | 回收浏览器遗留 node_repl 进程；保留活跃祖先进程检查。 |
| `omarchy-theme` | excluded | Omarchy 专用主题，与本机 KDE 不适用。 |
| `persistent-status-panel` | enabled | 保留可查看的任务状态面板。 |
| `pet-overlay` | enabled | 提供 KDE 桌面宠物及 KWin 辅助程序；仅在使用宠物时运行。 |
| `preferred-editor-file-links` | enabled | 文件链接遵守首选编辑器。 |
| `project-group-last-updated-sort` | enabled | 提供项目组最近更新时间排序。 |
| `project-task-sort` | enabled | 提供项目任务排序。 |
| `read-aloud` | enabled | 提供点击朗读及声音设置；不在安装或启动时下载语音模型。 |
| `read-aloud-mcp` | enabled | 包含朗读 MCP 后端；实际语音模型由用户后续安装。 |
| `reasoning-visibility` | enabled | 显示服务已提供的推理摘要及相应设置。 |
| `record-and-replay` | enabled | 补齐录制与回放工作流，依赖活动记忆；保留运行时主动开启。 |
| `remote-control-ui` | enabled | 补齐聊天输入框的远程工作位置选择，与远程控制设置成组启用。 |
| `remote-mobile-control` | enabled | 补齐远程控制设置及设备连接工作流；设备仍需用户配对授权。 |
| `shallow-repository-watches` | excluded | 与已选择的 directory-only-working-tree-watch 冲突，会减少深层更新监听。 |
| `shared-app-server-socket` | excluded | 改变桌面与 CLI 的共享执行权限与生命周期；保持独立 CLI，亦避免账户切换冲突。 |
| `start-minimized-to-tray` | enabled | 提供两种托盘启动开关；默认关闭，不自动修改登录自启动。 |
| `thorium-chrome-plugin` | conditional | 仅适用于 Thorium 浏览器，当前未使用。 |
| `tray-usage` | enabled | 提供托盘用量显示。 |
| `ui-tweaks` | enabled | 启用字体、建议提示与选中文本操作；保留图标、语言及侧栏样式，关闭未适配模型列表。 |
| `usage-limit-send-attempt` | conditional | 改变配额耗尽时的发送行为；需明确选择该策略。 |
| `wayland-global-shortcuts` | enabled | 通过 KDE GlobalShortcuts portal 提供全局快捷键；保留桌面授权。 |

UI Tweaks 的九个子功能均有显式配置：字体大小、手动字体、建议提示、选中文本解释、注释提交启用；图标选择、英文强度标签、侧栏样式和未适配当前官方包的模型列表替换关闭。

远程电脑入口还遵循官方项目兼容条件。验收时从未选择本地项目的新聊天打开“工作位置”；可用远程主机取决于同账户配对与在线状态。
