<?php

declare(strict_types=1);

try {
    require __DIR__ . '/../bootstrap.php';
} catch (Throwable $e) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'status' => 'error',
        'data' => ['message' => 'Erreur de démarrage', 'details' => $e->getMessage()],
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

use EventFlow\Router;
use EventFlow\Routes;

$router = new Router();
Routes::register($router);

$uri = $_SERVER['REQUEST_URI'] ?? '/';
$path = parse_url($uri, PHP_URL_PATH) ?? '/';
$path = rawurldecode($path);

try {
    $router->dispatch($_SERVER['REQUEST_METHOD'] ?? 'GET', $path);
} catch (Throwable $e) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'status' => 'error',
        'data' => ['message' => $e->getMessage()],
    ], JSON_UNESCAPED_UNICODE);
    exit;
}
