<?php

declare(strict_types=1);

namespace EventFlow;

final class Auth
{
    public static function startSession(): void
    {
        if (session_status() === PHP_SESSION_NONE) {
            session_set_cookie_params([
                'httponly' => true,
                'samesite' => 'Lax',
                'secure' => (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off'),
            ]);
            session_start();
        }
    }

    public static function userId(): ?int
    {
        self::startSession();
        $id = $_SESSION['user_id'] ?? null;
        return is_int($id) ? $id : (is_numeric($id) ? (int) $id : null);
    }

    public static function login(int $userId): void
    {
        self::startSession();
        session_regenerate_id(true);
        $_SESSION['user_id'] = $userId;
    }

    public static function logout(): void
    {
        self::startSession();
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $p = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
        }
        session_destroy();
    }

    public static function requireUser(): int
    {
        $uid = self::userId();
        if ($uid === null) {
            JsonResponse::error('Authentification requise', 401);
        }
        return $uid;
    }
}
