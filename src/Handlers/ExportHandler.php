<?php

declare(strict_types=1);

namespace EventFlow\Handlers;

use EventFlow\Auth;
use EventFlow\DB;
use EventFlow\JsonResponse;
use EventFlow\Request;

final class ExportHandler
{
    public static function pdfData(): void
    {
        $uid = Auth::requireUser();
        $q = Request::query();
        $pid = isset($q['project_id']) ? (int) $q['project_id'] : 0;
        if ($pid < 1) {
            JsonResponse::error('project_id requis', 422);
        }
        $st = DB::pdo()->prepare('SELECT * FROM ef_projects WHERE id=? AND user_id=? LIMIT 1');
        $st->execute([$pid, $uid]);
        $project = $st->fetch();
        if (!$project) {
            JsonResponse::error('Projet introuvable', 404);
        }

        $pdo = DB::pdo();
        $st = $pdo->prepare(
            'SELECT * FROM ef_rack_instances WHERE project_id=? ORDER BY sort_order, id'
        );
        $st->execute([$pid]);
        $racks = $st->fetchAll();

        $slotSql = $pdo->prepare(
            'SELECT s.*, d.name AS device_name, d.manufacturer, d.category, d.rack_u, d.rack_width,
                    d.panel_front_svg, d.panel_rear_svg, d.panel_front_ports, d.panel_rear_ports,
                    d.power_w, d.weight_kg
             FROM ef_rack_slots s
             INNER JOIN ef_device_templates d ON d.id = s.device_template_id
             WHERE s.rack_id = ?
             ORDER BY s.slot_u, s.slot_col'
        );

        $powerByRack = [];
        foreach ($racks as &$r) {
            $slotSql->execute([(int) $r['id']]);
            $slots = $slotSql->fetchAll();
            $sum = 0;
            foreach ($slots as $sl) {
                $sum += (int) ($sl['power_w'] ?? 0);
            }
            $powerByRack[(int) $r['id']] = $sum;
            $r['slots'] = $slots;
            $r['power_w_total'] = $sum;
        }
        unset($r);

        $st = $pdo->prepare(
            'SELECT c.*,
             s1.rack_id AS src_rack_id, s1.custom_name AS src_custom_name, s1.port_labels AS src_port_labels,
             s2.rack_id AS dst_rack_id, s2.custom_name AS dst_custom_name, s2.port_labels AS dst_port_labels,
             d1.name AS src_device_name, d1.panel_front_ports AS src_panel_fp, d1.panel_rear_ports AS src_panel_rp,
             d2.name AS dst_device_name, d2.panel_front_ports AS dst_panel_fp, d2.panel_rear_ports AS dst_panel_rp
             FROM ef_connections c
             INNER JOIN ef_rack_slots s1 ON s1.id = c.src_slot_id
             INNER JOIN ef_rack_slots s2 ON s2.id = c.dst_slot_id
             INNER JOIN ef_device_templates d1 ON d1.id = s1.device_template_id
             INNER JOIN ef_device_templates d2 ON d2.id = s2.device_template_id
             WHERE c.project_id = ?
             ORDER BY c.id'
        );
        $st->execute([$pid]);
        $connections = $st->fetchAll();

        foreach ($connections as &$c) {
            $c['src_label_display'] = self::portDisplayLabel(
                $c['src_port_id'],
                $c['src_port_labels'] ?? null,
                $c['src_panel_fp'] ?? null,
                $c['src_panel_rp'] ?? null
            );
            $c['dst_label_display'] = self::portDisplayLabel(
                $c['dst_port_id'],
                $c['dst_port_labels'] ?? null,
                $c['dst_panel_fp'] ?? null,
                $c['dst_panel_rp'] ?? null
            );
        }
        unset($c);

        $st = $pdo->prepare(
            'SELECT l.*, a.name AS rack_a_name, b.name AS rack_b_name
             FROM ef_project_racks_links l
             INNER JOIN ef_rack_instances a ON a.id = l.rack_a_id
             INNER JOIN ef_rack_instances b ON b.id = l.rack_b_id
             WHERE l.project_id=? ORDER BY l.id'
        );
        $st->execute([$pid]);
        $rackLinks = $st->fetchAll();

        $st = $pdo->prepare('SELECT id, email, display_name, contact_phone FROM users WHERE id=? LIMIT 1');
        $st->execute([(int) $project['user_id']]);
        $user = $st->fetch();

        $orphans = ConnectionHandler::computeOrphanPorts($pid);

        $totalPower = array_sum($powerByRack);
        JsonResponse::send([
            'project' => $project,
            'user' => $user,
            'racks' => $racks,
            'connections' => $connections,
            'rack_links' => $rackLinks,
            'orphan_ports' => $orphans,
            'totals' => [
                'power_w_all_racks' => $totalPower,
                'power_w_by_rack' => $powerByRack,
            ],
        ]);
    }

    private static function portDisplayLabel(
        string $portId,
        mixed $portLabelsJson,
        mixed $frontPorts,
        mixed $rearPorts
    ): string {
        $labels = [];
        if (is_string($portLabelsJson) && $portLabelsJson !== '') {
            $decoded = json_decode($portLabelsJson, true);
            if (is_array($decoded)) {
                $labels = $decoded;
            }
        }
        $business = $labels[$portId] ?? null;
        $generic = self::genericLabelFromPorts($portId, $frontPorts, $rearPorts);
        if ($business !== null && $business !== '') {
            return $generic !== '' ? ($generic . ' (' . $business . ')') : (string) $business;
        }
        return $generic;
    }

    private static function genericLabelFromPorts(string $portId, mixed $front, mixed $rear): string
    {
        foreach ([$front, $rear] as $blob) {
            if ($blob === null || $blob === '') {
                continue;
            }
            $arr = is_string($blob) ? json_decode($blob, true) : $blob;
            if (!is_array($arr)) {
                continue;
            }
            foreach ($arr as $p) {
                if (is_array($p) && ($p['id'] ?? null) === $portId) {
                    return (string) ($p['label'] ?? $portId);
                }
            }
        }
        return $portId;
    }
}
