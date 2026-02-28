#!/usr/bin/env bash
# Quick deploy: pull latest code and restart
# Usage: ssh root@YOUR_SERVER_IP 'bash /opt/keeper-league/scripts/update_server.sh'

set -euo pipefail

APP_DIR="/opt/keeper-league"

echo "Pulling latest code..."
cd "$APP_DIR"
sudo -u keeper git pull origin main

echo "Installing any new dependencies..."
sudo -u keeper venv/bin/pip install -q -r requirements.txt

echo "Restarting app..."
systemctl restart keeper-league

echo "Done! Checking status..."
sleep 2
systemctl is-active keeper-league && echo "App is running." || echo "ERROR: App failed to start. Check: journalctl -u keeper-league -n 50"
