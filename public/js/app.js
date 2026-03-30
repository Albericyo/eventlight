(function () {
  'use strict';

  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => [...(el || document).querySelectorAll(s)];

  const state = {
    user: null,
    project: null,
    themeLight: false,
    selectedRackId: null,
    selectedSlotId: null,
    /** Vue rack : connecteurs face avant ou face arrière (aligné sur panel-editor). */
    rackFaceView: 'front',
    /** Mode connexion : 1er clic sur un port (source), 2e clic sur un autre port (destination). */
    connectionMode: false,
    connectionDraft: null,
  };

  const PANEL_W = { full: 450, half: 213, third: 140 };
  const PANEL_U_H = 44;
  const PANEL_SLOTS_PER_U = { full: 10, half: 5, third: 3 };

  function parsePanelPorts(raw) {
    if (raw == null || raw === '') return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') {
      try {
        const p = JSON.parse(raw);
        return Array.isArray(p) ? p : [];
      } catch {
        return [];
      }
    }
    return [];
  }

  function portCenterOnPanel(panelW, rackW, rackU, p) {
    const cols = PANEL_SLOTS_PER_U[rackW] != null ? PANEL_SLOTS_PER_U[rackW] : PANEL_SLOTS_PER_U.full;
    const cw = panelW / cols;
    const ch = PANEL_U_H;
    if (typeof p.gridCol === 'number' && typeof p.gridRow === 'number') {
      const col = Math.max(0, Math.min(cols - 1, Math.floor(p.gridCol)));
      const row = Math.max(0, Math.min(rackU - 1, Math.floor(p.gridRow)));
      return { x: (col + 0.5) * cw, y: (row + 0.5) * ch };
    }
    const x = Number(p.x) || 0;
    const y = Number(p.y) || 0;
    return { x, y };
  }

  /** Case grille (col,row) occupée par un port — aligné sur portCenterOnPanel / panel-editor. */
  function portGridCell(p, rw, panelW, ru) {
    const cols = PANEL_SLOTS_PER_U[rw] != null ? PANEL_SLOTS_PER_U[rw] : PANEL_SLOTS_PER_U.full;
    const cw = panelW / cols;
    const ch = PANEL_U_H;
    if (typeof p.gridCol === 'number' && typeof p.gridRow === 'number') {
      return {
        col: Math.max(0, Math.min(cols - 1, Math.floor(p.gridCol))),
        row: Math.max(0, Math.min(ru - 1, Math.floor(p.gridRow))),
      };
    }
    const x = Number(p.x) || 0;
    const y = Number(p.y) || 0;
    return {
      col: Math.max(0, Math.min(cols - 1, Math.floor(x / cw))),
      row: Math.max(0, Math.min(ru - 1, Math.floor(y / ch))),
    };
  }

  /** Grille + cadre panneau : montre les emplacements vides (cases sans connecteur). */
  function rackPanelGridSvg(panelW, panelH, rw, ru, occupied) {
    const cols = PANEL_SLOTS_PER_U[rw] != null ? PANEL_SLOTS_PER_U[rw] : PANEL_SLOTS_PER_U.full;
    const cw = panelW / cols;
    const ch = PANEL_U_H;
    let g = '';
    g += `<rect class="rack-panel-face" x="0" y="0" width="${panelW}" height="${panelH}" fill="rgba(0,0,0,.2)" stroke="rgba(255,255,255,.12)" stroke-width="1" pointer-events="none"/>`;
    for (let row = 0; row < ru; row++) {
      for (let c = 0; c < cols; c++) {
        const empty = !occupied.has(`${c},${row}`);
        const fill = empty ? 'rgba(255,255,255,.045)' : 'rgba(0,0,0,.1)';
        g += `<rect x="${c * cw}" y="${row * ch}" width="${cw}" height="${ch}" fill="${fill}" stroke="rgba(55,60,72,.65)" stroke-width="0.9" stroke-dasharray="3 4" pointer-events="none"/>`;
      }
    }
    for (let u = 1; u < ru; u++) {
      g += `<line x1="0" x2="${panelW}" y1="${u * PANEL_U_H}" y2="${u * PANEL_U_H}" stroke="rgba(90,96,110,.45)" stroke-width="1" pointer-events="none"/>`;
    }
    return g;
  }

  /** Aperçu SVG des ports (face avant ou arrière) pour une ligne du rack. */
  function buildRackFacePreview(slot, face) {
    const key = face === 'rear' ? 'panel_rear_ports' : 'panel_front_ports';
    const ports = parsePanelPorts(slot[key]);
    const PS = typeof PortShapes !== 'undefined' ? PortShapes : null;
    const rw = slot.rack_width || 'full';
    const panelW = PANEL_W[rw] || PANEL_W.full;
    const ru = Math.max(1, Math.min(4, Number(slot.rack_u || 1)));
    const panelH = PANEL_U_H * ru;
    const fv = face === 'rear' ? 'rear' : 'front';

    const occupied = new Set();
    for (const p of ports) {
      const { col, row } = portGridCell(p, rw, panelW, ru);
      occupied.add(`${col},${row}`);
    }
    const gridSvg = rackPanelGridSvg(panelW, panelH, rw, ru, occupied);

    if (!ports.length) {
      return `<svg class="rack-slot-face-svg rack-slot-face-svg--with-grid" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${panelW} ${panelH}" preserveAspectRatio="xMidYMid meet">${gridSvg}<text x="${panelW / 2}" y="${panelH / 2}" dominant-baseline="middle" text-anchor="middle" fill="rgba(140,145,160,.92)" pointer-events="none" style="font-family:var(--font),monospace;font-size:12px">Face sans connecteur</text></svg>`;
    }
    if (!PS) {
      return `<svg class="rack-slot-face-svg rack-slot-face-svg--with-grid" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${panelW} ${panelH}" preserveAspectRatio="xMidYMid meet">${gridSvg}<text x="${panelW / 2}" y="${panelH / 2}" dominant-baseline="middle" text-anchor="middle" fill="rgba(140,145,160,.88)" pointer-events="none" style="font-family:var(--font),monospace;font-size:11px">${ports.length} connecteur(s)</text></svg>`;
    }

    const colsForPorts = PANEL_SLOTS_PER_U[rw] != null ? PANEL_SLOTS_PER_U[rw] : PANEL_SLOTS_PER_U.full;
    const cellWForPorts = panelW / colsForPorts;
    let body = '';
    for (const p of ports) {
      const { x, y } = portCenterOnPanel(panelW, rw, ru, p);
      const t = PS.defaultType(p.type || 'xlr_f');
      const inner = PS.shapeToSvgString(t, p.color || '#5a6a85', cellWForPorts);
      const pid = escAttr(p.id != null ? p.id : '');
      body += `<g class="rack-port-g" transform="translate(${x},${y})" data-slot-id="${slot.id}" data-port-id="${pid}" data-face="${fv}" style="pointer-events:all">${inner}</g>`;
    }
    return `<svg class="rack-slot-face-svg rack-slot-face-svg--with-grid" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${panelW} ${panelH}" preserveAspectRatio="xMidYMid meet">${gridSvg}${body}</svg>`;
  }

  const ICONS = {
    dash: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1" y="1" width="6" height="6" rx="1"/><rect x="9" y="1" width="6" height="6" rx="1"/><rect x="1" y="9" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/></svg>',
    rack: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1" y="2" width="14" height="3" rx="1"/><rect x="1" y="6.5" width="14" height="3" rx="1"/><rect x="1" y="11" width="14" height="3" rx="1"/></svg>',
    face: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1" y="4" width="14" height="8" rx="1"/><circle cx="4" cy="8" r="1.5"/><circle cx="8" cy="8" r="1.5"/><circle cx="12" cy="8" r="1.5"/></svg>',
    patch: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 4h3M2 8h3M2 12h3M11 4h3M11 8h3M11 12h3M5 4q3 0 3 4t3 4M5 8h6M5 12q3 0 3-4t3-4"/></svg>',
    pdf: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 1h6l4 4v10H4V1z"/><path d="M9 1v5h5"/><path d="M6 10h4M6 12.5h2"/></svg>',
  };

  const CAT_COL = {
    audio: '#f74f4f',
    light: '#7c4dff',
    network: '#2ec97e',
    power: '#f5a623',
    fx: '#4f8ef7',
    custom: '#607d8b',
  };

  /** Vérifie qu’aucun autre slot (même colonne) ne chevauche [slotU, slotU+heightU-1]. */
  function slotRangeFree(slots, slotU, heightU, slotCol, excludeSlotId) {
    const lo = slotU;
    const hi = slotU + heightU - 1;
    for (const s of slots) {
      if (excludeSlotId != null && String(s.id) === String(excludeSlotId)) continue;
      if (Number(s.slot_col || 0) !== Number(slotCol)) continue;
      const h = Math.max(1, Number(s.rack_u || 1));
      const olo = Number(s.slot_u);
      const ohi = olo + h - 1;
      if (Math.max(lo, olo) <= Math.min(hi, ohi)) return false;
    }
    return true;
  }

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function escAttr(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;');
  }

  function findSlotInRacks(racks, slotId) {
    for (const r of racks || []) {
      const s = (r.slots || []).find((x) => String(x.id) === String(slotId));
      if (s) return { rack: r, slot: s };
    }
    return null;
  }

  const CABLE_TYPE_FR = {
    xlr3: 'XLR 3 pts',
    xlr5: 'XLR 5 pts',
    rj45: 'RJ45',
    speakon: 'Speakon',
    jack: 'Jack 6,35',
    bnc: 'BNC',
    dmx: 'DMX',
    power: 'Alimentation',
    fiber: 'Fibre',
    other: 'Autre',
  };
  const SIGNAL_TYPE_FR = {
    audio_analog: 'Audio analogique',
    audio_digital: 'Audio numérique',
    dmx: 'DMX / lumière',
    ethernet: 'Ethernet',
    power: 'Alimentation',
    video: 'Vidéo',
    other: 'Autre',
  };

  function cableTypeFr(v) {
    if (v == null || v === '') return '—';
    return CABLE_TYPE_FR[v] || String(v);
  }

  function signalTypeFr(v) {
    if (v == null || v === '') return '—';
    return SIGNAL_TYPE_FR[v] || String(v);
  }

  function parsePortLabelsMap(raw) {
    if (raw == null || raw === '') return {};
    if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) return raw;
    if (typeof raw === 'string') {
      try {
        const o = JSON.parse(raw);
        return typeof o === 'object' && o !== null && !Array.isArray(o) ? o : {};
      } catch {
        return {};
      }
    }
    return {};
  }

  function portPatchLabel(portId, slot) {
    const pl = parsePortLabelsMap(slot?.port_labels);
    const pid = String(portId ?? '');
    const friendly = pl[pid];
    if (friendly) return `${pid} — ${friendly}`;
    return pid;
  }

  function cableMetaFieldsHtml(idPrefix) {
    const sigOpts = Object.keys(SIGNAL_TYPE_FR)
      .map((k) => `<option value="${escAttr(k)}">${esc(SIGNAL_TYPE_FR[k])}</option>`)
      .join('');
    const cabOpts = Object.keys(CABLE_TYPE_FR)
      .map((k) => `<option value="${escAttr(k)}">${esc(CABLE_TYPE_FR[k])}</option>`)
      .join('');
    return `
            <div class="ef-modal-section-hd field-label" style="margin-top:14px">Câblage terrain</div>
            <div class="muted" style="font-size:11px;margin-bottom:8px;line-height:1.35">Aide les équipes à savoir quel câble sortir, comment il est repéré (flight case, couleur) et la longueur.</div>
            <label class="field-label">Type de signal</label>
            <select class="ef-select" id="${idPrefix}-sig">${sigOpts}</select>
            <label class="field-label">Type de câble</label>
            <select class="ef-select" id="${idPrefix}-cab">${cabOpts}</select>
            <label class="field-label">Longueur (m)</label>
            <input class="ef-inp" id="${idPrefix}-len" type="text" placeholder="ex. 10 ou 15,5" autocomplete="off" />
            <label class="field-label">Repère / étiquette du câble</label>
            <input class="ef-inp" id="${idPrefix}-clab" type="text" placeholder="ex. Fly bleu, case 12…" autocomplete="off" />
            <label class="field-label">Note pour la pose</label>
            <textarea class="ef-ta" id="${idPrefix}-note" rows="2" placeholder="Face arrière, chemin goulotte…"></textarea>`;
  }

  function readCableMetaFromBackdrop(backdrop, idPrefix) {
    const lenRaw = backdrop.querySelector(`#${idPrefix}-len`)?.value?.trim() || '';
    let cable_length_m = null;
    if (lenRaw) {
      const n = parseFloat(lenRaw.replace(',', '.'));
      if (Number.isFinite(n)) cable_length_m = n;
    }
    return {
      signal_type: backdrop.querySelector(`#${idPrefix}-sig`)?.value || 'other',
      cable_type: backdrop.querySelector(`#${idPrefix}-cab`)?.value || 'other',
      cable_length_m,
      cable_label: backdrop.querySelector(`#${idPrefix}-clab`)?.value?.trim() || null,
      notes: backdrop.querySelector(`#${idPrefix}-note`)?.value?.trim() || null,
    };
  }

  /** Modale saisie (remplace prompt). Renvoie la chaîne trimée, ou null si annulation / champ vide. */
  function showModalPrompt(opts) {
    const {
      title,
      message = '',
      defaultValue = '',
      placeholder = '',
      confirmText = 'OK',
      cancelText = 'Annuler',
      inputMode = 'text',
      min,
      max,
    } = opts;
    return new Promise((resolve) => {
      const inpType = inputMode === 'number' ? 'number' : 'text';
      const minAttr = min != null ? ` min="${Number(min)}"` : '';
      const maxAttr = max != null ? ` max="${Number(max)}"` : '';
      const html = `
        <div class="ef-modal" role="dialog" aria-modal="true">
          <div class="ef-modal-title">${esc(title)}</div>
          ${message ? `<div class="ef-modal-msg muted">${esc(message)}</div>` : ''}
          <input type="${inpType}" class="ef-inp ef-modal-input" value="${esc(defaultValue)}" placeholder="${esc(placeholder)}"${minAttr}${maxAttr} />
          <div class="ef-modal-actions">
            <button type="button" class="btn" data-act="cancel">${esc(cancelText)}</button>
            <button type="button" class="btn btn-p" data-act="ok">${esc(confirmText)}</button>
          </div>
        </div>`;
      const backdrop = document.createElement('div');
      backdrop.className = 'ef-modal-backdrop';
      backdrop.innerHTML = html;
      document.body.appendChild(backdrop);
      document.body.style.overflow = 'hidden';
      const inp = backdrop.querySelector('.ef-modal-input');
      const finish = (val) => {
        backdrop.remove();
        document.body.style.overflow = '';
        resolve(val);
      };
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) finish(null);
      });
      backdrop.querySelector('[data-act="cancel"]').addEventListener('click', () => finish(null));
      backdrop.querySelector('[data-act="ok"]').addEventListener('click', () => {
        const raw = inp.value.trim();
        if (raw === '') {
          finish(null);
          return;
        }
        if (inputMode === 'number') {
          const n = Number(raw);
          if (Number.isNaN(n)) {
            finish(null);
            return;
          }
          finish(String(n));
          return;
        }
        finish(raw);
      });
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          backdrop.querySelector('[data-act="ok"]').click();
        }
        if (e.key === 'Escape') finish(null);
      });
      setTimeout(() => {
        inp.focus();
        if (typeof inp.select === 'function') inp.select();
      }, 10);
    });
  }

  /** Modale message (remplace alert). */
  function showModalAlert(opts) {
    const { title, message = '', okText = 'OK' } = opts;
    return new Promise((resolve) => {
      const html = `
        <div class="ef-modal" role="alertdialog">
          <div class="ef-modal-title">${esc(title)}</div>
          ${message ? `<div class="ef-modal-msg">${esc(message)}</div>` : ''}
          <div class="ef-modal-actions">
            <button type="button" class="btn btn-p" data-act="ok">${esc(okText)}</button>
          </div>
        </div>`;
      const backdrop = document.createElement('div');
      backdrop.className = 'ef-modal-backdrop';
      backdrop.innerHTML = html;
      document.body.appendChild(backdrop);
      document.body.style.overflow = 'hidden';
      const finish = () => {
        document.removeEventListener('keydown', onKey);
        backdrop.remove();
        document.body.style.overflow = '';
        resolve();
      };
      const onKey = (e) => {
        if (e.key === 'Enter' || e.key === 'Escape') {
          e.preventDefault();
          finish();
        }
      };
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) finish();
      });
      const btn = backdrop.querySelector('[data-act="ok"]');
      btn.addEventListener('click', finish);
      document.addEventListener('keydown', onKey);
      setTimeout(() => btn.focus(), 10);
    });
  }

  /** Formulaire connexion (remplace 4× prompt). */
  function showModalConnection(slotsFlat) {
    return new Promise((resolve) => {
      const opts = slotsFlat.map((x) => `<option value="${x.id}">${esc(x.label)}</option>`).join('');
      const html = `
        <div class="ef-modal ef-modal--wide" role="dialog" aria-modal="true">
          <div class="ef-modal-title">Nouvelle connexion</div>
          <div class="ef-modal-msg muted">Slots et identifiants de ports (ids des connecteurs sur les faces équipement).</div>
          <div class="ef-modal-fields">
            <label class="field-label">Équipement source</label>
            <select class="ef-select" id="efc-s1">${opts}</select>
            <label class="field-label">ID port source</label>
            <input class="ef-inp" id="efc-p1" type="text" placeholder="ex. p1" autocomplete="off" />
            <label class="field-label">Équipement destination</label>
            <select class="ef-select" id="efc-s2">${opts}</select>
            <label class="field-label">ID port destination</label>
            <input class="ef-inp" id="efc-p2" type="text" placeholder="ex. p2" autocomplete="off" />
            ${cableMetaFieldsHtml('efc-meta')}
          </div>
          <div class="ef-modal-actions">
            <button type="button" class="btn" data-act="cancel">Annuler</button>
            <button type="button" class="btn btn-p" data-act="ok">Créer</button>
          </div>
        </div>`;
      const backdrop = document.createElement('div');
      backdrop.className = 'ef-modal-backdrop';
      backdrop.innerHTML = html;
      document.body.appendChild(backdrop);
      document.body.style.overflow = 'hidden';
      const s1 = backdrop.querySelector('#efc-s1');
      const s2 = backdrop.querySelector('#efc-s2');
      const p1 = backdrop.querySelector('#efc-p1');
      const p2 = backdrop.querySelector('#efc-p2');
      if (slotsFlat.length >= 2) {
        s2.value = String(slotsFlat[1].id);
      }
      const ms = backdrop.querySelector('#efc-meta-sig');
      const mc = backdrop.querySelector('#efc-meta-cab');
      if (ms) ms.value = 'audio_analog';
      if (mc) mc.value = 'xlr3';
      const finish = (val) => {
        document.removeEventListener('keydown', onKeyEsc);
        backdrop.remove();
        document.body.style.overflow = '';
        resolve(val);
      };
      const onKeyEsc = (e) => {
        if (e.key === 'Escape') finish(null);
      };
      document.addEventListener('keydown', onKeyEsc);
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) finish(null);
      });
      backdrop.querySelector('[data-act="cancel"]').addEventListener('click', () => finish(null));
      backdrop.querySelector('[data-act="ok"]').addEventListener('click', () => {
        const pid1 = p1.value.trim();
        const pid2 = p2.value.trim();
        if (!pid1 || !pid2) {
          finish(null);
          return;
        }
        finish({
          src_slot_id: Number(s1.value),
          src_port_id: pid1,
          dst_slot_id: Number(s2.value),
          dst_port_id: pid2,
          ...readCableMetaFromBackdrop(backdrop, 'efc-meta'),
        });
      });
      p2.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          backdrop.querySelector('[data-act="ok"]').click();
        }
      });
      setTimeout(() => p1.focus(), 10);
    });
  }

  /** Après avoir choisi deux ports : type de câble, longueur, repères (annulation = null). */
  function showModalCableDetails(opts) {
    const { summary = '' } = opts || {};
    return new Promise((resolve) => {
      const html = `
        <div class="ef-modal ef-modal--wide" role="dialog" aria-modal="true">
          <div class="ef-modal-title">Matériel pour cette liaison</div>
          ${summary ? `<div class="ef-modal-msg muted" style="white-space:pre-wrap;font-size:12px;line-height:1.4">${esc(summary)}</div>` : ''}
          <div class="ef-modal-fields">${cableMetaFieldsHtml('efc-d')}</div>
          <div class="ef-modal-actions">
            <button type="button" class="btn" data-act="cancel">Annuler</button>
            <button type="button" class="btn btn-p" data-act="ok">Enregistrer la liaison</button>
          </div>
        </div>`;
      const backdrop = document.createElement('div');
      backdrop.className = 'ef-modal-backdrop';
      backdrop.innerHTML = html;
      document.body.appendChild(backdrop);
      document.body.style.overflow = 'hidden';
      const ds = backdrop.querySelector('#efc-d-sig');
      const dc = backdrop.querySelector('#efc-d-cab');
      if (ds) ds.value = 'audio_analog';
      if (dc) dc.value = 'xlr3';
      const finish = (val) => {
        document.removeEventListener('keydown', onKeyEsc);
        backdrop.remove();
        document.body.style.overflow = '';
        resolve(val);
      };
      const onKeyEsc = (e) => {
        if (e.key === 'Escape') finish(null);
      };
      document.addEventListener('keydown', onKeyEsc);
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) finish(null);
      });
      backdrop.querySelector('[data-act="cancel"]').addEventListener('click', () => finish(null));
      backdrop.querySelector('[data-act="ok"]').addEventListener('click', () => {
        finish(readCableMetaFromBackdrop(backdrop, 'efc-d'));
      });
      setTimeout(() => backdrop.querySelector('#efc-d-sig')?.focus(), 10);
    });
  }

  function parseHash() {
    const h = (location.hash || '#/login').replace(/^#/, '');
    const parts = h.split('/').filter(Boolean);
    return { parts, raw: h };
  }

  async function loadMe() {
    try {
      state.user = await api.get('/api/ef/auth/me');
    } catch {
      state.user = null;
    }
  }

  function nav(to) {
    location.hash = to;
  }

  function mount(html) {
    $('#app').innerHTML = html;
    bindShellCommon();
  }

  function bindShellCommon() {
    $('#btn-logout')?.addEventListener('click', async () => {
      await api.post('/api/ef/auth/logout', {});
      state.user = null;
      nav('#/login');
    });
    $('#btn-toggle-theme')?.addEventListener('click', () => {
      state.themeLight = !state.themeLight;
      $('#app').classList.toggle('light', state.themeLight);
    });
    $('#btn-new-proj-top')?.addEventListener('click', async () => {
      const name = await showModalPrompt({
        title: 'Nouveau projet',
        message: 'Nom du projet',
        placeholder: 'Mon événement',
        confirmText: 'Créer',
        cancelText: 'Annuler',
      });
      if (name == null) return;
      const p = await api.post('/api/ef/projects', { name });
      nav('#/project/' + p.id + '/rack');
    });
    $('#link-devices')?.addEventListener('click', (e) => {
      e.preventDefault();
      nav('#/devices');
    });
  }

  function shellLayout({ breadcrumb, main, navActive, projectId }) {
    const u = state.user;
    const navBtns = [
      { i: 0, hash: '#/projects', title: 'Dashboard', icon: ICONS.dash, dis: false },
      { i: 1, hash: projectId ? '#/project/' + projectId + '/rack' : null, title: 'Rack builder', icon: ICONS.rack, dis: !projectId },
      { i: 2, hash: '#/devices', title: 'Face panel (bibliothèque)', icon: ICONS.face, dis: false },
      { i: 3, hash: projectId ? '#/project/' + projectId + '/patch' : null, title: 'Patch', icon: ICONS.patch, dis: !projectId },
      { i: 4, hash: projectId ? '#/project/' + projectId + '/export' : null, title: 'Export PDF', icon: ICONS.pdf, dis: !projectId },
    ];
    const rail = navBtns
      .map((b) => {
        const active = navActive === b.i ? ' active' : '';
        const dis = b.dis || !b.hash;
        if (dis) {
          return `<button type="button" class="ni" disabled title="${esc(b.title)}">${b.icon}</button>`;
        }
        return `<button type="button" class="ni${active}" data-nav-hash="${b.hash}" title="${esc(b.title)}">${b.icon}</button>`;
      })
      .join('');
    return `
<div class="shell" id="shell-root">
  <header class="topbar">
    <div class="logo-t">EventFlow <span>// Event'Light</span></div>
    <div class="sep"></div>
    <div class="breadcrumb">${breadcrumb}</div>
    <div class="tb-actions">
      <button type="button" class="btn btn-p" id="btn-new-proj-top">+ Nouveau projet</button>
      <div class="sep"></div>
      <button type="button" class="toggle-theme" id="btn-toggle-theme" title="Thème">◐</button>
      <div class="sep"></div>
      ${u ? `<span class="muted" style="font-size:12px">${esc(u.email)}</span><button type="button" class="btn" id="btn-logout">Déconnexion</button>` : ''}
    </div>
  </header>
  <nav class="nav-rail">${rail}</nav>
  <main class="main">${main}</main>
</div>`;
  }

  function wireNavRail() {
    $$('[data-nav-hash]').forEach((btn) =>
      btn.addEventListener('click', () => {
        const h = btn.getAttribute('data-nav-hash');
        if (h) nav(h);
      })
    );
  }

  function mountShell(opts) {
    mount(shellLayout(opts));
    wireNavRail();
    if (state.themeLight) $('#app').classList.add('light');
    $('#app').classList.remove('rack-conn-mode');
  }

  function badgeStatus(st) {
    if (st === 'confirmed') return '<span class="badge bd-green">confirmé</span>';
    if (st === 'archived') return '<span class="badge bd-red">archivé</span>';
    return '<span class="badge bd-amber">draft</span>';
  }

  function miniRackFromProject(p) {
    const racks = p.racks || [];
    const segs = [];
    const colors = ['#f5a623', '#4f8ef7', '#f74f4f', '#7c4dff', '#2e3140'];
    if (!racks.length) {
      return '<div class="mini-rack"><div class="mini-rack-seg" style="width:100%;background:#2e3140"></div></div>';
    }
    let i = 0;
    for (const r of racks) {
      const slots = r.slots || [];
      const used = slots.reduce((s, sl) => s + Number(sl.rack_u || 1), 0);
      const pct = r.size_u ? Math.max(8, Math.round((used / r.size_u) * (100 / Math.max(racks.length, 1)))) : 15;
      const col = colors[i % colors.length];
      segs.push(`<div class="mini-rack-seg" style="width:${pct}%;background:${col}"></div>`);
      i++;
    }
    return `<div class="mini-rack">${segs.join('')}</div>`;
  }

  async function viewLogin() {
    mount(`
<div class="auth-wrap">
  <div class="auth-card">
    <h1>Connexion</h1>
    <form id="f-login">
      <label>Email</label>
      <input name="email" type="email" required autocomplete="username" />
      <label>Mot de passe</label>
      <input name="password" type="password" required minlength="8" autocomplete="current-password" />
      <button type="submit" class="btn btn-p">Se connecter</button>
      <p class="muted" style="margin-top:12px"><a href="#/register" class="link-accent">Créer un compte</a></p>
      <p id="login-err" class="err"></p>
    </form>
  </div>
</div>`);
    $('#f-login').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const fd = new FormData(ev.target);
      $('#login-err').textContent = '';
      try {
        await api.post('/api/ef/auth/login', { email: fd.get('email'), password: fd.get('password') });
        await loadMe();
        nav('#/projects');
      } catch (e) {
        $('#login-err').textContent = e.message;
      }
    });
  }

  async function viewRegister() {
    mount(`
<div class="auth-wrap">
  <div class="auth-card">
    <h1>Inscription</h1>
    <form id="f-reg">
      <label>Email</label>
      <input name="email" type="email" required />
      <label>Mot de passe</label>
      <input name="password" type="password" required minlength="8" />
      <label>Nom affiché</label>
      <input name="display_name" type="text" />
      <button type="submit" class="btn btn-p">S'inscrire</button>
      <p class="muted" style="margin-top:12px"><a href="#/login" class="link-accent">Déjà un compte</a></p>
      <p id="reg-err" class="err"></p>
    </form>
  </div>
</div>`);
    $('#f-reg').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const fd = new FormData(ev.target);
      $('#reg-err').textContent = '';
      try {
        await api.post('/api/ef/auth/register', {
          email: fd.get('email'),
          password: fd.get('password'),
          display_name: fd.get('display_name') || null,
        });
        await loadMe();
        nav('#/projects');
      } catch (e) {
        $('#reg-err').textContent = e.message;
      }
    });
  }

  async function viewDashboard() {
    if (!state.user) {
      nav('#/login');
      return;
    }
    let projects = [];
    let devices = [];
    let totalConn = 0;
    try {
      projects = await api.get('/api/ef/projects');
      devices = await api.get('/api/ef/devices');
      if (projects.length <= 20) {
        const full = await Promise.all(projects.map((p) => api.get('/api/ef/projects/' + p.id)));
        totalConn = full.reduce((s, x) => s + (x.connections || []).length, 0);
      } else {
        totalConn = '—';
      }
    } catch (e) {
      mountShell({
        breadcrumb: '<b>Dashboard</b>',
        main: `<div class="view-pad"><p class="err">${esc(e.message)}</p></div>`,
        navActive: 0,
        projectId: null,
      });
      return;
    }

    const cards = projects
      .map((p) => {
        const dot = '#4f8ef7';
        const venue = [p.client, p.venue].filter(Boolean).join(' · ');
        return `<div class="proj-card" data-pid="${p.id}">
          <div class="proj-name"><span class="proj-dot" style="background:${dot}"></span>${esc(p.name)}</div>
          <div class="proj-client">Client : ${esc(venue || '—')}</div>
          <div class="proj-meta">${badgeStatus(p.status)} <span class="badge bd-blue">EventFlow</span></div>
          ${miniRackFromProject({ racks: [] })}
          <div class="proj-footer"><span>projet</span><span>${esc(String(p.event_date || p.updated_at || '').slice(0, 10))}</span></div>
        </div>`;
      })
      .join('');

    mountShell({
      breadcrumb: '<b>Dashboard</b>',
      main: `<div class="view-pad">
        <div class="stats-grid">
          <div class="stat-card"><div class="stat-label">Projets</div><div class="stat-val">${projects.length}</div><div class="stat-sub">dans votre espace</div></div>
          <div class="stat-card"><div class="stat-label">Équipements</div><div class="stat-val">${devices.length}</div><div class="stat-sub">bibliothèque</div></div>
          <div class="stat-card"><div class="stat-label">Connexions patch</div><div class="stat-val">${totalConn}</div><div class="stat-sub">tous projets</div></div>
          <div class="stat-card"><div class="stat-label">Exports PDF</div><div class="stat-val">—</div><div class="stat-sub">bientôt compteur</div></div>
        </div>
        <div class="section-hd"><div class="section-title">Projets récents</div><button type="button" class="btn" id="link-devices">Bibliothèque équipements</button></div>
        <div class="projects-grid">${cards || '<p class="muted">Aucun projet — utilisez « Nouveau projet ».</p>'}</div>
      </div>`,
      navActive: 0,
      projectId: null,
    });

    $$('.proj-card[data-pid]').forEach((el) =>
      el.addEventListener('click', () => nav('#/project/' + el.getAttribute('data-pid') + '/rack'))
    );
  }

  function rackRowsVisual(rack, slots, face) {
    const rid = rack.id;
    const fv = face === 'rear' ? 'rear' : 'front';
    const size = Number(rack.size_u || 12);
    const sorted = [...slots].sort((a, b) => Number(a.slot_u) - Number(b.slot_u));
    const rows = [];
    let u = 1;
    while (u <= size) {
      const slot = sorted.find((s) => Number(s.slot_u) === u);
      if (!slot) {
        rows.push({ kind: 'empty', u });
        u++;
        continue;
      }
      const h = Math.min(Number(slot.rack_u || 1), size - u + 1);
      rows.push({ kind: 'slot', slot, h });
      u += h;
    }
    return rows
      .map((row) => {
        if (row.kind === 'empty') {
          return `<div class="rack-slot-r rack-slot-r--split" data-rack-id="${rid}">
            <div class="rack-slot-graphic">
              <div class="slot-num-r">${row.u}</div>
              <div class="slot-body-r rack-drop-zone" data-drop-u="${row.u}" data-rack-id="${rid}"><span style="font-size:11px;color:#1e2228">— vide —</span></div>
            </div>
            <div class="rack-slot-outside-name rack-slot-outside-name--empty"></div>
          </div>`;
        }
        const s = row.slot;
        const col = CAT_COL[s.category] || '#4f8ef7';
        const h = row.h;
        const cls = h >= 2 ? ' slot-2u' : '';
        const faceStrip = buildRackFacePreview(s, fv);
        const stripCls = h >= 2 ? ' slot-face-strip--2u' : '';
        const num =
          h >= 2
            ? `<div class="slot-num-r" style="height:100%;display:flex;flex-direction:column;justify-content:space-between;padding:2px 0"><span>${row.slot.slot_u}</span><span>${Number(row.slot.slot_u) + h - 1}</span></div>`
            : `<div class="slot-num-r">${s.slot_u}</div>`;
        const nm = esc(s.custom_name || s.device_name);
        const dragAttr = state.connectionMode ? 'false' : 'true';
        return `<div class="rack-slot-r${cls} rack-slot-r--split rack-slot-row" data-rack-id="${rid}" draggable="${dragAttr}" data-slot-id="${s.id}" title="Glisser vers une ligne vide pour déplacer">
          <div class="rack-slot-graphic">
            ${num}
            <div class="slot-body-r occ${cls} slot-body-with-face slot-body--ports-only" style="border-color:${col}55;background:${col}10;border-left:3px solid ${col}">
              <div class="slot-face-strip${stripCls}">${faceStrip}</div>
            </div>
          </div>
          <div class="rack-slot-outside-name">
            <div class="rack-slot-outside-title" style="color:${col}">${nm}</div>
            <div class="rack-slot-outside-meta">${h}U · ${esc(s.rack_width || 'full')} · ${esc(s.category)}</div>
          </div>
        </div>`;
      })
      .join('');
  }

  /** Deux clics sur les ports : 1er = source, 2e = destination, puis saisie câble / repères (mode connexion). */
  function wireRackPortConnectionClicks(projectId, racks) {
    $$('.rack-port-g').forEach((portG) => {
      portG.addEventListener('click', async (e) => {
        if (!state.connectionMode) return;
        e.preventDefault();
        e.stopPropagation();
        const pidRaw = portG.getAttribute('data-port-id');
        if (pidRaw == null || String(pidRaw).trim() === '') {
          void showModalAlert({
            title: 'Port',
            message: 'Ce connecteur n’a pas d’identifiant de port — éditez le modèle dans la bibliothèque (face panel).',
          });
          return;
        }
        const portId = String(pidRaw);
        const slotId = portG.getAttribute('data-slot-id');
        const faceTag = portG.getAttribute('data-face') || 'front';
        const draft = state.connectionDraft;
        if (!draft) {
          state.connectionDraft = { slotId, portId, face: faceTag };
          portG.classList.add('rack-port-selected');
          return;
        }
        if (String(draft.slotId) === String(slotId) && String(draft.portId) === String(portId)) {
          $$('.rack-port-g.rack-port-selected').forEach((el) => el.classList.remove('rack-port-selected'));
          state.connectionDraft = null;
          return;
        }
        const src = draft;
        const dstSlotId = slotId;
        const dstPortId = portId;
        const foundA = findSlotInRacks(racks, src.slotId);
        const foundB = findSlotInRacks(racks, dstSlotId);
        const na = foundA
          ? `${foundA.rack.name} U${foundA.slot.slot_u} — ${foundA.slot.custom_name || foundA.slot.device_name}`
          : `Slot ${src.slotId}`;
        const nb = foundB
          ? `${foundB.rack.name} U${foundB.slot.slot_u} — ${foundB.slot.custom_name || foundB.slot.device_name}`
          : `Slot ${dstSlotId}`;
        const pa = portPatchLabel(src.portId, foundA?.slot);
        const pb = portPatchLabel(dstPortId, foundB?.slot);
        const summary = `${na}\nport : ${pa}\n↓\n${nb}\nport : ${pb}`;
        const meta = await showModalCableDetails({ summary });
        if (!meta) return;
        $$('.rack-port-g.rack-port-selected').forEach((el) => el.classList.remove('rack-port-selected'));
        state.connectionDraft = null;
        try {
          await api.post('/api/ef/connections', {
            project_id: Number(projectId),
            src_slot_id: Number(src.slotId),
            src_port_id: String(src.portId),
            dst_slot_id: Number(dstSlotId),
            dst_port_id: String(dstPortId),
            signal_type: meta.signal_type,
            cable_type: meta.cable_type,
            cable_length_m: meta.cable_length_m,
            cable_label: meta.cable_label,
            notes: meta.notes,
          });
          viewProjectRack(projectId);
        } catch (err) {
          await showModalAlert({ title: 'Connexion impossible', message: err.message || 'Erreur' });
        }
      });
    });
  }

  async function viewProjectRack(projectId) {
    if (!state.user) {
      nav('#/login');
      return;
    }
    let data;
    try {
      data = await api.get('/api/ef/projects/' + projectId);
    } catch (e) {
      mountShell({
        breadcrumb: '<a href="#/projects">Dashboard</a> / <b>Erreur</b>',
        main: `<div class="view-pad"><p class="err">${esc(e.message)}</p></div>`,
        navActive: 1,
        projectId,
      });
      return;
    }
    state.project = data;
    const racks = data.racks || [];
    const rackId = state.selectedRackId && racks.find((r) => String(r.id) === String(state.selectedRackId)) ? state.selectedRackId : racks[0]?.id;
    state.selectedRackId = rackId;
    const rack = racks.find((r) => String(r.id) === String(rackId)) || racks[0];
    const rackSlots = rack ? rack.slots || [] : [];
    const allSlots = racks.flatMap((r) => r.slots || []);
    const devices = await api.get('/api/ef/devices');
    const byCat = {};
    for (const d of devices) {
      const c = d.category || 'custom';
      if (!byCat[c]) byCat[c] = [];
      byCat[c].push(d);
    }
    const lib = Object.keys(byCat)
      .sort()
      .map((cat) => {
        const head = `<div style="padding:4px 8px 1px;font-size:12px;color:var(--muted);letter-spacing:1px;text-transform:uppercase;margin-top:4px">${esc(cat)}</div>`;
        const items = byCat[cat]
          .map(
            (d) =>
              `<div class="lib-item" draggable="true" data-did="${d.id}" title="Glisser-déposer sur une ligne U vide"><div class="li-name">${esc(d.name)}</div><div class="li-meta"><span class="badge bd-green" style="font-size:12px">${d.rack_u}U</span><span class="badge bd-blue" style="font-size:12px">${esc(d.rack_width)}</span></div></div>`
          )
          .join('');
        return head + items;
      })
      .join('');

    const usedU = allSlots.reduce((s, sl) => s + Number(sl.rack_u || 1), 0);
    const totalW = allSlots.reduce((s, sl) => s + Number(sl.power_w || 0), 0);
    const usedInRack = rackSlots.reduce((s, sl) => s + Number(sl.rack_u || 1), 0);
    const faceV = state.rackFaceView === 'rear' ? 'rear' : 'front';
    const connMode = state.connectionMode;
    let rackHtmlInner = '';
    if (racks.length === 0) {
      rackHtmlInner = '<p class="muted">Aucun rack — ajoutez-en un.</p>';
    } else {
      rackHtmlInner = racks
        .map(
          (r) =>
            `<section class="rack-section" data-rack-id="${r.id}">
          <div class="rack-section-head">
            <span class="rack-section-title">${esc(r.name)}</span>
            <span class="rack-section-meta muted">${r.size_u}U · ${(r.slots || []).length} équip.</span>
          </div>
          <div class="rack-vis rack-vis--stacked">${rackRowsVisual(r, r.slots || [], faceV)}</div>
        </section>`
        )
        .join('');
    }
    const rackHtml = `<div class="all-racks-stack">${rackHtmlInner}</div>`;

    const selSlot = state.selectedSlotId
      ? allSlots.find((s) => String(s.id) === String(state.selectedSlotId))
      : allSlots[0];
    state.selectedSlotId = selSlot?.id;
    const col = selSlot ? CAT_COL[selSlot.category] || '#f74f4f' : '#444';
    const detail = selSlot
      ? `<div class="detail-area">
          <div style="height:3px;border-radius:2px;background:${col};margin-bottom:10px"></div>
          <div class="detail-name">${esc(selSlot.custom_name || selSlot.device_name)}</div>
          <div class="detail-sub">${selSlot.rack_u}U · ${esc(selSlot.rack_width)} · ${esc(selSlot.category)}</div>
          <div class="field-label">port_labels (JSON)</div>
          <textarea class="ef-ta" id="slot-pl-json" rows="3" placeholder='{"p1":"Lyre jardin"}'>${esc(selSlot.port_labels || '')}</textarea>
          <div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap">
            <button type="button" class="btn btn-p" id="btn-save-pl">Enregistrer labels</button>
            <button type="button" class="btn" id="btn-edit-face">Face panel ↗</button>
            <button type="button" class="btn" id="btn-slots-rack" style="color:var(--red);border-color:var(--red)">Slots détail</button>
          </div>
        </div>`
      : '<div class="detail-area muted">Sélectionnez un slot (clic sur une ligne U).</div>';

    mountShell({
      breadcrumb: `<a href="#/projects">Dashboard</a> / <span class="muted">${esc(data.name)}</span> / <b>Rack builder</b>`,
      main: `<div class="view-pad">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px">
          <div>
            <div style="font-family:var(--display);font-size:17px;font-weight:700">${esc(data.name)}</div>
            <div class="muted" style="margin-top:2px">${racks.length} rack(s) · <span style="color:var(--accent)">${usedU}U utilisés</span> · ${totalW}W</div>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            ${racks.map((r) => `<button type="button" class="btn ${String(r.id) === String(rackId) ? '' : ''}" data-sel-rack="${r.id}" style="${String(r.id) === String(rackId) ? 'border-color:var(--accent);color:var(--accent)' : ''}">${esc(r.name)}</button>`).join('')}
            <button type="button" class="btn" id="btn-add-rack">+ Rack</button>
            <button type="button" class="btn btn-p" onclick="location.hash='#/project/${projectId}/export'">Exporter PDF ↗</button>
            <button type="button" class="btn" id="btn-proj-settings">Projet</button>
          </div>
        </div>
        <div class="rb-layout">
          <div class="rb-lib">
            <div class="rb-section">Bibliothèque</div>
            <div style="padding:6px 8px;border-bottom:1px solid var(--border)"><input class="ef-inp" placeholder="Rechercher…" id="lib-search" style="font-size:12px" /></div>
            ${lib}
          </div>
          <div class="rb-main">
            ${rack ? `<div style="display:flex;gap:8px;align-items:center;width:100%;max-width:360px">
              <input class="ef-inp" id="rack-name-inp" value="${esc(rack.name)}" />
              <select class="ef-select" style="width:90px;margin-top:0" id="rack-size-sel">${[6, 8, 12, 16, 20, 24, 32, 42].map((u) => `<option value="${u}" ${Number(rack.size_u) === u ? 'selected' : ''}>${u}U</option>`).join('')}</select>
            </div><button type="button" class="btn" id="btn-save-rack-meta" style="align-self:start">Appliquer rack</button>` : ''}
            ${rack ? `<div class="rack-face-toggle" role="group" aria-label="Face du rack">
              <span class="muted rack-face-lbl">Vue connecteurs</span>
              <button type="button" class="btn rack-face-btn${faceV === 'front' ? ' rack-face-active' : ''}" data-rack-face="front">Face avant</button>
              <button type="button" class="btn rack-face-btn${faceV === 'rear' ? ' rack-face-active' : ''}" data-rack-face="rear">Face arrière</button>
            </div>` : ''}
            ${racks.length ? `<div class="rack-toolbar-extra" style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;width:100%;max-width:520px">
              <button type="button" class="btn${connMode ? ' btn-p' : ''}" id="btn-conn-mode">Mode connexion</button>
              <span class="muted" style="font-size:11px;line-height:1.2">${connMode ? 'Cliquez sur un port source puis sur un port destination : une fenêtre permet d’indiquer le type de câble, la longueur et les repères (voir aussi la Patch list).' : ''}</span>
            </div>` : ''}
            ${rackHtml}
            <div class="muted" style="font-size:11px;margin-top:6px;max-width:520px;line-height:1.35">Déplacer : glisser une ligne vers une ligne <strong>vide</strong> du <strong>même rack</strong> (même hauteur U requise). Ajouter : glisser depuis la bibliothèque. Le nom est affiché à droite du schéma.</div>
            <div class="muted"><span style="color:var(--text);font-weight:500">${usedU}</span> U équipés (projet) · <span style="color:var(--text);font-weight:500">${totalW}W</span>${rack ? ` · <span style="color:var(--muted)">Rack sélectionné « ${esc(rack.name)} » : ${usedInRack}/${rack.size_u}U</span>` : ''}</div>
          </div>
          <div class="rb-panel">
            <div class="rb-panel-tabs">
              <button type="button" class="rpt active">Détail</button>
              <button type="button" class="rpt" id="tab-patch-short">Patch ↗</button>
            </div>
            ${detail}
          </div>
        </div>
      </div>`,
      navActive: 1,
      projectId,
    });
    wireNavRail();
    $('#app').classList.toggle('rack-conn-mode', state.connectionMode);
    wireRackPortConnectionClicks(projectId, racks);

    $$('[data-sel-rack]').forEach((b) =>
      b.addEventListener('click', () => {
        state.selectedRackId = b.getAttribute('data-sel-rack');
        state.selectedSlotId = null;
        viewProjectRack(projectId);
      })
    );
    $$('.rack-face-btn[data-rack-face]').forEach((b) =>
      b.addEventListener('click', () => {
        state.rackFaceView = b.getAttribute('data-rack-face');
        viewProjectRack(projectId);
      })
    );
    $('#btn-conn-mode')?.addEventListener('click', () => {
      state.connectionMode = !state.connectionMode;
      state.connectionDraft = null;
      viewProjectRack(projectId);
    });
    $$('.rack-slot-row[data-slot-id]').forEach((el) => {
      let didDrag = false;
      el.addEventListener('dragstart', (e) => {
        didDrag = false;
        const sid = Number(el.getAttribute('data-slot-id'));
        const payload = JSON.stringify({ type: 'slot', slotId: sid });
        e.dataTransfer.setData('application/json', payload);
        e.dataTransfer.setData('text/plain', payload);
        e.dataTransfer.effectAllowed = 'move';
        try {
          e.dataTransfer.setDragImage(el, 0, 0);
        } catch {
          /* ignore */
        }
        el.classList.add('ef-dragging');
      });
      el.addEventListener('drag', () => {
        didDrag = true;
      });
      el.addEventListener('dragend', () => {
        el.classList.remove('ef-dragging');
      });
      el.addEventListener('click', (e) => {
        if (didDrag) {
          e.preventDefault();
          e.stopPropagation();
          didDrag = false;
          return;
        }
        state.selectedSlotId = el.getAttribute('data-slot-id');
        viewProjectRack(projectId);
      });
    });

    $$('.lib-item[data-did]').forEach((el) => {
      el.addEventListener('dragstart', (e) => {
        const payload = JSON.stringify({ type: 'template', deviceId: Number(el.getAttribute('data-did')) });
        e.dataTransfer.setData('application/json', payload);
        e.dataTransfer.setData('text/plain', payload);
        e.dataTransfer.effectAllowed = 'copy';
        el.classList.add('ef-dragging');
      });
      el.addEventListener('dragend', () => el.classList.remove('ef-dragging'));
      el.addEventListener('dblclick', async () => {
        if (!rack) return;
        const su = await showModalPrompt({
          title: 'Placer en U',
          message: 'Position U (1–' + rack.size_u + ')',
          defaultValue: '1',
          inputMode: 'number',
          min: 1,
          max: rack.size_u,
          confirmText: 'Placer',
          cancelText: 'Annuler',
        });
        if (su == null) return;
        await api.post('/api/ef/slots', {
          rack_id: rack.id,
          device_template_id: Number(el.getAttribute('data-did')),
          slot_u: Number(su),
          slot_col: 0,
        });
        viewProjectRack(projectId);
      });
    });

    $$('.rack-drop-zone').forEach((zone) => {
      zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = e.dataTransfer.effectAllowed === 'copy' ? 'copy' : 'move';
        zone.classList.add('rack-drop-hover');
      });
      zone.addEventListener('dragleave', (e) => {
        if (!zone.contains(e.relatedTarget)) zone.classList.remove('rack-drop-hover');
      });
      zone.addEventListener('drop', async (e) => {
        e.preventDefault();
        zone.classList.remove('rack-drop-hover');
        const targetRackId = zone.getAttribute('data-rack-id');
        const targetRack = racks.find((r) => String(r.id) === String(targetRackId));
        if (!targetRack) return;
        const slots = targetRack.slots || [];
        let raw = e.dataTransfer.getData('application/json');
        if (!raw) raw = e.dataTransfer.getData('text/plain');
        let payload;
        try {
          payload = JSON.parse(raw || '{}');
        } catch {
          return;
        }
        const u = Number(zone.getAttribute('data-drop-u'));
        const sizeU = Number(targetRack.size_u || 12);
        if (!u || u < 1 || u > sizeU) return;

        if (payload.type === 'template') {
          const dev = devices.find((d) => String(d.id) === String(payload.deviceId));
          if (!dev) return;
          const h = Math.max(1, Number(dev.rack_u || 1));
          if (u + h - 1 > sizeU) {
            await showModalAlert({
              title: 'Emplacement impossible',
              message: 'Équipement trop haut pour cet emplacement.',
            });
            return;
          }
          if (!slotRangeFree(slots, u, h, 0, null)) {
            await showModalAlert({
              title: 'Emplacement occupé',
              message: 'Pas assez d’espace libre à cet emplacement.',
            });
            return;
          }
          try {
            await api.post('/api/ef/slots', {
              rack_id: targetRack.id,
              device_template_id: payload.deviceId,
              slot_u: u,
              slot_col: 0,
            });
          } catch (err) {
            await showModalAlert({ title: 'Erreur', message: err.message || 'Erreur' });
            return;
          }
          viewProjectRack(projectId);
          return;
        }
        if (payload.type === 'slot') {
          const found = findSlotInRacks(racks, payload.slotId);
          if (!found) return;
          const { rack: srcRack, slot } = found;
          if (String(srcRack.id) !== String(targetRack.id)) {
            await showModalAlert({
              title: 'Déplacement impossible',
              message: 'Un équipement ne peut pas être déplacé vers un autre rack depuis cette vue (le rack du slot ne change pas).',
            });
            return;
          }
          const h = Math.max(1, Number(slot.rack_u || 1));
          if (u + h - 1 > sizeU) {
            await showModalAlert({
              title: 'Emplacement impossible',
              message: 'Équipement trop haut pour cet emplacement.',
            });
            return;
          }
          if (Number(slot.slot_u) === u && Number(slot.slot_col || 0) === 0) {
            return;
          }
          if (!slotRangeFree(slots, u, h, 0, slot.id)) {
            await showModalAlert({
              title: 'Emplacement occupé',
              message: 'Pas assez d’espace libre à cet emplacement.',
            });
            return;
          }
          try {
            await api.put('/api/ef/slots/' + slot.id, { slot_u: u, slot_col: 0 });
          } catch (err) {
            await showModalAlert({ title: 'Erreur', message: err.message || 'Erreur' });
            return;
          }
          viewProjectRack(projectId);
        }
      });
    });

    $('#btn-add-rack')?.addEventListener('click', async () => {
      const name = await showModalPrompt({
        title: 'Nouveau rack',
        message: 'Nom du rack',
        placeholder: 'Rack principal',
        confirmText: 'Ajouter',
        cancelText: 'Annuler',
      });
      if (name == null) return;
      await api.post('/api/ef/racks', { project_id: Number(projectId), name, size_u: 12 });
      viewProjectRack(projectId);
    });
    $('#btn-save-rack-meta')?.addEventListener('click', async () => {
      const name = $('#rack-name-inp')?.value?.trim();
      const size_u = Number($('#rack-size-sel')?.value);
      if (!rack || !name) return;
      await api.put('/api/ef/racks/' + rack.id, { name, size_u });
      viewProjectRack(projectId);
    });
    $('#btn-proj-settings')?.addEventListener('click', () => nav('#/project/' + projectId + '/settings'));
    $('#tab-patch-short')?.addEventListener('click', () => nav('#/project/' + projectId + '/patch'));
    $('#btn-save-pl')?.addEventListener('click', async () => {
      if (!selSlot) return;
      const raw = $('#slot-pl-json').value.trim();
      let pl = null;
      if (raw) {
        try {
          pl = JSON.parse(raw);
        } catch {
          await showModalAlert({ title: 'JSON invalide', message: 'Vérifiez la syntaxe du champ port_labels.' });
          return;
        }
      }
      await api.put('/api/ef/slots/' + selSlot.id, { port_labels: pl });
      viewProjectRack(projectId);
    });
    $('#btn-edit-face')?.addEventListener('click', () => {
      if (selSlot) nav('#/device/' + selSlot.device_template_id);
    });
    $('#btn-slots-rack')?.addEventListener('click', () => {
      if (rack) nav('#/project/' + projectId + '/rack/' + rack.id + '/slots');
    });
  }

  async function viewProjectSettings(projectId) {
    const data = await api.get('/api/ef/projects/' + projectId);
    mountShell({
      breadcrumb: `<a href="#/projects">Dashboard</a> / <a href="#/project/${projectId}/rack" class="link-accent">${esc(data.name)}</a> / <b>Projet</b>`,
      main: `<div class="view-pad" style="max-width:520px">
        <form id="f-proj" class="export-config">
          <div class="ec-title">Informations</div>
          <label class="field-label">Nom</label>
          <input class="ef-inp" name="name" value="${esc(data.name)}" required />
          <label class="field-label">Client</label>
          <input class="ef-inp" name="client" value="${esc(data.client || '')}" />
          <label class="field-label">Lieu</label>
          <input class="ef-inp" name="venue" value="${esc(data.venue || '')}" />
          <label class="field-label">Date</label>
          <input class="ef-inp" name="event_date" type="date" value="${esc(data.event_date || '')}" />
          <label class="field-label">Statut</label>
          <select class="ef-select" name="status" style="margin-top:0">
            <option value="draft" ${data.status === 'draft' ? 'selected' : ''}>draft</option>
            <option value="confirmed" ${data.status === 'confirmed' ? 'selected' : ''}>confirmed</option>
            <option value="archived" ${data.status === 'archived' ? 'selected' : ''}>archived</option>
          </select>
          <label class="field-label">Notes</label>
          <textarea class="ef-ta" name="notes" rows="4">${esc(data.notes || '')}</textarea>
          <p style="margin-top:12px"><button type="submit" class="btn btn-p">Enregistrer</button>
          <button type="button" class="btn" id="btn-dup">Dupliquer</button></p>
        </form>
      </div>`,
      navActive: 1,
      projectId,
    });
    wireNavRail();
    $('#f-proj').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const fd = new FormData(ev.target);
      await api.put('/api/ef/projects/' + projectId, {
        name: fd.get('name'),
        client: fd.get('client') || null,
        venue: fd.get('venue') || null,
        event_date: fd.get('event_date') || null,
        status: fd.get('status'),
        notes: fd.get('notes') || null,
      });
      viewProjectSettings(projectId);
    });
    $('#btn-dup').addEventListener('click', async () => {
      const name = await showModalPrompt({
        title: 'Dupliquer le projet',
        message: 'Nom de la copie',
        defaultValue: 'Copie — ' + data.name,
        confirmText: 'Dupliquer',
        cancelText: 'Annuler',
      });
      if (name == null) return;
      const p = await api.post('/api/ef/projects/' + projectId + '/duplicate', { name });
      nav('#/project/' + p.id + '/rack');
    });
  }

  async function viewProjectPatch(projectId) {
    const data = await api.get('/api/ef/projects/' + projectId);
    let rows = data.connections || [];
    let sigFilter = '';
    let orphanMode = false;

    const slotById = {};
    for (const r of data.racks || []) {
      for (const s of r.slots || []) slotById[s.id] = s;
    }

    function patchEndLabel(c, side) {
      const isSrc = side === 'src';
      const sid = c[isSrc ? 'src_slot_id' : 'dst_slot_id'];
      const rackN = c[isSrc ? 'src_rack_name' : 'dst_rack_name'] || '';
      const u = c[isSrc ? 'src_slot_u' : 'dst_slot_u'];
      const devName = c[isSrc ? 'src_device_name' : 'dst_device_name'] || '';
      const custom =
        c[isSrc ? 'src_custom_name' : 'dst_custom_name'] ||
        c[isSrc ? 'src_slot_custom' : 'dst_slot_custom'] ||
        '';
      const portId = c[isSrc ? 'src_port_id' : 'dst_port_id'];
      const slot = slotById[sid];
      const uDisp = u != null && u !== '' ? u : slot?.slot_u ?? '—';
      const devDisp = (slot?.custom_name || custom || devName || '').trim();
      const portDisp = portPatchLabel(portId, slot);
      const rackDisp = rackN || (slot ? (data.racks || []).find((x) => String(x.id) === String(slot.rack_id))?.name : '') || '—';
      return { where: `${rackDisp} · U${uDisp}`, dev: devDisp, port: portDisp };
    }

    function sigColor(sig) {
      if (sig === 'dmx' || sig === 'audio_digital') return '#7c4dff';
      if (sig === 'ethernet') return '#4f8ef7';
      if (sig === 'power') return '#f5a623';
      if (sig === 'audio_analog') return '#f74f4f';
      return '#607d8b';
    }

    function renderPatch() {
      const body = $('#patch-rows');
      if (!body) return;
      body.innerHTML = rows
        .map((c, i) => {
          const num = String(i + 1).padStart(3, '0');
          const sig = c.signal_type || '';
          const col = sigColor(sig);
          const src = patchEndLabel(c, 'src');
          const dst = patchEndLabel(c, 'dst');
          const cableBits = [cableTypeFr(c.cable_type)];
          if (c.cable_label) cableBits.push(`« ${c.cable_label} »`);
          const cableCell = cableBits.join(' ');
          const lenDisp = c.cable_length_m != null && c.cable_length_m !== '' ? `${c.cable_length_m} m` : '—';
          const noteDisp = String(c.notes || '').trim();
          const noteShort = noteDisp.length > 100 ? `${noteDisp.slice(0, 97)}…` : noteDisp;
          return `<div class="pt-row">
            <div class="pt-num">${num}</div>
            <div class="pt-cell-stack">
              <div class="pt-loc">${esc(src.where)}</div>
              <div class="pt-device">${esc(src.dev)}</div>
              <div class="pt-port"><b>${esc(src.port)}</b></div>
            </div>
            <div class="pt-cell-stack">
              <div class="pt-loc">${esc(dst.where)}</div>
              <div class="pt-device">${esc(dst.dev)}</div>
              <div class="pt-port"><b>${esc(dst.port)}</b></div>
            </div>
            <div class="pt-sig-cell"><span class="sig-dot" style="background:${col}"></span><span class="pt-sig">${esc(signalTypeFr(sig))}</span></div>
            <div class="pt-cable">${esc(cableCell)}</div>
            <div class="pt-len">${esc(lenDisp)}</div>
            <div class="pt-note muted"${noteDisp ? ` title="${esc(noteDisp)}"` : ''}>${noteShort ? esc(noteShort) : '—'}</div>
          </div>`;
        })
        .join('');
    }

    mountShell({
      breadcrumb: `<a href="#/projects">Dashboard</a> / <a href="#/project/${projectId}/rack" class="link-accent">${esc(data.name)}</a> / <b>Patch list</b>`,
      main: `<div class="view-pad">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px">
          <div>
            <div style="font-family:var(--display);font-size:17px;font-weight:700">Patch list</div>
            <div class="muted patch-lede" style="margin-top:6px;max-width:720px;line-height:1.45">Chaque ligne décrit une liaison réelle : rack et unité, équipement, connecteur (et libellé métier si renseigné), type de signal, matériel à sortir, repère du câble et notes de pose. À utiliser sur site ou pour préparer les volières / flights.</div>
            <div class="muted" style="margin-top:6px">${rows.length} connexion(s)</div>
          </div>
          <div style="display:flex;gap:8px">
            <button type="button" class="btn" id="btn-add-conn">+ Connexion</button>
            <button type="button" class="btn btn-p" onclick="location.hash='#/project/${projectId}/export'">Export PDF ↗</button>
          </div>
        </div>
        <div class="patch-layout">
          <div class="patch-filters">
            <span class="muted" style="font-size:12px">Filtres :</span>
            <button type="button" class="filter-btn active" data-flt="">Tout</button>
            <button type="button" class="filter-btn" data-flt="audio_analog">Son</button>
            <button type="button" class="filter-btn" data-flt="dmx">Lumière</button>
            <button type="button" class="filter-btn" data-flt="ethernet">Réseau</button>
            <button type="button" class="filter-btn" data-flt="power">Alim.</button>
            <button type="button" class="filter-btn" id="flt-orphan" style="border-color:var(--amber);color:var(--amber)">Orphelins ⚠</button>
          </div>
          <div class="patch-table">
            <div class="pt-head">
              <div class="pt-col">#</div>
              <div class="pt-col">Départ (où / quoi)</div>
              <div class="pt-col">Arrivée (où / quoi)</div>
              <div class="pt-col">Signal</div>
              <div class="pt-col">Câble & repère</div>
              <div class="pt-col">Long.</div>
              <div class="pt-col">Note</div>
            </div>
            <div id="patch-rows"></div>
          </div>
          <pre id="orphan-pre" class="muted" style="font-size:12px;white-space:pre-wrap;display:none"></pre>
        </div>
      </div>`,
      navActive: 3,
      projectId,
    });
    wireNavRail();

    async function reload() {
      if (orphanMode) {
        const res = await api.get('/api/ef/connections?project_id=' + projectId + '&orphan=1');
        rows = res.connections || [];
        $('#orphan-pre').style.display = 'block';
        $('#orphan-pre').textContent = JSON.stringify(res.orphan_ports || [], null, 2);
      } else {
        $('#orphan-pre').style.display = 'none';
        const q = '/api/ef/connections?project_id=' + projectId + (sigFilter ? '&signal_type=' + encodeURIComponent(sigFilter) : '');
        rows = await api.get(q);
      }
      renderPatch();
    }

    await reload();

    $$('.filter-btn[data-flt]').forEach((b) =>
      b.addEventListener('click', async () => {
        $$('.filter-btn[data-flt]').forEach((x) => x.classList.remove('active'));
        b.classList.add('active');
        sigFilter = b.getAttribute('data-flt') || '';
        orphanMode = false;
        await reload();
      })
    );
    $('#flt-orphan')?.addEventListener('click', async () => {
      orphanMode = !orphanMode;
      await reload();
    });

    $('#btn-add-conn')?.addEventListener('click', async () => {
      const slotsFlat = [];
      for (const r of data.racks || []) {
        for (const s of r.slots || []) {
          slotsFlat.push({ id: s.id, label: `${r.name} U${s.slot_u} · ${s.device_name}` });
        }
      }
      if (slotsFlat.length < 2) {
        await showModalAlert({
          title: 'Connexion impossible',
          message: 'Ajoutez au moins deux équipements dans les racks.',
        });
        return;
      }
      const conn = await showModalConnection(slotsFlat);
      if (!conn) return;
      await api.post('/api/ef/connections', {
        project_id: Number(projectId),
        src_slot_id: conn.src_slot_id,
        src_port_id: conn.src_port_id,
        dst_slot_id: conn.dst_slot_id,
        dst_port_id: conn.dst_port_id,
        signal_type: conn.signal_type,
        cable_type: conn.cable_type,
        cable_length_m: conn.cable_length_m,
        cable_label: conn.cable_label,
        notes: conn.notes,
      });
      await reload();
    });
  }

  async function viewProjectExport(projectId) {
    const data = await api.get('/api/ef/projects/' + projectId);
    mountShell({
      breadcrumb: `<a href="#/projects">Dashboard</a> / <a href="#/project/${projectId}/rack" class="link-accent">${esc(data.name)}</a> / <b>Export PDF</b>`,
      main: `<div class="view-pad">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
          <div>
            <div style="font-family:var(--display);font-size:17px;font-weight:700">Export fiche technique</div>
            <div class="muted" style="margin-top:2px">${esc(data.name)}</div>
          </div>
          <button type="button" class="btn btn-p" id="btn-gen-pdf" style="font-size:14px;padding:8px 18px">Générer PDF</button>
        </div>
        <div class="export-layout">
          <div class="export-config">
            <div class="ec-section">
              <div class="ec-title">Modules à inclure</div>
              ${['cover', 'racks', 'patch', 'links', 'power'].map((m) => {
                const labels = { cover: 'Page de garde', racks: 'Plan rack complet', patch: 'Patch list', links: 'Liaisons inter-racks', power: 'Bilan électrique' };
                return `<div class="module-row"><span class="module-name">${labels[m]}</span><div class="module-check on" data-mod="${m}"></div></div>`;
              }).join('')}
            </div>
            <div class="ec-section">
              <div class="ec-title">Paramètres</div>
              <div class="muted" style="margin-bottom:6px">Thème PDF</div>
              <div style="display:flex;gap:6px;margin-bottom:10px">
                <button type="button" class="filter-btn active" id="th-dark">Sombre</button>
                <button type="button" class="filter-btn" id="th-light">Clair</button>
              </div>
            </div>
          </div>
          <div class="preview-area">
            <div class="preview-header"><span>Aperçu</span><span style="color:var(--accent)">jsPDF</span></div>
            <div class="pdf-preview"><div class="pdf-page">
              <div class="pdf-hd"><div><div class="pdf-title">${esc(data.name)}</div><div class="pdf-sub">EventFlow · Event'Light</div></div></div>
              <div class="muted" style="font-size:11px">Résumé des modules cochés exportés dans le PDF.</div>
            </div></div>
          </div>
        </div>
      </div>`,
      navActive: 4,
      projectId,
    });
    wireNavRail();
    let pdfTheme = 'dark';
    $('#th-dark')?.addEventListener('click', () => {
      pdfTheme = 'dark';
      $('#th-dark').classList.add('active');
      $('#th-light').classList.remove('active');
    });
    $('#th-light')?.addEventListener('click', () => {
      pdfTheme = 'light';
      $('#th-light').classList.add('active');
      $('#th-dark').classList.remove('active');
    });
    $$('.module-check[data-mod]').forEach((el) =>
      el.addEventListener('click', () => el.classList.toggle('on'))
    );
    $('#btn-gen-pdf')?.addEventListener('click', async () => {
      const exp = await api.get('/api/ef/export/pdf?project_id=' + encodeURIComponent(projectId));
      const mods = {};
      $$('.module-check[data-mod]').forEach((el) => {
        mods[el.getAttribute('data-mod')] = el.classList.contains('on');
      });
      await buildPdf(exp, mods, pdfTheme);
    });
  }

  async function viewSlots(rackId, projectId) {
    const data = await api.get('/api/ef/projects/' + projectId);
    const rack = data.racks?.find((r) => String(r.id) === String(rackId));
    const slots = await api.get('/api/ef/slots?rack_id=' + rackId);
    const devs = await api.get('/api/ef/devices');
    const opts = devs.map((d) => `<option value="${d.id}">${esc(d.name)}</option>`).join('');
    const rows = slots
      .map(
        (s) =>
          `<tr data-sid="${s.id}"><td>${s.slot_u}</td><td>${esc(s.device_name)}</td>
          <td><input type="text" class="ef-inp port-labels" data-id="${s.id}" value="${esc(s.port_labels || '')}" style="max-width:280px" /></td>
          <td><button type="button" class="btn" data-save="${s.id}">Sauver</button></td></tr>`
      )
      .join('');
    mountShell({
      breadcrumb: `<a href="#/projects">Dashboard</a> / <a href="#/project/${projectId}/rack" class="link-accent">${esc(data.name)}</a> / <b>Slots</b>`,
      main: `<div class="view-pad">
        <p><a href="#/project/${projectId}/rack" class="link-accent">← Rack builder</a></p>
        <div class="export-config" style="max-width:720px">
          <form id="f-slot" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;align-items:end">
            <div><div class="field-label">Équipement</div><select class="ef-select" name="device_template_id" style="margin-top:0;width:220px">${opts}</select></div>
            <div><div class="field-label">U</div><input class="ef-inp" name="slot_u" type="number" min="1" max="42" value="1" style="width:70px;margin-top:0" /></div>
            <button type="submit" class="btn btn-p">Placer</button>
          </form>
          <table class="patch-table" style="display:block;overflow:auto">
            <thead><tr class="pt-head" style="display:table;width:100%"><th class="pt-col">U</th><th class="pt-col">Équipement</th><th class="pt-col">port_labels JSON</th><th></th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`,
      navActive: 1,
      projectId,
    });
    wireNavRail();
    $('#f-slot').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const fd = new FormData(ev.target);
      await api.post('/api/ef/slots', {
        rack_id: Number(rackId),
        device_template_id: Number(fd.get('device_template_id')),
        slot_u: Number(fd.get('slot_u')),
        slot_col: 0,
      });
      viewSlots(rackId, projectId);
    });
    $$('button[data-save]').forEach((b) =>
      b.addEventListener('click', async () => {
        const sid = b.getAttribute('data-save');
        const inp = $(`input[data-id="${sid}"]`);
        let pl = null;
        const raw = inp.value.trim();
        if (raw) {
          try {
            pl = JSON.parse(raw);
          } catch {
            await showModalAlert({ title: 'JSON invalide', message: 'Vérifiez le JSON des port_labels.' });
            return;
          }
        }
        await api.put('/api/ef/slots/' + sid, { port_labels: pl });
      })
    );
  }

  async function viewDevices() {
    const list = await api.get('/api/ef/devices');
    const rows = list
      .map(
        (d) =>
          `<tr style="cursor:pointer;border-bottom:1px solid var(--border)" data-did="${d.id}">
            <td style="padding:8px;font-size:13px;font-weight:500">${esc(d.name)}</td>
            <td style="padding:8px;font-size:12px;color:var(--muted)">${esc(d.manufacturer || '')}</td>
            <td style="padding:8px">${esc(d.category)}</td><td style="padding:8px">${d.rack_u}U</td>
            <td style="padding:8px;font-size:12px">${d.is_public ? 'public' : 'perso'}</td>
          </tr>`
      )
      .join('');
    mountShell({
      breadcrumb: '<a href="#/projects">Dashboard</a> / <b>Bibliothèque équipements</b>',
      main: `<div class="view-pad">
        <button type="button" class="btn btn-p" id="btn-dev-new">+ Nouvel équipement</button>
        <div class="patch-table" style="margin-top:12px;overflow:auto"><table style="width:100%;border-collapse:collapse"><tbody>${rows}</tbody></table></div>
      </div>`,
      navActive: 2,
      projectId: null,
    });
    wireNavRail();
    $('#btn-dev-new').addEventListener('click', async () => {
      const name = await showModalPrompt({
        title: 'Nouvel équipement',
        message: 'Nom commercial',
        placeholder: 'Mon préampli',
        confirmText: 'Créer',
        cancelText: 'Annuler',
      });
      if (name == null) return;
      const d = await api.post('/api/ef/devices', { name, category: 'custom', rack_u: 1 });
      nav('#/device/' + d.id);
    });
    $$('tr[data-did]').forEach((tr) =>
      tr.addEventListener('click', () => nav('#/device/' + tr.getAttribute('data-did')))
    );
  }

  async function viewDeviceEdit(devId) {
    const d = await api.get('/api/ef/devices/' + devId);
    mountShell({
      breadcrumb: `<a href="#/projects">Dashboard</a> / <a href="#/devices" class="link-accent">Équipements</a> / <b>${esc(d.name)}</b>`,
      main: `<div class="view-pad">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
          <div>
            <div style="font-family:var(--display);font-size:17px;font-weight:700">Éditeur face panel</div>
            <div class="muted">${esc(d.name)} · ${d.rack_u}U ${esc(d.rack_width)}</div>
          </div>
          <div style="display:flex;gap:8px">
            <button type="button" class="btn" onclick="history.back()">Retour</button>
            <button type="button" class="btn btn-p" id="btn-save-dev-meta">Enregistrer infos</button>
          </div>
        </div>
        <form id="f-dev" class="export-config" style="max-width:520px;margin-bottom:16px">
          <div class="ec-title">Fiche équipement</div>
          <input type="hidden" name="id" value="${d.id}" />
          <label class="field-label">Nom</label>
          <input class="ef-inp" name="name" value="${esc(d.name)}" required />
          <label class="field-label">Marque</label>
          <input class="ef-inp" name="manufacturer" value="${esc(d.manufacturer || '')}" />
          <label class="field-label">Catégorie</label>
          <select class="ef-select" name="category">${['audio', 'light', 'network', 'power', 'fx', 'custom'].map((c) => `<option value="${c}" ${d.category === c ? 'selected' : ''}>${c}</option>`).join('')}</select>
          <label class="field-label">U / largeur / W</label>
          <div style="display:flex;gap:8px">
            <input class="ef-inp" name="rack_u" type="number" min="1" max="4" value="${d.rack_u}" style="width:60px" />
            <select class="ef-select" name="rack_width" style="margin-top:0;width:120px"><option value="full" ${d.rack_width === 'full' ? 'selected' : ''}>full</option><option value="half" ${d.rack_width === 'half' ? 'selected' : ''}>half</option><option value="third" ${d.rack_width === 'third' ? 'selected' : ''}>third</option></select>
            <input class="ef-inp" name="power_w" type="number" value="${d.power_w ?? 0}" style="width:80px" />
          </div>
          <label class="field-label">Notes</label>
          <textarea class="ef-ta" name="notes">${esc(d.notes || '')}</textarea>
          <label class="muted"><input type="checkbox" name="is_public" ${d.is_public ? 'checked' : ''} /> Public</label>
        </form>
        <div class="export-layout" style="grid-template-columns:1fr 280px">
          <div class="fp-canvas-area" style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:16px">
            <div class="field-label">Face avant</div>
            <div id="edit-front"></div>
            <button type="button" class="btn btn-p" id="btn-save-front">Enregistrer face avant</button>
            <div class="field-label" style="margin-top:16px">Face arrière</div>
            <div id="edit-rear"></div>
            <button type="button" class="btn btn-p" id="btn-save-rear">Enregistrer face arrière</button>
          </div>
          <div class="export-config"><div class="ec-title">Aide</div><p class="muted" style="font-size:12px">Clic sur une case vide pour placer · <strong>double-clic</strong> sur un connecteur pour le supprimer · ou <strong>Alt + clic</strong> si le double-clic ne marche pas · glisser pour déplacer. Faces pouvant rester vides — enregistrez chaque face.</p></div>
        </div>
      </div>`,
      navActive: 2,
      projectId: null,
    });
    wireNavRail();

    const ef = new PanelEditor($('#edit-front'), { rack_u: d.rack_u, rack_width: d.rack_width, face: 'front' });
    ef.loadFromDevice(d);
    ef.render();
    const er = new PanelEditor($('#edit-rear'), { rack_u: d.rack_u, rack_width: d.rack_width, face: 'rear' });
    er.loadFromDevice(d);
    er.render();

    $('#btn-save-dev-meta')?.addEventListener('click', () => $('#f-dev').requestSubmit());
    $('#f-dev').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const fd = new FormData(ev.target);
      await api.put('/api/ef/devices/' + devId, {
        name: fd.get('name'),
        manufacturer: fd.get('manufacturer') || null,
        category: fd.get('category'),
        rack_u: Number(fd.get('rack_u')),
        rack_width: fd.get('rack_width'),
        power_w: Number(fd.get('power_w')),
        notes: fd.get('notes') || null,
        is_public: fd.get('is_public') ? 1 : 0,
      });
      viewDeviceEdit(devId);
    });
    $('#btn-save-front')?.addEventListener('click', async () => {
      await api.put('/api/ef/devices/' + devId, {
        panel_front_svg: ef.buildSvgString(),
        panel_front_ports: JSON.parse(ef.getPortsJson() || '[]'),
      });
      await showModalAlert({ title: 'Enregistré', message: 'Face avant enregistrée.', okText: 'OK' });
    });
    $('#btn-save-rear')?.addEventListener('click', async () => {
      await api.put('/api/ef/devices/' + devId, {
        panel_rear_svg: er.buildSvgString(),
        panel_rear_ports: JSON.parse(er.getPortsJson() || '[]'),
      });
      await showModalAlert({ title: 'Enregistré', message: 'Face arrière enregistrée.', okText: 'OK' });
    });
  }

  /** Pour PDF : index slotId|portId -> lignes de liaison patch. */
  function buildPdfConnBySlotPort(connections) {
    const m = Object.create(null);
    function add(sid, pid, text) {
      const k = `${String(sid)}|${String(pid)}`;
      if (!m[k]) m[k] = [];
      m[k].push(text);
    }
    for (const c of connections || []) {
      const len =
        c.cable_length_m != null && c.cable_length_m !== '' ? ` ${String(c.cable_length_m)}m` : '';
      const ct = cableTypeFr(c.cable_type);
      const cpart = ct && ct !== '—' ? `, ${ct}` : '';
      const lbl = c.cable_label ? `, ${String(c.cable_label)}` : '';
      add(
        c.src_slot_id,
        c.src_port_id,
        `-> ${c.dst_rack_name || '?'} U${c.dst_slot_u} ${c.dst_device_name || ''} [${c.dst_label_display || c.dst_port_id}]${cpart}${len}${lbl}`
      );
      add(
        c.dst_slot_id,
        c.dst_port_id,
        `<- ${c.src_rack_name || '?'} U${c.src_slot_u} ${c.src_device_name || ''} [${c.src_label_display || c.src_port_id}]${cpart}${len}${lbl}`
      );
    }
    return m;
  }

  function pdfPortCaptionLine(slot, p, faceLabel) {
    const id = p.id != null ? String(p.id) : '';
    const pl = parsePortLabelsMap(slot.port_labels);
    const biz = pl[id] ? String(pl[id]) : '';
    const typ = p.type ? String(p.type) : '';
    const bits = [id || '?'];
    if (typ) bits.push(`type ${typ}`);
    if (biz) bits.push(`libelle: ${biz}`);
    bits.push(`(${faceLabel})`);
    return bits.join(' | ');
  }

  /** Hauteur mm consommée par une liste de lignes après decoupe a la largeur colW. */
  function pdfWrappedBlockHeight(doc, lines, colW, lineH) {
    let h = 0;
    for (const raw of lines) {
      const s = raw == null ? '' : String(raw);
      const parts = doc.splitTextToSize(s, colW);
      h += Math.max(1, parts.length) * lineH;
    }
    return h;
  }

  /** Ecrit des lignes avec retour a la ligne, retourne y apres le bloc. */
  function pdfEmitWrappedLines(doc, lines, x, y, colW, lineH, pageBreak) {
    for (const raw of lines) {
      const s = raw == null ? '' : String(raw);
      const parts = doc.splitTextToSize(s, colW);
      for (const p of parts) {
        if (y > 272) {
          pageBreak();
          y = 20;
        }
        doc.text(p, x, y);
        y += lineH;
      }
    }
    return y;
  }

  /** Lignes texte pour un slot (une colonne PDF). */
  function pdfLinesForSlot(s, connByPort) {
    const out = [];
    const h = Math.max(1, Number(s.rack_u || 1));
    const uHi = Number(s.slot_u) + h - 1;
    const uLab = h > 1 ? `U${s.slot_u}-U${uHi} (${h}U)` : `U${s.slot_u}`;
    const dev = (s.custom_name || s.device_name || '').trim();
    const mod =
      s.device_name && s.custom_name && s.custom_name !== s.device_name ? ` modele: ${s.device_name}` : '';
    const pwr = s.power_w ? ` ${s.power_w}W` : '';
    out.push(`-- ${uLab} ${dev}${mod}${pwr} | ${s.category || ''}`);
    const faces = [
      { label: 'avant', raw: s.panel_front_ports },
      { label: 'arriere', raw: s.panel_rear_ports },
    ];
    for (const { label, raw } of faces) {
      out.push(`  Face ${label}:`);
      const ports = parsePanelPorts(raw);
      if (!ports.length) {
        out.push('    (pas de connecteur)');
        continue;
      }
      for (const p of ports) {
        const cap = pdfPortCaptionLine(s, p, label);
        out.push(`    * ${cap}`);
        const k = `${String(s.id)}|${String(p.id)}`;
        for (const lk of connByPort[k] || []) {
          out.push(`       ${lk}`);
        }
      }
    }
    return out;
  }

  async function buildPdf(exp, mods, theme) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const line = (t, x, y) => doc.text(t, x, y);
    let y = 20;
    const fg = theme === 'dark' ? [14, 15, 17] : [255, 255, 255];
    const tx = theme === 'dark' ? [240, 240, 240] : [20, 20, 20];
    if (theme === 'dark') {
      doc.setFillColor(...fg);
      doc.rect(0, 0, 210, 297, 'F');
      doc.setTextColor(...tx);
    }
    if (mods.cover) {
      line('EventFlow — Fiche technique', 20, y);
      y += 10;
      line(String(exp.project?.name || ''), 20, y);
      y += 8;
      line('Client: ' + (exp.project?.client || ''), 20, y);
      y += 12;
    }
    if (mods.racks) {
      doc.addPage();
      y = 20;
      if (theme === 'dark') {
        doc.setFillColor(...fg);
        doc.rect(0, 0, 210, 297, 'F');
        doc.setTextColor(...tx);
      }
      const connByPort = buildPdfConnBySlotPort(exp.connections);
      const ensureRackPage = () => {
        if (y <= 272) return;
        doc.addPage();
        y = 20;
        if (theme === 'dark') {
          doc.setFillColor(...fg);
          doc.rect(0, 0, 210, 297, 'F');
          doc.setTextColor(...tx);
        }
      };
      doc.setFontSize(11);
      line('Plans racks — schema U, ports et liaisons', 20, y);
      y += 6;
      doc.setFontSize(8.5);
      line(
        'Ordre des U: du haut vers le bas du projet (grand U en tete). U1 souvent en bas physique. Ports: id, type, libelle projet (port_labels). Liaisons issues du patch.',
        20,
        y
      );
      y += 8;
      doc.setFontSize(10);
      for (const r of exp.racks || []) {
        ensureRackPage();
        line(`=== ${r.name} — ${r.size_u}U ===`, 20, y);
        y += 6;
        const slots = [...(r.slots || [])].sort((a, b) => Number(b.slot_u) - Number(a.slot_u));
        if (!slots.length) {
          line('  (aucun equipement)', 22, y);
          y += 6;
        }
        for (const s of slots) {
          ensureRackPage();
          const h = Math.max(1, Number(s.rack_u || 1));
          const uHi = Number(s.slot_u) + h - 1;
          const uLab = h > 1 ? `U${s.slot_u}-U${uHi} (${h}U)` : `U${s.slot_u}`;
          const dev = (s.custom_name || s.device_name || '').trim();
          const mod = s.device_name && s.custom_name && s.custom_name !== s.device_name ? ` modele: ${s.device_name}` : '';
          const pwr = s.power_w ? ` ${s.power_w}W` : '';
          line(`-- ${uLab} ${dev}${mod}${pwr} | ${s.category || ''}`, 20, y);
          y += 5;
          const faces = [
            { label: 'avant', raw: s.panel_front_ports },
            { label: 'arriere', raw: s.panel_rear_ports },
          ];
          for (const { label, raw } of faces) {
            ensureRackPage();
            line(`  Face ${label}:`, 22, y);
            y += 4.5;
            const ports = parsePanelPorts(raw);
            if (!ports.length) {
              line('    (pas de connecteur sur ce gabarit)', 24, y);
              y += 4.5;
              continue;
            }
            for (const p of ports) {
              ensureRackPage();
              const cap = pdfPortCaptionLine(s, p, label);
              const capTrim = cap.length > 105 ? `${cap.slice(0, 102)}...` : cap;
              line(`    * ${capTrim}`, 24, y);
              y += 4;
              const k = `${String(s.id)}|${String(p.id)}`;
              const links = connByPort[k] || [];
              for (const lk of links) {
                ensureRackPage();
                const t = lk.length > 100 ? `${lk.slice(0, 97)}...` : lk;
                line(`       ${t}`, 26, y);
                y += 4;
              }
            }
          }
          y += 3;
        }
        y += 4;
      }
      doc.setFontSize(10);
    }
    if (mods.patch) {
      doc.addPage();
      y = 20;
      if (theme === 'dark') {
        doc.setFillColor(...fg);
        doc.rect(0, 0, 210, 297, 'F');
        doc.setTextColor(...tx);
      }
      line('Patch list — câblage', 20, y);
      y += 8;
      line('Rack, U, equipement, connecteur, signal, cable, repere, note.', 20, y);
      y += 10;
      for (const c of exp.connections || []) {
        const srcR = c.src_rack_name || '';
        const dstR = c.dst_rack_name || '';
        const su = c.src_slot_u != null ? c.src_slot_u : '?';
        const du = c.dst_slot_u != null ? c.dst_slot_u : '?';
        const sl = c.src_label_display || c.src_port_id;
        const dl = c.dst_label_display || c.dst_port_id;
        const cab = [cableTypeFr(c.cable_type)]
          .concat(
            c.cable_length_m != null && c.cable_length_m !== '' ? `${c.cable_length_m} m` : null,
            c.cable_label ? String(c.cable_label) : null
          )
          .filter(Boolean)
          .join(' — ');
        const t1 = `[${su}] ${srcR} / ${c.src_device_name || ''}  ·  ${sl}  -->  [${du}] ${dstR} / ${c.dst_device_name || ''}  ·  ${dl}`;
        line(String(t1).substring(0, 98), 20, y);
        y += 5;
        if (cab) {
          line(`    Cable: ${cab.substring(0, 90)}`, 22, y);
          y += 5;
        }
        if (c.notes) {
          line(`    Note: ${String(c.notes).substring(0, 88)}`, 22, y);
          y += 5;
        }
        y += 2;
        if (y > 278) {
          doc.addPage();
          y = 20;
        }
      }
    }
    if (mods.links) {
      doc.addPage();
      y = 20;
      if (theme === 'dark') {
        doc.setFillColor(...fg);
        doc.rect(0, 0, 210, 297, 'F');
        doc.setTextColor(...tx);
      }
      for (const l of exp.rack_links || []) {
        line(`${l.rack_a_name || l.rack_a_id} ↔ ${l.rack_b_name || l.rack_b_id}`, 20, y);
        y += 7;
      }
    }
    if (mods.power) {
      doc.addPage();
      y = 20;
      if (theme === 'dark') {
        doc.setFillColor(...fg);
        doc.rect(0, 0, 210, 297, 'F');
        doc.setTextColor(...tx);
      }
      line('Bilan électrique (W)', 20, y);
      y += 10;
      const by = exp.totals?.power_w_by_rack || {};
      for (const [rid, w] of Object.entries(by)) {
        line(`Rack ${rid}: ${w} W`, 20, y);
        y += 7;
      }
      line(`Total: ${exp.totals?.power_w_all_racks ?? 0} W`, 20, y + 4);
    }
    doc.save('eventflow-export.pdf');
  }

  async function route() {
    await loadMe();
    const { parts } = parseHash();
    if (!state.user && parts[0] !== 'login' && parts[0] !== 'register') {
      if (['projects', 'project', 'devices', 'device'].includes(parts[0])) {
        nav('#/login');
        return;
      }
    }
    if (parts.length === 0) {
      state.user ? nav('#/projects') : await viewLogin();
      return;
    }
    if (parts[0] === 'login') {
      await viewLogin();
      return;
    }
    if (parts[0] === 'register') {
      await viewRegister();
      return;
    }
    if (parts[0] === 'projects') {
      await viewDashboard();
      return;
    }
    if (parts[0] === 'devices') {
      await viewDevices();
      return;
    }
    if (parts[0] === 'device' && parts[1]) {
      await viewDeviceEdit(parts[1]);
      return;
    }
    if (parts[0] === 'project' && parts[1]) {
      const pid = parts[1];
      const sub = parts[2] || 'rack';
      if (parts[2] === 'rack' && parts[3] && parts[4] === 'slots') {
        await viewSlots(parts[3], pid);
        return;
      }
      if (sub === 'settings') {
        await viewProjectSettings(pid);
        return;
      }
      if (sub === 'rack') {
        await viewProjectRack(pid);
        return;
      }
      if (sub === 'patch') {
        await viewProjectPatch(pid);
        return;
      }
      if (sub === 'export') {
        await viewProjectExport(pid);
        return;
      }
      nav('#/project/' + pid + '/rack');
      return;
    }
    await viewLogin();
  }

  window.addEventListener('hashchange', () => route().catch((e) => console.error(e)));
  route().catch((e) => console.error(e));
})();
