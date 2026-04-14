FROM php:8.3-fpm
WORKDIR /var/www/html

# Install system dependencies (Debian Bullseye/Bookworm)
RUN apt-get update && apt-get install -y \
    bash \
    curl \
    libpng-dev \
    libzip-dev \
    zlib1g-dev \
    libicu-dev \
    libpq-dev \
    libonig-dev \
    libfreetype6-dev \
    libjpeg62-turbo-dev \
    supervisor \
    nginx \
    unzip \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install PHP extensions
RUN docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install pdo_pgsql mbstring zip gd intl bcmath exif pcntl \
    && pecl install redis && docker-php-ext-enable redis

# Install Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# Copy project files
COPY . .

# Install dependencies
RUN composer install --no-interaction --optimize-autoloader --no-dev --no-scripts

# Set permissions
RUN chown -R www-data:www-data storage bootstrap/cache

# Copy Nginx configuration
COPY ./docker/nginx/backend.conf /etc/nginx/sites-available/default
RUN ln -sf /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default

# Copy PHP-FPM pool configuration (increase worker count to prevent timeouts)
COPY ./docker/php/www.conf /usr/local/etc/php-fpm.d/www.conf

# Copy Supervisor configuration
COPY ./docker/supervisor/backend.conf /etc/supervisor/conf.d/supervisord.conf

# Modify PHP-FPM config
RUN sed -i 's/listen = \/run\/php\/php8.3-fpm.sock/listen = 0.0.0.0:9000/g' /usr/local/etc/php-fpm.d/zz-docker.conf || \
    echo 'listen = 0.0.0.0:9000' >> /usr/local/etc/php-fpm.d/zz-docker.conf

EXPOSE 80

# Create startup script
RUN printf '#!/bin/sh\n\
# Fix Windows CRLF line endings on mounted .env file\n\
if [ -f /var/www/html/.env ]; then\n\
  sed -i "s/\\r$//" /var/www/html/.env\n\
fi\n\
\n\
cd /var/www/html\n\
\n\
# Generate app key if not set\n\
if [ -z "$APP_KEY" ] || [ "$APP_KEY" = "" ]; then\n\
  php artisan key:generate --force\n\
fi\n\
\n\
# Cache config for production performance\n\
if [ "$APP_ENV" = "production" ]; then\n\
  php artisan config:cache 2>/dev/null || true\n\
  php artisan route:cache 2>/dev/null || true\n\
  php artisan view:cache 2>/dev/null || true\n\
fi\n\
\n\
# Run pending migrations\n\
php artisan migrate --force 2>/dev/null || true\n\
\n\
# Start supervisor\n\
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf\n\
' > /usr/local/bin/start.sh && chmod +x /usr/local/bin/start.sh

CMD ["/usr/local/bin/start.sh"]
