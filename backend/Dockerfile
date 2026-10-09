FROM php:8.3-fpm-bookworm
WORKDIR /var/www/html

# Install system dependencies and targeted dev libraries for PHP extensions
# (Explicitly avoiding libavif-dev, libaom-dev, cmake, and dav1d to prevent heavy compilation and build exit 255)
RUN apt-get update && apt-get install -y --no-install-recommends \
    bash \
    curl \
    supervisor \
    nginx \
    unzip \
    git \
    libpq-dev \
    libzip-dev \
    libicu-dev \
    libfreetype6-dev \
    libjpeg62-turbo-dev \
    libpng-dev \
    libwebp-dev \
    && rm -rf /var/lib/apt/lists/*

# Install PHP extension installer helper (used for fast redis extension installation)
COPY --from=mlocati/php-extension-installer:latest /usr/bin/install-php-extensions /usr/local/bin/

# Configure and compile core PHP extensions in parallel without heavy video/avif codecs
RUN docker-php-ext-configure gd --with-freetype --with-jpeg --with-webp \
    && docker-php-ext-configure intl \
    && docker-php-ext-install -j$(nproc) \
        pdo_pgsql \
        zip \
        gd \
        intl \
        bcmath \
        exif \
        pcntl \
    && install-php-extensions redis

# PHP configuration for file uploads, memory, and security
RUN echo "upload_max_filesize=50M" > /usr/local/etc/php/conf.d/uploads.ini \
    && echo "post_max_size=50M" >> /usr/local/etc/php/conf.d/uploads.ini \
    && echo "memory_limit=256M" >> /usr/local/etc/php/conf.d/uploads.ini \
    && echo "max_execution_time=300" >> /usr/local/etc/php/conf.d/uploads.ini \
    && echo "upload_tmp_dir=/tmp" >> /usr/local/etc/php/conf.d/uploads.ini \
    && echo "expose_php=Off" >> /usr/local/etc/php/conf.d/uploads.ini \
    && chmod 1777 /tmp

# Install Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# Copy only composer manifest files first to leverage Docker layer caching
COPY composer.json composer.lock ./

# Install dependencies (cached unless composer.json or composer.lock changes)
# Cap memory at 1G to prevent host RAM exhaustion (OOM exit 255)
RUN COMPOSER_MEMORY_LIMIT=1G composer install --no-interaction --optimize-autoloader --no-dev --no-scripts --no-autoloader

# Copy project files
COPY . .

# Generate optimized autoloader with application classes without triggering post-autoload-dump scripts
RUN COMPOSER_MEMORY_LIMIT=1G composer dump-autoload --optimize --no-dev --no-scripts

# Explicitly discover Laravel packages
RUN php artisan package:discover --ansi

# Set directory permissions and storage structure efficiently in a single layer
RUN mkdir -p \
        storage/framework/cache/data \
        storage/framework/sessions \
        storage/framework/views \
        storage/logs \
        storage/fonts \
        storage/temp \
        vendor/ezyang/htmlpurifier/library/HTMLPurifier/DefinitionCache/Serializer \
    && chown -R www-data:www-data storage bootstrap/cache vendor/ezyang/htmlpurifier \
    && chmod -R 775 storage bootstrap/cache vendor/ezyang/htmlpurifier \
    && chmod 1777 /tmp

# Copy Nginx configuration and validate syntax
COPY ./docker/nginx/hsts_map.conf /etc/nginx/conf.d/hsts_map.conf
COPY ./docker/nginx/backend.conf /etc/nginx/sites-available/default
RUN ln -sf /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default \
    && nginx -t

# Copy PHP-FPM pool configuration (increase worker count to prevent timeouts)
COPY ./docker/php/www.conf /usr/local/etc/php-fpm.d/www.conf
COPY ./docker/php/opcache.ini /usr/local/etc/php/conf.d/opcache.ini

# Copy Supervisor configuration
COPY ./docker/supervisor/backend.conf /etc/supervisor/conf.d/supervisord.conf

# Modify PHP-FPM config
RUN sed -i 's/listen = \/run\/php\/php8.3-fpm.sock/listen = 0.0.0.0:9000/g' /usr/local/etc/php-fpm.d/zz-docker.conf || \
    echo 'listen = 0.0.0.0:9000' >> /usr/local/etc/php-fpm.d/zz-docker.conf

EXPOSE 80

# Health check - validates Nginx + PHP-FPM + Laravel API responsiveness
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -f http://localhost/api/health || exit 1

# Copy startup script (external file - easier to maintain and edit)
COPY ./docker/start.sh /usr/local/bin/start.sh
RUN chmod +x /usr/local/bin/start.sh

CMD ["/usr/local/bin/start.sh"]
