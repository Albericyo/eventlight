<?php

declare(strict_types=1);

namespace EventFlow\Handlers;

use EventFlow\Auth;
use EventFlow\DB;
use EventFlow\JsonResponse;
use EventFlow\Request;

final class ConnectionHandler
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

        $signal = isset($q['signal_type']) ? trim((string) $q['signal_type']) : '';
        $rackId = isset($q['rack_id']) ? (int) $q['rack_id'] : 0;
        $slotFilter = isset($q['slot_id']) ? (int) $q['slot_id'] : 0;

        $sql = 'SELECT c.*,
                ri1.name AS src_rack_name, ri2.name AS dst_rack_name,
                s1.slot_u AS src_slot_u, s1.custom_name AS src_slot_custom, d1.name AS src_device_name,
                s2.slot_u AS dst_slot_u, s2.custom_name AS dst_slot_custom, d2.name AS dst_device_name
                FROM ef_connections c
                INNER JOIN ef_rack_slots s1 ON s1.id = c.src_slot_id
                INNER JOIN ef_rack_instances ri1 ON ri1.id = s1.rack_id
                INNER JOIN ef_device_templates d1 ON d1.id = s1.device_template_id
                INNER JOIN ef_rack_slots s2 ON s2.id = c.dst_slot_id
                INNER JOIN ef_rack_instances ri2 ON ri2.id = s2.rack_id
                INNER JOIN ef_device_templates d2 ON d2.id = s2.device_template_id
                WHERE c.project_id = ?';
        $params = [$pid];
        if ($signal !== '' && $signal !== 'all') {
            $sql .= ' AND c.signal_type = ?';
            $params[] = $signal;
        }
        if ($rackId > 0) {
            $sql .= ' AND (ri1.id = ? OR ri2.id = ?)';
            $params[] = $rackId;
            $params[] = $rackId;
        }
        if ($slotFilter > 0) {
            $sql .= ' AND (c.src_slot_id = ? OR c.dst_slot_id = ?)';
            $params[] = $slotFilter;
            $params[] = $slotFilter;
        }
        $sql .= ' ORDER BY c.id';
        $st = DB::pdo()->prepare($sql);
        $st->execute($params);
        $rows = $st->fetchAll();

        if (!empty($q['orphan']) && $q['orphan'] === '1') {
            $orphans = self::computeOrphanPorts($pid);
            JsonResponse::send(['connections' => $rows, 'orphan_ports' => $orphans]);
            return;
        }

        JsonResponse::send($rows);
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
        $srcSlot = (int) ($b['src_slot_id'] ?? 0);
        $dstSlot = (int) ($b['dst_slot_id'] ?? 0);
        $srcPort = trim((string) ($b['src_port_id'] ?? ''));
        $dstPort = trim((string) ($b['dst_port_id'] ?? ''));
        if ($srcSlot < 1 || $dstSlot < 1 || $srcPort === '' || $dstPort === '') {
            JsonResponse::error('Slots et ports requis', 422);
        }
        self::assertSlotsInProject($pid, $srcSlot, $dstSlot);
        $pdo = DB::pdo();
        $st = $pdo->prepare(
            'INSERT INTO ef_connections (project_id, src_slot_id, src_port_id, dst_slot_id, dst_port_id,
             cable_type, cable_length_m, cable_label, signal_type, notes)
             VALUES (?,?,?,?,?,?,?,?,?,?)'
        );
        $st->execute([
            $pid,
            $srcSlot,
            $srcPort,
            $dstSlot,
            $dstPort,
            self::enumCable($b['cable_type'] ?? 'other'),
            isset($b['cable_length_m']) ? (float) $b['cable_length_m'] : null,
            self::nullableString($b, 'cable_label'),
            self::enumSignal($b['signal_type'] ?? 'other'),
            self::nullableString($b, 'notes'),
        ]);
        JsonResponse::send(self::connRow((int) $pdo->lastInsertId()));
    }

    public static function update(string $id): void
    {
        $uid = Auth::requireUser();
        $cid = (int) $id;
        $row = self::connWithProject($cid);
        self::assertProjectOwner((int) $row['project_id'], $uid);
        $b = Request::jsonBody();
        $pid = (int) $row['project_id'];
        $srcSlot = (int) ($b['src_slot_id'] ?? $row['src_slot_id']);
        $dstSlot = (int) ($b['dst_slot_id'] ?? $row['dst_slot_id']);
        self::assertSlotsInProject($pid, $srcSlot, $dstSlot);
        $st = DB::pdo()->prepare(
            'UPDATE ef_connections SET src_slot_id=?, src_port_id=?, dst_slot_id=?, dst_port_id=?,
             cable_type=?, cable_length_m=?, cable_label=?, signal_type=?, notes=?
             WHERE id=?'
        );
        $st->execute([
            $srcSlot,
            trim((string) ($b['src_port_id'] ?? $row['src_port_id'])),
            $dstSlot,
            trim((string) ($b['dst_port_id'] ?? $row['dst_port_id'])),
            self::enumCable($b['cable_type'] ?? $row['cable_type']),
            isset($b['cable_length_m']) ? (float) $b['cable_length_m'] : $row['cable_length_m'],
            array_key_exists('cable_label', $b) ? self::nullableString($b, 'cable_label') : $row['cable_label'],
            self::enumSignal($b['signal_type'] ?? $row['signal_type']),
            array_key_exists('notes', $b) ? self::nullableString($b, 'notes') : $row['notes'],
            $cid,
        ]);
        JsonResponse::send(self::connRow($cid));
    }

    public static function delete(string $id): void
    {
        $uid = Auth::requireUser();
        $cid = (int) $id;
        $row = self::connWithProject($cid);
        self::assertProjectOwner((int) $row['project_id'], $uid);
        DB::pdo()->prepare('DELETE FROM ef_connections WHERE id=?')->execute([$cid]);
        JsonResponse::send(['deleted' => true]);
    }

    /** @return list<array<string, mixed>> */
    public static function computeOrphanPorts(int $projectId): array
    {
        $pdo = DB::pdo();
        $st = $pdo->prepare(
            'SELECT s.id AS slot_id, s.rack_id, s.port_labels, d.panel_front_ports, d.panel_rear_ports
             FROM ef_rack_slots s
             INNER JOIN ef_rack_instances ri ON ri.id = s.rack_id
             INNER JOIN ef_device_templates d ON d.id = s.device_template_id
             WHERE ri.project_id = ?'
        );
        $st->execute([$projectId]);
        $slots = $st->fetchAll();

        $used = [];
        $cs = $pdo->prepare('SELECT src_slot_id, src_port_id, dst_slot_id, dst_port_id FROM ef_connections WHERE project_id=?');
        $cs->execute([$projectId]);
        foreach ($cs->fetchAll() as $c) {
            $used[(int) $c['src_slot_id'] . ':' . $c['src_port_id']] = true;
            $used[(int) $c['dst_slot_id'] . ':' . $c['dst_port_id']] = true;
        }

        $out = [];
        foreach ($slots as $s) {
            $ids = array_unique(array_merge(
                self::portIdsListFromJson($s['panel_front_ports']),
                self::portIdsListFromJson($s['panel_rear_ports'])
            ));
            foreach ($ids as $portId) {
                $key = (int) $s['slot_id'] . ':' . $portId;
                if (!isset($used[$key])) {
                    $out[] = [
                        'slot_id' => (int) $s['slot_id'],
                        'rack_id' => (int) $s['rack_id'],
                        'port_id' => $portId,
                    ];
                }
            }
        }
        return $out;
    }

    /** @return list<string> */
    private static function portIdsListFromJson(mixed $json): array
    {
        if ($json === null || $json === '') {
            return [];
        }
        $arr = is_string($json) ? json_decode($json, true) : $json;
        if (!is_array($arr)) {
            return [];
        }
        $m = [];
        foreach ($arr as $p) {
            if (is_array($p) && isset($p['id'])) {
                $m[] = (string) $p['id'];
            }
        }
        return $m;
    }

    private static function assertProjectOwner(int $projectId, int $uid): void
    {
        $st = DB::pdo()->prepare('SELECT id FROM ef_projects WHERE id=? AND user_id=? LIMIT 1');
        $st->execute([$projectId, $uid]);
        if (!$st->fetch()) {
            JsonResponse::error('Projet introuvable', 404);
        }
    }

    private static function assertSlotsInProject(int $projectId, int $srcSlotId, int $dstSlotId): void
    {
        $sql = 'SELECT COUNT(*) FROM ef_rack_slots s
                INNER JOIN ef_rack_instances ri ON ri.id = s.rack_id
                WHERE ri.project_id = ? AND s.id IN (?,?)';
        $st = DB::pdo()->prepare($sql);
        $st->execute([$projectId, $srcSlotId, $dstSlotId]);
        if ((int) $st->fetchColumn() !== 2) {
            JsonResponse::error('Slots invalides pour ce projet', 422);
        }
    }

    /** @return array<string, mixed> */
    private static function connWithProject(int $id): array
    {
        $sql = 'SELECT c.*, ri.project_id FROM ef_connections c
                INNER JOIN ef_rack_slots s ON s.id = c.src_slot_id
                INNER JOIN ef_rack_instances ri ON ri.id = s.rack_id
                WHERE c.id=? LIMIT 1';
        $st = DB::pdo()->prepare($sql);
        $st->execute([$id]);
        $row = $st->fetch();
        if (!$row) {
            JsonResponse::error('Connexion introuvable', 404);
        }
        return $row;
    }

    /** @return array<string, mixed> */
    private static function connRow(int $id): array
    {
        $st = DB::pdo()->prepare('SELECT * FROM ef_connections WHERE id=? LIMIT 1');
        $st->execute([$id]);
        $row = $st->fetch();
        if (!$row) {
            JsonResponse::error('Connexion introuvable', 404);
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

    private static function enumCable(mixed $v): string
    {
        $v = (string) $v;
        $ok = ['xlr3', 'xlr5', 'rj45', 'speakon', 'jack', 'bnc', 'dmx', 'power', 'fiber', 'other'];
        return in_array($v, $ok, true) ? $v : 'other';
    }

    private static function enumSignal(mixed $v): string
    {
        $v = (string) $v;
        $ok = ['audio_analog', 'audio_digital', 'dmx', 'ethernet', 'power', 'video', 'other'];
        return in_array($v, $ok, true) ? $v : 'other';
    }
}
