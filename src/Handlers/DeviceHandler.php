<?php

declare(strict_types=1);

namespace EventFlow\Handlers;

use EventFlow\Auth;
use EventFlow\DB;
use EventFlow\JsonResponse;
use EventFlow\Request;

final class DeviceHandler
{
    public static function list(): void
    {
        $uid = Auth::requireUser();
        $pdo = DB::pdo();
        $st = $pdo->prepare(
            'SELECT * FROM ef_device_templates
             WHERE is_public = 1 OR created_by = ?
             ORDER BY name'
        );
        $st->execute([$uid]);
        JsonResponse::send($st->fetchAll());
    }

    public static function get(string $id): void
    {
        $uid = Auth::requireUser();
        $did = (int) $id;
        $st = DB::pdo()->prepare(
            'SELECT * FROM ef_device_templates WHERE id=? AND (is_public=1 OR created_by=?) LIMIT 1'
        );
        $st->execute([$did, $uid]);
        $row = $st->fetch();
        if (!$row) {
            JsonResponse::error('Équipement introuvable', 404);
        }
        JsonResponse::send($row);
    }

    public static function create(): void
    {
        $uid = Auth::requireUser();
        $b = Request::jsonBody();
        $name = isset($b['name']) ? trim((string) $b['name']) : '';
        if ($name === '') {
            JsonResponse::error('Nom requis', 422);
        }
        $pdo = DB::pdo();
        $st = $pdo->prepare(
            'INSERT INTO ef_device_templates
             (name, manufacturer, category, rack_u, rack_width, weight_kg, power_w, depth_mm,
              panel_front_svg, panel_rear_svg, panel_front_ports, panel_rear_ports, notes, is_public, created_by)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
        );
        $st->execute([
            $name,
            self::nullableString($b, 'manufacturer'),
            self::enumCategory($b['category'] ?? 'custom'),
            self::intOr($b['rack_u'] ?? 1, 1, 1, 4),
            self::enumWidth($b['rack_width'] ?? 'full'),
            isset($b['weight_kg']) ? (float) $b['weight_kg'] : null,
            isset($b['power_w']) ? (int) $b['power_w'] : 0,
            isset($b['depth_mm']) ? (int) $b['depth_mm'] : null,
            $b['panel_front_svg'] ?? null,
            $b['panel_rear_svg'] ?? null,
            self::jsonOrNull($b['panel_front_ports'] ?? null),
            self::jsonOrNull($b['panel_rear_ports'] ?? null),
            self::nullableString($b, 'notes'),
            !empty($b['is_public']) ? 1 : 0,
            $uid,
        ]);
        JsonResponse::send(self::row((int) $pdo->lastInsertId()));
    }

    public static function update(string $id): void
    {
        $uid = Auth::requireUser();
        $did = (int) $id;
        self::requireWritable($did, $uid);
        $cur = self::row($did);
        $b = Request::jsonBody();
        $name = array_key_exists('name', $b) ? trim((string) $b['name']) : (string) $cur['name'];
        if ($name === '') {
            JsonResponse::error('Nom requis', 422);
        }
        $manufacturer = array_key_exists('manufacturer', $b)
            ? self::nullableString($b, 'manufacturer')
            : ($cur['manufacturer'] ?? null);
        $category = array_key_exists('category', $b)
            ? self::enumCategory($b['category'])
            : self::enumCategory($cur['category'] ?? 'custom');
        $rackU = array_key_exists('rack_u', $b)
            ? self::intOr($b['rack_u'], 1, 1, 4)
            : self::intOr($cur['rack_u'] ?? 1, 1, 1, 4);
        $rackWidth = array_key_exists('rack_width', $b)
            ? self::enumWidth($b['rack_width'])
            : self::enumWidth($cur['rack_width'] ?? 'full');
        $weightKg = array_key_exists('weight_kg', $b)
            ? (isset($b['weight_kg']) && $b['weight_kg'] !== '' ? (float) $b['weight_kg'] : null)
            : ($cur['weight_kg'] !== null ? (float) $cur['weight_kg'] : null);
        $powerW = array_key_exists('power_w', $b) ? (int) $b['power_w'] : (int) ($cur['power_w'] ?? 0);
        $depthMm = array_key_exists('depth_mm', $b)
            ? (isset($b['depth_mm']) && $b['depth_mm'] !== '' ? (int) $b['depth_mm'] : null)
            : ($cur['depth_mm'] !== null ? (int) $cur['depth_mm'] : null);
        $pfs = array_key_exists('panel_front_svg', $b) ? $b['panel_front_svg'] : $cur['panel_front_svg'];
        $prs = array_key_exists('panel_rear_svg', $b) ? $b['panel_rear_svg'] : $cur['panel_rear_svg'];
        $pfp = array_key_exists('panel_front_ports', $b) ? self::jsonOrNull($b['panel_front_ports']) : $cur['panel_front_ports'];
        $prp = array_key_exists('panel_rear_ports', $b) ? self::jsonOrNull($b['panel_rear_ports']) : $cur['panel_rear_ports'];
        $notes = array_key_exists('notes', $b) ? self::nullableString($b, 'notes') : ($cur['notes'] ?? null);
        $isPublic = array_key_exists('is_public', $b)
            ? (!empty($b['is_public']) ? 1 : 0)
            : (int) ($cur['is_public'] ?? 0);

        $st = DB::pdo()->prepare(
            'UPDATE ef_device_templates SET
             name=?, manufacturer=?, category=?, rack_u=?, rack_width=?, weight_kg=?, power_w=?, depth_mm=?,
             panel_front_svg=?, panel_rear_svg=?, panel_front_ports=?, panel_rear_ports=?, notes=?, is_public=?
             WHERE id=?'
        );
        $st->execute([
            $name,
            $manufacturer,
            $category,
            $rackU,
            $rackWidth,
            $weightKg,
            $powerW,
            $depthMm,
            $pfs,
            $prs,
            $pfp,
            $prp,
            $notes,
            $isPublic,
            $did,
        ]);
        JsonResponse::send(self::row($did));
    }

    public static function delete(string $id): void
    {
        $uid = Auth::requireUser();
        $did = (int) $id;
        self::requireWritable($did, $uid);
        $c = DB::pdo()->prepare('SELECT COUNT(*) FROM ef_rack_slots WHERE device_template_id=?');
        $c->execute([$did]);
        if ((int) $c->fetchColumn() > 0) {
            JsonResponse::error('Équipement encore utilisé dans un rack', 409);
        }
        DB::pdo()->prepare('DELETE FROM ef_device_templates WHERE id=?')->execute([$did]);
        JsonResponse::send(['deleted' => true]);
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

    private static function enumCategory(mixed $c): string
    {
        $c = (string) $c;
        $ok = ['audio', 'light', 'network', 'power', 'fx', 'custom'];
        return in_array($c, $ok, true) ? $c : 'custom';
    }

    private static function enumWidth(mixed $w): string
    {
        $w = (string) $w;
        return in_array($w, ['full', 'half', 'third'], true) ? $w : 'full';
    }

    private static function intOr(mixed $v, int $default, int $min, int $max): int
    {
        $i = is_numeric($v) ? (int) $v : $default;
        return max($min, min($max, $i));
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

    /** @return array<string, mixed> */
    private static function row(int $id): array
    {
        $st = DB::pdo()->prepare('SELECT * FROM ef_device_templates WHERE id=? LIMIT 1');
        $st->execute([$id]);
        $row = $st->fetch();
        if (!$row) {
            JsonResponse::error('Équipement introuvable', 404);
        }
        return $row;
    }

    /** @return array<string, mixed> */
    private static function requireWritable(int $id, int $uid): array
    {
        $st = DB::pdo()->prepare('SELECT * FROM ef_device_templates WHERE id=? LIMIT 1');
        $st->execute([$id]);
        $row = $st->fetch();
        if (!$row) {
            JsonResponse::error('Équipement introuvable', 404);
        }
        if ((int) ($row['created_by'] ?? 0) !== $uid) {
            JsonResponse::error('Modification réservée au créateur', 403);
        }
        return $row;
    }
}
