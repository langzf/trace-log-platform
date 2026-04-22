#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

SCRIPT_NAME="$(basename "$0")"

log() {
  printf '[%s] %s\n' "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" "$*"
}

warn() {
  log "WARN: $*"
}

die() {
  log "ERROR: $*" >&2
  exit 1
}

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

print_help() {
  cat <<'EOF'
Usage:
  install_openclaw.sh [options]

Options:
  --non-interactive, --yes          Run without prompts
  --force                           Force reinstall
  --method <auto|brew|binary|bootstrap>
  --version <target-version>
  --binary-url <url>
  --sha256 <hex>
  --bootstrap-url <url>
  --install-dir <dir>
  --endpoint <url>
  --health-path <path>
  --expect-health                   Enforce endpoint health check after install
  --post-install-command <command>  Run command after install (e.g. start service)
  --help                            Show help

Environment variables (same effect as options):
  OPENCLAW_INSTALL_METHOD
  OPENCLAW_TARGET_VERSION
  OPENCLAW_BINARY_URL
  OPENCLAW_BINARY_SHA256
  OPENCLAW_BOOTSTRAP_URL
  OPENCLAW_INSTALL_DIR
  OPENCLAW_ENDPOINT
  OPENCLAW_HEALTH_PATH
  OPENCLAW_EXPECT_HEALTH
  OPENCLAW_POST_INSTALL_COMMAND
  OPENCLAW_BREW_FORMULA
  OPENCLAW_REQUIRE_CHECKSUM
EOF
}

OPENCLAW_INSTALL_METHOD="${OPENCLAW_INSTALL_METHOD:-auto}"
OPENCLAW_TARGET_VERSION="${OPENCLAW_TARGET_VERSION:-}"
OPENCLAW_BINARY_URL="${OPENCLAW_BINARY_URL:-}"
OPENCLAW_BINARY_SHA256="${OPENCLAW_BINARY_SHA256:-}"
OPENCLAW_BOOTSTRAP_URL="${OPENCLAW_BOOTSTRAP_URL:-}"
OPENCLAW_INSTALL_DIR="${OPENCLAW_INSTALL_DIR:-/usr/local/bin}"
OPENCLAW_ENDPOINT="${OPENCLAW_ENDPOINT:-http://127.0.0.1:18789}"
OPENCLAW_HEALTH_PATH="${OPENCLAW_HEALTH_PATH:-/health}"
OPENCLAW_POST_INSTALL_COMMAND="${OPENCLAW_POST_INSTALL_COMMAND:-}"
OPENCLAW_BREW_FORMULA="${OPENCLAW_BREW_FORMULA:-openclaw}"
OPENCLAW_REQUIRE_CHECKSUM="${OPENCLAW_REQUIRE_CHECKSUM:-1}"

NON_INTERACTIVE=0
FORCE_REINSTALL=0
EXPECT_HEALTH="${OPENCLAW_EXPECT_HEALTH:-0}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --non-interactive|--yes)
      NON_INTERACTIVE=1
      shift
      ;;
    --force)
      FORCE_REINSTALL=1
      shift
      ;;
    --method)
      OPENCLAW_INSTALL_METHOD="${2:-}"
      shift 2
      ;;
    --version)
      OPENCLAW_TARGET_VERSION="${2:-}"
      shift 2
      ;;
    --binary-url)
      OPENCLAW_BINARY_URL="${2:-}"
      shift 2
      ;;
    --sha256)
      OPENCLAW_BINARY_SHA256="${2:-}"
      shift 2
      ;;
    --bootstrap-url)
      OPENCLAW_BOOTSTRAP_URL="${2:-}"
      shift 2
      ;;
    --install-dir)
      OPENCLAW_INSTALL_DIR="${2:-}"
      shift 2
      ;;
    --endpoint)
      OPENCLAW_ENDPOINT="${2:-}"
      shift 2
      ;;
    --health-path)
      OPENCLAW_HEALTH_PATH="${2:-}"
      shift 2
      ;;
    --expect-health)
      EXPECT_HEALTH=1
      shift
      ;;
    --post-install-command)
      OPENCLAW_POST_INSTALL_COMMAND="${2:-}"
      shift 2
      ;;
    --help|-h)
      print_help
      exit 0
      ;;
    *)
      die "unknown argument: $1"
      ;;
  esac
done

if [[ "$OPENCLAW_HEALTH_PATH" != /* ]]; then
  OPENCLAW_HEALTH_PATH="/${OPENCLAW_HEALTH_PATH}"
fi

case "$OPENCLAW_INSTALL_METHOD" in
  auto|brew|binary|bootstrap) ;;
  *)
    die "OPENCLAW_INSTALL_METHOD must be one of: auto, brew, binary, bootstrap"
    ;;
esac

current_version() {
  if ! command_exists openclaw; then
    return 1
  fi
  openclaw --version 2>/dev/null | head -n 1
}

version_matches_target() {
  if [[ -z "$OPENCLAW_TARGET_VERSION" ]]; then
    return 1
  fi
  local current
  current="$(current_version || true)"
  [[ -n "$current" && "$current" == *"$OPENCLAW_TARGET_VERSION"* ]]
}

resolve_install_dir() {
  local preferred="$OPENCLAW_INSTALL_DIR"
  if [[ -z "$preferred" ]]; then
    preferred="/usr/local/bin"
  fi

  if [[ -d "$preferred" && -w "$preferred" ]]; then
    printf '%s\n' "$preferred"
    return
  fi

  if [[ ! -d "$preferred" ]]; then
    if mkdir -p "$preferred" >/dev/null 2>&1; then
      printf '%s\n' "$preferred"
      return
    fi
  fi

  local fallback="$HOME/.local/bin"
  mkdir -p "$fallback"
  warn "install dir '$preferred' is not writable, fallback to '$fallback'"
  printf '%s\n' "$fallback"
}

verify_sha256() {
  local file="$1"
  local expected="$2"
  local actual=""
  if command_exists shasum; then
    actual="$(shasum -a 256 "$file" | awk '{print $1}')"
  elif command_exists sha256sum; then
    actual="$(sha256sum "$file" | awk '{print $1}')"
  else
    die "neither shasum nor sha256sum found; cannot verify checksum"
  fi

  if [[ "$actual" != "$expected" ]]; then
    die "checksum verification failed: expected=$expected actual=$actual"
  fi
}

find_openclaw_binary() {
  local root="$1"
  local candidate

  candidate="$(find "$root" -type f -name openclaw -perm -u+x 2>/dev/null | head -n 1 || true)"
  if [[ -n "$candidate" ]]; then
    printf '%s\n' "$candidate"
    return
  fi

  candidate="$(find "$root" -type f -name openclaw 2>/dev/null | head -n 1 || true)"
  if [[ -n "$candidate" ]]; then
    chmod +x "$candidate"
    printf '%s\n' "$candidate"
    return
  fi

  return 1
}

install_binary_file() {
  local source_binary="$1"
  local install_dir="$2"
  local target="$install_dir/openclaw"
  local backup=""

  mkdir -p "$install_dir"
  if [[ -f "$target" ]]; then
    backup="${target}.bak.$(date +%s)"
    cp "$target" "$backup"
    log "backup existing binary to $backup"
  fi

  if ! install -m 0755 "$source_binary" "$target"; then
    if [[ -n "$backup" && -f "$backup" ]]; then
      cp "$backup" "$target"
    fi
    die "failed to install openclaw binary to $target"
  fi

  if ! "$target" --version >/dev/null 2>&1; then
    if [[ -n "$backup" && -f "$backup" ]]; then
      cp "$backup" "$target"
      warn "new binary verification failed, rollback to backup"
    fi
    die "installed binary cannot run 'openclaw --version'"
  fi
}

install_via_brew() {
  if ! command_exists brew; then
    return 1
  fi

  if [[ -n "$OPENCLAW_TARGET_VERSION" ]]; then
    warn "brew mode does not guarantee exact version pin unless formula supports it"
  fi

  if brew list "$OPENCLAW_BREW_FORMULA" >/dev/null 2>&1; then
    if [[ "$FORCE_REINSTALL" -eq 1 ]]; then
      log "reinstall openclaw via brew: $OPENCLAW_BREW_FORMULA"
      brew reinstall "$OPENCLAW_BREW_FORMULA"
    else
      log "upgrade openclaw via brew: $OPENCLAW_BREW_FORMULA"
      brew upgrade "$OPENCLAW_BREW_FORMULA" || true
    fi
  else
    log "install openclaw via brew: $OPENCLAW_BREW_FORMULA"
    brew install "$OPENCLAW_BREW_FORMULA"
  fi
  return 0
}

install_via_binary() {
  local url="$OPENCLAW_BINARY_URL"
  [[ -n "$url" ]] || die "binary mode requires OPENCLAW_BINARY_URL"

  if [[ "$OPENCLAW_REQUIRE_CHECKSUM" == "1" && -z "$OPENCLAW_BINARY_SHA256" ]]; then
    die "OPENCLAW_BINARY_SHA256 is required when OPENCLAW_REQUIRE_CHECKSUM=1"
  fi

  command_exists curl || die "curl is required for binary install"
  command_exists tar || die "tar is required for binary install"
  command_exists install || die "install command is required"

  local tmp_dir
  tmp_dir="$(mktemp -d "${TMPDIR:-/tmp}/openclaw-install.XXXXXX")"
  trap 'rm -rf "$tmp_dir"' EXIT

  local artifact="$tmp_dir/openclaw-artifact"
  log "download openclaw artifact: $url"
  curl -fL "$url" -o "$artifact"

  if [[ -n "$OPENCLAW_BINARY_SHA256" ]]; then
    verify_sha256 "$artifact" "$OPENCLAW_BINARY_SHA256"
    log "checksum verified"
  else
    warn "checksum skipped (OPENCLAW_BINARY_SHA256 not set)"
  fi

  local extracted_bin=""
  case "$url" in
    *.tar.gz|*.tgz)
      mkdir -p "$tmp_dir/extracted"
      tar -xzf "$artifact" -C "$tmp_dir/extracted"
      extracted_bin="$(find_openclaw_binary "$tmp_dir/extracted" || true)"
      ;;
    *.zip)
      command_exists unzip || die "unzip is required for zip artifacts"
      mkdir -p "$tmp_dir/extracted"
      unzip -q "$artifact" -d "$tmp_dir/extracted"
      extracted_bin="$(find_openclaw_binary "$tmp_dir/extracted" || true)"
      ;;
    *)
      extracted_bin="$artifact"
      chmod +x "$extracted_bin"
      ;;
  esac

  [[ -n "$extracted_bin" ]] || die "cannot locate openclaw binary in artifact"

  local install_dir
  install_dir="$(resolve_install_dir)"
  install_binary_file "$extracted_bin" "$install_dir"

  if [[ ":$PATH:" != *":$install_dir:"* ]]; then
    warn "install dir '$install_dir' is not in PATH; you may need to export PATH=\"$install_dir:\$PATH\""
  fi
}

install_via_bootstrap() {
  local url="$OPENCLAW_BOOTSTRAP_URL"
  [[ -n "$url" ]] || die "bootstrap mode requires OPENCLAW_BOOTSTRAP_URL"
  command_exists curl || die "curl is required for bootstrap install"
  log "execute bootstrap installer from: $url"
  curl -fsSL "$url" | bash
}

run_post_install() {
  if [[ -z "$OPENCLAW_POST_INSTALL_COMMAND" ]]; then
    return
  fi
  log "run post-install command"
  bash -lc "$OPENCLAW_POST_INSTALL_COMMAND"
}

wait_health_if_required() {
  if [[ "$EXPECT_HEALTH" != "1" ]]; then
    return
  fi

  command_exists curl || die "curl is required for health check"
  local health_url="${OPENCLAW_ENDPOINT%/}${OPENCLAW_HEALTH_PATH}"
  local max_wait=60
  local elapsed=0

  while [[ "$elapsed" -lt "$max_wait" ]]; do
    if curl -fsS "$health_url" >/dev/null 2>&1; then
      log "health check passed: $health_url"
      return
    fi
    sleep 1
    elapsed=$((elapsed + 1))
  done

  die "health check timeout after ${max_wait}s: $health_url"
}

log "start ${SCRIPT_NAME}"
log "method=$OPENCLAW_INSTALL_METHOD force=$FORCE_REINSTALL target_version=${OPENCLAW_TARGET_VERSION:-<none>}"

if command_exists openclaw && [[ "$FORCE_REINSTALL" -eq 0 ]]; then
  if [[ -z "$OPENCLAW_TARGET_VERSION" ]]; then
    log "openclaw already installed: $(current_version || echo unknown)"
    wait_health_if_required
    log "done"
    exit 0
  fi

  if version_matches_target; then
    log "target version already installed: $(current_version || echo unknown)"
    wait_health_if_required
    log "done"
    exit 0
  fi
fi

selected_method="$OPENCLAW_INSTALL_METHOD"
if [[ "$selected_method" == "auto" ]]; then
  if command_exists brew; then
    selected_method="brew"
  elif [[ -n "$OPENCLAW_BINARY_URL" ]]; then
    selected_method="binary"
  elif [[ -n "$OPENCLAW_BOOTSTRAP_URL" ]]; then
    selected_method="bootstrap"
  else
    die "auto mode failed: no brew and no binary/bootstrap source configured"
  fi
fi

log "selected install method: $selected_method"
case "$selected_method" in
  brew)
    install_via_brew || die "brew install failed"
    ;;
  binary)
    install_via_binary
    ;;
  bootstrap)
    install_via_bootstrap
    ;;
  *)
    die "unsupported method: $selected_method"
    ;;
esac

run_post_install
wait_health_if_required

if ! command_exists openclaw; then
  die "openclaw is still not found in PATH after installation"
fi

log "openclaw version: $(current_version || echo unknown)"
log "done"
