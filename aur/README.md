# AUR package: codex-desktop

This directory contains the AUR-style package files for ChatGPT Community on
Arch Linux and derivatives. The source application is OpenAI's official Linux
package; `ilysenko/codex-desktop-linux` verifies and repackages it as a native
pacman package.

The package is named `codex-desktop` for compatibility with its bundled update
manager. It declares `replaces=('codex-desktop-bin')`, so pacman can migrate
legacy installations without deleting `~/.codex`.

The current recipe pins upstream commit
`61b5e818dc0b46ee531994d8bbb09d81e9581843` and official Linux release
`26.1106.51428`, including the upstream repairs through November 11, 2026.
Both architecture hashes were checked against OpenAI's signed stable metadata.

[`linux-features.json`](linux-features.json) enables the experimental
`remote-mobile-control` feature, including **Control other devices**. The recipe
and latest-build script both pass this configuration to upstream's builder;
the packaged updater preserves it for future rebuilds. This does not bypass
account authorization or guarantee server-side Remote availability.

Build:

```bash
makepkg -s
```

Refresh metadata after editing `PKGBUILD`:

```bash
makepkg --printsrcinfo > .SRCINFO
```

Before publishing a version bump, resolve the current official package through
the signed stable index and update `pkgver`, architecture-specific URLs, and
SHA-256 values together. Do not use a `latest` URL as an AUR trust root.
