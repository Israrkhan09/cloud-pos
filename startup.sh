#!/bin/sh

# Detect platform and set APP_URL accordingly
if [ -n "$RENDER_EXTERNAL_URL" ]; then
    # Render.com - provides full HTTPS URL automatically
    export APP_URL="$RENDER_EXTERNAL_URL"
    export ASSET_URL="$RENDER_EXTERNAL_URL"
    echo "==> Render detected: $APP_URL"
elif [ -n "$RAILWAY_PUBLIC_DOMAIN" ]; then
    # Railway - provides domain without scheme
    export APP_URL="https://$RAILWAY_PUBLIC_DOMAIN"
    export ASSET_URL="https://$RAILWAY_PUBLIC_DOMAIN"
    echo "==> Railway detected: $APP_URL"
elif [ -n "$APP_URL" ]; then
    # APP_URL set manually via environment variable
    export ASSET_URL="$APP_URL"
    echo "==> Manual APP_URL: $APP_URL"
else
    export APP_URL="https://cloud-pos-production.up.railway.app"
    export ASSET_URL="$APP_URL"
    echo "==> Fallback URL: $APP_URL"
fi

export TRUSTED_PROXIES="*"
export PHP_CLI_SERVER_WORKERS=4

echo "==> PORT: ${PORT:-8000}"

# Clear and rebuild config cache
php artisan config:clear || true
php artisan cache:clear || true
php artisan route:clear || true
php artisan view:clear || true

php artisan config:cache || true
php artisan route:cache || true
php artisan view:cache || true

# Run migrations
php artisan migrate --force || true

# Create test user with verified email (email_verified_at required for dashboard access)
php artisan tinker --execute="
\$user = App\Models\User::firstOrCreate(
    ['email' => 'test@test.com'],
    ['name' => 'Test User', 'password' => bcrypt('password'), 'email_verified_at' => now()]
);
if (is_null(\$user->email_verified_at)) {
    \$user->update(['email_verified_at' => now()]);
}
echo 'User OK: ' . \$user->email;
" || true

echo "==> Launching PHP server on port ${PORT:-8000}..."

exec php -S 0.0.0.0:${PORT:-8000} server.php
