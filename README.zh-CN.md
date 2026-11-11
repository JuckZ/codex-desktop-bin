# codex-desktop-bin

[English](README.md) | [简体中文](README.zh-CN.md)

适用于 Arch Linux/CachyOS 的 **ChatGPT Community** 打包项目。项目通过
[`ilysenko/codex-desktop-linux`](https://github.com/ilysenko/codex-desktop-linux)，
基于 OpenAI 官方签名的 Linux ChatGPT 软件包构建。

尽管本仓库保留了历史名称，生成的软件包和命令现在统一使用与上游兼容的
`codex-desktop`，这是内置事务式更新器正常工作的必要条件。新软件包会在一次
pacman 事务中替换旧的 `codex-desktop-bin`，并保留用户数据。

## 主要变化

OpenAI 现已发布原生 Linux 软件包，本项目不再下载或转换 `Codex.dmg`。当前构建流程会：

- 验证 OpenAI 签名的稳定版 APT 元数据和软件包 SHA-256；
- 提取官方 Linux Electron 运行时及随附工具；
- 没有可选功能或必要的核心兼容补丁需要应用时，保持 `resources/app.asar` 逐字节不变；
- 生成原生 Arch 软件包；
- 包含上游事务式更新管理器及回滚支持。

本发行版通过 [`aur/linux-features.json`](aur/linux-features.json) 启用上游的
实验性 `remote-mobile-control` 功能，显示 Linux 上的
**设置 → 连接 → 控制其他设备**，并包含配套的注册授权与设备密钥适配。
实际连接仍需满足账号授权和服务端条件。本地构建与 CI 使用同一配置，
配置及所需功能代码也会打包进更新器，供后续重新构建使用。

安装后的桌面入口名称为 **ChatGPT Community**，以便与 OpenAI 单独提供的
`chatgpt` 软件包区分。

本 Arch 打包保留官方签名 Linux 包自带的图标，统一用于桌面入口和托盘；
更新器重新构建时也会继续使用官方图标。

OpenAI 目前将 Linux 应用标记为预览版，支持的发行版包括 Ubuntu、Debian 和
Fedora。Arch Linux/CachyOS 尚未列入官方支持范围，因此本仓库继续为这些系统
提供兼容和 pacman 打包层。详情参见
[官方 Linux 应用文档](https://developers.openai.com/codex/linux/linux-app/)。

## 在 Arch Linux/CachyOS 上安装

预构建的 x86_64 软件包会发布到 GitHub Releases，随后经过验证、签名并同步至
现有的 `JuckZ/arch-repo` pacman 仓库。只需配置一次仓库签名密钥和软件源：

```bash
curl -fsSL https://raw.githubusercontent.com/JuckZ/codex-desktop-bin/main/scripts/setup-pacman-repo.sh | sudo bash
```

然后通过正常的完整系统升级事务安装或更新：

```bash
sudo pacman -Syu juckz/codex-desktop
```

软件包名是 `codex-desktop`；`codex-desktop-bin` 只是历史仓库名和旧软件包名。
不要使用缺少 `-u` 的 `pacman -Sy`，因为 Arch Linux 不支持局部升级。

公共仓库要求软件包带有 JuckZ 仓库密钥签名。验证链和二进制再分发说明参见
[分发说明](docs/DISTRIBUTION.md)。

## 本地构建

如需开发、审计、构建 aarch64，或者预构建 Release 暂时不可用，仍可在本地构建。

安装构建依赖：

```bash
sudo pacman -S --needed base-devel curl dpkg git gnupg nodejs npm python rust
```

使用最新上游提交和 OpenAI 签名的稳定版软件包构建：

```bash
./scripts/build-latest.sh
```

安装构建结果；如已安装旧的 `codex-desktop-bin`，脚本会自动完成替换：

```bash
./scripts/install-local.sh
```

迁移不会删除应用与 CLI 共用的 `~/.codex` 用户状态。安装前请完全退出 Codex Desktop。

## 验证安装

```bash
pacman -Qi codex-desktop
codex-desktop --diagnose
systemctl --user status codex-update-manager.service --no-pager
codex-update-manager status --json
```

## 更新

通过 `juckz` 仓库安装后，正常更新系统即可获得新版本：

```bash
sudo pacman -Syu
```

内置更新器会检查 OpenAI 签名的稳定版仓库，并使用相同的功能选项重新构建原生软件包：

```bash
codex-update-manager check-now
codex-update-manager status
```

也可以拉取本仓库后明确地重新构建和安装：

```bash
git pull --ff-only
./scripts/build-latest.sh
./scripts/install-local.sh
```

可用的构建参数：

```bash
UPSTREAM_REF=<branch-tag-or-commit> ./scripts/build-latest.sh
MAX_BUILD_THREADS=8 ./scripts/build-latest.sh
PACKAGE_WITH_UPDATER=0 ./scripts/build-latest.sh
OUTPUT_DIR=/tmp/codex-dist ./scripts/build-latest.sh
UPSTREAM_DEB=/path/to/chatgpt_amd64.deb ./scripts/build-latest.sh
CODEX_LINUX_FEATURES_CONFIG=/path/to/features.json ./scripts/build-latest.sh
```

自定义功能配置必须是已存在的 JSON 文件。使用 `{"enabled":[]}` 可构建
不含可选功能的版本。构建临时文件默认放在磁盘上的 `.work/tmp`；如需调整，
请将 `TMPDIR` 指向其他磁盘目录，避免大型解包任务占满内存中的 `/tmp`。

## AUR 文件

`aur/PKGBUILD` 是可复现的 AUR 风格配方，固定到经过审核的上游提交以及具体的
官方软件包版本和哈希。`pkgver` 使用更新器采用的 UTC 构建时间戳格式，
`_chatgpt_ver` 记录 OpenAI 应用版本。OpenAI 发布新版本时，需要更新这些版本、
两个架构的哈希，然后刷新：

```bash
cd aur
makepkg --printsrcinfo > .SRCINFO
```

本地 `scripts/build-latest.sh` 会跟踪签名的稳定版索引，而不是使用静态版本固定值。

## Wayland

启动器检测到可用的合成器套接字时会自动选择原生 Wayland；ChromeOS Crostini、
GNOME 多显示器和 WSLg 环境仍使用 X11 后端。显式设置的参数优先。
如需使用 XWayland，请在 `~/.config/codex-desktop/electron-flags.conf` 中添加：

```text
--ozone-platform=x11
```

## 致谢

感谢 [Linux.do](https://linux.do/) 社区提供的平台与交流环境，讨论与分享对本项目帮助很大。

## 免责声明

这是一个非官方社区打包项目，与 OpenAI 无关联，也未获得 OpenAI 的认可或支持。
OpenAI、ChatGPT、Codex 及相关资产归 OpenAI 或相应权利人所有。详情参见
[DISCLAIMER.md](DISCLAIMER.md)。
