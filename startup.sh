#!/bin/sh

# Set APP_URL from Railway's provided URL if available
if [ -n "$RAILWAY_PUBLIC_DOMAIN" ]; then
    export APP_URL="https://$RAILWAY_PUBLIC_DOMAIN"
fi

# Clear and rebuild cache with correct runtime values
php artisan config:clear
php artisan cache:clear
php artisan route:clear
php artisan view:clear

# Re-cache with correct values
php artisan config:cache
php artisan route:cache
php artisan view:cache

# Run any pending migrations
php artisan migrate --force

# Start PHP server with multiple workers
exec php -S 0.0.0.0:${PORT:-8000} -t public server.php
