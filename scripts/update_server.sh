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

echo "Reloading app (zero-downtime)..."
MASTER_PID=$(systemctl show keeper-league --property=MainPID --value)
if [ "$MASTER_PID" -gt 0 ] 2>/dev/null; then
  # Graceful reload: gunicorn spawns new workers with updated code,
  # old workers finish serving current requests, then exit. No downtime.
  kill -HUP "$MASTER_PID"
  sleep 2
  echo "Done! Checking status..."
  systemctl is-active keeper-league && echo "App is running (graceful reload)." || echo "ERROR: App not running after reload."
else
  echo "No running process found, doing full start..."
  systemctl start keeper-league
  sleep 2
  systemctl is-active keeper-league && echo "App is running (cold start)." || echo "ERROR: App failed to start. Check: journalctl -u keeper-league -n 50"
fi
