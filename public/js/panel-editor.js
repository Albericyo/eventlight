(function (global) {
  'use strict';

  const WIDTH = { full: 450, half: 213, third: 140 };
  const U_H = 44;

  /** Référence 19" (demi / tiers) — plus de placement sur grille 10 cases : position horizontale libre par ligne U. */
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
      this._paletteType = 'xlr3_in';
      this._svg = null;
      /** Évite un clic « ajouter » sur le fond juste après un drag depuis un port. */
      this._suppressGridClickUntil = 0;
    }

    _cols() {
      return SLOTS_PER_U[this.rackWidth] != null ? SLOTS_PER_U[this.rackWidth] : SLOTS_PER_U.full;
    }

    _panelW() {
      return WIDTH[this.rackWidth] || WIDTH.full;
    }

    _maxPorts() {
      return Math.max(64, this._cols() * this.rackU * 4);
    }

    _rowFromY(y) {
      return Math.max(0, Math.min(this.rackU - 1, Math.floor(y / U_H)));
    }

    _clampXNorm(xn, type) {
      const PS = global.PortShapes;
      const span = PS && PS.portSpan ? PS.portSpan(type || 'xlr3_in') : 0.055;
      const lo = span / 2;
      const hi = 1 - span / 2;
      return Math.max(lo, Math.min(hi, xn));
    }

    _applyFreeXY(p) {
      const w = this._panelW();
      const PS = global.PortShapes;
      const span = PS && PS.portSpan ? PS.portSpan(p.type || 'xlr3_in') : 0.055;
      let row =
        typeof p.row === 'number'
          ? p.row
          : typeof p.gridRow === 'number'
            ? Math.floor(p.gridRow)
            : this._rowFromY(Number(p.y) || U_H / 2);
      row = Math.max(0, Math.min(this.rackU - 1, Math.floor(row)));
      let xn;
      if (typeof p.xNorm === 'number') {
        xn = p.xNorm;
      } else if (typeof p.gridCol === 'number') {
        const cols = this._cols();
        xn = (Math.max(0, Math.min(cols - 1, Math.floor(p.gridCol))) + 0.5) / cols;
      } else {
        xn = (Number(p.x) || w / 2) / w;
      }
      xn = this._clampXNorm(xn, p.type);
      p.row = row;
      p.xNorm = xn;
      p.x = xn * w;
      p.y = (row + 0.5) * U_H;
    }

    _syncLegacyGrid(p) {
      const cols = this._cols();
      p.gridRow = p.row;
      p.gridCol = Math.min(cols - 1, Math.max(0, Math.round(p.xNorm * cols - 0.5)));
    }

    /** Charge JSON : anciens ports (gridCol) → row + xNorm ; plusieurs ports sur une même ligne possibles. */
    _normalizePortsAfterLoad() {
      const next = [];
      for (const raw of this.ports) {
        if (!raw || typeof raw !== 'object') continue;
        const p = { ...raw };
        this._applyFreeXY(p);
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
      this.ports.forEach((p) => {
        this._applyFreeXY(p);
        this._syncLegacyGrid(p);
      });
      return JSON.stringify(this.ports);
    }

    buildSvgString() {
      const PS = global.PortShapes;
      if (!PS) {
        return this._buildSvgStringLegacy();
      }
      const w = this._panelW();
      const h = U_H * this.rackU;
      let body = '';
      for (const p of this.ports) {
        this._applyFreeXY(p);
        const { x, y } = p;
        const t = PS.defaultType(p.type || 'xlr3_in');
        const col = p.color || '#5a6a85';
        const inner = PS.shapeToSvgString(t, col);
        body += `<g transform="translate(${x},${y})">${inner}</g>`;
      }
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">${body}</svg>`;
    }

    _buildSvgStringLegacy() {
      const w = this._panelW();
      const h = U_H * this.rackU;
      let body = '';
      for (const p of this.ports) {
        this._applyFreeXY(p);
        const { x, y } = p;
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
      const w = this._panelW();
      const h = U_H * this.rackU;
      const cols = this._cols();
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
      const keys = Object.keys(typesMap).length ? Object.keys(typesMap) : ['xlr3_in', 'xlr3_out', 'dmx3_in', 'dmx3_out', 'dmx5_in', 'dmx5_out', 'rj45', 'iec_in', 'schuko_f'];
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
        '· ' +
        this.rackU +
        ' ligne(s) U · déplacement horizontal libre · XLR 3 / DMX en IN / OUT (nickel / vert) · ref. 19” (' +
        cols +
        ' unités) · max ~' +
        this._maxPorts() +
        ' ports';
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
        const band = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        band.setAttribute('x', '0');
        band.setAttribute('y', String(row * U_H));
        band.setAttribute('width', String(w));
        band.setAttribute('height', String(U_H));
        band.setAttribute('fill', 'rgba(22,24,30,0.45)');
        band.setAttribute('stroke', '#2a2d38');
        band.setAttribute('stroke-dasharray', '5 5');
        band.setAttribute('class', 'panel-u-band');
        svg.appendChild(band);
      }

      for (let u = 1; u < this.rackU; u++) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', '0');
        line.setAttribute('x2', String(w));
        line.setAttribute('y1', String(u * U_H));
        line.setAttribute('y2', String(u * U_H));
        line.setAttribute('stroke', '#444');
        svg.appendChild(line);
      }

      this.ports.forEach((p, idx) => {
        this._applyFreeXY(p);
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('data-idx', String(idx));
        g.style.cursor = 'grab';
        this._setGroupTransform(g, p.x, p.y);

        if (PS) {
          const t = PS.defaultType(p.type || 'xlr3_in');
          PS.appendShapeToGroup(g, t, p.color);
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
          g.style.cursor = 'grabbing';
          const onMove = (e) => {
            const loc = this._loc(svg, e);
            const row = this._rowFromY(loc.y);
            let xn = loc.x / w;
            xn = this._clampXNorm(xn, port.type);
            port.row = row;
            port.xNorm = xn;
            port.x = xn * w;
            port.y = (row + 0.5) * U_H;
            this._setGroupTransform(g, port.x, port.y);
          };
          const onUp = (e) => {
            g.style.cursor = 'grab';
            this._suppressGridClickUntil = Date.now() + 350;
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            const loc = this._loc(svg, e);
            const row = this._rowFromY(loc.y);
            let xn = loc.x / w;
            xn = this._clampXNorm(xn, port.type);
            port.row = row;
            port.xNorm = xn;
            this._applyFreeXY(port);
            this._setGroupTransform(g, port.x, port.y);
          };
          document.addEventListener('mousemove', onMove);
          document.addEventListener('mouseup', onUp);
        });
      });

      svg.addEventListener('click', (ev) => {
        if (ev.target.closest('g[data-idx]')) return;
        if (Date.now() < this._suppressGridClickUntil) return;
        const loc = this._loc(svg, ev);
        const row = this._rowFromY(loc.y);
        let xn = loc.x / w;
        if (this.ports.length >= this._maxPorts()) {
          return;
        }
        const id = 'p_' + Date.now();
        const PSg = global.PortShapes;
        const ptype = PSg ? PSg.defaultType(this._paletteType) : this._paletteType;
        const meta = PSg && PSg.PORT_TYPES[ptype] ? PSg.PORT_TYPES[ptype] : { r: 10, signal: 'audio_analog' };
        xn = this._clampXNorm(xn, ptype);
        const np = {
          id,
          type: ptype,
          row,
          xNorm: xn,
          radius: meta.r || 10,
          label: '',
          signal: meta.signal || 'audio_analog',
          color: '#4f8ef7',
        };
        this._applyFreeXY(np);
        this.ports.push(np);
        this.render();
      });

      wrap.appendChild(svg);
      const hint = document.createElement('p');
      hint.className = 'muted';
      hint.style.fontSize = '12px';
      hint.style.marginTop = '8px';
      hint.innerHTML =
        'Clic sur une <strong>ligne U</strong> = ajouter le connecteur choisi à cet endroit horizontal · <strong>glisser</strong> pour le déplacer sur la ligne (ou changer de ligne) · <strong>double-clic</strong> ou <strong>Alt + clic</strong> sur un connecteur = supprimer. Face vide possible — enregistrez pour sauver.';
      wrap.appendChild(hint);
      this.root.appendChild(wrap);
    }
  }

  global.PanelEditor = PanelEditor;
  global.PORT_TYPES = PORT_TYPES;
})(typeof window !== 'undefined' ? window : globalThis);
