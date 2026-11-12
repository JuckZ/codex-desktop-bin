# codex-desktop-bin

[English](README.md) | [简体中文](README.zh-CN.md)

Arch/CachyOS packaging for **ChatGPT Community**, built from OpenAI's signed
official Linux ChatGPT package through
[`ilysenko/codex-desktop-linux`](https://github.com/ilysenko/codex-desktop-linux).

Despite this repository's historical name, generated packages now use the
upstream-compatible package and command identity `codex-desktop`. This is
required by the bundled transactional updater. The package replaces the legacy
`codex-desktop-bin` package in one pacman transaction and preserves user data.

## What changed

OpenAI now publishes a native Linux package. This project no longer downloads
or converts `Codex.dmg`. The current build:

- verifies OpenAI's signed stable APT metadata and package SHA-256;
- extracts the official Linux Electron runtime and bundled tools;
- preserves `resources/app.asar` byte-for-byte when neither optional features
  nor required core compatibility patches apply;
- produces a native Arch package;
- includes the upstream transactional update manager and rollback support.

This distribution enables upstream's experimental `remote-mobile-control` and
`remote-control-ui` features through
[`aur/linux-features.json`](aur/linux-features.json). Together they expose
**Settings → Connections → Control other devices** and the composer's
**Work in → Remote** entry on Linux, and include the associated enrollment and
device-key adaptations. The settings tab and composer have separate visibility
gates, so `remote-mobile-control` alone does not enable the remote picker.
Account authorization, project eligibility, and server availability still apply.
The same configuration is used by local and CI builds and is embedded in the
updater's rebuild bundle.

The **CachyOS / KDE full profile** reviews all 52 upstream feature modules:
34 are installed, 10 require a different environment or an explicit additional
choice, and 8 are excluded with documented reasons. It includes native computer
control, KDE Wayland shortcuts and dictation, API-key model visibility and Fast
controls, activity memory/recording, speech, and a read-only feature inventory
under **Settings → General → Community features**. Runtime permissions,
pairing, capture switches, external backends and voice-model downloads remain
separate steps. API Fast requires provider support and is not selected
automatically.

[`aur/feature-policy.json`](aur/feature-policy.json) is the reviewed policy;
the [complete inventory and reasons](docs/FEATURES.md) describe every module.
Source builds reject new, removed or changed unreviewed manifests, incomplete
capability groups, dependencies and conflicts. Packaging and release CI also
compare the actual app, GUI catalog, updater configuration and native helpers.
The updater carries the same policy and checks. A drifted enabled feature
rejects the candidate instead of silently publishing a reduced build.

The installed desktop entry is **ChatGPT Community** so it remains distinct
from OpenAI's separate `chatgpt` package.

This Arch distribution preserves the icon from the signed official Linux
payload for both the desktop launcher and tray, including updater rebuilds.

OpenAI currently documents the Linux app as a preview for supported Ubuntu,
Debian, and Fedora releases. Arch/CachyOS is not listed as a supported target,
so this repository remains the compatibility and pacman-packaging layer for
those systems. See the [official Linux app documentation](https://developers.openai.com/codex/linux/linux-app/).

## Install on Arch/CachyOS

Prebuilt x86_64 packages are published as GitHub Releases, then verified,
signed, and mirrored into the existing `JuckZ/arch-repo` pacman repository.
Configure its signing key and repository once:

```bash
setup_script="$(mktemp)"
trap 'rm -f -- "$setup_script"' EXIT

curl --fail --location --silent --show-error \
  --output "$setup_script" \
  https://raw.githubusercontent.com/JuckZ/codex-desktop-bin/main/scripts/setup-pacman-repo.sh

printf '%s  %s\n' \
  '042499f34cdaabc8ceecadd858ce4840fa5ef66c3b2c22729696c5dc54524f73' \
  "$setup_script" | sha256sum --check --strict

sudo bash "$setup_script"
```

Then install or update with the normal full-system upgrade transaction:

```bash
sudo pacman -Syu juckz/codex-desktop
```

The package is named `codex-desktop`; `codex-desktop-bin` is only the
historical repository name and legacy package identity. Avoid `pacman -Sy`
without `-u`, because Arch does not support partial upgrades.

The public repository requires package signatures from the JuckZ repository
key. See [the distribution notes](docs/DISTRIBUTION.md) for the verification
chain and binary redistribution notice.

## Build locally

Local building remains available for development, auditing, aarch64, or as a
fallback if a prebuilt release is unavailable.

Install build dependencies:

```bash
sudo pacman -S --needed base-devel curl dpkg git gnupg nodejs npm python rust
```

Build from the latest upstream commit and OpenAI's signed stable package:

```bash
./scripts/build-latest.sh
```

Install it, including automatic replacement of a legacy `codex-desktop-bin`
installation:

```bash
./scripts/install-local.sh
```

The migration does not delete `~/.codex`, which is shared application and CLI
state. Fully quit Codex Desktop before installing.

## Verify

```bash
pacman -Qi codex-desktop
codex-desktop --diagnose
systemctl --user status codex-update-manager.service --no-pager
codex-update-manager status --json
```

## Updating

For installations configured through the `juckz` repository, normal system
updates install new releases:

```bash
sudo pacman -Syu
```

The installed updater checks OpenAI's signed stable repository and rebuilds the
native package with the same feature selection:

```bash
codex-update-manager check-now
codex-update-manager status
```

To update explicitly by rebuilding this repository instead:

```bash
git pull --ff-only
./scripts/build-latest.sh
./scripts/install-local.sh
```

Useful build overrides:

```bash
UPSTREAM_REF=<branch-tag-or-commit> ./scripts/build-latest.sh
MAX_BUILD_THREADS=8 ./scripts/build-latest.sh
PACKAGE_WITH_UPDATER=0 ./scripts/build-latest.sh
OUTPUT_DIR="$HOME/.cache/codex-dist" ./scripts/build-latest.sh
UPSTREAM_DEB=/path/to/chatgpt_amd64.deb ./scripts/build-latest.sh
CODEX_LINUX_FEATURES_CONFIG=/path/to/features.json ./scripts/build-latest.sh
```

The feature-config override must point to an existing JSON file that matches
the reviewed policy. To change this distribution's feature selection, update
both the policy and configuration, regenerate the inventory with
`node aur/feature-profile.cjs docs > docs/FEATURES.md`, and run
`node --test scripts/feature-profile.test.cjs`. Builds compile the selected
native helpers before staging; updater rebuilds reuse those packaged helpers.
Scratch files default to `.work/tmp` on disk; set `TMPDIR` to another disk-backed
directory if needed.

## AUR files

`aur/PKGBUILD` is a reproducible AUR-style recipe pinned to a reviewed upstream
commit and a concrete official package version/hash. `pkgver` follows the UTC
build timestamp scheme used by the updater; `_chatgpt_ver` records the OpenAI
application version. When OpenAI publishes a new version, update both values,
both architecture hashes, and refresh:

```bash
cd aur
makepkg --printsrcinfo > .SRCINFO
```

The local `scripts/build-latest.sh` path intentionally follows the signed
stable metadata instead of a static version pin.

## Wayland

The launcher selects native Wayland when a live compositor socket is available.
ChromeOS Crostini, GNOME with multiple monitors, and WSLg retain the X11 backend.
Explicit flags take priority. To use XWayland, add this line to
`~/.config/codex-desktop/electron-flags.conf`:

```text
--ozone-platform=x11
```

## Acknowledgements

Thanks to the [Linux.do](https://linux.do/) community for providing a platform
and welcoming environment for discussion. The discussions and sharing there
have been a great help to this project.

## Disclaimer

This is an unofficial community packaging project. It is not affiliated with,
endorsed by, or supported by OpenAI. OpenAI, ChatGPT, Codex, and related assets
belong to their respective rights holders. See [DISCLAIMER.md](DISCLAIMER.md).
