<?php

declare(strict_types=1);

namespace EventFlow;

final class JsonResponse
{
    public static function send(mixed $data, int $code = 200): never
    {
        http_response_code($code);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['status' => 'ok', 'data' => $data], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
        exit;
    }

    public static function error(string $message, int $code = 400, mixed $details = null): never
    {
        http_response_code($code);
        header('Content-Type: application/json; charset=utf-8');
        $payload = ['status' => 'error', 'data' => ['message' => $message]];
        if ($details !== null) {
            $payload['data']['details'] = $details;
        }
        echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
        exit;
    }
}
