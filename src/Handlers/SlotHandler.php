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
            'SELECT s.*, d.name AS device_name, d.manufacturer, d.category, d.rack_width
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
        $devH = self::templateRackU($deviceId);
        $rackW = self::templateRackWidth($deviceId);
        $slotCol = array_key_exists('slot_col', $b)
            ? (int) $b['slot_col']
            : ($rackW === 'half' ? self::firstFreeHalfColumn($rackId, $slotU, $devH, null) : 0);
        self::assertSlotColForWidth($rackW, $slotCol);
        self::assertSameRackUAtSameSlotStart($rackId, $slotU, $devH, null);
        self::validateSlotPosition(null, $rackId, $slotU, $slotCol, $devH, $rackW);
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
        $slotU = array_key_exists('slot_u', $b) ? (int) $b['slot_u'] : (int) $slot['slot_u'];
        $slotCol = array_key_exists('slot_col', $b) ? (int) $b['slot_col'] : (int) $slot['slot_col'];
        $devH = self::templateRackU((int) $slot['device_template_id']);
        $rackW = self::templateRackWidth((int) $slot['device_template_id']);
        if ($slotU !== (int) $slot['slot_u'] || $slotCol !== (int) $slot['slot_col']) {
            self::assertSlotColForWidth($rackW, $slotCol);
            self::assertSameRackUAtSameSlotStart((int) $slot['rack_id'], $slotU, $devH, $sid);
            self::validateSlotPosition($sid, (int) $slot['rack_id'], $slotU, $slotCol, $devH, $rackW);
        }
        try {
            $st = DB::pdo()->prepare(
                'UPDATE ef_rack_slots SET
                 custom_name=?, custom_notes=?, color_hex=?, port_labels=?, slot_u=?, slot_col=?
                 WHERE id=?'
            );
            $st->execute([
                array_key_exists('custom_name', $b) ? self::nullableString($b, 'custom_name') : $slot['custom_name'],
                array_key_exists('custom_notes', $b) ? self::nullableString($b, 'custom_notes') : $slot['custom_notes'],
                array_key_exists('color_hex', $b) ? self::colorHex($b['color_hex'] ?? null) : $slot['color_hex'],
                array_key_exists('port_labels', $b) ? self::jsonOrNull($b['port_labels']) : $slot['port_labels'],
                $slotU,
                $slotCol,
                $sid,
            ]);
        } catch (\PDOException $e) {
            if ($e->getCode() === '23000' && str_contains($e->getMessage(), 'uq_slot')) {
                JsonResponse::error('Emplacement déjà occupé (slot_u / slot_col)', 409);
            }
            throw $e;
        }
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

    private static function templateRackU(int $deviceTemplateId): int
    {
        $st = DB::pdo()->prepare('SELECT rack_u FROM ef_device_templates WHERE id=? LIMIT 1');
        $st->execute([$deviceTemplateId]);
        $r = $st->fetch();
        return max(1, (int) ($r['rack_u'] ?? 1));
    }

    private static function templateRackWidth(int $deviceTemplateId): string
    {
        $st = DB::pdo()->prepare('SELECT rack_width FROM ef_device_templates WHERE id=? LIMIT 1');
        $st->execute([$deviceTemplateId]);
        $r = $st->fetch();
        $w = (string) ($r['rack_width'] ?? 'full');
        return in_array($w, ['full', 'half', 'third'], true) ? $w : 'full';
    }

    private static function assertSlotColForWidth(string $rackWidth, int $slotCol): void
    {
        if ($rackWidth === 'full' && $slotCol !== 0) {
            JsonResponse::error('Un équipement pleine largeur doit être en colonne 0.', 422);
        }
        if ($rackWidth === 'half' && ($slotCol < 0 || $slotCol > 1)) {
            JsonResponse::error('Colonne invalide pour half (0 = gauche, 1 = droite).', 422);
        }
        if ($rackWidth === 'third' && ($slotCol < 0 || $slotCol > 2)) {
            JsonResponse::error('Colonne invalide pour third (0, 1 ou 2).', 422);
        }
    }

    /** Tous les équipements commençant au même U doivent avoir la même hauteur (rack_u). */
    private static function assertSameRackUAtSameSlotStart(int $rackId, int $slotU, int $rackUHeight, ?int $excludeSlotId): void
    {
        $sql = 'SELECT d.rack_u FROM ef_rack_slots s
                INNER JOIN ef_device_templates d ON d.id = s.device_template_id
                WHERE s.rack_id=? AND s.slot_u=?';
        $params = [$rackId, $slotU];
        if ($excludeSlotId !== null && $excludeSlotId > 0) {
            $sql .= ' AND s.id<>?';
            $params[] = $excludeSlotId;
        }
        $st = DB::pdo()->prepare($sql);
        $st->execute($params);
        while ($row = $st->fetch()) {
            if ((int) $row['rack_u'] !== $rackUHeight) {
                JsonResponse::error(
                    'Sur la même ligne U, tous les équipements doivent avoir la même hauteur (U).',
                    409
                );
            }
        }
    }

    private static function firstFreeHalfColumn(int $rackId, int $slotU, int $heightU, ?int $excludeSlotId): int
    {
        foreach ([0, 1] as $col) {
            if (! self::hasSlotConflict($excludeSlotId, $rackId, $slotU, $col, $heightU, 'half')) {
                return $col;
            }
        }
        JsonResponse::error('Aucune demi-place libre sur cette ligne.', 409);
    }

    /** Chevauchement U + largeur (full = toute la ligne, half/third = colonne). */
    private static function validateSlotPosition(
        ?int $excludeSlotId,
        int $rackId,
        int $slotU,
        int $slotCol,
        int $heightU,
        string $rackWidth
    ): void {
        $st = DB::pdo()->prepare('SELECT size_u FROM ef_rack_instances WHERE id=? LIMIT 1');
        $st->execute([$rackId]);
        $rack = $st->fetch();
        $sizeU = max(1, (int) ($rack['size_u'] ?? 12));
        if ($slotU < 1 || $slotU + $heightU - 1 > $sizeU) {
            JsonResponse::error('Position hors rack', 422);
        }
        if (self::hasSlotConflict($excludeSlotId, $rackId, $slotU, $slotCol, $heightU, $rackWidth)) {
            JsonResponse::error('Emplacement déjà occupé (chevauchement)', 409);
        }
    }

    private static function hasSlotConflict(
        ?int $excludeSlotId,
        int $rackId,
        int $slotU,
        int $slotCol,
        int $heightU,
        string $rackWidth
    ): bool {
        $sql = 'SELECT s.id, s.slot_u, s.slot_col, d.rack_u, d.rack_width
                FROM ef_rack_slots s
                INNER JOIN ef_device_templates d ON d.id = s.device_template_id
                WHERE s.rack_id=?';
        $params = [$rackId];
        if ($excludeSlotId !== null && $excludeSlotId > 0) {
            $sql .= ' AND s.id<>?';
            $params[] = $excludeSlotId;
        }
        $st = DB::pdo()->prepare($sql);
        $st->execute($params);
        while ($row = $st->fetch()) {
            $ou = (int) $row['slot_u'];
            $oh = max(1, (int) $row['rack_u']);
            if (! self::uRangesOverlap($slotU, $heightU, $ou, $oh)) {
                continue;
            }
            $theirW = self::normalizeRackWidth((string) ($row['rack_width'] ?? 'full'));
            $theirCol = (int) $row['slot_col'];
            if (self::horizontalConflict($rackWidth, $slotCol, $theirW, $theirCol)) {
                return true;
            }
        }
        return false;
    }

    private static function normalizeRackWidth(string $w): string
    {
        return in_array($w, ['full', 'half', 'third'], true) ? $w : 'full';
    }

    private static function uRangesOverlap(int $u1, int $h1, int $u2, int $h2): bool
    {
        $aHi = $u1 + $h1 - 1;
        $bHi = $u2 + $h2 - 1;
        return max($u1, $u2) <= min($aHi, $bHi);
    }

    /** Conflit horizontal si les deux occupent la même « tranche » de la ligne U. */
    private static function horizontalConflict(string $w1, int $c1, string $w2, int $c2): bool
    {
        $w1 = self::normalizeRackWidth($w1);
        $w2 = self::normalizeRackWidth($w2);
        if ($w1 === 'full' || $w2 === 'full') {
            return true;
        }
        return $c1 === $c2;
    }
}
