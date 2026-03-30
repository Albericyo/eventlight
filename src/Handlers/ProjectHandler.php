<?php

declare(strict_types=1);

namespace EventFlow\Handlers;

use EventFlow\Auth;
use EventFlow\DB;
use EventFlow\JsonResponse;
use EventFlow\Request;

final class ProjectHandler
{
    public static function list(): void
    {
        $uid = Auth::requireUser();
        $st = DB::pdo()->prepare(
            'SELECT id, user_id, name, client, venue, event_date, status, notes, created_at, updated_at
             FROM ef_projects WHERE user_id = ? ORDER BY updated_at DESC'
        );
        $st->execute([$uid]);
        JsonResponse::send($st->fetchAll());
    }

    public static function get(string $id): void
    {
        $uid = Auth::requireUser();
        $pid = (int) $id;
        $p = self::fetchProjectOwned($pid, $uid);
        $p['racks'] = self::racksWithSlots($pid);
        $p['connections'] = self::connectionsForProject($pid);
        $p['rack_links'] = self::rackLinksForProject($pid);
        JsonResponse::send($p);
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
            'INSERT INTO ef_projects (user_id, name, client, venue, event_date, status, notes)
             VALUES (?,?,?,?,?,?,?)'
        );
        $st->execute([
            $uid,
            $name,
            self::nullableString($b, 'client'),
            self::nullableString($b, 'venue'),
            self::nullableDate($b, 'event_date'),
            self::enumStatus($b['status'] ?? 'draft'),
            self::nullableString($b, 'notes'),
        ]);
        JsonResponse::send(self::getProjectRow((int) $pdo->lastInsertId()));
    }

    public static function update(string $id): void
    {
        $uid = Auth::requireUser();
        $pid = (int) $id;
        self::fetchProjectOwned($pid, $uid);
        $b = Request::jsonBody();
        $st = DB::pdo()->prepare(
            'UPDATE ef_projects SET name=?, client=?, venue=?, event_date=?, status=?, notes=?
             WHERE id=? AND user_id=?'
        );
        $st->execute([
            isset($b['name']) ? trim((string) $b['name']) : '',
            self::nullableString($b, 'client'),
            self::nullableString($b, 'venue'),
            self::nullableDate($b, 'event_date'),
            self::enumStatus($b['status'] ?? 'draft'),
            self::nullableString($b, 'notes'),
            $pid,
            $uid,
        ]);
        JsonResponse::send(self::getProjectRow($pid));
    }

    public static function delete(string $id): void
    {
        $uid = Auth::requireUser();
        $pid = (int) $id;
        self::fetchProjectOwned($pid, $uid);
        $st = DB::pdo()->prepare('DELETE FROM ef_projects WHERE id=? AND user_id=?');
        $st->execute([$pid, $uid]);
        JsonResponse::send(['deleted' => true]);
    }

    public static function duplicate(string $id): void
    {
        $uid = Auth::requireUser();
        $pid = (int) $id;
        $src = self::fetchProjectOwned($pid, $uid);
        $b = Request::jsonBody();
        $newName = isset($b['name']) ? trim((string) $b['name']) : ('Copie — ' . $src['name']);

        $pdo = DB::pdo();
        $pdo->beginTransaction();
        try {
            $st = $pdo->prepare(
                'INSERT INTO ef_projects (user_id, name, client, venue, event_date, status, notes)
                 VALUES (?,?,?,?,?,?,?)'
            );
            $st->execute([
                $uid,
                $newName,
                $src['client'],
                $src['venue'],
                $src['event_date'],
                'draft',
                $src['notes'],
            ]);
            $newPid = (int) $pdo->lastInsertId();

            $rackMap = [];
            $racks = $pdo->prepare('SELECT * FROM ef_rack_instances WHERE project_id=? ORDER BY sort_order, id');
            $racks->execute([$pid]);
            foreach ($racks->fetchAll() as $r) {
                $ins = $pdo->prepare(
                    'INSERT INTO ef_rack_instances (project_id, name, size_u, rack_type, location, sort_order, notes)
                     VALUES (?,?,?,?,?,?,?)'
                );
                $ins->execute([
                    $newPid,
                    $r['name'],
                    $r['size_u'],
                    $r['rack_type'],
                    $r['location'],
                    $r['sort_order'],
                    $r['notes'],
                ]);
                $rackMap[(int) $r['id']] = (int) $pdo->lastInsertId();
            }

            $slotMap = [];
            $slots = $pdo->prepare(
                'SELECT s.* FROM ef_rack_slots s
                 INNER JOIN ef_rack_instances ri ON ri.id = s.rack_id
                 WHERE ri.project_id = ?'
            );
            $slots->execute([$pid]);
            foreach ($slots->fetchAll() as $s) {
                $newRackId = $rackMap[(int) $s['rack_id']] ?? null;
                if ($newRackId === null) {
                    continue;
                }
                $ins = $pdo->prepare(
                    'INSERT INTO ef_rack_slots (rack_id, device_template_id, slot_u, slot_col, custom_name, custom_notes, color_hex, port_labels)
                     VALUES (?,?,?,?,?,?,?,?)'
                );
                $ins->execute([
                    $newRackId,
                    $s['device_template_id'],
                    $s['slot_u'],
                    $s['slot_col'],
                    $s['custom_name'],
                    $s['custom_notes'],
                    $s['color_hex'],
                    $s['port_labels'],
                ]);
                $slotMap[(int) $s['id']] = (int) $pdo->lastInsertId();
            }

            $conns = $pdo->prepare('SELECT * FROM ef_connections WHERE project_id=?');
            $conns->execute([$pid]);
            foreach ($conns->fetchAll() as $c) {
                $nsId = $slotMap[(int) $c['src_slot_id']] ?? null;
                $ndId = $slotMap[(int) $c['dst_slot_id']] ?? null;
                if ($nsId === null || $ndId === null) {
                    continue;
                }
                $ins = $pdo->prepare(
                    'INSERT INTO ef_connections (project_id, src_slot_id, src_port_id, dst_slot_id, dst_port_id,
                     cable_type, cable_length_m, cable_label, signal_type, notes)
                     VALUES (?,?,?,?,?,?,?,?,?,?)'
                );
                $ins->execute([
                    $newPid,
                    $nsId,
                    $c['src_port_id'],
                    $ndId,
                    $c['dst_port_id'],
                    $c['cable_type'],
                    $c['cable_length_m'],
                    $c['cable_label'],
                    $c['signal_type'],
                    $c['notes'],
                ]);
            }

            $links = $pdo->prepare('SELECT * FROM ef_project_racks_links WHERE project_id=?');
            $links->execute([$pid]);
            foreach ($links->fetchAll() as $l) {
                $a = $rackMap[(int) $l['rack_a_id']] ?? null;
                $bb = $rackMap[(int) $l['rack_b_id']] ?? null;
                if ($a === null || $bb === null) {
                    continue;
                }
                $ins = $pdo->prepare(
                    'INSERT INTO ef_project_racks_links (project_id, rack_a_id, rack_b_id, link_type, cable_length_m, notes)
                     VALUES (?,?,?,?,?,?)'
                );
                $ins->execute([$newPid, $a, $bb, $l['link_type'], $l['cable_length_m'], $l['notes']]);
            }

            $pdo->commit();
        } catch (\Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }

        JsonResponse::send(self::getProjectRow($newPid));
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

    /** @param array<string, mixed> $b */
    private static function nullableDate(array $b, string $k): ?string
    {
        if (!array_key_exists($k, $b) || $b[$k] === null || $b[$k] === '') {
            return null;
        }
        return (string) $b[$k];
    }

    private static function enumStatus(mixed $s): string
    {
        $s = (string) $s;
        return in_array($s, ['draft', 'confirmed', 'archived'], true) ? $s : 'draft';
    }

    /** @return array<string, mixed> */
    private static function getProjectRow(int $id): array
    {
        $st = DB::pdo()->prepare('SELECT * FROM ef_projects WHERE id=? LIMIT 1');
        $st->execute([$id]);
        $row = $st->fetch();
        if (!$row) {
            JsonResponse::error('Projet introuvable', 404);
        }
        return $row;
    }

    /** @return array<string, mixed> */
    private static function fetchProjectOwned(int $pid, int $uid): array
    {
        $st = DB::pdo()->prepare('SELECT * FROM ef_projects WHERE id=? AND user_id=? LIMIT 1');
        $st->execute([$pid, $uid]);
        $row = $st->fetch();
        if (!$row) {
            JsonResponse::error('Projet introuvable', 404);
        }
        return $row;
    }

    /** @return list<array<string, mixed>> */
    private static function racksWithSlots(int $projectId): array
    {
        $pdo = DB::pdo();
        $st = $pdo->prepare(
            'SELECT * FROM ef_rack_instances WHERE project_id=? ORDER BY sort_order, id'
        );
        $st->execute([$projectId]);
        $racks = $st->fetchAll();
        $slotSt = $pdo->prepare(
            'SELECT s.*, d.name AS device_name, d.manufacturer, d.category, d.rack_u, d.rack_width,
                    d.panel_front_svg, d.panel_rear_svg, d.panel_front_ports, d.panel_rear_ports, d.power_w
             FROM ef_rack_slots s
             INNER JOIN ef_device_templates d ON d.id = s.device_template_id
             WHERE s.rack_id = ?
             ORDER BY s.slot_u, s.slot_col'
        );
        foreach ($racks as &$r) {
            $slotSt->execute([(int) $r['id']]);
            $r['slots'] = $slotSt->fetchAll();
        }
        unset($r);
        return $racks;
    }

    /** @return list<array<string, mixed>> */
    private static function connectionsForProject(int $projectId): array
    {
        $sql = 'SELECT c.*,
                ri1.name AS src_rack_name, ri2.name AS dst_rack_name,
                s1.slot_u AS src_slot_u, s2.slot_u AS dst_slot_u,
                s1.rack_id AS src_rack_id, s1.custom_name AS src_custom_name, s1.device_template_id AS src_device_template_id,
                s2.rack_id AS dst_rack_id, s2.custom_name AS dst_custom_name, s2.device_template_id AS dst_device_template_id,
                d1.name AS src_device_name, d2.name AS dst_device_name
                FROM ef_connections c
                INNER JOIN ef_rack_slots s1 ON s1.id = c.src_slot_id
                INNER JOIN ef_rack_slots s2 ON s2.id = c.dst_slot_id
                INNER JOIN ef_rack_instances ri1 ON ri1.id = s1.rack_id
                INNER JOIN ef_rack_instances ri2 ON ri2.id = s2.rack_id
                INNER JOIN ef_device_templates d1 ON d1.id = s1.device_template_id
                INNER JOIN ef_device_templates d2 ON d2.id = s2.device_template_id
                WHERE c.project_id = ?
                ORDER BY c.id';
        $st = DB::pdo()->prepare($sql);
        $st->execute([$projectId]);
        return $st->fetchAll();
    }

    /** @return list<array<string, mixed>> */
    private static function rackLinksForProject(int $projectId): array
    {
        $sql = 'SELECT l.*, a.name AS rack_a_name, b.name AS rack_b_name
                FROM ef_project_racks_links l
                INNER JOIN ef_rack_instances a ON a.id = l.rack_a_id
                INNER JOIN ef_rack_instances b ON b.id = l.rack_b_id
                WHERE l.project_id=? ORDER BY l.id';
        $st = DB::pdo()->prepare($sql);
        $st->execute([$projectId]);
        return $st->fetchAll();
    }
}
