#!/bin/sh

# Force HTTPS APP_URL from Railway domain
if [ -n "$RAILWAY_PUBLIC_DOMAIN" ]; then
    export APP_URL="https://$RAILWAY_PUBLIC_DOMAIN"
    export ASSET_URL="https://$RAILWAY_PUBLIC_DOMAIN"
else
    export APP_URL="https://cloud-pos-production.up.railway.app"
    export ASSET_URL="https://cloud-pos-production.up.railway.app"
fi

export TRUSTED_PROXIES="*"
export PHP_CLI_SERVER_WORKERS=4

echo "==> APP_URL: $APP_URL"
echo "==> PORT: ${PORT:-8000}"

# Clear and rebuild config cache (errors are non-fatal)
php artisan config:clear || true
php artisan cache:clear || true
php artisan route:clear || true
php artisan view:clear || true

php artisan config:cache || true
php artisan route:cache || true
php artisan view:cache || true

# Run migrations
php artisan migrate --force || true

# Create test user directly via artisan (safe - uses firstOrCreate)
php artisan tinker --execute="
App\Models\User::firstOrCreate(
    ['email' => 'test@test.com'],
    ['name' => 'Test User', 'password' => bcrypt('password')]
);
echo 'User ready: ' . App\Models\User::count() . ' users';
" || true

echo "==> Launching PHP server..."

# Start server from project root - server.php handles static files from public/
exec php -S 0.0.0.0:${PORT:-8000} server.php
