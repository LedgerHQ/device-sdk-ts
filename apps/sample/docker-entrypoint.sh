#!/bin/bash
set -e

# Minimal PID 1 supervisor for the two processes in this pod:
#  - if either exits, stop the other and exit non-zero so Kubernetes restarts the pod
#    (otherwise Node keeps serving while every /api/* request fails);
#  - SIGTERM/SIGINT are forwarded to both for graceful shutdown.

# Flask API — pod-internal only; Next rewrites /api/* to it (API_URL baked at build).
gunicorn --chdir /app/py --bind 127.0.0.1:5328 --workers 2 --timeout 60 api.index:app &
api_pid=$!

# Kubernetes sets HOSTNAME to the pod name and Next standalone binds to it, so force 0.0.0.0.
HOSTNAME=0.0.0.0 node apps/sample/server.js &
web_pid=$!

stop() {
  kill -TERM "$api_pid" "$web_pid" 2>/dev/null || true
}
trap 'stop; wait; exit 143' TERM INT

# Block until the first of the two exits.
status=0
wait -n "$api_pid" "$web_pid" || status=$?

# One died (or exited cleanly, which is also unexpected for a server): take the other down.
stop
wait || true
[ "$status" -eq 0 ] && status=1
exit "$status"
