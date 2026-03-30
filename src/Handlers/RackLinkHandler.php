<?php

declare(strict_types=1);

namespace EventFlow\Handlers;

use EventFlow\Auth;
use EventFlow\DB;
use EventFlow\JsonResponse;
use EventFlow\Request;

final class RackLinkHandler
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
            'SELECT l.*, a.name AS rack_a_name, b.name AS rack_b_name
             FROM ef_project_racks_links l
             INNER JOIN ef_rack_instances a ON a.id = l.rack_a_id
             INNER JOIN ef_rack_instances b ON b.id = l.rack_b_id
             WHERE l.project_id=?
             ORDER BY l.id'
        );
        $st->execute([$pid]);
        JsonResponse::send($st->fetchAll());
    }

    public static function create(): void
    {
        $uid = Auth::requireUser();
        $b = Request::jsonBody();
        $pid = (int) ($b['project_id'] ?? 0);
        $a = (int) ($b['rack_a_id'] ?? 0);
        $bb = (int) ($b['rack_b_id'] ?? 0);
        if ($pid < 1 || $a < 1 || $bb < 1 || $a === $bb) {
            JsonResponse::error('project_id et deux racks distincts requis', 422);
        }
        self::assertProjectOwner($pid, $uid);
        self::assertRacksInProject($pid, $a, $bb);
        $pdo = DB::pdo();
        $st = $pdo->prepare(
            'INSERT INTO ef_project_racks_links (project_id, rack_a_id, rack_b_id, link_type, cable_length_m, notes)
             VALUES (?,?,?,?,?,?)'
        );
        $st->execute([
            $pid,
            $a,
            $bb,
            self::enumLink($b['link_type'] ?? 'other'),
            isset($b['cable_length_m']) ? (float) $b['cable_length_m'] : null,
            self::nullableString($b, 'notes'),
        ]);
        JsonResponse::send(self::row((int) $pdo->lastInsertId()));
    }

    public static function update(string $id): void
    {
        $uid = Auth::requireUser();
        $lid = (int) $id;
        $row = self::row($lid);
        self::assertProjectOwner((int) $row['project_id'], $uid);
        $b = Request::jsonBody();
        $pid = (int) $row['project_id'];
        $a = (int) ($b['rack_a_id'] ?? $row['rack_a_id']);
        $bb = (int) ($b['rack_b_id'] ?? $row['rack_b_id']);
        if ($a === $bb) {
            JsonResponse::error('Les deux racks doivent être distincts', 422);
        }
        self::assertRacksInProject($pid, $a, $bb);
        $st = DB::pdo()->prepare(
            'UPDATE ef_project_racks_links SET rack_a_id=?, rack_b_id=?, link_type=?, cable_length_m=?, notes=?
             WHERE id=?'
        );
        $st->execute([
            $a,
            $bb,
            self::enumLink($b['link_type'] ?? $row['link_type']),
            isset($b['cable_length_m']) ? (float) $b['cable_length_m'] : $row['cable_length_m'],
            array_key_exists('notes', $b) ? self::nullableString($b, 'notes') : $row['notes'],
            $lid,
        ]);
        JsonResponse::send(self::row($lid));
    }

    public static function delete(string $id): void
    {
        $uid = Auth::requireUser();
        $lid = (int) $id;
        $row = self::row($lid);
        self::assertProjectOwner((int) $row['project_id'], $uid);
        DB::pdo()->prepare('DELETE FROM ef_project_racks_links WHERE id=?')->execute([$lid]);
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

    private static function assertRacksInProject(int $projectId, int $rackA, int $rackB): void
    {
        $st = DB::pdo()->prepare(
            'SELECT COUNT(*) FROM ef_rack_instances WHERE project_id=? AND id IN (?,?)'
        );
        $st->execute([$projectId, $rackA, $rackB]);
        if ((int) $st->fetchColumn() !== 2) {
            JsonResponse::error('Racks invalides pour ce projet', 422);
        }
    }

    /** @return array<string, mixed> */
    private static function row(int $id): array
    {
        $st = DB::pdo()->prepare('SELECT * FROM ef_project_racks_links WHERE id=? LIMIT 1');
        $st->execute([$id]);
        $row = $st->fetch();
        if (!$row) {
            JsonResponse::error('Liaison introuvable', 404);
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

    private static function enumLink(mixed $v): string
    {
        $v = (string) $v;
        $ok = ['ethernet', 'audio_snake', 'dmx_snake', 'power', 'multicore', 'other'];
        return in_array($v, $ok, true) ? $v : 'other';
    }
}
