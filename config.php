<?php

declare(strict_types=1);

use Dotenv\Dotenv;

$root = __DIR__;

if (is_file($root . '/vendor/autoload.php')) {
    require_once $root . '/vendor/autoload.php';
}

if (class_exists(Dotenv::class) && is_file($root . '/.env')) {
    Dotenv::createImmutable($root)->safeLoad();
}

return [
    'env' => $_ENV['APP_ENV'] ?? 'production',
    'secret' => $_ENV['APP_SECRET'] ?? '',
    'db' => [
        'dsn' => $_ENV['DB_DSN'] ?? 'mysql:host=127.0.0.1;dbname=eventflow;charset=utf8mb4',
        'user' => $_ENV['DB_USER'] ?? 'root',
        'pass' => $_ENV['DB_PASS'] ?? '',
    ],
];
