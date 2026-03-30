(function () {
  'use strict';

  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => [...(el || document).querySelectorAll(s)];

  const state = {
    user: null,
    route: '',
    project: null,
    devices: [],
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

  function layout(title, inner) {
    const u = state.user;
    return `
      <header class="topbar">
        <a href="#/projects" class="brand">EventFlow</a>
        <nav>
          ${u ? `<span class="who">${esc(u.email)}</span>
          <a href="#/projects">Projets</a>
          <a href="#/devices">Équipements</a>
          <button type="button" id="btn-logout">Déconnexion</button>` : `<a href="#/login">Connexion</a>`}
        </nav>
      </header>
      <main class="main">
        <h1>${esc(title)}</h1>
        ${inner}
      </main>`;
  }

  function mount(html) {
    $('#app').innerHTML = html;
    $('#btn-logout')?.addEventListener('click', async () => {
      await api.post('/api/ef/auth/logout', {});
      state.user = null;
      nav('#/login');
    });
  }

  async function viewLogin() {
    mount(
      layout(
        'Connexion',
        `<form id="f-login" class="card">
          <label>Email <input name="email" type="email" required /></label>
          <label>Mot de passe <input name="password" type="password" required minlength="8" /></label>
          <button type="submit">Se connecter</button>
          <p><a href="#/register">Créer un compte</a></p>
          <p id="login-err" class="err"></p>
        </form>`
      )
    );
    $('#f-login').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const fd = new FormData(ev.target);
      $('#login-err').textContent = '';
      try {
        await api.post('/api/ef/auth/login', {
          email: fd.get('email'),
          password: fd.get('password'),
        });
        await loadMe();
        nav('#/projects');
      } catch (e) {
        $('#login-err').textContent = e.message;
      }
    });
  }

  async function viewRegister() {
    mount(
      layout(
        'Inscription',
        `<form id="f-reg" class="card">
          <label>Email <input name="email" type="email" required /></label>
          <label>Mot de passe <input name="password" type="password" required minlength="8" /></label>
          <label>Nom affiché <input name="display_name" type="text" /></label>
          <button type="submit">S'inscrire</button>
          <p><a href="#/login">Déjà un compte</a></p>
          <p id="reg-err" class="err"></p>
        </form>`
      )
    );
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

  async function viewProjects() {
    if (!state.user) {
      nav('#/login');
      return;
    }
    let list = [];
    try {
      list = await api.get('/api/ef/projects');
    } catch (e) {
      mount(layout('Projets', `<p class="err">${esc(e.message)}</p>`));
      return;
    }
    const rows = list
      .map(
        (p) =>
          `<tr><td><a href="#/project/${p.id}">${esc(p.name)}</a></td><td>${esc(p.client || '')}</td><td>${esc(p.status)}</td>
          <td><button type="button" data-dup="${p.id}">Dupliquer</button></td></tr>`
      )
      .join('');
    mount(
      layout(
        'Projets',
        `<p><button type="button" id="btn-new">Nouveau projet</button></p>
        <table class="table"><thead><tr><th>Nom</th><th>Client</th><th>Statut</th><th></th></tr></thead>
        <tbody>${rows || '<tr><td colspan="4">Aucun projet</td></tr>'}</tbody></table>`
      )
    );
    $('#btn-new').addEventListener('click', async () => {
      const name = prompt('Nom du projet ?');
      if (!name) return;
      const p = await api.post('/api/ef/projects', { name });
      nav('#/project/' + p.id);
    });
    $$('button[data-dup]').forEach((b) =>
      b.addEventListener('click', async () => {
        const id = b.getAttribute('data-dup');
        const name = prompt('Nom de la copie ?', 'Copie');
        if (!name) return;
        const p = await api.post('/api/ef/projects/' + id + '/duplicate', { name });
        nav('#/project/' + p.id);
      })
    );
  }

  async function viewProject(id) {
    if (!state.user) {
      nav('#/login');
      return;
    }
    let data;
    try {
      data = await api.get('/api/ef/projects/' + id);
    } catch (e) {
      mount(layout('Projet', `<p class="err">${esc(e.message)}</p>`));
      return;
    }
    state.project = data;

    const rackRows = (data.racks || [])
      .map(
        (r) =>
          `<tr><td>${esc(r.name)}</td><td>${r.size_u}U</td><td>${esc(r.location || '')}</td>
          <td><button type="button" data-slot="${r.id}" class="btn-sm">Slots</button></td></tr>`
      )
      .join('');

    const patchRows = (data.connections || [])
      .map((c, i) => {
        const num = String(i + 1).padStart(3, '0');
        return `<tr><td>${num}</td><td>${esc(c.src_device_name || '')}</td><td>${esc(c.src_port_id)}</td>
          <td>${esc(c.dst_device_name || '')}</td><td>${esc(c.dst_port_id)}</td><td>${esc(c.signal_type)}</td>
          <td>${esc(c.cable_type || '')}</td><td>${c.cable_length_m ?? ''}</td></tr>`;
      })
      .join('');

    const linkRows = (data.rack_links || [])
      .map(
        (l) =>
          `<tr><td>${esc(l.rack_a_name || l.rack_a_id)}</td><td>${esc(l.rack_b_name || l.rack_b_id)}</td>
          <td>${esc(l.link_type)}</td><td>${l.cable_length_m ?? ''}</td><td>${esc(l.notes || '')}</td></tr>`
      )
      .join('');

    mount(
      layout(
        data.name,
        `<div class="grid2">
          <section class="card">
            <h2>Infos</h2>
            <form id="f-proj">
              <input type="hidden" name="id" value="${data.id}" />
              <label>Nom <input name="name" value="${esc(data.name)}" required /></label>
              <label>Client <input name="client" value="${esc(data.client || '')}" /></label>
              <label>Lieu <input name="venue" value="${esc(data.venue || '')}" /></label>
              <label>Date <input name="event_date" type="date" value="${esc(data.event_date || '')}" /></label>
              <label>Statut
                <select name="status">
                  <option value="draft" ${data.status === 'draft' ? 'selected' : ''}>draft</option>
                  <option value="confirmed" ${data.status === 'confirmed' ? 'selected' : ''}>confirmed</option>
                  <option value="archived" ${data.status === 'archived' ? 'selected' : ''}>archived</option>
                </select>
              </label>
              <label>Notes <textarea name="notes">${esc(data.notes || '')}</textarea></label>
              <button type="submit">Enregistrer</button>
            </form>
          </section>
          <section class="card">
            <h2>Racks</h2>
            <p><button type="button" id="btn-add-rack">Ajouter un rack</button></p>
            <table class="table"><thead><tr><th>Nom</th><th>Taille</th><th>Lieu</th><th></th></tr></thead>
            <tbody>${rackRows || '<tr><td colspan="4">Aucun rack</td></tr>'}</tbody></table>
          </section>
        </div>
        <section class="card">
          <h2>Patch list</h2>
          <p>
            <label>Filtrer signal <select id="flt-sig"><option value="">(tous)</option>
              <option value="audio_analog">audio</option>
              <option value="dmx">dmx</option>
              <option value="ethernet">ethernet</option>
              <option value="power">power</option>
            </select></label>
            <button type="button" id="btn-orphan">Voir orphelins (API)</button>
            <button type="button" id="btn-add-conn">Nouvelle connexion</button>
          </p>
          <div id="orphan-box" class="muted"></div>
          <table class="table"><thead><tr><th>#</th><th>De (équip.)</th><th>Port src</th><th>Vers</th><th>Port dst</th><th>Signal</th><th>Câble</th><th>m</th></tr></thead>
          <tbody id="patch-body">${patchRows || ''}</tbody></table>
        </section>
        <section class="card">
          <h2>Liaisons inter-racks</h2>
          <p><button type="button" id="btn-add-link">Ajouter liaison</button></p>
          <table class="table"><thead><tr><th>Rack A</th><th>Rack B</th><th>Type</th><th>m</th><th>Notes</th></tr></thead>
          <tbody>${linkRows || '<tr><td colspan="5">Aucune</td></tr>'}</tbody></table>
        </section>
        <section class="card">
          <h2>Export PDF (données + jsPDF)</h2>
          <div id="pdf-modules">
            <label><input type="checkbox" data-mod="cover" checked /> Page de garde</label>
            <label><input type="checkbox" data-mod="racks" checked /> Plans racks</label>
            <label><input type="checkbox" data-mod="patch" checked /> Patch complète</label>
            <label><input type="checkbox" data-mod="links" checked /> Liaisons inter-racks</label>
            <label><input type="checkbox" data-mod="power" checked /> Bilan électrique</label>
          </div>
          <p><label>Thème <select id="pdf-theme"><option value="light">Clair</option><option value="dark">Sombre</option></select></label></p>
          <p><button type="button" id="btn-pdf">Télécharger PDF</button></p>
        </section>`
      )
    );

    $('#f-proj').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const fd = new FormData(ev.target);
      await api.put('/api/ef/projects/' + id, {
        name: fd.get('name'),
        client: fd.get('client') || null,
        venue: fd.get('venue') || null,
        event_date: fd.get('event_date') || null,
        status: fd.get('status'),
        notes: fd.get('notes') || null,
      });
      await viewProject(id);
    });

    $('#btn-add-rack').addEventListener('click', async () => {
      const name = prompt('Nom du rack ?');
      if (!name) return;
      await api.post('/api/ef/racks', { project_id: Number(id), name, size_u: 12 });
      await viewProject(id);
    });

    $$('button[data-slot]').forEach((b) =>
      b.addEventListener('click', async () => {
        const rackId = b.getAttribute('data-slot');
        await viewSlots(rackId, id);
      })
    );

    async function reloadPatch() {
      const sig = $('#flt-sig').value;
      const q = '/api/ef/connections?project_id=' + encodeURIComponent(id) + (sig ? '&signal_type=' + encodeURIComponent(sig) : '');
      const rows = await api.get(q);
      const tbody = $('#patch-body');
      tbody.innerHTML = rows
        .map((c, i) => {
          const num = String(i + 1).padStart(3, '0');
          return `<tr><td>${num}</td><td>${esc(c.src_device_name || '')}</td><td>${esc(c.src_port_id)}</td>
            <td>${esc(c.dst_device_name || '')}</td><td>${esc(c.dst_port_id)}</td><td>${esc(c.signal_type)}</td>
            <td>${esc(c.cable_type || '')}</td><td>${c.cable_length_m ?? ''}</td></tr>`;
        })
        .join('');
    }

    $('#flt-sig')?.addEventListener('change', () => reloadPatch().catch((e) => alert(e.message)));

    $('#btn-orphan').addEventListener('click', async () => {
      const res = await api.get('/api/ef/connections?project_id=' + id + '&orphan=1');
      const box = $('#orphan-box');
      const o = res.orphan_ports || res;
      box.textContent = JSON.stringify(o, null, 2);
    });

    $('#btn-add-conn').addEventListener('click', async () => {
      const slotsFlat = [];
      for (const r of data.racks || []) {
        for (const s of r.slots || []) {
          slotsFlat.push({ id: s.id, label: `${r.name} U${s.slot_u} · ${s.device_name}` });
        }
      }
      if (slotsFlat.length < 2) {
        alert('Ajoutez des équipements dans les racks avant de câbler.');
        return;
      }
      const sid1 = prompt('ID slot source ? (' + slotsFlat.map((x) => x.id).join(', ') + ')');
      const pid1 = prompt('ID port source (ex: p_123) ?');
      const sid2 = prompt('ID slot destination ?');
      const pid2 = prompt('ID port destination ?');
      if (!sid1 || !sid2 || !pid1 || !pid2) return;
      await api.post('/api/ef/connections', {
        project_id: Number(id),
        src_slot_id: Number(sid1),
        src_port_id: pid1,
        dst_slot_id: Number(sid2),
        dst_port_id: pid2,
        signal_type: 'audio_analog',
        cable_type: 'xlr3',
      });
      await viewProject(id);
    });

    $('#btn-add-link').addEventListener('click', async () => {
      const racks = data.racks || [];
      if (racks.length < 2) {
        alert('Au moins deux racks requis.');
        return;
      }
      const a = prompt('ID rack A ? (' + racks.map((r) => r.id).join(', ') + ')');
      const b = prompt('ID rack B ?');
      if (!a || !b) return;
      await api.post('/api/ef/rack-links', {
        project_id: Number(id),
        rack_a_id: Number(a),
        rack_b_id: Number(b),
        link_type: 'ethernet',
      });
      await viewProject(id);
    });

    $('#btn-pdf').addEventListener('click', async () => {
      const exp = await api.get('/api/ef/export/pdf?project_id=' + encodeURIComponent(id));
      const mods = {};
      $$('#pdf-modules input[data-mod]').forEach((el) => {
        mods[el.getAttribute('data-mod')] = el.checked;
      });
      const theme = $('#pdf-theme').value;
      await buildPdf(exp, mods, theme);
    });
  }

  async function viewSlots(rackId, projectId) {
    const rack = state.project?.racks?.find((r) => String(r.id) === String(rackId));
    const slots = await api.get('/api/ef/slots?rack_id=' + encodeURIComponent(rackId));
    const devs = await api.get('/api/ef/devices');
    const opts = devs.map((d) => `<option value="${d.id}">${esc(d.name)}</option>`).join('');
    const rows = slots
      .map(
        (s) =>
          `<tr data-sid="${s.id}"><td>${s.slot_u}</td><td>${esc(s.device_name)}</td>
          <td><input type="text" class="port-labels" data-id="${s.id}" placeholder='{"p1":"label"}' value="${esc(s.port_labels || '')}" /></td>
          <td><button type="button" data-save="${s.id}">Sauver labels</button></td></tr>`
      )
      .join('');
    mount(
      layout(
        'Slots — ' + (rack ? rack.name : rackId),
        `<p><a href="#/project/${projectId}">← Projet</a></p>
        <section class="card">
          <h2>Ajouter un équipement</h2>
          <form id="f-slot" class="row">
            <select name="device_template_id">${opts}</select>
            <input name="slot_u" type="number" min="1" max="42" value="1" />
            <button type="submit">Placer</button>
          </form>
        </section>
        <section class="card">
          <h2>Slots — port_labels (JSON)</h2>
          <table class="table"><thead><tr><th>U</th><th>Équipement</th><th>port_labels JSON</th><th></th></tr></thead>
          <tbody>${rows || '<tr><td colspan="4">Vide</td></tr>'}</tbody></table>
        </section>`
      )
    );
    $('#f-slot').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const fd = new FormData(ev.target);
      await api.post('/api/ef/slots', {
        rack_id: Number(rackId),
        device_template_id: Number(fd.get('device_template_id')),
        slot_u: Number(fd.get('slot_u')),
        slot_col: 0,
      });
      await viewSlots(rackId, projectId);
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
        alert('Enregistré');
      })
    );
  }

  async function viewDevices() {
    if (!state.user) {
      nav('#/login');
      return;
    }
    const list = await api.get('/api/ef/devices');
    const rows = list
      .map(
        (d) =>
          `<tr><td><a href="#/device/${d.id}">${esc(d.name)}</a></td><td>${esc(d.manufacturer || '')}</td>
          <td>${esc(d.category)}</td><td>${d.rack_u}U</td><td>${d.is_public ? 'public' : 'perso'}</td></tr>`
      )
      .join('');
    mount(
      layout(
        'Bibliothèque équipements',
        `<p><button type="button" id="btn-dev-new">Nouvel équipement</button></p>
        <table class="table"><thead><tr><th>Nom</th><th>Marque</th><th>Cat.</th><th>U</th><th></th></tr></thead>
        <tbody>${rows}</tbody></table>`
      )
    );
    $('#btn-dev-new').addEventListener('click', async () => {
      const name = prompt('Nom commercial ?');
      if (!name) return;
      const d = await api.post('/api/ef/devices', { name, category: 'custom', rack_u: 1 });
      nav('#/device/' + d.id);
    });
  }

  async function viewDeviceEdit(devId) {
    if (!state.user) {
      nav('#/login');
      return;
    }
    const d = await api.get('/api/ef/devices/' + devId);
    mount(
      layout(
        'Équipement — ' + d.name,
        `<p><a href="#/devices">← Bibliothèque</a></p>
        <section class="card">
          <form id="f-dev">
            <label>Nom <input name="name" value="${esc(d.name)}" required /></label>
            <label>Marque <input name="manufacturer" value="${esc(d.manufacturer || '')}" /></label>
            <label>Catégorie
              <select name="category">
                ${['audio', 'light', 'network', 'power', 'fx', 'custom']
                  .map((c) => `<option value="${c}" ${d.category === c ? 'selected' : ''}>${c}</option>`)
                  .join('')}
              </select>
            </label>
            <label>U <input name="rack_u" type="number" min="1" max="4" value="${d.rack_u}" /></label>
            <label>Largeur
              <select name="rack_width">
                <option value="full" ${d.rack_width === 'full' ? 'selected' : ''}>19" full</option>
                <option value="half" ${d.rack_width === 'half' ? 'selected' : ''}>Half</option>
                <option value="third" ${d.rack_width === 'third' ? 'selected' : ''}>Third</option>
              </select>
            </label>
            <label>Conso (W) <input name="power_w" type="number" value="${d.power_w ?? 0}" /></label>
            <label>Notes <textarea name="notes">${esc(d.notes || '')}</textarea></label>
            <label><input type="checkbox" name="is_public" ${d.is_public ? 'checked' : ''} /> Public</label>
            <button type="submit">Enregistrer infos</button>
          </form>
        </section>
        <section class="card">
          <h2>Face avant</h2>
          <div id="edit-front"></div>
          <button type="button" id="btn-save-front">Générer SVG + JSON face avant</button>
        </section>
        <section class="card">
          <h2>Face arrière</h2>
          <div id="edit-rear"></div>
          <button type="button" id="btn-save-rear">Générer SVG + JSON face arrière</button>
        </section>`
      )
    );

    const ef = new PanelEditor($('#edit-front'), { rack_u: d.rack_u, rack_width: d.rack_width, face: 'front' });
    ef.loadFromDevice(d);
    ef.render();
    const er = new PanelEditor($('#edit-rear'), { rack_u: d.rack_u, rack_width: d.rack_width, face: 'rear' });
    er.loadFromDevice(d);
    er.render();

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
      await viewDeviceEdit(devId);
    });

    $('#btn-save-front').addEventListener('click', async () => {
      const frontPorts = ef.getPortsJson();
      const panel_front_svg = ef.buildSvgString();
      await api.put('/api/ef/devices/' + devId, {
        name: d.name,
        category: d.category,
        rack_u: d.rack_u,
        rack_width: d.rack_width,
        panel_front_svg,
        panel_front_ports: JSON.parse(frontPorts || '[]'),
      });
      alert('Face avant enregistrée');
    });
    $('#btn-save-rear').addEventListener('click', async () => {
      const rearPorts = er.getPortsJson();
      const panel_rear_svg = er.buildSvgString();
      await api.put('/api/ef/devices/' + devId, {
        name: d.name,
        category: d.category,
        rack_u: d.rack_u,
        rack_width: d.rack_width,
        panel_rear_svg,
        panel_rear_ports: JSON.parse(rearPorts || '[]'),
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
      y += 8;
      line('Lieu: ' + (exp.project?.venue || ''), 20, y);
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
        line(`${r.name} — ${r.size_u}U — ${r.location || ''}`, 20, y);
        y += 7;
        for (const s of r.slots || []) {
          line(`  U${s.slot_u} ${s.device_name} (${s.category})`, 22, y);
          y += 6;
          if (y > 270) {
            doc.addPage();
            y = 20;
          }
        }
        y += 4;
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
        const t = `${c.src_device_name} [${c.src_port_id}] → ${c.dst_device_name} [${c.dst_port_id}] (${c.signal_type})`;
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
      line('Liaisons inter-racks', 20, y);
      y += 10;
      for (const l of exp.rack_links || []) {
        line(`${l.rack_a_name || l.rack_a_id} ↔ ${l.rack_b_name || l.rack_b_id} (${l.link_type})`, 20, y);
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
      if (parts[0] === 'projects' || parts[0] === 'project' || parts[0] === 'devices' || parts[0] === 'device') {
        nav('#/login');
        return;
      }
    }
    if (parts.length === 0) {
      if (state.user) {
        await viewProjects();
      } else {
        await viewLogin();
      }
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
      await viewProjects();
      return;
    }
    if (parts[0] === 'project' && parts[1]) {
      await viewProject(parts[1]);
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
    await viewLogin();
  }

  window.addEventListener('hashchange', () => route().catch((e) => console.error(e)));
  route().catch((e) => console.error(e));
})();
