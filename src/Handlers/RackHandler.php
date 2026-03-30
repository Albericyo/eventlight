<?php

declare(strict_types=1);

namespace EventFlow\Handlers;

use EventFlow\Auth;
use EventFlow\DB;
use EventFlow\JsonResponse;
use EventFlow\Request;

final class RackHandler
{
    public static function list(): void
    {
        $uid = Auth::requireUser();
        $q = Request::query();
        $pid = isset($q['project_id']) ? (int) $q['project_id'] : 0;
        if ($pid < 1) {
            JsonResponse::error('project_id requis', 422);
        }
        self::assertProjectOwner($pid, $uid);
        $st = DB::pdo()->prepare(
            'SELECT * FROM ef_rack_instances WHERE project_id=? ORDER BY sort_order, id'
        );
        $st->execute([$pid]);
        JsonResponse::send($st->fetchAll());
    }

    public static function create(): void
    {
        $uid = Auth::requireUser();
        $b = Request::jsonBody();
        $pid = (int) ($b['project_id'] ?? 0);
        if ($pid < 1) {
            JsonResponse::error('project_id requis', 422);
        }
        self::assertProjectOwner($pid, $uid);
        $name = isset($b['name']) ? trim((string) $b['name']) : '';
        if ($name === '') {
            JsonResponse::error('Nom requis', 422);
        }
        $pdo = DB::pdo();
        $st = $pdo->prepare(
            'INSERT INTO ef_rack_instances (project_id, name, size_u, rack_type, location, sort_order, notes)
             VALUES (?,?,?,?,?,?,?)'
        );
        $st->execute([
            $pid,
            $name,
            self::intRange($b['size_u'] ?? 12, 6, 42),
            self::enumRackType($b['rack_type'] ?? 'flight'),
            self::nullableString($b, 'location'),
            (int) ($b['sort_order'] ?? 0),
            self::nullableString($b, 'notes'),
        ]);
        JsonResponse::send(self::rackRow((int) $pdo->lastInsertId()));
    }

    public static function update(string $id): void
    {
        $uid = Auth::requireUser();
        $rid = (int) $id;
        $r = self::rackWithProject($rid);
        self::assertProjectOwner((int) $r['project_id'], $uid);
        $b = Request::jsonBody();
        $st = DB::pdo()->prepare(
            'UPDATE ef_rack_instances SET name=?, size_u=?, rack_type=?, location=?, sort_order=?, notes=?
             WHERE id=?'
        );
        $st->execute([
            isset($b['name']) ? trim((string) $b['name']) : $r['name'],
            self::intRange($b['size_u'] ?? $r['size_u'], 6, 42),
            self::enumRackType($b['rack_type'] ?? $r['rack_type']),
            array_key_exists('location', $b) ? self::nullableString($b, 'location') : $r['location'],
            (int) ($b['sort_order'] ?? $r['sort_order']),
            array_key_exists('notes', $b) ? self::nullableString($b, 'notes') : $r['notes'],
            $rid,
        ]);
        JsonResponse::send(self::rackRow($rid));
    }

    public static function delete(string $id): void
    {
        $uid = Auth::requireUser();
        $rid = (int) $id;
        $r = self::rackWithProject($rid);
        self::assertProjectOwner((int) $r['project_id'], $uid);
        DB::pdo()->prepare('DELETE FROM ef_rack_instances WHERE id=?')->execute([$rid]);
        JsonResponse::send(['deleted' => true]);
    }

    private static function assertProjectOwner(int $projectId, int $uid): void
    {
        $st = DB::pdo()->prepare('SELECT id FROM ef_projects WHERE id=? AND user_id=? LIMIT 1');
        $st->execute([$projectId, $uid]);
        if (!$st->fetch()) {
            JsonResponse::error('Projet introuvable', 404);
        }
    }

    /** @return array<string, mixed> */
    private static function rackWithProject(int $rackId): array
    {
        $st = DB::pdo()->prepare('SELECT * FROM ef_rack_instances WHERE id=? LIMIT 1');
        $st->execute([$rackId]);
        $row = $st->fetch();
        if (!$row) {
            JsonResponse::error('Rack introuvable', 404);
        }
        return $row;
    }

    /** @return array<string, mixed> */
    private static function rackRow(int $id): array
    {
        $st = DB::pdo()->prepare('SELECT * FROM ef_rack_instances WHERE id=? LIMIT 1');
        $st->execute([$id]);
        $row = $st->fetch();
        if (!$row) {
            JsonResponse::error('Rack introuvable', 404);
        }
        return $row;
    }

    /** @param array<string, mixed> $b */
    private static function nullableString(array $b, string $k): ?string
    {
        if (!array_key_exists($k, $b) || $b[$k] === null) {
            return null;
        }
        $v = trim((string) $b[$k]);
        return $v === '' ? null : $v;
    }

    private static function intRange(mixed $v, int $min, int $max): int
    {
        $i = is_numeric($v) ? (int) $v : $min;
        return max($min, min($max, $i));
    }

    private static function enumRackType(mixed $t): string
    {
        $t = (string) $t;
        return in_array($t, ['open', 'flight', 'wall'], true) ? $t : 'flight';
    }
}
