<?php

declare(strict_types=1);

namespace EventFlow;

final class Router
{
    /** @var list<array{method:string,regex:string,callback:callable}> */
    private array $routes = [];

    public function get(string $regex, callable $callback): void
    {
        $this->routes[] = ['method' => 'GET', 'regex' => $regex, 'callback' => $callback];
    }

    public function post(string $regex, callable $callback): void
    {
        $this->routes[] = ['method' => 'POST', 'regex' => $regex, 'callback' => $callback];
    }

    public function put(string $regex, callable $callback): void
    {
        $this->routes[] = ['method' => 'PUT', 'regex' => $regex, 'callback' => $callback];
    }

    public function delete(string $regex, callable $callback): void
    {
        $this->routes[] = ['method' => 'DELETE', 'regex' => $regex, 'callback' => $callback];
    }

    public function dispatch(string $method, string $path): void
    {
        $path = '/' . trim($path, '/');
        if ($path !== '/' && str_ends_with($path, '/')) {
            $path = rtrim($path, '/');
        }

        foreach ($this->routes as $route) {
            if (strtoupper($method) !== $route['method']) {
                continue;
            }
            if (preg_match($route['regex'], $path, $m)) {
                $args = [];
                for ($i = 1; isset($m[$i]); $i++) {
                    $args[] = $m[$i];
                }
                ($route['callback'])(...$args);
                return;
            }
        }
        JsonResponse::error('Route introuvable', 404);
    }
}
