#!/usr/bin/env bash
#
# provision-ui-server.sh
#
# Provisions the SAME Ubuntu EC2 instance (already running ermservice backend +
# Jenkins, see ../businessprocess-erm-service-dev/deploy/) to also build & run
# the Next.js UI (businessprocess-erm-ui) natively as a systemd service.
#
# Run as root (or via sudo) on the target Ubuntu instance:
#   sudo bash provision-ui-server.sh
#
set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration (override via environment before invoking the script if needed)
# ---------------------------------------------------------------------------
REPO_URL="${REPO_URL:-https://github.com/mauliksolanki-bot/businessprocess-erm-ui.git}"
REPO_BRANCH="${REPO_BRANCH:-production}"
APP_USER="${APP_USER:-ermui}"
APP_DIR="${APP_DIR:-/opt/ermui}"
APP_SRC_DIR="${APP_DIR}/src"
ENV_DIR="/etc/ermui"
ENV_FILE="${ENV_DIR}/ermui.env"
SERVICE_NAME="ermui"
APP_PORT="${APP_PORT:-3000}"
API_BASE_URL="${API_BASE_URL:-http://35.154.240.113:8081}"
NODE_MAJOR="${NODE_MAJOR:-20}"

log() { echo -e "\n\033[1;32m==> $*\033[0m"; }
warn() { echo -e "\033[1;33mWARN: $*\033[0m"; }

if [[ $EUID -ne 0 ]]; then
  echo "This script must be run as root (use sudo)." >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# 1. Node.js (via NodeSource) + git + curl
# ---------------------------------------------------------------------------
log "Installing Node.js ${NODE_MAJOR}.x, git, curl"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl git ca-certificates gnupg ufw rsync

if ! command -v node >/dev/null 2>&1 || ! node -v | grep -q "^v${NODE_MAJOR}\."; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y nodejs
fi

node -v
npm -v

# ---------------------------------------------------------------------------
# 2. Service user + directories
# ---------------------------------------------------------------------------
log "Creating service user '${APP_USER}' and directories"
if ! id -u "${APP_USER}" >/dev/null 2>&1; then
  useradd --system --create-home --home-dir "${APP_DIR}" --shell /usr/sbin/nologin "${APP_USER}"
fi
mkdir -p "${APP_DIR}" "${ENV_DIR}"
chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}"

# ---------------------------------------------------------------------------
# 3. Environment file (created once, never overwritten)
# ---------------------------------------------------------------------------
if [[ ! -f "${ENV_FILE}" ]]; then
  log "Creating env file at ${ENV_FILE}"
  cat > "${ENV_FILE}" <<EOF
NODE_ENV=production
PORT=${APP_PORT}
NEXT_PUBLIC_API_BASE_URL=${API_BASE_URL}
NEXT_PUBLIC_NEW_RELIC_BROWSER_SNIPPET=
EOF
  chown "${APP_USER}:${APP_USER}" "${ENV_FILE}"
  chmod 600 "${ENV_FILE}"
else
  log "Env file ${ENV_FILE} already exists; leaving it untouched"
fi

# ---------------------------------------------------------------------------
# 4. Clone + build the UI
# ---------------------------------------------------------------------------
log "Cloning ${REPO_URL} (branch ${REPO_BRANCH})"
if [[ -d "${APP_SRC_DIR}/.git" ]]; then
  su -s /bin/bash "${APP_USER}" -c "git -C '${APP_SRC_DIR}' fetch --all && git -C '${APP_SRC_DIR}' checkout '${REPO_BRANCH}' && git -C '${APP_SRC_DIR}' reset --hard 'origin/${REPO_BRANCH}'"
else
  rm -rf "${APP_SRC_DIR}"
  su -s /bin/bash "${APP_USER}" -c "git clone --branch '${REPO_BRANCH}' '${REPO_URL}' '${APP_SRC_DIR}'"
fi

log "Installing dependencies (npm ci --include=dev, forced so devDependencies like @tailwindcss/postcss are always installed regardless of ambient NODE_ENV/npm config)"
su -s /bin/bash "${APP_USER}" -c "cd '${APP_SRC_DIR}' && unset NODE_ENV && npm ci --include=dev"

if [[ ! -d "${APP_SRC_DIR}/node_modules/@tailwindcss/postcss" ]]; then
  warn "@tailwindcss/postcss still missing after npm ci - installing it explicitly as a fallback"
  su -s /bin/bash "${APP_USER}" -c "cd '${APP_SRC_DIR}' && unset NODE_ENV && npm install --no-save @tailwindcss/postcss tailwindcss"
fi

log "Building the Next.js app (only NEXT_PUBLIC_* vars exported for build time)"
su -s /bin/bash "${APP_USER}" -c "cd '${APP_SRC_DIR}' && export \$(grep -E '^NEXT_PUBLIC_' '${ENV_FILE}' | xargs -d '\n') && npm run build"

# ---------------------------------------------------------------------------
# 5. systemd service
# ---------------------------------------------------------------------------
log "Writing systemd unit /etc/systemd/system/${SERVICE_NAME}.service"
cat > "/etc/systemd/system/${SERVICE_NAME}.service" <<EOF
[Unit]
Description=ermservice UI (Next.js) application
After=network.target

[Service]
Type=simple
User=${APP_USER}
WorkingDirectory=${APP_SRC_DIR}
EnvironmentFile=${ENV_FILE}
ExecStart=/usr/bin/npm run start -- -p ${APP_PORT}
SuccessExitStatus=143
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "${SERVICE_NAME}"
systemctl restart "${SERVICE_NAME}"

# ---------------------------------------------------------------------------
# 6. Firewall
# ---------------------------------------------------------------------------
log "Configuring ufw firewall (allow ${APP_PORT})"
ufw allow "${APP_PORT}/tcp" || true
ufw --force enable || true

# ---------------------------------------------------------------------------
# 7. Scoped sudoers so Jenkins can deploy without full root
# ---------------------------------------------------------------------------
log "Granting jenkins user scoped sudo rights to deploy ${SERVICE_NAME}"
cat > /etc/sudoers.d/jenkins-ermui <<EOF
jenkins ALL=(root) NOPASSWD: /bin/systemctl restart ${SERVICE_NAME}
jenkins ALL=(root) NOPASSWD: /bin/systemctl status ${SERVICE_NAME}
jenkins ALL=(root) NOPASSWD: /bin/systemctl is-active ${SERVICE_NAME}
jenkins ALL=(root) NOPASSWD: /bin/chown -R ${APP_USER}\:${APP_USER} ${APP_SRC_DIR}
jenkins ALL=(root) NOPASSWD: /usr/bin/rsync -a --delete /tmp/ermui-deploy/ ${APP_SRC_DIR}/
jenkins ALL=(${APP_USER}) NOPASSWD: ALL
EOF
chmod 440 /etc/sudoers.d/jenkins-ermui
visudo -c -f /etc/sudoers.d/jenkins-ermui

# ---------------------------------------------------------------------------
# 8. Verification
# ---------------------------------------------------------------------------
log "Verifying deployment"
sleep 8

STATUS_OK=true

echo "---- systemctl status ${SERVICE_NAME} ----"
if systemctl is-active --quiet "${SERVICE_NAME}"; then
  echo "systemctl: ${SERVICE_NAME} is ACTIVE"
else
  echo "systemctl: ${SERVICE_NAME} is NOT active"
  STATUS_OK=false
fi
systemctl status "${SERVICE_NAME}" --no-pager -l || true

echo "---- node process check ----"
if pgrep -f "next-server|next start" >/dev/null; then
  echo "node process FOUND:"
  ps -ef | grep -E "[n]ext-server|[n]ext start"
else
  echo "node process NOT FOUND"
  STATUS_OK=false
fi

echo "---- HTTP smoke test (http://localhost:${APP_PORT}) ----"
HTTP_OK=false
for i in {1..10}; do
  if curl -sf "http://localhost:${APP_PORT}" -o /dev/null; then
    echo "HTTP check: OK (UI responding on ${APP_PORT})"
    HTTP_OK=true
    break
  fi
  sleep 5
done
if [[ "${HTTP_OK}" != "true" ]]; then
  echo "HTTP check: FAILED to get a response on ${APP_PORT}"
  STATUS_OK=false
fi

echo
if [[ "${STATUS_OK}" == "true" ]]; then
  log "UI PROVISIONING COMPLETE - PASS"
else
  warn "UI PROVISIONING COMPLETE WITH ISSUES - see checks above"
fi

echo
echo "Next steps:"
echo "  1. UI URL: http://<public-ip>:${APP_PORT}"
echo "  2. Env file (API base URL etc.): ${ENV_FILE} - edit and re-run 'npm run build' + restart if changed (NEXT_PUBLIC_* vars are baked in at build time)"
