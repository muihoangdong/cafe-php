FROM php:8.3-fpm
RUN apt-get update && apt-get install -y git unzip libpq-dev libzip-dev libonig-dev libpng-dev libxml2-dev libsqlite3-dev \
 && docker-php-ext-install pdo_pgsql pdo_sqlite mbstring zip bcmath pcntl gd \
 && pecl install redis && docker-php-ext-enable redis \
 && rm -rf /var/lib/apt/lists/*
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
WORKDIR /var/www/html


