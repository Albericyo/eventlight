<?php

declare(strict_types=1);

namespace EventFlow;

final class Request
{
    /** @return array<string, mixed> */
    public static function jsonBody(): array
    {
        $raw = file_get_contents('php://input') ?: '';
        if ($raw === '') {
            return [];
        }
        try {
            $decoded = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            JsonResponse::error('JSON invalide', 400);
        }
        return is_array($decoded) ? $decoded : [];
    }

    /** @return array<string, string> */
    public static function query(): array
    {
        return $_GET;
    }
}
