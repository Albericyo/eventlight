<?php

declare(strict_types=1);

require __DIR__ . '/../bootstrap.php';

use EventFlow\Router;
use EventFlow\Routes;

$router = new Router();
Routes::register($router);

$uri = $_SERVER['REQUEST_URI'] ?? '/';
$path = parse_url($uri, PHP_URL_PATH) ?? '/';
$path = rawurldecode($path);

$router->dispatch($_SERVER['REQUEST_METHOD'] ?? 'GET', $path);
