#!/bin/sh
# Replace BACKEND_UPSTREAM placeholder with actual backend URL from env var
# Default: http://backend (for docker-compose usage)
BACKEND_URL="${BACKEND_URL:-http://backend}"

echo "Starting nginx with backend URL: ${BACKEND_URL}"

# Replace placeholder in nginx config
sed -i "s|BACKEND_UPSTREAM|${BACKEND_URL}|g" /etc/nginx/conf.d/default.conf

# Start nginx
exec nginx -g "daemon off;"
