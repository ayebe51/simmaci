#!/bin/sh
set -e

# Fix Windows CRLF line endings on mounted .env file
if [ -f /var/www/html/.env ]; then
  sed -i "s/\r$//" /var/www/html/.env
fi

cd /var/www/html

# Ensure tmp directory is writable for file uploads
chmod 1777 /tmp 2>/dev/null || true

# Generate app key if not set
if [ -z "$APP_KEY" ] || [ "$APP_KEY" = "" ]; then
  php artisan key:generate --force
fi

# Wait for DB to be ready (max 60s)
echo "Waiting for database..."
for i in $(seq 1 30); do
  php artisan db:show 2>/dev/null && break
  echo "DB not ready, retry $i/30..."
  sleep 2
done

# Run pending migrations
echo "Running migrations..."
php artisan migrate --force || { echo "Migration failed, aborting"; exit 1; }

# Cache config for production performance
# ALWAYS clear first to prevent stale cached config from previous deployments
# (stale config can persist if container image is reused without full rebuild)
if [ "$APP_ENV" = "production" ]; then
  echo "Clearing and rebuilding config cache..."
  php artisan config:clear || true
  php artisan cache:clear || true
  php artisan config:cache || true
  php artisan route:cache || true
  php artisan view:cache || true
fi

echo "Startup complete, launching supervisor..."

# Start supervisor
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
