(function (global) {
  'use strict';

  const WIDTH = { full: 450, half: 213, third: 140 };
  const U_H = 44;

  /** Emplacements max par ligne (largeur 19") : full = 10, demi-rack et tiers proportionnels. */
  const SLOTS_PER_U = { full: 10, half: 5, third: 3 };

  /** Liste pour rétrocompatibilité — préférer PortShapes.PORT_TYPES */
  const PORT_TYPES = [];

  class PanelEditor {
    constructor(root, opts) {
      this.root = root;
      this.rackU = Math.max(1, Math.min(4, opts.rack_u || 1));
      this.rackWidth = opts.rack_width || 'full';
      this.face = opts.face || 'front';
      this.ports = [];
      this._paletteType = 'xlr_f';
      this._svg = null;
      /** Évite un clic « ajouter » sur le fond juste après un drag depuis un port. */
      this._suppressGridClickUntil = 0;
    }

    _cols() {
      return SLOTS_PER_U[this.rackWidth] != null ? SLOTS_PER_U[this.rackWidth] : SLOTS_PER_U.full;
    }

    _maxPorts() {
      return this._cols() * this.rackU;
    }

    _cellFromXY(x, y) {
      const cols = this._cols();
      const w = WIDTH[this.rackWidth] || WIDTH.full;
      const cw = w / cols;
      const ch = U_H;
      let col = Math.floor(x / cw);
      let row = Math.floor(y / ch);
      col = Math.max(0, Math.min(cols - 1, col));
      row = Math.max(0, Math.min(this.rackU - 1, row));
      return { col, row };
    }

    _cellCenter(col, row) {
      const cols = this._cols();
      const w = WIDTH[this.rackWidth] || WIDTH.full;
      const cw = w / cols;
      const ch = U_H;
      return { x: (col + 0.5) * cw, y: (row + 0.5) * ch };
    }

    _applyGridToXY(p) {
      const { x, y } = this._cellCenter(p.gridCol, p.gridRow);
      p.x = x;
      p.y = y;
    }

    /** Anciens JSON avec x/y libres → grille + dédoublonnage. */
    _normalizePortsAfterLoad() {
      const cols = this._cols();
      const rows = this.rackU;
      const used = new Set();
      const next = [];
      for (const raw of this.ports) {
        const p = { ...raw };
        if (typeof p.gridCol !== 'number' || typeof p.gridRow !== 'number') {
          const c = this._cellFromXY(p.x ?? 0, p.y ?? 0);
          p.gridCol = c.col;
          p.gridRow = c.row;
        }
        p.gridCol = Math.max(0, Math.min(cols - 1, Math.floor(p.gridCol)));
        p.gridRow = Math.max(0, Math.min(rows - 1, Math.floor(p.gridRow)));
        let key = `${p.gridCol},${p.gridRow}`;
        if (used.has(key)) {
          let found = false;
          for (let r = 0; r < rows && !found; r++) {
            for (let c = 0; c < cols && !found; c++) {
              const k = `${c},${r}`;
              if (!used.has(k)) {
                p.gridCol = c;
                p.gridRow = r;
                key = k;
                found = true;
              }
            }
          }
          if (!found) continue;
        }
        used.add(key);
        this._applyGridToXY(p);
        next.push(p);
      }
      this.ports = next;
    }

    loadFromDevice(dev) {
      const key = this.face === 'front' ? 'panel_front_ports' : 'panel_rear_ports';
      const raw = dev[key];
      if (!raw) {
        this.ports = [];
        return;
      }
      try {
        const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
        this.ports = Array.isArray(arr) ? arr : [];
      } catch {
        this.ports = [];
      }
      this._normalizePortsAfterLoad();
    }

    getPortsJson() {
      this.ports.forEach((p) => this._applyGridToXY(p));
      return JSON.stringify(this.ports);
    }

    buildSvgString() {
      const PS = global.PortShapes;
      if (!PS) {
        return this._buildSvgStringLegacy();
      }
      const w = WIDTH[this.rackWidth] || WIDTH.full;
      const h = U_H * this.rackU;
      const cols = this._cols();
      const cw = w / cols;
      let body = '';
      for (const p of this.ports) {
        const gc = typeof p.gridCol === 'number' ? p.gridCol : this._cellFromXY(p.x ?? 0, p.y ?? 0).col;
        const gr = typeof p.gridRow === 'number' ? p.gridRow : this._cellFromXY(p.x ?? 0, p.y ?? 0).row;
        const { x, y } = this._cellCenter(gc, gr);
        const t = PS.defaultType(p.type || 'xlr_f');
        const col = p.color || '#5a6a85';
        const inner = PS.shapeToSvgString(t, col, cw);
        body += `<g transform="translate(${x},${y})">${inner}</g>`;
      }
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">${body}</svg>`;
    }

    _buildSvgStringLegacy() {
      const w = WIDTH[this.rackWidth] || WIDTH.full;
      const h = U_H * this.rackU;
      let body = '';
      for (const p of this.ports) {
        const gc = typeof p.gridCol === 'number' ? p.gridCol : this._cellFromXY(p.x ?? 0, p.y ?? 0).col;
        const gr = typeof p.gridRow === 'number' ? p.gridRow : this._cellFromXY(p.x ?? 0, p.y ?? 0).row;
        const { x, y } = this._cellCenter(gc, gr);
        const r = p.radius || 8;
        body += `<circle cx="${x}" cy="${y}" r="${r}" fill="#2a2d34" stroke="#888"/>`;
      }
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">${body}</svg>`;
    }

    _loc(svg, ev) {
      const pt = svg.createSVGPoint();
      pt.x = ev.clientX;
      pt.y = ev.clientY;
      const ctm = svg.getScreenCTM();
      if (!ctm) return { x: 0, y: 0 };
      const loc = pt.matrixTransform(ctm.inverse());
      return { x: loc.x, y: loc.y };
    }

    _setGroupTransform(g, x, y) {
      g.setAttribute('transform', `translate(${x} ${y})`);
    }

    render() {
      const PS = global.PortShapes;
      const w = WIDTH[this.rackWidth] || WIDTH.full;
      const h = U_H * this.rackU;
      const cols = this._cols();
      const cw = w / cols;
      this.root.innerHTML = '';
      const wrap = document.createElement('div');
      wrap.className = 'panel-editor';

      const pal = document.createElement('div');
      pal.className = 'port-palette';
      pal.innerHTML = '<span>Type de connecteur :</span> ';
      const sel = document.createElement('select');
      sel.className = 'ef-select';
      sel.style.display = 'inline-block';
      sel.style.width = 'auto';
      sel.style.minWidth = '200px';
      sel.style.marginLeft = '8px';
      sel.style.marginTop = '0';
      const typesMap = PS ? PS.PORT_TYPES : {};
      const keys = Object.keys(typesMap).length ? Object.keys(typesMap) : ['xlr_f', 'xlr_m', 'xlr5_f', 'rj45', 'iec_in', 'schuko_f'];
      keys.forEach((id) => {
        const o = document.createElement('option');
        o.value = id;
        o.textContent = typesMap[id] ? typesMap[id].label : id;
        sel.appendChild(o);
      });
      sel.value = PS ? PS.defaultType(this._paletteType) : this._paletteType;
      sel.addEventListener('change', () => {
        this._paletteType = sel.value;
      });
      pal.appendChild(sel);
      const gridHint = document.createElement('span');
      gridHint.className = 'muted';
      gridHint.style.marginLeft = '10px';
      gridHint.style.fontSize = '12px';
      gridHint.textContent =
        '· Grille : ' + cols + ' × ' + this.rackU + 'U max (' + this._maxPorts() + ' prises) · 19" full = 10 / ligne';
      pal.appendChild(gridHint);
      wrap.appendChild(pal);

      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      this._svg = svg;
      svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
      svg.setAttribute('width', String(Math.min(w, 480)));
      svg.setAttribute('height', String(Math.min(h, 320)));
      svg.classList.add('panel-svg');
      svg.style.background = '#0e0f11';
      svg.style.border = '1px solid #333';

      const frame = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      frame.setAttribute('x', '0');
      frame.setAttribute('y', '0');
      frame.setAttribute('width', String(w));
      frame.setAttribute('height', String(h));
      frame.setAttribute('fill', 'none');
      frame.setAttribute('stroke', '#444');
      svg.appendChild(frame);

      for (let row = 0; row < this.rackU; row++) {
        for (let c = 0; c < cols; c++) {
          const cell = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          cell.setAttribute('x', String(c * cw));
          cell.setAttribute('y', String(row * U_H));
          cell.setAttribute('width', String(cw));
          cell.setAttribute('height', String(U_H));
          cell.setAttribute('fill', 'none');
          cell.setAttribute('stroke', '#2a2d38');
          cell.setAttribute('stroke-dasharray', '2 3');
          cell.setAttribute('class', 'panel-grid-cell');
          cell.setAttribute('data-grid-col', String(c));
          cell.setAttribute('data-grid-row', String(row));
          svg.appendChild(cell);
        }
      }

      for (let u = 1; u < this.rackU; u++) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', '0');
        line.setAttribute('x2', String(w));
        line.setAttribute('y1', String(u * U_H));
        line.setAttribute('y2', String(u * U_H));
        line.setAttribute('stroke', '#333');
        svg.appendChild(line);
      }

      this.ports.forEach((p, idx) => {
        this._applyGridToXY(p);
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('data-idx', String(idx));
        g.style.cursor = 'grab';
        this._setGroupTransform(g, p.x, p.y);

        if (PS) {
          const t = PS.defaultType(p.type || 'xlr_f');
          PS.appendShapeToGroup(g, t, p.color, cw);
        } else {
          const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          c.setAttribute('r', String(p.radius || 8));
          c.setAttribute('fill', p.color || '#3d5a80');
          c.setAttribute('stroke', '#ccc');
          g.appendChild(c);
        }

        svg.appendChild(g);

        g.addEventListener('dblclick', (ev) => {
          ev.stopPropagation();
          ev.preventDefault();
          this.ports.splice(idx, 1);
          this.render();
        });

        /** Suppression sans double-clic (grille pleine / navigateurs qui cassent dblclick après re-render). */
        g.addEventListener('click', (ev) => {
          if (!ev.altKey) return;
          ev.stopPropagation();
          ev.preventDefault();
          this.ports.splice(idx, 1);
          this.render();
        });

        g.addEventListener('mousedown', (ev) => {
          ev.stopPropagation();
          const port = this.ports[idx];
          if (!port) return;
          const startCol = port.gridCol;
          const startRow = port.gridRow;
          g.style.cursor = 'grabbing';
          const onMove = (e) => {
            const loc = this._loc(svg, e);
            const { col, row } = this._cellFromXY(loc.x, loc.y);
            const { x, y } = this._cellCenter(col, row);
            this._setGroupTransform(g, x, y);
          };
          const onUp = (e) => {
            g.style.cursor = 'grab';
            this._suppressGridClickUntil = Date.now() + 350;
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            const loc = this._loc(svg, e);
            const { col, row } = this._cellFromXY(loc.x, loc.y);
            if (col === startCol && row === startRow) {
              /* Ne pas re-render : sinon le DOM est recréé entre les deux clics et le double-clic ne supprime jamais. */
              this._applyGridToXY(port);
              this._setGroupTransform(g, port.x, port.y);
              return;
            }
            const j = this.ports.findIndex(
              (p2, i) => i !== idx && p2.gridCol === col && p2.gridRow === row
            );
            if (j >= 0) {
              this.ports[j].gridCol = startCol;
              this.ports[j].gridRow = startRow;
            }
            port.gridCol = col;
            port.gridRow = row;
            this._applyGridToXY(port);
            if (j >= 0) this._applyGridToXY(this.ports[j]);
            this.render();
          };
          document.addEventListener('mousemove', onMove);
          document.addEventListener('mouseup', onUp);
        });
      });

      svg.addEventListener('click', (ev) => {
        if (ev.target.closest('g[data-idx]')) return;
        if (Date.now() < this._suppressGridClickUntil) return;
        const loc = this._loc(svg, ev);
        const { col, row } = this._cellFromXY(loc.x, loc.y);
        const taken = this.ports.some((p) => p.gridCol === col && p.gridRow === row);
        if (taken) return;
        if (this.ports.length >= this._maxPorts()) {
          return;
        }
        const id = 'p_' + Date.now();
        const PSg = global.PortShapes;
        const ptype = PSg ? PSg.defaultType(this._paletteType) : this._paletteType;
        const meta = PSg && PSg.PORT_TYPES[ptype] ? PSg.PORT_TYPES[ptype] : { r: 10, signal: 'audio_analog' };
        const np = {
          id,
          type: ptype,
          gridCol: col,
          gridRow: row,
          radius: meta.r || 10,
          label: '',
          signal: meta.signal || 'audio_analog',
          color: '#4f8ef7',
        };
        this._applyGridToXY(np);
        this.ports.push(np);
        this.render();
      });

      wrap.appendChild(svg);
      const hint = document.createElement('p');
      hint.className = 'muted';
      hint.style.fontSize = '12px';
      hint.style.marginTop = '8px';
      hint.innerHTML =
        'Clic sur une case vide = ajouter · <strong>double-clic</strong> sur un connecteur = supprimer · ou <strong>Alt + clic</strong> pour supprimer · glisser pour déplacer (échange si occupé). Grille 19". Face vide possible — enregistrez pour sauver.';
      wrap.appendChild(hint);
      this.root.appendChild(wrap);
    }
  }

  global.PanelEditor = PanelEditor;
  global.PORT_TYPES = PORT_TYPES;
})(typeof window !== 'undefined' ? window : globalThis);
