#!/bin/bash
set -euo pipefail

TUNNEL_NAME="yt-dlp"
APP_DIR="/opt/yt-dlp-resolver"

echo "=== Cloudflare Tunnel Setup for yt-dlp Resolver ==="
echo ""

# 1. Install cloudflared
echo "[1/5] Installing cloudflared..."
if command -v cloudflared &>/dev/null; then
  echo "  cloudflared already installed: $(cloudflared --version)"
else
  ARCH=$(uname -m)
  if [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then
    PKG="cloudflared-linux-arm64.deb"
  elif [ "$ARCH" = "x86_64" ] || [ "$ARCH" = "amd64" ]; then
    PKG="cloudflared-linux-amd64.deb"
  else
    echo "  Unsupported architecture: $ARCH"
    exit 1
  fi
  curl -sL "https://github.com/cloudflare/cloudflared/releases/latest/download/$PKG" -o "/tmp/$PKG"
  sudo dpkg -i "/tmp/$PKG"
  rm -f "/tmp/$PKG"
  echo "  cloudflared installed: $(cloudflared --version)"
fi
echo ""

# 2. Login (requires browser)
echo "[2/5] Authenticating cloudflared..."
echo "  A browser tab will open. Log in with your Cloudflare account."
cloudflared tunnel login
echo ""

# 3. Create tunnel
echo "[3/5] Creating tunnel '$TUNNEL_NAME'..."
if cloudflared tunnel list 2>/dev/null | grep -q "$TUNNEL_NAME"; then
  echo "  Tunnel '$TUNNEL_NAME' already exists."
else
  cloudflared tunnel create "$TUNNEL_NAME"
fi
echo ""

# 4. Ask user for domain
echo "[4/5] DNS setup..."
echo "  Do you have a custom domain in Cloudflare? (e.g., example.com)"
echo "  If yes, enter domain name (without subdomain):"
echo "  If no (only workers.dev), press Enter for Quick Tunnel."
read -p "  Domain [Enter for Quick Tunnel]: " CUSTOM_DOMAIN
TUNNEL_ID=$(cloudflared tunnel list 2>/dev/null | grep "$TUNNEL_NAME" | awk '{print $1}')

if [ -z "$CUSTOM_DOMAIN" ]; then
  # Quick Tunnel - no DNS needed
  echo ""
  echo "  Using Quick Tunnel (random trycloudflare.com URL)"
  echo "  NOTE: Quick Tunnel URL changes on restart!"
  echo "  You'll need to update wrangler.toml each time."

  sudo tee "/etc/systemd/system/cloudflared-$TUNNEL_NAME.service" > /dev/null <<EOF
[Unit]
Description=Cloudflare Tunnel for $TUNNEL_NAME (Quick Tunnel)
After=network.target

[Service]
Type=simple
User=root
ExecStart=/usr/bin/cloudflared tunnel --url http://localhost:8000
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

  echo ""
  echo "  Starting Quick Tunnel..."
  echo "  Run 'journalctl -u cloudflared-$TUNNEL_NAME -f' to get the URL after start."

else
  # Proper DNS-based tunnel
  TUNNEL_HOSTNAME="resolve.$CUSTOM_DOMAIN"

  TUNNEL_ID=$(cloudflared tunnel list | grep "$TUNNEL_NAME" | awk '{print $1}')
  echo "  Tunnel ID: $TUNNEL_ID"

  mkdir -p ~/.cloudflared
  cat > ~/.cloudflared/config.yml <<EOF
tunnel: $TUNNEL_NAME
credentials-file: /root/.cloudflared/$TUNNEL_ID.json

ingress:
  - hostname: $TUNNEL_HOSTNAME
    service: http://localhost:8000
  - service: http_status:404
EOF

  cloudflared tunnel route dns "$TUNNEL_NAME" "$TUNNEL_HOSTNAME"

  sudo tee "/etc/systemd/system/cloudflared-$TUNNEL_NAME.service" > /dev/null <<EOF
[Unit]
Description=Cloudflare Tunnel for $TUNNEL_NAME
After=network.target

[Service]
Type=simple
User=root
ExecStart=/usr/bin/cloudflared tunnel run $TUNNEL_NAME
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

  echo ""
  echo "  URL: https://$TUNNEL_HOSTNAME"
  echo "  Update wrangler.toml: FALLBACK_RESOLVER_URL = \"https://$TUNNEL_HOSTNAME\""
fi

sudo systemctl daemon-reload
sudo systemctl enable "cloudflared-$TUNNEL_NAME"
sudo systemctl restart "cloudflared-$TUNNEL_NAME"

echo ""
echo "=== Done ==="
echo "Check: systemctl status cloudflared-$TUNNEL_NAME"
echo "Logs:  journalctl -u cloudflared-$TUNNEL_NAME -f"
echo ""
echo "Test after tunnel is up:"
echo "  curl http://localhost:8000/health"
