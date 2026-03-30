/**
 * Rendus SVG par type de port — silhouettes proches des connecteurs réels (schéma technique).
 */
(function (global) {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';

  /**
   * span = part de la largeur du panneau occupée horizontalement (1.0 = toute la largeur).
   * Schuko ≈ 1/10 ; seul XLR 3 pin (audio) ; DMX en 3 ou 5 pin — nickel vs vert.
   */
  /** @type {Record<string, { label: string, r: number, span: number, signal?: string }>} */
  const PORT_TYPES = {
    xlr3_in: { label: 'XLR 3 pin IN', r: 10, span: 0.052, signal: 'audio_analog' },
    xlr3_out: { label: 'XLR 3 pin OUT', r: 10, span: 0.052, signal: 'audio_analog' },
    dmx3_in: { label: 'DMX 3 pin IN', r: 10, span: 0.052, signal: 'dmx' },
    dmx3_out: { label: 'DMX 3 pin OUT', r: 10, span: 0.052, signal: 'dmx' },
    dmx5_in: { label: 'DMX 5 pin IN', r: 10, span: 0.054, signal: 'dmx' },
    dmx5_out: { label: 'DMX 5 pin OUT', r: 10, span: 0.054, signal: 'dmx' },
    jack_ts: { label: 'Jack 6.35 TS', r: 8, span: 0.042, signal: 'audio_analog' },
    jack_trs: { label: 'Jack 6.35 TRS', r: 8, span: 0.042, signal: 'audio_analog' },
    jack_mini: { label: 'Jack 3.5 mm', r: 6, span: 0.035, signal: 'audio_analog' },
    rj45: { label: 'RJ45', r: 11, span: 0.058, signal: 'ethernet' },
    ethercon: { label: 'EtherCON', r: 10, span: 0.055, signal: 'ethernet' },
    speakon_2: { label: 'Speakon NL2', r: 10, span: 0.052, signal: 'audio_analog' },
    speakon_4: { label: 'Speakon NL4', r: 11, span: 0.055, signal: 'audio_analog' },
    powercon_in: { label: 'PowerCON entrée (bleu)', r: 10, span: 0.052, signal: 'power' },
    powercon_out: { label: 'PowerCON sortie (gris)', r: 10, span: 0.052, signal: 'power' },
    iec_in: { label: 'IEC C14 (entrée secteur)', r: 12, span: 0.085, signal: 'power' },
    iec_out: { label: 'IEC C13 (sortie)', r: 12, span: 0.085, signal: 'power' },
    schuko_f: { label: 'Prise secteur (Schuko F)', r: 14, span: 0.1, signal: 'power' },
    schuko_m: { label: 'Fiche secteur (Schuko M)', r: 14, span: 0.1, signal: 'power' },
    usb_a: { label: 'USB-A', r: 8, span: 0.038, signal: 'other' },
    usb_c: { label: 'USB-C', r: 7, span: 0.032, signal: 'other' },
    hdmi: { label: 'HDMI', r: 12, span: 0.068, signal: 'video' },
    bnc: { label: 'BNC', r: 9, span: 0.045, signal: 'video' },
    led_indicator: { label: 'LED', r: 4, span: 0.022, signal: 'other' },
    button: { label: 'Bouton', r: 7, span: 0.038, signal: 'other' },
    display: { label: 'Écran', r: 14, span: 0.078, signal: 'other' },
    knob: { label: 'Potentiomètre', r: 11, span: 0.055, signal: 'other' },
  };

  function stroke() {
    return '#9aa3b2';
  }
  /**Contour « nickel » pour XLR 3 pts (audio) — distinct du vert DMX. */
  function strokeXlr3() {
    return '#b8c5d4';
  }
  /**Contour DMX / éclairage — vert lisible sur fond sombre. */
  function strokeDmx() {
    return '#00e676';
  }
  function fillDmxShell() {
    return '#0d1814';
  }
  function fillDark() {
    return '#15181d';
  }
  function fillMetal() {
    return '#2a3140';
  }
  function accent(c) {
    return c || '#5a6a85';
  }

  /**
   * Dessine la forme centrée sur (0,0) dans le groupe g.
   */
  function appendShapeToGroup(g, type, color) {
    const st = stroke();
    const fd = fillDark();
    const fm = fillMetal();
    const ac = accent(color);

    function circle(cx, cy, r, opt) {
      const el = document.createElementNS(NS, 'circle');
      el.setAttribute('cx', String(cx));
      el.setAttribute('cy', String(cy));
      el.setAttribute('r', String(r));
      if (opt) {
        if (opt.fill) el.setAttribute('fill', opt.fill);
        if (opt.stroke) el.setAttribute('stroke', opt.stroke);
        if (opt.sw != null) el.setAttribute('stroke-width', String(opt.sw));
      }
      g.appendChild(el);
    }

    function rect(x, y, w, h, rx, opt) {
      const el = document.createElementNS(NS, 'rect');
      el.setAttribute('x', String(x));
      el.setAttribute('y', String(y));
      el.setAttribute('width', String(w));
      el.setAttribute('height', String(h));
      if (rx) el.setAttribute('rx', String(rx));
      if (opt) {
        if (opt.fill) el.setAttribute('fill', opt.fill);
        if (opt.stroke) el.setAttribute('stroke', opt.stroke);
        if (opt.sw != null) el.setAttribute('stroke-width', String(opt.sw));
      }
      g.appendChild(el);
    }

    function line(x1, y1, x2, y2, opt) {
      const el = document.createElementNS(NS, 'line');
      el.setAttribute('x1', String(x1));
      el.setAttribute('y1', String(y1));
      el.setAttribute('x2', String(x2));
      el.setAttribute('y2', String(y2));
      if (opt) {
        if (opt.stroke) el.setAttribute('stroke', opt.stroke);
        if (opt.sw != null) el.setAttribute('stroke-width', String(opt.sw));
      }
      g.appendChild(el);
    }

    function path(d, opt) {
      const el = document.createElementNS(NS, 'path');
      el.setAttribute('d', d);
      if (opt) {
        if (opt.fill) el.setAttribute('fill', opt.fill);
        if (opt.stroke) el.setAttribute('stroke', opt.stroke);
        if (opt.sw != null) el.setAttribute('stroke-width', String(opt.sw));
        if (opt.fillRule) el.setAttribute('fill-rule', opt.fillRule);
      }
      g.appendChild(el);
    }

    // —— XLR 3 pin IN : nickel + languette + 3 trous ——
    if (type === 'xlr3_in') {
      const sx = strokeXlr3();
      rect(-3, -12.2, 6, 3, 0.6, { fill: fm, stroke: sx, sw: 0.5 });
      circle(0, 0, 10, { fill: fd, stroke: sx, sw: 1.35 });
      const ang = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3];
      for (let i = 0; i < 3; i++) {
        const a = ang[i] - Math.PI / 2;
        circle(Math.cos(a) * 4.2, Math.sin(a) * 4.2, 1.8, { fill: '#0a0c0f', stroke: '#5a6a78', sw: 0.5 });
      }
      circle(0, 0, 2.2, { fill: '#333944', stroke: '#7a8a9a', sw: 0.45 });
      return;
    }

    // —— XLR 3 pin OUT : nickel + languette + 3 broches ——
    if (type === 'xlr3_out') {
      const sx = strokeXlr3();
      rect(-3, -12.2, 6, 3, 0.6, { fill: fm, stroke: sx, sw: 0.5 });
      circle(0, 0, 10, { fill: fd, stroke: sx, sw: 1.35 });
      const ang = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3];
      for (let i = 0; i < 3; i++) {
        const a = ang[i] - Math.PI / 2;
        line(Math.cos(a) * 2, Math.sin(a) * 2, Math.cos(a) * 6.5, Math.sin(a) * 6.5, { stroke: '#d8dde6', sw: 1.8 });
        circle(Math.cos(a) * 7.2, Math.sin(a) * 7.2, 1.2, { fill: '#eef1f6', stroke: '#8899aa', sw: 0.45 });
      }
      circle(0, 0, 2, { fill: fm, stroke: '#7a8a9a', sw: 0.45 });
      return;
    }

    // —— DMX 3 pin IN / OUT (même géométrie que XLR 3, coque verte) ——
    if (type === 'dmx3_in') {
      const sx = strokeDmx();
      const dfill = fillDmxShell();
      rect(-3, -12.2, 6, 3, 0.6, { fill: fm, stroke: sx, sw: 0.5 });
      circle(0, 0, 10, { fill: dfill, stroke: sx, sw: 1.35 });
      const ang = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3];
      for (let i = 0; i < 3; i++) {
        const a = ang[i] - Math.PI / 2;
        circle(Math.cos(a) * 4.2, Math.sin(a) * 4.2, 1.8, { fill: '#050807', stroke: '#1b5e20', sw: 0.5 });
      }
      circle(0, 0, 2.2, { fill: '#1b3a25', stroke: sx, sw: 0.45 });
      return;
    }
    if (type === 'dmx3_out') {
      const sx = strokeDmx();
      const dfill = fillDmxShell();
      rect(-3, -12.2, 6, 3, 0.6, { fill: fm, stroke: sx, sw: 0.5 });
      circle(0, 0, 10, { fill: dfill, stroke: sx, sw: 1.35 });
      const ang = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3];
      for (let i = 0; i < 3; i++) {
        const a = ang[i] - Math.PI / 2;
        line(Math.cos(a) * 2, Math.sin(a) * 2, Math.cos(a) * 6.5, Math.sin(a) * 6.5, { stroke: '#b9f6ca', sw: 1.8 });
        circle(Math.cos(a) * 7.2, Math.sin(a) * 7.2, 1.2, { fill: '#e8f8ee', stroke: '#2e7d32', sw: 0.45 });
      }
      circle(0, 0, 2, { fill: '#1b3a25', stroke: sx, sw: 0.45 });
      return;
    }

    // —— DMX 5 pin IN / OUT ——
    if (type === 'dmx5_in') {
      const sx = strokeDmx();
      const dfill = fillDmxShell();
      circle(0, 0, 10, { fill: dfill, stroke: sx, sw: 1.45 });
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * 2 * Math.PI - Math.PI / 2;
        circle(Math.cos(a) * 5, Math.sin(a) * 5, 1.45, { fill: '#050807', stroke: '#1b5e20', sw: 0.45 });
      }
      circle(0, 0, 1.9, { fill: '#1b3a25', stroke: sx, sw: 0.35 });
      return;
    }
    if (type === 'dmx5_out') {
      const sx = strokeDmx();
      const dfill = fillDmxShell();
      circle(0, 0, 10, { fill: dfill, stroke: sx, sw: 1.45 });
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * 2 * Math.PI - Math.PI / 2;
        line(Math.cos(a) * 2.5, Math.sin(a) * 2.5, Math.cos(a) * 7, Math.sin(a) * 7, { stroke: '#b9f6ca', sw: 1.25 });
        circle(Math.cos(a) * 7.5, Math.sin(a) * 7.5, 1.05, { fill: '#e8f8ee', stroke: '#2e7d32', sw: 0.35 });
      }
      return;
    }

    // —— IEC C14 entrée (prise appareil) : rectangle + 3 fentes + plot terre ——
    if (type === 'iec_in') {
      rect(-11, -8, 22, 16, 2, { fill: fd, stroke: st, sw: 1 });
      rect(-6, -5, 3, 7, 0.5, { fill: '#0a0a0a', stroke: '#444', sw: 0.3 });
      rect(-1.5, -5, 3, 7, 0.5, { fill: '#0a0a0a', stroke: '#444', sw: 0.3 });
      rect(3, -5, 3, 7, 0.5, { fill: '#0a0a0a', stroke: '#444', sw: 0.3 });
      path('M 0 5 L -3 8 L 3 8 Z', { fill: fm, stroke: st, sw: 0.5 });
      return;
    }

    // —— IEC C13 sortie (femelle cordon) ——
    if (type === 'iec_out') {
      rect(-11, -8, 22, 16, 2, { fill: fd, stroke: st, sw: 1 });
      rect(-6, -4, 3, 6, 0.5, { fill: '#1a1a1a', stroke: '#555', sw: 0.3 });
      rect(-1.5, -4, 3, 6, 0.5, { fill: '#1a1a1a', stroke: '#555', sw: 0.3 });
      rect(3, -4, 3, 6, 0.5, { fill: '#1a1a1a', stroke: '#555', sw: 0.3 });
      circle(0, 6, 2, { fill: fm, stroke: st, sw: 0.4 });
      return;
    }

    // —— Prise Schuko CEE 7/3 (F) : platine ronde, 2 trous 19 mm + ressorts terre haut/bas ——
    if (type === 'schuko_f') {
      circle(0, 0, 12, { fill: '#f4efe6', stroke: '#a89880', sw: 0.75 });
      circle(0, 0, 10.2, { fill: '#ebe6dc', stroke: '#d8d0c4', sw: 0.35 });
      path('M -6 -5.5 A 7 3.5 0 0 1 6 -5.5', { fill: 'rgba(255,255,255,0.22)' });
      circle(-4.85, 0, 2.35, { fill: '#121212', stroke: '#3a3a3a', sw: 0.4 });
      circle(4.85, 0, 2.35, { fill: '#121212', stroke: '#3a3a3a', sw: 0.4 });
      circle(-4.85, 0, 1.1, { fill: '#2a2a2a' });
      circle(4.85, 0, 1.1, { fill: '#2a2a2a' });
      rect(-2.8, -10.2, 5.6, 2.4, 0.7, { fill: '#d4af37', stroke: '#8b6914', sw: 0.25 });
      rect(-2.8, 7.8, 5.6, 2.4, 0.7, { fill: '#d4af37', stroke: '#8b6914', sw: 0.25 });
      return;
    }
    // —— Fiche Schuko CEE 7/4 : corps rond, broches + contacts latéraux ——
    if (type === 'schuko_m') {
      circle(0, 0, 12, { fill: '#2e3238', stroke: '#5a5f68', sw: 0.9 });
      circle(0, 0, 9.5, { fill: '#252a30' });
      rect(-12.4, -3, 1.8, 6, 0.4, { fill: '#c9a227', stroke: '#6b5a20', sw: 0.2 });
      rect(10.6, -3, 1.8, 6, 0.4, { fill: '#c9a227', stroke: '#6b5a20', sw: 0.2 });
      circle(-4.85, 0, 2.1, { fill: '#c8ccd4', stroke: '#7a8088', sw: 0.35 });
      circle(4.85, 0, 2.1, { fill: '#c8ccd4', stroke: '#7a8088', sw: 0.35 });
      circle(-4.85, 0, 0.85, { fill: '#a8aeb8' });
      circle(4.85, 0, 0.85, { fill: '#a8aeb8' });
      return;
    }

    // —— PowerCON : cercle + cran + symbole ——
    if (type === 'powercon_in') {
      circle(0, 0, 10, { fill: '#1a3a6e', stroke: '#4f8ef7', sw: 1.2 });
      path('M 3 -6 A 8 8 0 0 1 8 2', { fill: 'none', stroke: '#7cb4ff', sw: 1.5 });
      rect(-2, -3, 4, 6, 0.5, { fill: '#0a1628', stroke: '#5af', sw: 0.4 });
      return;
    }
    if (type === 'powercon_out') {
      circle(0, 0, 10, { fill: '#3a3a40', stroke: '#9a9aaa', sw: 1.2 });
      path('M 3 -6 A 8 8 0 0 1 8 2', { fill: 'none', stroke: '#ccc', sw: 1.5 });
      rect(-2, -3, 4, 6, 0.5, { fill: '#222', stroke: '#888', sw: 0.4 });
      return;
    }

    // —— RJ45 : trapèze contacts ——
    if (type === 'rj45') {
      path('M -9 -6 L 9 -6 L 7 8 L -7 8 Z', { fill: fd, stroke: '#c9a227', sw: 1 });
      for (let i = 0; i < 8; i++) {
        const x = -6 + i * 1.7;
        rect(x, -2, 1.2, 5, 0.2, { fill: '#d4af37', stroke: '#8a7020', sw: 0.2 });
      }
      return;
    }

    // —— EtherCON : RJ45 dans coque ronde ——
    if (type === 'ethercon') {
      circle(0, 0, 11, { fill: fd, stroke: st, sw: 1.2 });
      path('M -6 -3 L 6 -3 L 5 5 L -5 5 Z', { fill: '#1a1a1a', stroke: '#4f8ef7', sw: 0.8 });
      for (let i = 0; i < 4; i++) {
        rect(-4 + i * 2.2, 0, 1.5, 2.5, 0.2, { fill: '#b8860b', stroke: '#665', sw: 0.2 });
      }
      return;
    }

    // —— Speakon NL4 : 4 broches en carré + verrou ——
    if (type === 'speakon_4' || type === 'speakon_2') {
      const n = type === 'speakon_2' ? 2 : 4;
      circle(0, 0, 11, { fill: '#1a1a12', stroke: '#9acd32', sw: 1.2 });
      if (n === 4) {
        [[-4, -4], [4, -4], [-4, 4], [4, 4]].forEach(([x, y]) => {
          circle(x, y, 2.2, { fill: '#333', stroke: '#9acd32', sw: 0.5 });
        });
      } else {
        circle(-3, 0, 2.5, { fill: '#333', stroke: '#9acd32', sw: 0.5 });
        circle(3, 0, 2.5, { fill: '#333', stroke: '#9acd32', sw: 0.5 });
      }
      path('M 8 -4 L 10 -2 L 8 0', { fill: 'none', stroke: '#9acd32', sw: 1 });
      return;
    }

    // —— Jack 6.35 ——
    if (type === 'jack_ts' || type === 'jack_trs') {
      rect(-4, -8, 8, 16, 2, { fill: fm, stroke: st, sw: 1 });
      circle(0, 5, 3.5, { fill: '#222', stroke: '#666', sw: 0.5 });
      if (type === 'jack_trs') {
        line(-2, 2, 2, 2, { stroke: '#888', sw: 0.8 });
        line(-2, -1, 2, -1, { stroke: '#888', sw: 0.8 });
      } else {
        line(0, 1, 0, 4, { stroke: '#888', sw: 0.9 });
      }
      return;
    }
    if (type === 'jack_mini') {
      rect(-3, -5, 6, 10, 1.5, { fill: fm, stroke: st, sw: 0.8 });
      circle(0, 3, 2.2, { fill: '#222', stroke: '#666', sw: 0.4 });
      return;
    }

    // —— USB ——
    if (type === 'usb_a') {
      rect(-7, -4, 14, 8, 1, { fill: fm, stroke: st, sw: 0.8 });
      rect(-5, -2, 8, 4, 0.5, { fill: '#1a1a1a', stroke: '#444', sw: 0.3 });
      rect(4, -1, 2, 2, 0.3, { fill: ac, stroke: 'none' });
      return;
    }
    if (type === 'usb_c') {
      rect(-6, -3, 12, 6, 2, { fill: '#222', stroke: '#666', sw: 0.8 });
      rect(-4, -1, 8, 2, 0.5, { fill: '#0a3d62', stroke: '#4af', sw: 0.3 });
      return;
    }

    // —— HDMI ——
    if (type === 'hdmi') {
      path('M -10 -4 L 10 -4 L 8 6 L -8 6 Z', { fill: '#1a2332', stroke: '#4a6fa5', sw: 1 });
      rect(-6, -1, 12, 4, 0.5, { fill: '#0d1520', stroke: '#345', sw: 0.4 });
      return;
    }

    // —— BNC ——
    if (type === 'bnc') {
      circle(0, 0, 8, { fill: fm, stroke: '#c9a227', sw: 1 });
      circle(0, 0, 3.5, { fill: '#111', stroke: '#666', sw: 0.4 });
      circle(0, 0, 1.2, { fill: '#c9a227', stroke: 'none' });
      rect(-1.5, -10, 3, 4, 0.5, { fill: fm, stroke: st, sw: 0.5 });
      return;
    }

    if (type === 'led_indicator') {
      circle(0, 0, 4, { fill: ac, stroke: st, sw: 0.5 });
      return;
    }
    if (type === 'button') {
      circle(0, 0, 7, { fill: '#2a2a30', stroke: st, sw: 1 });
      circle(0, 0, 3.5, { fill: '#1a1a20', stroke: '#444', sw: 0.4 });
      return;
    }
    if (type === 'display') {
      rect(-14, -8, 28, 16, 2, { fill: '#0a1620', stroke: st, sw: 1 });
      rect(-11, -5, 22, 10, 1, { fill: '#1a5080', stroke: '#4f8ef7', sw: 0.5 });
      return;
    }
    if (type === 'knob') {
      circle(0, 0, 11, { fill: '#2a2830', stroke: st, sw: 1 });
      line(0, 0, 0, -7, { stroke: ac, sw: 1.5 });
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * 2 * Math.PI;
        line(Math.cos(a) * 8, Math.sin(a) * 8, Math.cos(a) * 9.5, Math.sin(a) * 9.5, { stroke: '#555', sw: 0.4 });
      }
      return;
    }

    // défaut
    circle(0, 0, 8, { fill: fd, stroke: ac, sw: 1 });
  }

  /**
   * Fragment SVG (chaîne) pour export — doit rester synchro avec appendShapeToGroup.
   */
  function shapeToSvgString(type, color) {
    const st = '#9aa3b2';
    const fd = '#15181d';
    const fm = '#2a3140';
    const ac = color || '#5a6a85';
    const stXlr3 = '#b8c5d4';
    const stDmx = '#00e676';
    const fdDmx = '#0d1814';

    const esc = (s) =>
      String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    if (type === 'xlr3_in') {
      let s =
        `<rect x="-3" y="-12.2" width="6" height="3" rx="0.6" fill="${fm}" stroke="${stXlr3}" stroke-width="0.5"/>` +
        `<circle cx="0" cy="0" r="10" fill="${fd}" stroke="${stXlr3}" stroke-width="1.35"/>`;
      const ang = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3];
      for (let i = 0; i < 3; i++) {
        const a = ang[i] - Math.PI / 2;
        s += `<circle cx="${(Math.cos(a) * 4.2).toFixed(2)}" cy="${(Math.sin(a) * 4.2).toFixed(2)}" r="1.8" fill="#0a0c0f" stroke="#5a6a78" stroke-width="0.5"/>`;
      }
      s += `<circle cx="0" cy="0" r="2.2" fill="#333944" stroke="#7a8a9a" stroke-width="0.45"/>`;
      return s;
    }
    if (type === 'xlr3_out') {
      let s =
        `<rect x="-3" y="-12.2" width="6" height="3" rx="0.6" fill="${fm}" stroke="${stXlr3}" stroke-width="0.5"/>` +
        `<circle cx="0" cy="0" r="10" fill="${fd}" stroke="${stXlr3}" stroke-width="1.35"/>`;
      const ang = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3];
      for (let i = 0; i < 3; i++) {
        const a = ang[i] - Math.PI / 2;
        const x1 = Math.cos(a) * 2,
          y1 = Math.sin(a) * 2,
          x2 = Math.cos(a) * 6.5,
          y2 = Math.sin(a) * 6.5;
        s += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#d8dde6" stroke-width="1.8"/>`;
        s += `<circle cx="${(Math.cos(a) * 7.2).toFixed(2)}" cy="${(Math.sin(a) * 7.2).toFixed(2)}" r="1.2" fill="#eef1f6" stroke="#8899aa" stroke-width="0.45"/>`;
      }
      s += `<circle cx="0" cy="0" r="2" fill="${fm}" stroke="#7a8a9a" stroke-width="0.45"/>`;
      return s;
    }
    if (type === 'dmx3_in') {
      let s =
        `<rect x="-3" y="-12.2" width="6" height="3" rx="0.6" fill="${fm}" stroke="${stDmx}" stroke-width="0.5"/>` +
        `<circle cx="0" cy="0" r="10" fill="${fdDmx}" stroke="${stDmx}" stroke-width="1.35"/>`;
      const ang = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3];
      for (let i = 0; i < 3; i++) {
        const a = ang[i] - Math.PI / 2;
        s += `<circle cx="${(Math.cos(a) * 4.2).toFixed(2)}" cy="${(Math.sin(a) * 4.2).toFixed(2)}" r="1.8" fill="#050807" stroke="#1b5e20" stroke-width="0.5"/>`;
      }
      s += `<circle cx="0" cy="0" r="2.2" fill="#1b3a25" stroke="${stDmx}" stroke-width="0.45"/>`;
      return s;
    }
    if (type === 'dmx3_out') {
      let s =
        `<rect x="-3" y="-12.2" width="6" height="3" rx="0.6" fill="${fm}" stroke="${stDmx}" stroke-width="0.5"/>` +
        `<circle cx="0" cy="0" r="10" fill="${fdDmx}" stroke="${stDmx}" stroke-width="1.35"/>`;
      const ang = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3];
      for (let i = 0; i < 3; i++) {
        const a = ang[i] - Math.PI / 2;
        const x1 = Math.cos(a) * 2,
          y1 = Math.sin(a) * 2,
          x2 = Math.cos(a) * 6.5,
          y2 = Math.sin(a) * 6.5;
        s += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#b9f6ca" stroke-width="1.8"/>`;
        s += `<circle cx="${(Math.cos(a) * 7.2).toFixed(2)}" cy="${(Math.sin(a) * 7.2).toFixed(2)}" r="1.2" fill="#e8f8ee" stroke="#2e7d32" stroke-width="0.45"/>`;
      }
      s += `<circle cx="0" cy="0" r="2" fill="#1b3a25" stroke="${stDmx}" stroke-width="0.45"/>`;
      return s;
    }
    if (type === 'dmx5_in') {
      let s = `<circle cx="0" cy="0" r="10" fill="${fdDmx}" stroke="${stDmx}" stroke-width="1.45"/>`;
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * 2 * Math.PI - Math.PI / 2;
        s += `<circle cx="${(Math.cos(a) * 5).toFixed(2)}" cy="${(Math.sin(a) * 5).toFixed(2)}" r="1.45" fill="#050807" stroke="#1b5e20" stroke-width="0.45"/>`;
      }
      s += `<circle cx="0" cy="0" r="1.9" fill="#1b3a25" stroke="${stDmx}" stroke-width="0.35"/>`;
      return s;
    }
    if (type === 'dmx5_out') {
      let s = `<circle cx="0" cy="0" r="10" fill="${fdDmx}" stroke="${stDmx}" stroke-width="1.45"/>`;
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * 2 * Math.PI - Math.PI / 2;
        const x1 = Math.cos(a) * 2.5,
          y1 = Math.sin(a) * 2.5,
          x2 = Math.cos(a) * 7,
          y2 = Math.sin(a) * 7;
        s += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#b9f6ca" stroke-width="1.25"/>`;
        s += `<circle cx="${(Math.cos(a) * 7.5).toFixed(2)}" cy="${(Math.sin(a) * 7.5).toFixed(2)}" r="1.05" fill="#e8f8ee" stroke="#2e7d32" stroke-width="0.35"/>`;
      }
      return s;
    }
    if (type === 'iec_in') {
      return (
        `<rect x="-11" y="-8" width="22" height="16" rx="2" fill="${fd}" stroke="${st}" stroke-width="1"/>` +
        `<rect x="-6" y="-5" width="3" height="7" rx="0.5" fill="#0a0a0a" stroke="#444" stroke-width="0.3"/>` +
        `<rect x="-1.5" y="-5" width="3" height="7" rx="0.5" fill="#0a0a0a" stroke="#444" stroke-width="0.3"/>` +
        `<rect x="3" y="-5" width="3" height="7" rx="0.5" fill="#0a0a0a" stroke="#444" stroke-width="0.3"/>` +
        `<path d="M 0 5 L -3 8 L 3 8 Z" fill="${fm}" stroke="${st}" stroke-width="0.5"/>`
      );
    }
    if (type === 'iec_out') {
      return (
        `<rect x="-11" y="-8" width="22" height="16" rx="2" fill="${fd}" stroke="${st}" stroke-width="1"/>` +
        `<rect x="-6" y="-4" width="3" height="6" rx="0.5" fill="#1a1a1a" stroke="#555" stroke-width="0.3"/>` +
        `<rect x="-1.5" y="-4" width="3" height="6" rx="0.5" fill="#1a1a1a" stroke="#555" stroke-width="0.3"/>` +
        `<rect x="3" y="-4" width="3" height="6" rx="0.5" fill="#1a1a1a" stroke="#555" stroke-width="0.3"/>` +
        `<circle cx="0" cy="6" r="2" fill="${fm}" stroke="${st}" stroke-width="0.4"/>`
      );
    }
    if (type === 'schuko_f') {
      return (
        `<circle cx="0" cy="0" r="12" fill="#f4efe6" stroke="#a89880" stroke-width="0.75"/>` +
        `<circle cx="0" cy="0" r="10.2" fill="#ebe6dc" stroke="#d8d0c4" stroke-width="0.35"/>` +
        `<path d="M -6 -5.5 A 7 3.5 0 0 1 6 -5.5" fill="rgba(255,255,255,0.22)" stroke="none"/>` +
        `<circle cx="-4.85" cy="0" r="2.35" fill="#121212" stroke="#3a3a3a" stroke-width="0.4"/>` +
        `<circle cx="4.85" cy="0" r="2.35" fill="#121212" stroke="#3a3a3a" stroke-width="0.4"/>` +
        `<circle cx="-4.85" cy="0" r="1.1" fill="#2a2a2a"/>` +
        `<circle cx="4.85" cy="0" r="1.1" fill="#2a2a2a"/>` +
        `<rect x="-2.8" y="-10.2" width="5.6" height="2.4" rx="0.7" fill="#d4af37" stroke="#8b6914" stroke-width="0.25"/>` +
        `<rect x="-2.8" y="7.8" width="5.6" height="2.4" rx="0.7" fill="#d4af37" stroke="#8b6914" stroke-width="0.25"/>`
      );
    }
    if (type === 'schuko_m') {
      return (
        `<circle cx="0" cy="0" r="12" fill="#2e3238" stroke="#5a5f68" stroke-width="0.9"/>` +
        `<circle cx="0" cy="0" r="9.5" fill="#252a30"/>` +
        `<rect x="-12.4" y="-3" width="1.8" height="6" rx="0.4" fill="#c9a227" stroke="#6b5a20" stroke-width="0.2"/>` +
        `<rect x="10.6" y="-3" width="1.8" height="6" rx="0.4" fill="#c9a227" stroke="#6b5a20" stroke-width="0.2"/>` +
        `<circle cx="-4.85" cy="0" r="2.1" fill="#c8ccd4" stroke="#7a8088" stroke-width="0.35"/>` +
        `<circle cx="4.85" cy="0" r="2.1" fill="#c8ccd4" stroke="#7a8088" stroke-width="0.35"/>` +
        `<circle cx="-4.85" cy="0" r="0.85" fill="#a8aeb8"/>` +
        `<circle cx="4.85" cy="0" r="0.85" fill="#a8aeb8"/>`
      );
    }
    if (type === 'powercon_in') {
      return (
        `<circle cx="0" cy="0" r="10" fill="#1a3a6e" stroke="#4f8ef7" stroke-width="1.2"/>` +
        `<path d="M 3 -6 A 8 8 0 0 1 8 2" fill="none" stroke="#7cb4ff" stroke-width="1.5"/>` +
        `<rect x="-2" y="-3" width="4" height="6" rx="0.5" fill="#0a1628" stroke="#5af" stroke-width="0.4"/>`
      );
    }
    if (type === 'powercon_out') {
      return (
        `<circle cx="0" cy="0" r="10" fill="#3a3a40" stroke="#9a9aaa" stroke-width="1.2"/>` +
        `<path d="M 3 -6 A 8 8 0 0 1 8 2" fill="none" stroke="#ccc" stroke-width="1.5"/>` +
        `<rect x="-2" y="-3" width="4" height="6" rx="0.5" fill="#222" stroke="#888" stroke-width="0.4"/>`
      );
    }
    if (type === 'rj45') {
      let s =
        `<path d="M -9 -6 L 9 -6 L 7 8 L -7 8 Z" fill="${fd}" stroke="#c9a227" stroke-width="1"/>`;
      for (let i = 0; i < 8; i++) {
        const x = -6 + i * 1.7;
        s += `<rect x="${x}" y="-2" width="1.2" height="5" rx="0.2" fill="#d4af37" stroke="#8a7020" stroke-width="0.2"/>`;
      }
      return s;
    }
    if (type === 'ethercon') {
      let s = `<circle cx="0" cy="0" r="11" fill="${fd}" stroke="${st}" stroke-width="1.2"/>`;
      s += `<path d="M -6 -3 L 6 -3 L 5 5 L -5 5 Z" fill="#1a1a1a" stroke="#4f8ef7" stroke-width="0.8"/>`;
      for (let i = 0; i < 4; i++) {
        s += `<rect x="${-4 + i * 2.2}" y="0" width="1.5" height="2.5" rx="0.2" fill="#b8860b" stroke="#665" stroke-width="0.2"/>`;
      }
      return s;
    }
    if (type === 'speakon_4' || type === 'speakon_2') {
      const n = type === 'speakon_2' ? 2 : 4;
      let s = `<circle cx="0" cy="0" r="11" fill="#1a1a12" stroke="#9acd32" stroke-width="1.2"/>`;
      if (n === 4) {
        [[-4, -4], [4, -4], [-4, 4], [4, 4]].forEach(([x, y]) => {
          s += `<circle cx="${x}" cy="${y}" r="2.2" fill="#333" stroke="#9acd32" stroke-width="0.5"/>`;
        });
      } else {
        s += `<circle cx="-3" cy="0" r="2.5" fill="#333" stroke="#9acd32" stroke-width="0.5"/>`;
        s += `<circle cx="3" cy="0" r="2.5" fill="#333" stroke="#9acd32" stroke-width="0.5"/>`;
      }
      s += `<path d="M 8 -4 L 10 -2 L 8 0" fill="none" stroke="#9acd32" stroke-width="1"/>`;
      return s;
    }
    if (type === 'jack_ts' || type === 'jack_trs') {
      let s =
        `<rect x="-4" y="-8" width="8" height="16" rx="2" fill="${fm}" stroke="${st}" stroke-width="1"/>` +
        `<circle cx="0" cy="5" r="3.5" fill="#222" stroke="#666" stroke-width="0.5"/>`;
      if (type === 'jack_trs') {
        s += `<line x1="-2" y1="2" x2="2" y2="2" stroke="#888" stroke-width="0.8"/><line x1="-2" y1="-1" x2="2" y2="-1" stroke="#888" stroke-width="0.8"/>`;
      } else {
        s += `<line x1="0" y1="1" x2="0" y2="4" stroke="#888" stroke-width="0.9"/>`;
      }
      return s;
    }
    if (type === 'jack_mini') {
      return (
        `<rect x="-3" y="-5" width="6" height="10" rx="1.5" fill="${fm}" stroke="${st}" stroke-width="0.8"/>` +
        `<circle cx="0" cy="3" r="2.2" fill="#222" stroke="#666" stroke-width="0.4"/>`
      );
    }
    if (type === 'usb_a') {
      return (
        `<rect x="-7" y="-4" width="14" height="8" rx="1" fill="${fm}" stroke="${st}" stroke-width="0.8"/>` +
        `<rect x="-5" y="-2" width="8" height="4" rx="0.5" fill="#1a1a1a" stroke="#444" stroke-width="0.3"/>` +
        `<rect x="4" y="-1" width="2" height="2" rx="0.3" fill="${esc(ac)}" stroke="none"/>`
      );
    }
    if (type === 'usb_c') {
      return (
        `<rect x="-6" y="-3" width="12" height="6" rx="2" fill="#222" stroke="#666" stroke-width="0.8"/>` +
        `<rect x="-4" y="-1" width="8" height="2" rx="0.5" fill="#0a3d62" stroke="#4af" stroke-width="0.3"/>`
      );
    }
    if (type === 'hdmi') {
      return (
        `<path d="M -10 -4 L 10 -4 L 8 6 L -8 6 Z" fill="#1a2332" stroke="#4a6fa5" stroke-width="1"/>` +
        `<rect x="-6" y="-1" width="12" height="4" rx="0.5" fill="#0d1520" stroke="#345" stroke-width="0.4"/>`
      );
    }
    if (type === 'bnc') {
      return (
        `<circle cx="0" cy="0" r="8" fill="${fm}" stroke="#c9a227" stroke-width="1"/>` +
        `<circle cx="0" cy="0" r="3.5" fill="#111" stroke="#666" stroke-width="0.4"/>` +
        `<circle cx="0" cy="0" r="1.2" fill="#c9a227" stroke="none"/>` +
        `<rect x="-1.5" y="-10" width="3" height="4" rx="0.5" fill="${fm}" stroke="${st}" stroke-width="0.5"/>`
      );
    }
    if (type === 'led_indicator') {
      return `<circle cx="0" cy="0" r="4" fill="${esc(ac)}" stroke="${st}" stroke-width="0.5"/>`;
    }
    if (type === 'button') {
      return (
        `<circle cx="0" cy="0" r="7" fill="#2a2a30" stroke="${st}" stroke-width="1"/>` +
        `<circle cx="0" cy="0" r="3.5" fill="#1a1a20" stroke="#444" stroke-width="0.4"/>`
      );
    }
    if (type === 'display') {
      return (
        `<rect x="-14" y="-8" width="28" height="16" rx="2" fill="#0a1620" stroke="${st}" stroke-width="1"/>` +
        `<rect x="-11" y="-5" width="22" height="10" rx="1" fill="#1a5080" stroke="#4f8ef7" stroke-width="0.5"/>`
      );
    }
    if (type === 'knob') {
      let s =
        `<circle cx="0" cy="0" r="11" fill="#2a2830" stroke="${st}" stroke-width="1"/>` +
        `<line x1="0" y1="0" x2="0" y2="-7" stroke="${esc(ac)}" stroke-width="1.5"/>`;
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * 2 * Math.PI;
        s += `<line x1="${(Math.cos(a) * 8).toFixed(2)}" y1="${(Math.sin(a) * 8).toFixed(2)}" x2="${(Math.cos(a) * 9.5).toFixed(
          2
        )}" y2="${(Math.sin(a) * 9.5).toFixed(2)}" stroke="#555" stroke-width="0.4"/>`;
      }
      return s;
    }
    return `<circle cx="0" cy="0" r="8" fill="${fd}" stroke="${esc(ac)}" stroke-width="1"/>`;
  }

  function defaultType(type) {
    if (!type || typeof type !== 'string') return 'xlr3_in';
    if (PORT_TYPES[type]) return type;
    const legacy = {
      speakon: 'speakon_4',
      xlr3: 'xlr3_in',
      xlr3_f: 'xlr3_in',
      xlr3_m: 'xlr3_out',
      xlr_f: 'xlr3_in',
      xlr_m: 'xlr3_out',
      xlr5_f: 'dmx5_in',
      xlr5_m: 'dmx5_out',
      dmx3_f: 'dmx3_in',
      dmx3_m: 'dmx3_out',
      dmx5_f: 'dmx5_in',
      dmx5_m: 'dmx5_out',
      dmx: 'dmx5_in',
      power: 'iec_in',
      iec: 'iec_in',
    };
    return legacy[type] || 'xlr3_in';
  }

  /** Encombrement horizontal (fraction de la largeur du panneau) pour clamp et anti-dépassement. */
  function portSpan(type) {
    const t = defaultType(type);
    const m = PORT_TYPES[t];
    return m && typeof m.span === 'number' ? m.span : 0.055;
  }

  global.PortShapes = {
    PORT_TYPES,
    appendShapeToGroup,
    shapeToSvgString,
    defaultType,
    portSpan,
  };
})(typeof window !== 'undefined' ? window : globalThis);
