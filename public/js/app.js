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
  };

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

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
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
      const name = prompt('Nom du projet ?');
      if (!name) return;
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
      ${u ? `<span class="muted" style="font-size:10px">${esc(u.email)}</span><button type="button" class="btn" id="btn-logout">Déconnexion</button>` : ''}
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

  function rackRowsVisual(rack, slots) {
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
          return `<div class="rack-slot-r"><div class="slot-num-r">${row.u}</div><div class="slot-body-r"><span style="font-size:9px;color:#1e2228">— vide —</span></div></div>`;
        }
        const s = row.slot;
        const col = CAT_COL[s.category] || '#4f8ef7';
        const h = row.h;
        const cls = h >= 2 ? ' slot-2u' : '';
        const num =
          h >= 2
            ? `<div class="slot-num-r" style="height:100%;display:flex;flex-direction:column;justify-content:space-between;padding:2px 0"><span>${row.slot.slot_u}</span><span>${Number(row.slot.slot_u) + h - 1}</span></div>`
            : `<div class="slot-num-r">${s.slot_u}</div>`;
        return `<div class="rack-slot-r${cls}">${num}<div class="slot-body-r occ${cls}" data-slot-id="${s.id}" style="border-color:${col}55;background:${col}10;border-left:3px solid ${col}">
          <div><div class="slot-dn" style="color:${col}">${esc(s.custom_name || s.device_name)}</div>
          <div class="slot-ds">${h}U · ${esc(s.rack_width || 'full')} · ${esc(s.category)}</div></div>
        </div></div>`;
      })
      .join('');
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
    const slots = rack ? rack.slots || [] : [];
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
        const head = `<div style="padding:4px 8px 1px;font-size:8px;color:var(--muted);letter-spacing:1px;text-transform:uppercase;margin-top:4px">${esc(cat)}</div>`;
        const items = byCat[cat]
          .map(
            (d) =>
              `<div class="lib-item" data-did="${d.id}"><div class="li-name">${esc(d.name)}</div><div class="li-meta"><span class="badge bd-green" style="font-size:8px">${d.rack_u}U</span><span class="badge bd-blue" style="font-size:8px">${esc(d.rack_width)}</span></div></div>`
          )
          .join('');
        return head + items;
      })
      .join('');

    const usedU = slots.reduce((s, sl) => s + Number(sl.rack_u || 1), 0);
    const totalW = slots.reduce((s, sl) => s + Number(sl.power_w || 0), 0);
    const rackHtml = rack
      ? rackRowsVisual(rack, slots)
      : '<p class="muted">Aucun rack — ajoutez-en un.</p>';

    const selSlot = state.selectedSlotId ? slots.find((s) => String(s.id) === String(state.selectedSlotId)) : slots[0];
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
      : '<div class="detail-area muted">Sélectionnez un slot dans le rack (clic sur une ligne U).</div>';

    mountShell({
      breadcrumb: `<a href="#/projects">Dashboard</a> / <span class="muted">${esc(data.name)}</span> / <b>Rack builder</b>`,
      main: `<div class="view-pad">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px">
          <div>
            <div style="font-family:var(--display);font-size:15px;font-weight:700">${esc(data.name)}</div>
            <div class="muted" style="margin-top:2px">${rack ? esc(rack.name) : '—'} · ${rack ? rack.size_u + 'U' : ''} · <span style="color:var(--accent)">${usedU}U utilisés</span></div>
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
            <div style="padding:6px 8px;border-bottom:1px solid var(--border)"><input class="ef-inp" placeholder="Rechercher…" id="lib-search" style="font-size:10px" /></div>
            ${lib}
          </div>
          <div class="rb-main">
            ${rack ? `<div style="display:flex;gap:8px;align-items:center;width:100%;max-width:360px">
              <input class="ef-inp" id="rack-name-inp" value="${esc(rack.name)}" />
              <select class="ef-select" style="width:90px;margin-top:0" id="rack-size-sel">${[6, 8, 12, 16, 20, 24, 32, 42].map((u) => `<option value="${u}" ${Number(rack.size_u) === u ? 'selected' : ''}>${u}U</option>`).join('')}</select>
            </div><button type="button" class="btn" id="btn-save-rack-meta" style="align-self:start">Appliquer rack</button>` : ''}
            <div class="rack-vis">${rackHtml}</div>
            <div class="muted"><span style="color:var(--text);font-weight:500">${usedU}</span>/${rack ? rack.size_u : 0}U · <span style="color:var(--text);font-weight:500">${totalW}W</span></div>
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

    $$('[data-sel-rack]').forEach((b) =>
      b.addEventListener('click', () => {
        state.selectedRackId = b.getAttribute('data-sel-rack');
        state.selectedSlotId = null;
        viewProjectRack(projectId);
      })
    );
    $$('.slot-body-r.occ[data-slot-id]').forEach((el) => {
      el.style.cursor = 'pointer';
      el.addEventListener('click', () => {
        state.selectedSlotId = el.getAttribute('data-slot-id');
        viewProjectRack(projectId);
      });
    });

    $('#btn-add-rack')?.addEventListener('click', async () => {
      const name = prompt('Nom du rack ?');
      if (!name) return;
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
          alert('JSON invalide');
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

    $$('.lib-item[data-did]').forEach((el) =>
      el.addEventListener('dblclick', async () => {
        if (!rack) return;
        const su = prompt('Position U (1–' + rack.size_u + ') ?', '1');
        if (!su) return;
        await api.post('/api/ef/slots', {
          rack_id: rack.id,
          device_template_id: Number(el.getAttribute('data-did')),
          slot_u: Number(su),
          slot_col: 0,
        });
        viewProjectRack(projectId);
      })
    );
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
      const name = prompt('Nom de la copie ?', 'Copie — ' + data.name);
      if (!name) return;
      const p = await api.post('/api/ef/projects/' + projectId + '/duplicate', { name });
      nav('#/project/' + p.id + '/rack');
    });
  }

  async function viewProjectPatch(projectId) {
    const data = await api.get('/api/ef/projects/' + projectId);
    let rows = data.connections || [];
    let sigFilter = '';
    let orphanMode = false;

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
          return `<div class="pt-row">
            <div class="pt-num">${num}</div>
            <div><div class="pt-device">${esc(c.src_device_name || '')}</div><div class="pt-port"><b>${esc(c.src_port_id)}</b></div></div>
            <div><div class="pt-device">${esc(c.dst_device_name || '')}</div><div class="pt-port"><b>${esc(c.dst_port_id)}</b></div></div>
            <div><span class="sig-dot" style="background:${col}"></span><span style="font-size:10px;color:var(--muted)">${esc(sig)}</span></div>
            <div><span class="cable-pill" style="background:#1e1a3a;color:var(--accent2);font-size:9px">${esc(c.cable_type || '')}</span></div>
            <div style="font-size:10px;color:var(--muted)">${c.cable_length_m ?? '—'}</div>
            <div class="muted">⋯</div>
          </div>`;
        })
        .join('');
    }

    mountShell({
      breadcrumb: `<a href="#/projects">Dashboard</a> / <a href="#/project/${projectId}/rack" class="link-accent">${esc(data.name)}</a> / <b>Patch list</b>`,
      main: `<div class="view-pad">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px">
          <div>
            <div style="font-family:var(--display);font-size:15px;font-weight:700">Patch list</div>
            <div class="muted" style="margin-top:2px">${rows.length} connexion(s)</div>
          </div>
          <div style="display:flex;gap:8px">
            <button type="button" class="btn" id="btn-add-conn">+ Connexion</button>
            <button type="button" class="btn btn-p" onclick="location.hash='#/project/${projectId}/export'">Export PDF ↗</button>
          </div>
        </div>
        <div class="patch-layout">
          <div class="patch-filters">
            <span class="muted" style="font-size:10px">Filtres :</span>
            <button type="button" class="filter-btn active" data-flt="">Tout</button>
            <button type="button" class="filter-btn" data-flt="audio_analog">Son</button>
            <button type="button" class="filter-btn" data-flt="dmx">Lumière</button>
            <button type="button" class="filter-btn" data-flt="ethernet">Réseau</button>
            <button type="button" class="filter-btn" data-flt="power">Alim.</button>
            <button type="button" class="filter-btn" id="flt-orphan" style="border-color:var(--amber);color:var(--amber)">Orphelins ⚠</button>
          </div>
          <div class="patch-table">
            <div class="pt-head">
              <div class="pt-col">#</div><div class="pt-col">Source</div><div class="pt-col">Destination</div>
              <div class="pt-col">Signal</div><div class="pt-col">Câble</div><div class="pt-col">Long.</div><div class="pt-col"></div>
            </div>
            <div id="patch-rows"></div>
          </div>
          <pre id="orphan-pre" class="muted" style="font-size:10px;white-space:pre-wrap;display:none"></pre>
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
        alert('Ajoutez des équipements dans les racks.');
        return;
      }
      const sid1 = prompt('ID slot source ? (' + slotsFlat.map((x) => x.id).join(', ') + ')');
      const pid1 = prompt('ID port source ?');
      const sid2 = prompt('ID slot destination ?');
      const pid2 = prompt('ID port destination ?');
      if (!sid1 || !sid2 || !pid1 || !pid2) return;
      await api.post('/api/ef/connections', {
        project_id: Number(projectId),
        src_slot_id: Number(sid1),
        src_port_id: pid1,
        dst_slot_id: Number(sid2),
        dst_port_id: pid2,
        signal_type: 'audio_analog',
        cable_type: 'xlr3',
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
            <div style="font-family:var(--display);font-size:15px;font-weight:700">Export fiche technique</div>
            <div class="muted" style="margin-top:2px">${esc(data.name)}</div>
          </div>
          <button type="button" class="btn btn-p" id="btn-gen-pdf" style="font-size:12px;padding:8px 18px">Générer PDF</button>
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
              <div class="muted" style="font-size:9px">Résumé des modules cochés exportés dans le PDF.</div>
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
            alert('JSON invalide');
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
            <td style="padding:8px;font-size:11px;font-weight:500">${esc(d.name)}</td>
            <td style="padding:8px;font-size:10px;color:var(--muted)">${esc(d.manufacturer || '')}</td>
            <td style="padding:8px">${esc(d.category)}</td><td style="padding:8px">${d.rack_u}U</td>
            <td style="padding:8px;font-size:10px">${d.is_public ? 'public' : 'perso'}</td>
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
      const name = prompt('Nom commercial ?');
      if (!name) return;
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
            <div style="font-family:var(--display);font-size:15px;font-weight:700">Éditeur face panel</div>
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
          <div class="export-config"><div class="ec-title">Aide</div><p class="muted" style="font-size:10px">Clic sur le fond pour placer un port · double-clic sur un port pour le supprimer · glisser pour déplacer.</p></div>
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
      alert('Face avant enregistrée');
    });
    $('#btn-save-rear')?.addEventListener('click', async () => {
      await api.put('/api/ef/devices/' + devId, {
        panel_rear_svg: er.buildSvgString(),
        panel_rear_ports: JSON.parse(er.getPortsJson() || '[]'),
      });
      alert('Face arrière enregistrée');
    });
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
      line('Plans racks', 20, y);
      y += 10;
      for (const r of exp.racks || []) {
        line(`${r.name} — ${r.size_u}U`, 20, y);
        y += 7;
        for (const s of r.slots || []) {
          line(`  U${s.slot_u} ${s.device_name}`, 22, y);
          y += 6;
          if (y > 270) {
            doc.addPage();
            y = 20;
          }
        }
      }
    }
    if (mods.patch) {
      doc.addPage();
      y = 20;
      if (theme === 'dark') {
        doc.setFillColor(...fg);
        doc.rect(0, 0, 210, 297, 'F');
        doc.setTextColor(...tx);
      }
      line('Patch list', 20, y);
      y += 10;
      for (const c of exp.connections || []) {
        const t = `${c.src_device_name} [${c.src_port_id}] → ${c.dst_device_name} [${c.dst_port_id}]`;
        line(t.substring(0, 95), 20, y);
        y += 6;
        if (y > 280) {
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
