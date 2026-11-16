FROM php:8.2-cli

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    curl \
    libsqlite3-dev \
    libzip-dev \
    unzip \
    && docker-php-ext-install pdo pdo_sqlite sqlite3 zip \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Install Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# Set working directory
WORKDIR /app

# Copy project files
COPY . .

# Install PHP dependencies (if vendor not committed or incomplete)
RUN if [ ! -f vendor/autoload.php ]; then composer install --no-dev --optimize-autoloader --no-interaction; fi

# Create necessary directories
RUN mkdir -p storage/framework/views \
    storage/framework/cache/data \
    storage/framework/sessions \
    storage/logs \
    bootstrap/cache \
    && chmod -R 775 storage bootstrap/cache

# Use Railway-specific .env if available
RUN if [ -f .env.railway ]; then cp .env.railway .env; fi

# Generate app key if not set
RUN php artisan key:generate --force || true

# Cache config and routes for performance
RUN php artisan config:cache || true
RUN php artisan route:cache || true
RUN php artisan view:cache || true

# Run migrations on the SQLite database
RUN php artisan migrate --force || true

# Expose port
EXPOSE 8000

# Start PHP built-in server
CMD php -S 0.0.0.0:${PORT:-8000} -t public server.php
