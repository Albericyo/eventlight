<?php

declare(strict_types=1);

namespace EventFlow\Handlers;

use EventFlow\Auth;
use EventFlow\DB;
use EventFlow\JsonResponse;
use EventFlow\Request;

final class SlotHandler
{
    public static function list(): void
    {
        $uid = Auth::requireUser();
        $q = Request::query();
        $rid = isset($q['rack_id']) ? (int) $q['rack_id'] : 0;
        if ($rid < 1) {
            JsonResponse::error('rack_id requis', 422);
        }
        self::assertRackOwner($rid, $uid);
        $st = DB::pdo()->prepare(
            'SELECT s.*, d.name AS device_name, d.manufacturer, d.category
             FROM ef_rack_slots s
             INNER JOIN ef_device_templates d ON d.id = s.device_template_id
             WHERE s.rack_id=?
             ORDER BY s.slot_u, s.slot_col'
        );
        $st->execute([$rid]);
        JsonResponse::send($st->fetchAll());
    }

    public static function create(): void
    {
        $uid = Auth::requireUser();
        $b = Request::jsonBody();
        $rackId = (int) ($b['rack_id'] ?? 0);
        $deviceId = (int) ($b['device_template_id'] ?? 0);
        if ($rackId < 1 || $deviceId < 1) {
            JsonResponse::error('rack_id et device_template_id requis', 422);
        }
        self::assertRackOwner($rackId, $uid);
        self::assertDeviceVisible($deviceId, $uid);
        $slotU = (int) ($b['slot_u'] ?? 1);
        $slotCol = (int) ($b['slot_col'] ?? 0);
        $pdo = DB::pdo();
        try {
            $st = $pdo->prepare(
                'INSERT INTO ef_rack_slots (rack_id, device_template_id, slot_u, slot_col, custom_name, custom_notes, color_hex, port_labels)
                 VALUES (?,?,?,?,?,?,?,?)'
            );
            $st->execute([
                $rackId,
                $deviceId,
                $slotU,
                $slotCol,
                self::nullableString($b, 'custom_name'),
                self::nullableString($b, 'custom_notes'),
                self::colorHex($b['color_hex'] ?? null),
                self::jsonOrNull($b['port_labels'] ?? null),
            ]);
        } catch (\PDOException $e) {
            if ($e->getCode() === '23000' && str_contains($e->getMessage(), 'uq_slot')) {
                JsonResponse::error('Emplacement déjà occupé (slot_u / slot_col)', 409);
            }
            throw $e;
        }
        JsonResponse::send(self::slotRow((int) $pdo->lastInsertId()));
    }

    public static function update(string $id): void
    {
        $uid = Auth::requireUser();
        $sid = (int) $id;
        $slot = self::slotWithRackProject($sid);
        self::assertProjectOwner((int) $slot['project_id'], $uid);
        $b = Request::jsonBody();
        $st = DB::pdo()->prepare(
            'UPDATE ef_rack_slots SET
             custom_name=?, custom_notes=?, color_hex=?, port_labels=?
             WHERE id=?'
        );
        $st->execute([
            array_key_exists('custom_name', $b) ? self::nullableString($b, 'custom_name') : $slot['custom_name'],
            array_key_exists('custom_notes', $b) ? self::nullableString($b, 'custom_notes') : $slot['custom_notes'],
            array_key_exists('color_hex', $b) ? self::colorHex($b['color_hex'] ?? null) : $slot['color_hex'],
            array_key_exists('port_labels', $b) ? self::jsonOrNull($b['port_labels']) : $slot['port_labels'],
            $sid,
        ]);
        JsonResponse::send(self::slotRow($sid));
    }

    public static function delete(string $id): void
    {
        $uid = Auth::requireUser();
        $sid = (int) $id;
        $slot = self::slotWithRackProject($sid);
        self::assertProjectOwner((int) $slot['project_id'], $uid);
        DB::pdo()->prepare('DELETE FROM ef_rack_slots WHERE id=?')->execute([$sid]);
        JsonResponse::send(['deleted' => true]);
    }

    /** @return array<string, mixed> */
    private static function slotWithRackProject(int $slotId): array
    {
        $sql = 'SELECT s.*, ri.project_id
                FROM ef_rack_slots s
                INNER JOIN ef_rack_instances ri ON ri.id = s.rack_id
                WHERE s.id=? LIMIT 1';
        $st = DB::pdo()->prepare($sql);
        $st->execute([$slotId]);
        $row = $st->fetch();
        if (!$row) {
            JsonResponse::error('Slot introuvable', 404);
        }
        return $row;
    }

    private static function assertProjectOwner(int $projectId, int $uid): void
    {
        $st = DB::pdo()->prepare('SELECT id FROM ef_projects WHERE id=? AND user_id=? LIMIT 1');
        $st->execute([$projectId, $uid]);
        if (!$st->fetch()) {
            JsonResponse::error('Projet introuvable', 404);
        }
    }

    private static function assertRackOwner(int $rackId, int $uid): void
    {
        $sql = 'SELECT ri.project_id FROM ef_rack_instances ri
                INNER JOIN ef_projects p ON p.id = ri.project_id
                WHERE ri.id=? AND p.user_id=? LIMIT 1';
        $st = DB::pdo()->prepare($sql);
        $st->execute([$rackId, $uid]);
        if (!$st->fetch()) {
            JsonResponse::error('Rack introuvable', 404);
        }
    }

    private static function assertDeviceVisible(int $deviceId, int $uid): void
    {
        $st = DB::pdo()->prepare(
            'SELECT id FROM ef_device_templates WHERE id=? AND (is_public=1 OR created_by=?) LIMIT 1'
        );
        $st->execute([$deviceId, $uid]);
        if (!$st->fetch()) {
            JsonResponse::error('Équipement introuvable', 404);
        }
    }

    /** @return array<string, mixed> */
    private static function slotRow(int $id): array
    {
        $st = DB::pdo()->prepare(
            'SELECT s.*, d.name AS device_name FROM ef_rack_slots s
             INNER JOIN ef_device_templates d ON d.id = s.device_template_id
             WHERE s.id=? LIMIT 1'
        );
        $st->execute([$id]);
        $row = $st->fetch();
        if (!$row) {
            JsonResponse::error('Slot introuvable', 404);
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

    private static function jsonOrNull(mixed $v): ?string
    {
        if ($v === null) {
            return null;
        }
        if (is_string($v)) {
            return $v;
        }
        return json_encode($v, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    }

    private static function colorHex(mixed $v): ?string
    {
        if ($v === null || $v === '') {
            return null;
        }
        $s = (string) $v;
        return preg_match('/^#[0-9A-Fa-f]{6}$/', $s) ? $s : null;
    }
}
