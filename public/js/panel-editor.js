(function (global) {
  'use strict';

  const WIDTH = { full: 450, half: 213, third: 140 };
  const U_H = 44;

  const PORT_TYPES = [
    { id: 'xlr_m', label: 'XLR M' },
    { id: 'xlr_f', label: 'XLR F' },
    { id: 'xlr5_m', label: 'XLR5 M' },
    { id: 'xlr5_f', label: 'XLR5 F' },
    { id: 'rj45', label: 'RJ45' },
    { id: 'speakon_4', label: 'Speakon' },
    { id: 'powercon_in', label: 'PowerCON in' },
    { id: 'iec_in', label: 'IEC in' },
  ];

  class PanelEditor {
    constructor(root, opts) {
      this.root = root;
      this.rackU = Math.max(1, Math.min(4, opts.rack_u || 1));
      this.rackWidth = opts.rack_width || 'full';
      this.face = opts.face || 'front';
      this.ports = [];
      this._paletteType = 'xlr_f';
      this._svg = null;
      this._dragIdx = null;
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
    }

    getPortsJson() {
      return JSON.stringify(this.ports);
    }

    buildSvgString() {
      const w = WIDTH[this.rackWidth] || WIDTH.full;
      const h = U_H * this.rackU;
      let body = '';
      for (const p of this.ports) {
        const r = p.radius || 8;
        body += `<circle data-pid="${String(p.id).replace(/"/g, '')}" cx="${p.x}" cy="${p.y}" r="${r}" fill="#2a2d34" stroke="#888"/>`;
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
      return { x: Math.round(loc.x), y: Math.round(loc.y) };
    }

    render() {
      const w = WIDTH[this.rackWidth] || WIDTH.full;
      const h = U_H * this.rackU;
      this.root.innerHTML = '';
      const wrap = document.createElement('div');
      wrap.className = 'panel-editor';

      const pal = document.createElement('div');
      pal.className = 'port-palette';
      pal.innerHTML = '<span>Port :</span> ';
      const sel = document.createElement('select');
      PORT_TYPES.forEach((t) => {
        const o = document.createElement('option');
        o.value = t.id;
        o.textContent = t.label;
        sel.appendChild(o);
      });
      sel.value = this._paletteType;
      sel.addEventListener('change', () => {
        this._paletteType = sel.value;
      });
      pal.appendChild(sel);
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
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.dataset.idx = String(idx);
        const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        const r = p.radius || 8;
        c.setAttribute('cx', String(p.x));
        c.setAttribute('cy', String(p.y));
        c.setAttribute('r', String(r));
        c.setAttribute('fill', p.color || '#3d5a80');
        c.setAttribute('stroke', '#ccc');
        c.style.cursor = 'move';
        g.appendChild(c);
        svg.appendChild(g);

        g.addEventListener('dblclick', (ev) => {
          ev.stopPropagation();
          this.ports.splice(idx, 1);
          this.render();
        });
        g.addEventListener('mousedown', (ev) => {
          ev.stopPropagation();
          ev.preventDefault();
          const onMove = (e) => {
            const p = this.ports[idx];
            if (!p) return;
            const loc = this._loc(svg, e);
            p.x = loc.x;
            p.y = loc.y;
            c.setAttribute('cx', String(p.x));
            c.setAttribute('cy', String(p.y));
          };
          const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
          };
          document.addEventListener('mousemove', onMove);
          document.addEventListener('mouseup', onUp);
        });
      });

      svg.addEventListener('click', (ev) => {
        if (ev.target.closest('g')) return;
        const loc = this._loc(svg, ev);
        const id = 'p_' + Date.now();
        this.ports.push({
          id,
          type: this._paletteType,
          x: loc.x,
          y: loc.y,
          radius: 8,
          label: '',
          signal: 'audio_analog',
          color: '#3d5a80',
        });
        this.render();
      });

      wrap.appendChild(svg);
      const hint = document.createElement('p');
      hint.className = 'muted';
      hint.textContent = 'Clic fond = ajouter · double-clic port = supprimer · glisser pour déplacer';
      wrap.appendChild(hint);
      this.root.appendChild(wrap);
    }
  }

  global.PanelEditor = PanelEditor;
  global.PORT_TYPES = PORT_TYPES;
})(typeof window !== 'undefined' ? window : globalThis);
