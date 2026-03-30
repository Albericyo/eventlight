<?php

declare(strict_types=1);

/** Routeur pour `php -S localhost:8080 public/router.php` */
$uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
if (str_starts_with($uri, '/api/')) {
    require __DIR__ . '/index.php';
    return;
}
$file = __DIR__ . $uri;
if ($uri !== '/' && is_file($file)) {
    return false;
}
header('Content-Type: text/html; charset=utf-8');
readfile(__DIR__ . '/index.html');
