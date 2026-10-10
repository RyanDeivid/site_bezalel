#!/usr/bin/env bash
# Atualiza o backend na VM (opção systemd). Idempotente: pode rodar a cada release.
set -euo pipefail
cd /opt/bezalel
git pull --ff-only
cd server
python3.13 -m venv .venv
.venv/bin/pip install --quiet -r requirements.txt
sudo systemctl restart bezalel-api
sleep 2
curl -fsS http://127.0.0.1:8100/health && echo " — bezalel-api ok"
