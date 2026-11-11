# Distribution notes

This repository is packaging automation for Arch/CachyOS. It uses
`ilysenko/codex-desktop-linux` to verify OpenAI's signed stable APT metadata,
validate the selected official Linux package, and build a pacman package.
OpenAI's preview documentation currently lists Ubuntu, Debian, and Fedora;
Arch/CachyOS support in this repository remains community-maintained.

## Source and trust model

- OpenAI's signed Linux `.deb` is the application source.
- The signature chain is pinned repository key → `InRelease` → `Packages`
  SHA-256 → package SHA-256.
- Upstream maintainer scripts are not executed; only the data payload is used.
- With no optional ASAR feature enabled and no required core patch, the official
  `resources/app.asar` remains byte-for-byte identical. This distribution opts
  into `remote-mobile-control`; its ASAR changes are recorded in the patch report.
- The old macOS DMG conversion and its redistribution caveat no longer apply.

The AUR recipe pins a concrete upstream commit and official package hash. The
local latest-build script follows the signed stable index and records the
resolved version and digest inside the application build metadata.

Both build paths use the tracked `aur/linux-features.json` configuration. The
update-builder bundle includes that configuration and the enabled feature's
code/resources, so an update retains the outbound-control adaptations. The
bundle is a source snapshot: if a new official release breaks its patch
anchors, rebuild this repository against current upstream source to refresh it.

## Prebuilt pacman repository

Successful source workflows publish the x86_64 package, its SHA-256 file, and
build provenance as assets of the latest GitHub Release. `JuckZ/arch-repo`
independently verifies those assets, signs the package and repository database,
and publishes the rolling pacman repository at:

```text
https://github.com/JuckZ/arch-repo/releases/download/repository-$arch
```

After the one-time repository setup, install or update with:

```bash
sudo pacman -Syu juckz/codex-desktop
```

The source workflow runs after relevant changes to `main`, on manual dispatch,
and on a six-hour schedule. The signed-repository synchronization runs 30
minutes later and skips an exact package asset already present in the rolling
repository. Release assets currently target x86_64; aarch64 remains a
local-build path.

The pacman repository uses `SigLevel = Required DatabaseOptional`. Packages and
the database are signed with fingerprint
`A361 30B4 88E1 E756 04E6 0A9A 92A8 15DA 30F9 FA93`; the setup script verifies
that exact public-key fingerprint before importing and locally trusting it.

## Binary artifacts and redistribution

A generated package contains OpenAI application binaries. The repository's MIT
license applies only to this project's packaging code and documentation; it
does not grant rights to redistribute OpenAI's payload. The repository owner
has elected to publish generated packages after reviewing and accepting that
separate redistribution risk. Downloaders receive no additional rights to the
OpenAI payload from this project's MIT license.

## Package migration

The runtime-compatible package identity is `codex-desktop`. It replaces the
historical `codex-desktop-bin` package in one pacman transaction. Package
removal and replacement preserve `~/.codex` and other user-owned state.
