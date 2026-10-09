FROM php:8.3-fpm-bookworm
WORKDIR /var/www/html

# Environment settings for lightweight fast extension compilation
# Disable AVIF/SVT-AV1/RAV1E video codecs in GD to prevent heavy compilation, high memory usage, and build exit 255
ENV IPE_GD_WITHOUTAVIF=1

# Install system dependencies
RUN apt-get update && apt-get install -y \
    bash \
    curl \
    supervisor \
    nginx \
    unzip \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install PHP extensions using official extension installer image
COPY --from=mlocati/php-extension-installer:latest /usr/bin/install-php-extensions /usr/local/bin/

RUN install-php-extensions \
    pdo_pgsql \
    mbstring \
    zip \
    gd \
    intl \
    bcmath \
    exif \
    pcntl \
    opcache \
    redis

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
RUN COMPOSER_MEMORY_LIMIT=-1 composer install --no-interaction --optimize-autoloader --no-dev --no-scripts --no-autoloader

# Copy project files
COPY . .

# Generate optimized autoloader with application classes
RUN composer dump-autoload --optimize --no-dev

# Set permissions
RUN chown -R www-data:www-data storage bootstrap/cache
RUN mkdir -p vendor/ezyang/htmlpurifier/library/HTMLPurifier/DefinitionCache/Serializer && \
    chmod -R 775 vendor/ezyang/htmlpurifier/library/HTMLPurifier/DefinitionCache/Serializer && \
    chown -R www-data:www-data vendor/ezyang/htmlpurifier/library/HTMLPurifier/DefinitionCache/Serializer
RUN mkdir -p storage/fonts storage/temp && \
    chown -R www-data:www-data storage/fonts storage/temp && \
    chmod -R 775 /tmp

# Copy Nginx configuration
COPY ./docker/nginx/hsts_map.conf /etc/nginx/conf.d/hsts_map.conf
COPY ./docker/nginx/backend.conf /etc/nginx/sites-available/default
RUN ln -sf /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default

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
