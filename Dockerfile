FROM php:8.2-cli

# Install system dependencies + Node.js 20
RUN apt-get update && apt-get install -y \
    git curl unzip zip \
    libsqlite3-dev libzip-dev libpng-dev libonig-dev libxml2-dev \
    && docker-php-ext-install pdo pdo_sqlite sqlite3 zip mbstring bcmath \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Install Node.js 20
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Install Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

WORKDIR /app

# Copy all project files
COPY . .

# Install PHP dependencies
RUN composer install --no-dev --optimize-autoloader --no-interaction --no-scripts

# Install Node dependencies and build frontend assets
RUN npm ci --prefer-offline || npm install
RUN npm run build

# Setup storage directories
RUN mkdir -p storage/framework/views \
             storage/framework/cache/data \
             storage/framework/sessions \
             storage/logs \
             bootstrap/cache \
    && chmod -R 775 storage bootstrap/cache

# Use Railway .env if available, otherwise keep existing
RUN if [ -f .env.railway ]; then cp .env.railway .env; fi

# Generate app key
RUN php artisan key:generate --force

# Cache for performance
RUN php artisan config:cache || true
RUN php artisan route:cache || true
RUN php artisan view:cache || true

# Run database migrations
RUN php artisan migrate --force || true

EXPOSE 8000

CMD php -S 0.0.0.0:${PORT:-8000} -t public server.php
