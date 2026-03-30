<?php

declare(strict_types=1);

namespace EventFlow\Handlers;

use EventFlow\Auth;
use EventFlow\DB;
use EventFlow\JsonResponse;
use EventFlow\Request;

final class AuthHandler
{
    public static function register(): void
    {
        $b = Request::jsonBody();
        $email = isset($b['email']) ? trim((string) $b['email']) : '';
        $password = isset($b['password']) ? (string) $b['password'] : '';
        if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            JsonResponse::error('Email invalide', 422);
        }
        if (strlen($password) < 8) {
            JsonResponse::error('Mot de passe trop court (8 caractères min.)', 422);
        }
        $hash = password_hash($password, PASSWORD_DEFAULT);
        $pdo = DB::pdo();
        try {
            $st = $pdo->prepare('INSERT INTO users (email, password_hash, display_name) VALUES (?,?,?)');
            $st->execute([
                $email,
                $hash,
                isset($b['display_name']) ? (string) $b['display_name'] : null,
            ]);
        } catch (\PDOException $e) {
            if ($e->getCode() === '23000') {
                JsonResponse::error('Cet email est déjà utilisé', 409);
            }
            throw $e;
        }
        $id = (int) $pdo->lastInsertId();
        Auth::login($id);
        JsonResponse::send(self::userRow($id));
    }

    public static function login(): void
    {
        $b = Request::jsonBody();
        $email = isset($b['email']) ? trim((string) $b['email']) : '';
        $password = isset($b['password']) ? (string) $b['password'] : '';
        $st = DB::pdo()->prepare('SELECT id, password_hash FROM users WHERE email = ? LIMIT 1');
        $st->execute([$email]);
        $row = $st->fetch();
        if (!$row || !password_verify($password, $row['password_hash'])) {
            JsonResponse::error('Identifiants invalides', 401);
        }
        Auth::login((int) $row['id']);
        JsonResponse::send(self::userRow((int) $row['id']));
    }

    public static function logout(): void
    {
        Auth::logout();
        JsonResponse::send(['ok' => true]);
    }

    public static function me(): void
    {
        $uid = Auth::userId();
        if ($uid === null) {
            JsonResponse::send(null);
        }
        JsonResponse::send(self::userRow($uid));
    }

    /** @return array<string, mixed> */
    private static function userRow(int $id): array
    {
        $st = DB::pdo()->prepare(
            'SELECT id, email, display_name, contact_phone, created_at FROM users WHERE id = ? LIMIT 1'
        );
        $st->execute([$id]);
        $row = $st->fetch();
        if (!$row) {
            JsonResponse::error('Utilisateur introuvable', 404);
        }
        return $row;
    }
}
