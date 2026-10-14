#!/bin/sh
# Runs the first-boot setup, then starts n8n. Keep this file LF-only (see .gitattributes).
set -e
node /kit/docker/bootstrap.js || echo "[kit] bootstrap reported a problem, starting n8n anyway"
exec n8n start
