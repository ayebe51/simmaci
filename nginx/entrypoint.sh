#!/bin/sh
# BACKEND_URL env var is kept for documentation purposes.
# nginx/default.conf uses hardcoded "http://backend:80" (docker-compose service name).
# No runtime substitution needed since service name is fixed.
BACKEND_URL="${BACKEND_URL:-http://backend}"
echo "Starting nginx (backend upstream: ${BACKEND_URL})"

# Start nginx
exec nginx -g "daemon off;"
