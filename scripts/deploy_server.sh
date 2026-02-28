#!/usr/bin/env bash
# ============================================================
# Keeper League — Full server setup script
# Run as root on a fresh Ubuntu 24.04 VPS
#
# Usage:
#   ssh root@YOUR_SERVER_IP
#   curl -sSL https://raw.githubusercontent.com/jpod31/keeper-league/main/scripts/deploy_server.sh | bash
#
#   OR copy this file to the server and run:
#   chmod +x deploy_server.sh && ./deploy_server.sh
# ============================================================

set -euo pipefail

APP_USER="keeper"
APP_DIR="/opt/keeper-league"
DATA_DIR="/opt/keeper-league/data"
REPO="https://github.com/jpod31/keeper-league.git"
DOMAIN=""  # leave blank to skip SSL — set later with: certbot --nginx -d yourdomain.com

echo "============================================"
echo "  Keeper League — Server Setup"
echo "============================================"

# ── 1. System packages ──────────────────────────────────
echo "[1/7] Installing system packages..."
apt-get update -qq
apt-get install -y -qq python3 python3-pip python3-venv git nginx certbot python3-certbot-nginx ufw > /dev/null

# ── 2. Firewall ─────────────────────────────────────────
echo "[2/7] Configuring firewall..."
ufw allow OpenSSH > /dev/null
ufw allow 'Nginx Full' > /dev/null
echo "y" | ufw enable > /dev/null 2>&1 || true

# ── 3. App user + clone repo ────────────────────────────
echo "[3/7] Setting up app user and cloning repo..."
id -u $APP_USER &>/dev/null || useradd -r -m -s /bin/bash $APP_USER

if [ -d "$APP_DIR" ]; then
    cd "$APP_DIR" && git pull origin main
else
    git clone "$REPO" "$APP_DIR"
fi

mkdir -p "$DATA_DIR"
chown -R $APP_USER:$APP_USER "$APP_DIR"

# ── 4. Python venv + deps ──────────────────────────────
echo "[4/7] Installing Python dependencies..."
cd "$APP_DIR"
sudo -u $APP_USER python3 -m venv venv
sudo -u $APP_USER venv/bin/pip install -q --upgrade pip
sudo -u $APP_USER venv/bin/pip install -q -r requirements.txt

# ── 5. Environment file ────────────────────────────────
echo "[5/7] Creating .env file..."
if [ ! -f "$APP_DIR/.env" ]; then
    SECRET=$(python3 -c "import secrets; print(secrets.token_hex(32))")
    cat > "$APP_DIR/.env" << ENVEOF
SECRET_KEY=$SECRET
FLASK_ENV=production
FLASK_DEBUG=0
DATA_DIR=$DATA_DIR
PORT=8000
ALLOWED_ORIGINS=*
ENVEOF
    chown $APP_USER:$APP_USER "$APP_DIR/.env"
    chmod 600 "$APP_DIR/.env"
    echo "  Generated .env with random SECRET_KEY"
else
    echo "  .env already exists, skipping"
fi

# ── 6. Systemd service ─────────────────────────────────
echo "[6/7] Creating systemd service..."
cat > /etc/systemd/system/keeper-league.service << 'SVCEOF'
[Unit]
Description=Keeper League Flask App
After=network.target

[Service]
User=keeper
Group=keeper
WorkingDirectory=/opt/keeper-league
EnvironmentFile=/opt/keeper-league/.env
ExecStart=/opt/keeper-league/venv/bin/gunicorn \
    --worker-class eventlet \
    -w 1 \
    --bind 127.0.0.1:8000 \
    --timeout 120 \
    --access-logfile /opt/keeper-league/data/access.log \
    --error-logfile /opt/keeper-league/data/error.log \
    app:app
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SVCEOF

systemctl daemon-reload
systemctl enable keeper-league
systemctl restart keeper-league

# ── 7. Nginx reverse proxy ─────────────────────────────
echo "[7/7] Configuring Nginx..."
cat > /etc/nginx/sites-available/keeper-league << 'NGXEOF'
server {
    listen 80;
    server_name _;

    client_max_body_size 16M;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket support (for draft + live scores)
    location /socket.io/ {
        proxy_pass http://127.0.0.1:8000/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }
}
NGXEOF

ln -sf /etc/nginx/sites-available/keeper-league /etc/nginx/sites-enabled/keeper-league
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo ""
echo "============================================"
echo "  DONE! Your site is live."
echo "============================================"
echo ""
echo "  App running at:  http://$(curl -s ifconfig.me)"
echo "  Logs:            journalctl -u keeper-league -f"
echo "  Restart:         systemctl restart keeper-league"
echo ""
echo "  To add a domain with HTTPS:"
echo "    1. Point your domain's A record to $(curl -s ifconfig.me)"
echo "    2. Edit /etc/nginx/sites-available/keeper-league"
echo "       Change 'server_name _;' to 'server_name yourdomain.com;'"
echo "    3. Run: certbot --nginx -d yourdomain.com"
echo "    4. Update .env: ALLOWED_ORIGINS=https://yourdomain.com"
echo "    5. systemctl restart keeper-league"
echo ""
