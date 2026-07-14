#!/bin/bash
set -euo pipefail

# yt-dlp Resolver Deploy Script
# Usage: bash deploy.sh [/path/to/api-key-file]

APP_DIR="/opt/yt-dlp-resolver"
SERVICE_NAME="yt-dlp-resolver"
ENV_FILE="/etc/yt-dlp-resolver.env"
KEY_FILE="${1:-}"

if [[ $# -gt 1 ]]; then
    echo "Usage: bash deploy.sh [/path/to/api-key-file]" >&2
    exit 1
fi

echo "=== yt-dlp Resolver Deploy ==="
echo ""

# 1. Install system deps
echo "[1/5] Installing system dependencies..."
apt update -qq
apt install -y -qq python3 python3-pip python3-venv nginx openssl

if [[ -n "$KEY_FILE" ]]; then
    if [[ ! -f "$KEY_FILE" ]]; then
        echo "API key file does not exist or is not a regular file." >&2
        exit 1
    fi
    if command -v stat >/dev/null 2>&1; then
        KEY_MODE=$(stat -c '%a' -- "$KEY_FILE")
        if [[ ! "$KEY_MODE" =~ 00$ ]]; then
            echo "API key file must not be accessible by group or other users." >&2
            exit 1
        fi
    fi
    API_KEY=$(<"$KEY_FILE")
elif [[ -f "$ENV_FILE" ]]; then
    API_KEY=$(sed -n 's/^API_KEY=//p' "$ENV_FILE" | tail -n 1)
else
    API_KEY=$(openssl rand -hex 16)
fi

if [[ ! "$API_KEY" =~ ^[0-9A-Fa-f]{32,128}$ ]]; then
    echo "API key must be 32-128 hexadecimal characters." >&2
    exit 1
fi

# 2. Create app runtime
echo "[2/5] Creating application runtime..."
mkdir -p "$APP_DIR"
getent group ytresolver >/dev/null 2>&1 || groupadd --system ytresolver
id -u ytresolver >/dev/null 2>&1 || useradd --system --gid ytresolver --home "$APP_DIR" --shell /usr/sbin/nologin ytresolver
python3 -m venv "$APP_DIR/.venv"
"$APP_DIR/.venv/bin/pip" install -q yt-dlp -r "$(dirname "$0")/requirements.txt"
YT_DLP_PATH="$APP_DIR/.venv/bin/yt-dlp"

# 3. Install app files and environment
echo "[3/5] Installing files..."
install -o root -g ytresolver -m 0640 "$(dirname "$0")/app.py" "$APP_DIR/app.py"
install -o root -g ytresolver -m 0640 "$(dirname "$0")/requirements.txt" "$APP_DIR/requirements.txt"
install -o root -g ytresolver -m 0640 "$(dirname "$0")/nginx.conf" "$APP_DIR/nginx.conf"
install -o root -g root -m 0644 "$(dirname "$0")/nginx.conf" "/etc/nginx/sites-available/yt-dlp-resolver"
chown -R root:ytresolver "$APP_DIR"
chmod 0750 "$APP_DIR"
chmod -R u=rwX,g=rX,o= "$APP_DIR/.venv"

ENV_TMP=$(mktemp "${ENV_FILE}.tmp.XXXXXX")
trap 'rm -f "$ENV_TMP"' EXIT
printf 'API_KEY=%s\nYT_DLP_PATH=%s\n' "$API_KEY" "$YT_DLP_PATH" > "$ENV_TMP"
chmod 0600 "$ENV_TMP"
chown root:root "$ENV_TMP"
mv "$ENV_TMP" "$ENV_FILE"
trap - EXIT

rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/yt-dlp-resolver /etc/nginx/sites-enabled/yt-dlp-resolver

# 4. Create systemd service
echo "[4/5] Creating systemd service..."
SERVICE_TMP=$(mktemp)
trap 'rm -f "$SERVICE_TMP"' EXIT
cat > "$SERVICE_TMP" <<EOF
[Unit]
Description=yt-dlp Resolver API for ShortVideo TV
After=network.target

[Service]
Type=simple
User=ytresolver
Group=ytresolver
WorkingDirectory=$APP_DIR
EnvironmentFile=/etc/yt-dlp-resolver.env
Environment="PYTHONDONTWRITEBYTECODE=1"
ExecStart=$APP_DIR/.venv/bin/python -m uvicorn app:app --host 127.0.0.1 --port 8001 --no-access-log
Restart=always
RestartSec=5
KillSignal=SIGINT
TimeoutStopSec=30
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF
install -o root -g root -m 0644 "$SERVICE_TMP" "/etc/systemd/system/$SERVICE_NAME.service"
rm -f "$SERVICE_TMP"
trap - EXIT

# 5. Enable and start
echo "[5/5] Starting service..."
systemctl daemon-reload
systemctl enable "$SERVICE_NAME"
nginx -t
systemctl enable nginx
systemctl restart "$SERVICE_NAME"
systemctl reload-or-restart nginx

echo ""
echo "=== Done ==="
echo "Service: $SERVICE_NAME"
echo "Public port:     8000"
echo "Private Uvicorn: 127.0.0.1:8001"
echo "API key: stored in $ENV_FILE (mode 0600)"
echo "Firewall: allow inbound TCP 8000; this script does not modify firewall rules."
echo ""
echo "Check status: systemctl status $SERVICE_NAME"
echo "View logs:    journalctl -u $SERVICE_NAME -f"
echo "Check Nginx:  nginx -t && systemctl status nginx"
echo ""
echo "Test:"
echo "  curl http://localhost:8000/health"
echo "  Authenticated endpoints require the key stored in $ENV_FILE"
