#!/usr/bin/env bash
# Source after changing into the prepared upstream repository. All build paths
# are explicit because staging must use the same cached binaries as Cargo.
set -Eeuo pipefail
: "${CARGO_TARGET_DIR:?Set a disk-backed Cargo target directory}"
export CARGO_TARGET_DIR
export CODEX_COMPUTER_USE_BINARY_SOURCE="$CARGO_TARGET_DIR/release/codex-computer-use-linux"
export CODEX_COMPUTER_USE_COSMIC_BINARY_SOURCE="$CARGO_TARGET_DIR/release/codex-computer-use-cosmic"
export CODEX_COMPUTER_USE_INDICATOR_BINARY_SOURCE="$CARGO_TARGET_DIR/release/codex-computer-use-indicator"
export CODEX_LINUX_READ_ALOUD_MCP_SOURCE="$CARGO_TARGET_DIR/release/codex-read-aloud-linux"
export CODEX_RECORD_REPLAY_LINUX_SOURCE="$CARGO_TARGET_DIR/release/codex-record-replay-linux"
export CODEX_PET_KWIN_SOURCE="$CARGO_TARGET_DIR/release/codex-pet-kwin"
export CODEX_MCP_HELPER_REAPER_SOURCE="$CARGO_TARGET_DIR/release/codex-mcp-helper-reaper"
# This upstream target explicitly supplies --target-dir for the portal helper.
export CODEX_GLOBAL_DICTATION_LINUX_SOURCE="$PWD/global-dictation-linux/target/release/codex-global-dictation-linux"
make -e build-native-feature-helpers
