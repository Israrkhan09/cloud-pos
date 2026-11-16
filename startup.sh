#!/bin/sh

# Set APP_URL with HTTPS from Railway's domain
if [ -n "$RAILWAY_PUBLIC_DOMAIN" ]; then
    export APP_URL="https://$RAILWAY_PUBLIC_DOMAIN"
    export ASSET_URL="https://$RAILWAY_PUBLIC_DOMAIN"
else
    export APP_URL="https://cloud-pos-production.up.railway.app"
    export ASSET_URL="https://cloud-pos-production.up.railway.app"
fi

export TRUSTED_PROXIES="*"
export PHP_CLI_SERVER_WORKERS=4

echo "==> APP_URL set to: $APP_URL"

# Clear all caches first
php artisan config:clear
php artisan cache:clear
php artisan route:clear
php artisan view:clear

# Rebuild cache with correct runtime values
php artisan config:cache
php artisan route:cache
php artisan view:cache

# Run database migrations
php artisan migrate --force

echo "==> Starting PHP server on port ${PORT:-8000} with $PHP_CLI_SERVER_WORKERS workers"

# Start PHP built-in server from project root
# server.php handles static file routing to public/ directory
exec PHP_CLI_SERVER_WORKERS=$PHP_CLI_SERVER_WORKERS php -S 0.0.0.0:${PORT:-8000} server.php
