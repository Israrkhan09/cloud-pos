FROM php:8.2-cli

# Install system dependencies + Node.js 20
RUN apt-get update && apt-get install -y \
    git curl unzip zip \
    libsqlite3-dev libzip-dev libpng-dev libonig-dev libxml2-dev \
    && docker-php-ext-install pdo_sqlite zip mbstring bcmath \
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
RUN composer install --no-dev --optimize-autoloader --no-interaction

# Install Node dependencies and build frontend assets
RUN npm install --legacy-peer-deps
RUN npm run build

# Setup storage and bootstrap directories
RUN mkdir -p storage/framework/views \
             storage/framework/cache/data \
             storage/framework/sessions \
             storage/logs \
             bootstrap/cache \
    && chmod -R 775 storage bootstrap/cache

# Use Railway .env
RUN cp .env.railway .env

# Generate app key
RUN php artisan key:generate --force

# Make startup script executable
RUN chmod +x /app/startup.sh

EXPOSE 8000

# Use startup script (clears and rebuilds cache at runtime with correct APP_URL)
CMD ["/app/startup.sh"]
