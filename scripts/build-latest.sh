#!/usr/bin/env bash
set -Eeuo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

UPSTREAM_URL="${UPSTREAM_URL:-https://github.com/ilysenko/codex-desktop-linux.git}"
UPSTREAM_REF="${UPSTREAM_REF:-main}"
WORK_DIR="${WORK_DIR:-$REPO_ROOT/.work/codex-desktop-linux-official}"
OUTPUT_DIR="${OUTPUT_DIR:-$REPO_ROOT/dist}"
MIGRATION_PATCH="$REPO_ROOT/aur/arch-legacy-package.patch"
CODEX_LINUX_FEATURES_CONFIG="${CODEX_LINUX_FEATURES_CONFIG:-$REPO_ROOT/aur/linux-features.json}"
UPSTREAM_DEB="${UPSTREAM_DEB:-}"
PACKAGE_NAME="codex-desktop"
PACKAGE_DISPLAY_NAME="${PACKAGE_DISPLAY_NAME:-ChatGPT Community}"
PACKAGE_COMMENT="${PACKAGE_COMMENT:-Community Linux distribution based on OpenAI ChatGPT}"
PACKAGE_WITH_UPDATER="${PACKAGE_WITH_UPDATER:-1}"
PACKAGE_VERSION="${PACKAGE_VERSION:-}"

if [ -z "${MAX_BUILD_THREADS:-}" ]; then
  if command -v nproc >/dev/null 2>&1; then
    MAX_BUILD_THREADS="$(nproc)"
  else
    MAX_BUILD_THREADS="4"
  fi
fi

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    printf 'Missing required command: %s\n' "$1" >&2
    exit 1
  }
}

for command in git make makepkg curl dpkg-deb gpgv node npm python3 cargo; do
  require_cmd "$command"
done
[ -f "$MIGRATION_PATCH" ] || {
  printf 'Missing migration patch: %s\n' "$MIGRATION_PATCH" >&2
  exit 1
}
[ -f "$CODEX_LINUX_FEATURES_CONFIG" ] || {
  printf 'Missing Linux features config: %s\n' "$CODEX_LINUX_FEATURES_CONFIG" >&2
  exit 1
}
export CODEX_LINUX_FEATURES_CONFIG="$(realpath "$CODEX_LINUX_FEATURES_CONFIG")"
# Extracted application and packaging copies are several GB. Keep the default
# scratch directory on disk instead of the host's RAM-backed /tmp.
export TMPDIR="${TMPDIR:-$REPO_ROOT/.work/tmp}"
mkdir -p "$TMPDIR"
TMPDIR="$(realpath "$TMPDIR")"

case "$(uname -m)" in
  x86_64|aarch64|arm64) ;;
  *)
    printf 'Unsupported architecture: %s (expected x86_64 or ARM64)\n' "$(uname -m)" >&2
    exit 1
    ;;
esac

case "$WORK_DIR" in
  "$REPO_ROOT"|"/")
    printf 'Refusing unsafe work directory: %s\n' "$WORK_DIR" >&2
    exit 1
    ;;
esac

mkdir -p "$REPO_ROOT/.work" "$(dirname "$WORK_DIR")" "$OUTPUT_DIR"

if [ ! -d "$WORK_DIR/.git" ]; then
  git clone "$UPSTREAM_URL" "$WORK_DIR"
fi
actual_upstream_url="$(git -C "$WORK_DIR" remote get-url origin)"
[ "$actual_upstream_url" = "$UPSTREAM_URL" ] || {
  printf 'Unexpected origin for %s: %s\n' "$WORK_DIR" "$actual_upstream_url" >&2
  exit 1
}

git -C "$WORK_DIR" fetch --prune --tags origin
if git -C "$WORK_DIR" rev-parse --verify --quiet "origin/$UPSTREAM_REF^{commit}" >/dev/null; then
  upstream_commit="$(git -C "$WORK_DIR" rev-parse "origin/$UPSTREAM_REF^{commit}")"
else
  upstream_commit="$(git -C "$WORK_DIR" rev-parse "$UPSTREAM_REF^{commit}")"
fi

# Build in a disposable worktree. Local experiments and generated state in the
# source cache can therefore never enter the package or be deleted by a build.
build_root="$(mktemp -d "$REPO_ROOT/.work/codex-build.XXXXXX")"
build_dir="$build_root/source"
cleanup() {
  git -C "$WORK_DIR" worktree remove --force "$build_dir" >/dev/null 2>&1 || true
  rmdir "$build_root" >/dev/null 2>&1 || true
}
trap cleanup EXIT
git -C "$WORK_DIR" worktree add --detach "$build_dir" "$upstream_commit"
git -C "$build_dir" submodule update --init --recursive
git -C "$build_dir" apply "$MIGRATION_PATCH"
install -m 0644 "$REPO_ROOT/aur/feature-policy.json" "$REPO_ROOT/aur/feature-profile.cjs" \
  "$build_dir/packaging/linux/"
node "$REPO_ROOT/aur/feature-profile.cjs" source "$build_dir" "$CODEX_LINUX_FEATURES_CONFIG"
node "$build_dir/scripts/lib/linux-features.js" --enabled

printf 'Building %s from %s at %s\n' \
  "$PACKAGE_NAME" "$UPSTREAM_URL" "$(git -C "$build_dir" rev-parse --short HEAD)"

(
  cd "$build_dir"
  export CARGO_TARGET_DIR="${CARGO_TARGET_DIR:-$REPO_ROOT/.work/cargo-target}"
  export MAX_BUILD_THREADS
  source "$REPO_ROOT/aur/build-feature-helpers.sh"
  build_app_args=()
  if [ -n "$UPSTREAM_DEB" ]; then
    [ -f "$UPSTREAM_DEB" ] || {
      printf 'UPSTREAM_DEB does not exist: %s\n' "$UPSTREAM_DEB" >&2
      exit 1
    }
    build_app_args=("$(realpath "$UPSTREAM_DEB")")
  fi
  CODEX_APP_ID=codex-desktop \
    CODEX_APP_DISPLAY_NAME="$PACKAGE_DISPLAY_NAME" \
    UPSTREAM_DEB='' \
    ./install.sh "${build_app_args[@]}"

  build_info="$build_dir/codex-app/.codex-linux/build-info.json"
  [ -f "$build_info" ] || {
    printf 'Missing generated build metadata: %s\n' "$build_info" >&2
    exit 1
  }
  upstream_version="$(node -e '
    const info = require(process.argv[1]);
    const version = info.upstreamLinuxPackage?.version;
    if (!/^[0-9][0-9A-Za-z.+:~-]*$/.test(version ?? "")) process.exit(1);
    process.stdout.write(version);
  ' "$build_info")"
  package_version="$PACKAGE_VERSION"
  if [ -z "$package_version" ]; then
    package_version="$(date -u +%Y.%m.%d.%H%M%S)"
  fi
  if [[ ! "$package_version" =~ ^[0-9][0-9A-Za-z._+]*$ ]]; then
    printf 'Invalid PACKAGE_VERSION: %s\n' "$package_version" >&2
    exit 1
  fi
  printf 'Resolved OpenAI package %s; native package version %s\n' \
    "$upstream_version" "$package_version"

  cargo_target_dir="$CARGO_TARGET_DIR"
  MAX_BUILD_THREADS="$MAX_BUILD_THREADS" \
    CARGO_TARGET_DIR="$cargo_target_dir" \
    PACKAGE_NAME="$PACKAGE_NAME" \
    PACKAGE_VERSION="$package_version" \
    PACKAGE_DISPLAY_NAME="$PACKAGE_DISPLAY_NAME" \
    PACKAGE_COMMENT="$PACKAGE_COMMENT" \
    PACKAGE_WITH_UPDATER="$PACKAGE_WITH_UPDATER" \
    UPDATER_BINARY_SOURCE="$cargo_target_dir/release/codex-update-manager" \
    make -e pacman
)

latest_pkg="$(find "$build_dir/dist" -maxdepth 1 -type f \
  -name "$PACKAGE_NAME-[0-9]*.pkg.tar.*" -print | sort -V | tail -n 1)"

if [ -z "$latest_pkg" ]; then
  printf 'No generated package found under %s/dist\n' "$build_dir" >&2
  exit 1
fi

dest="$OUTPUT_DIR/$(basename "$latest_pkg")"
cp "$latest_pkg" "$dest"
ln -sfn "$(basename "$dest")" "$OUTPUT_DIR/$PACKAGE_NAME-latest.pkg.tar.zst"
(
  cd "$OUTPUT_DIR"
  sha256sum "$(basename "$dest")" > "$(basename "$dest").sha256"
)

printf '\nBuilt package:\n  %s\n' "$dest"
printf 'Latest symlink:\n  %s\n' "$OUTPUT_DIR/$PACKAGE_NAME-latest.pkg.tar.zst"
