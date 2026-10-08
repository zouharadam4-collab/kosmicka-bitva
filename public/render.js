/* ==========================================================================
   render.js – scéna „Kosmická bitva“
   Planety (procedurální textury), rakety, částice a filmové finále
   (odpočet → start raket → zásah → praskliny → rozpad planety).
   Běží v prohlížeči i v Node (kvůli testování snímků).
   ========================================================================== */
(function (root) {
  'use strict';

  var TAU = Math.PI * 2;
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smooth(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  function easeOut(t) { t = clamp(t, 0, 1); return 1 - Math.pow(1 - t, 3); }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function norm2(x, y) { var l = Math.sqrt(x * x + y * y) || 1; return { x: x / l, y: y / l }; }

  /* ------------------------------ šum 3D ------------------------------ */
  function hash3(ix, iy, iz, seed) {
    var h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(iz, 1274126177) ^ Math.imul(seed, 2246822519);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
  function vnoise3(x, y, z, s) {
    var xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    var xf = x - xi, yf = y - yi, zf = z - zi;
    var u = fade(xf), v = fade(yf), w = fade(zf);
    var c000 = hash3(xi, yi, zi, s), c100 = hash3(xi + 1, yi, zi, s);
    var c010 = hash3(xi, yi + 1, zi, s), c110 = hash3(xi + 1, yi + 1, zi, s);
    var c001 = hash3(xi, yi, zi + 1, s), c101 = hash3(xi + 1, yi, zi + 1, s);
    var c011 = hash3(xi, yi + 1, zi + 1, s), c111 = hash3(xi + 1, yi + 1, zi + 1, s);
    var x00 = c000 + (c100 - c000) * u, x10 = c010 + (c110 - c010) * u;
    var x01 = c001 + (c101 - c001) * u, x11 = c011 + (c111 - c011) * u;
    var y0 = x00 + (x10 - x00) * v, y1 = x01 + (x11 - x01) * v;
    return y0 + (y1 - y0) * w;
  }
  function fbm3(x, y, z, s, oct) {
    var a = 0, amp = 0.5, f = 1, sum = 0;
    for (var i = 0; i < oct; i++) {
      a += amp * vnoise3(x * f, y * f, z * f, s + i * 17);
      sum += amp; amp *= 0.5; f *= 2.03;
    }
    return a / sum;
  }

  /* ------------------- procedurální vrstvy planety --------------------
     kind 0 = oceánská planeta AQUA, kind 1 = sopečná planeta IGNIS.
     Vrstvy: albedo, oblaka, stín, zář (lávа), odlesk (oceán).              */
  var TEX = 512;
  function makePlanetLayers(kind, mk) {
    var N = TEX, R = N / 2;
    function layer() { var c = mk(N, N); var g = c.getContext('2d'); return { c: c, g: g, img: g.createImageData(N, N) }; }
    var A = layer(), C = layer(), S = layer(), E = kind === 1 ? layer() : null, P = kind === 0 ? layer() : null;
    var seed = kind === 0 ? 11 : 57;
    var Lx = -0.55, Ly = -0.5, Lz = 0.67, ll = Math.sqrt(Lx * Lx + Ly * Ly + Lz * Lz);
    Lx /= ll; Ly /= ll; Lz /= ll;
    var Hx = Lx, Hy = Ly, Hz = Lz + 1, hl = Math.sqrt(Hx * Hx + Hy * Hy + Hz * Hz);
    Hx /= hl; Hy /= hl; Hz /= hl;
    var ca = Math.cos(0.55), sa = Math.sin(0.55), cb = Math.cos(0.35), sb = Math.sin(0.35);

    for (var y = 0; y < N; y++) {
      for (var x = 0; x < N; x++) {
        var nx = (x + 0.5 - R) / R, ny = (y + 0.5 - R) / R, d2 = nx * nx + ny * ny;
        if (d2 > 1) continue;
        var dist = Math.sqrt(d2), nz = Math.sqrt(1 - d2);
        var edge = clamp((1 - dist) * R * 0.9, 0, 1);
        var i4 = (y * N + x) * 4;
        // otočení koule, ať se póly nevidí přesně nahoře
        var rx = nx * ca + nz * sa, rz = -nx * sa + nz * ca, ry = ny * cb - rz * sb; rz = ny * sb + rz * cb;
        var r, g, b, ocean = 0, lava = 0, heat = 0;

        if (kind === 0) {
          var h = fbm3(rx * 1.9 + 4.2, ry * 1.9 + 1.3, rz * 1.9 + 7.7, seed, 6);
          if (h < 0.5) {
            var t = h / 0.5; t = t * t;
            r = lerp(6, 40, t); g = lerp(34, 128, t); b = lerp(98, 182, t);
            var coast = smooth((h - 0.455) / 0.045);
            r = lerp(r, 120, coast); g = lerp(g, 204, coast); b = lerp(b, 198, coast);
            ocean = 1 - coast * 0.6;
          } else {
            var e = (h - 0.5) / 0.5;
            if (e < 0.18) { var q = smooth(e / 0.18); r = lerp(200, 84, q); g = lerp(186, 142, q); b = lerp(124, 64, q); }
            else if (e < 0.52) { var q2 = smooth((e - 0.18) / 0.34); r = lerp(84, 118, q2); g = lerp(142, 112, q2); b = lerp(64, 70, q2); }
            else if (e < 0.8) { var q3 = smooth((e - 0.52) / 0.28); r = lerp(118, 140, q3); g = lerp(112, 124, q3); b = lerp(70, 112, q3); }
            else { var q4 = smooth((e - 0.8) / 0.12); r = lerp(140, 244, q4); g = lerp(124, 247, q4); b = lerp(112, 252, q4); }
          }
          var lat = Math.abs(ry);
          var ice = smooth((lat - (0.84 + 0.07 * (fbm3(rx * 4, ry * 4, rz * 4, seed + 99, 3) - 0.5))) / 0.06);
          r = lerp(r, 238, ice); g = lerp(g, 243, ice); b = lerp(b, 250, ice); ocean *= (1 - ice);
          // oblaka
          var cl = fbm3(rx * 3.0 + 20, ry * 3.6 + 5, rz * 3.0 + 9, seed + 5, 5);
          var ca1 = smooth((cl - 0.5) / 0.2) * 0.92;
          C.img.data[i4] = 250; C.img.data[i4 + 1] = 252; C.img.data[i4 + 2] = 255; C.img.data[i4 + 3] = ca1 * edge * 255;
        } else {
          var hh = fbm3(rx * 2.1 + 9, ry * 2.1 + 3, rz * 2.1 + 1, seed, 6);
          var qa = smooth((hh - 0.35) / 0.4);
          r = lerp(46, 140, qa); g = lerp(26, 70, qa); b = lerp(24, 44, qa);
          var w = fbm3(rx * 5 + 2, ry * 5 + 8, rz * 5 + 4, seed + 7, 4);
          var ash = smooth((w - 0.6) / 0.15) * 0.55;
          r = lerp(r, 128, ash); g = lerp(g, 112, ash); b = lerp(b, 104, ash);
          var lake = smooth((0.4 - hh) / 0.07);
          var rr = fbm3(rx * 3.4 + 31, ry * 3.4, rz * 3.4 + 5, seed + 3, 5);
          var ridge = 1 - Math.abs(2 * rr - 1);
          var crack = smooth((ridge - 0.9) / 0.06);
          lava = clamp(lake + crack * 0.95, 0, 1);
          heat = clamp(lake * 0.75 + crack, 0, 1);
          r = lerp(r, 28, lava * 0.9); g = lerp(g, 12, lava * 0.9); b = lerp(b, 8, lava * 0.9);
          // popelnatá oblaka
          var cl2 = fbm3(rx * 3.0 + 20, ry * 3.6 + 5, rz * 3.0 + 9, seed + 5, 5);
          var ca2 = smooth((cl2 - 0.56) / 0.2) * 0.5;
          C.img.data[i4] = 150; C.img.data[i4 + 1] = 110; C.img.data[i4 + 2] = 96; C.img.data[i4 + 3] = ca2 * edge * 255;
          // zář lávy (svítí i na noční straně)
          E.img.data[i4] = lerp(210, 255, heat); E.img.data[i4 + 1] = lerp(36, 196, heat * heat); E.img.data[i4 + 2] = lerp(0, 60, heat * heat * heat);
          E.img.data[i4 + 3] = lava * edge * 255;
        }
        A.img.data[i4] = r; A.img.data[i4 + 1] = g; A.img.data[i4 + 2] = b; A.img.data[i4 + 3] = edge * 255;

        // stín (terminátor) + ztmavení okraje
        var dot = nx * Lx + ny * Ly + nz * Lz;
        var light = smooth(clamp(dot * 1.25 + 0.1, 0, 1));
        var sh = (1 - light) * 0.93 + Math.pow(1 - nz, 2.5) * 0.3;
        S.img.data[i4] = 2; S.img.data[i4 + 1] = 5; S.img.data[i4 + 2] = 14; S.img.data[i4 + 3] = clamp(sh, 0, 0.96) * edge * 255;

        if (P) {
          var sp = Math.pow(Math.max(0, nx * Hx + ny * Hy + nz * Hz), 70) * ocean * 0.9;
          P.img.data[i4] = 255; P.img.data[i4 + 1] = 255; P.img.data[i4 + 2] = 255; P.img.data[i4 + 3] = sp * edge * 255;
        }
      }
    }
    A.g.putImageData(A.img, 0, 0); C.g.putImageData(C.img, 0, 0); S.g.putImageData(S.img, 0, 0);
    if (E) E.g.putImageData(E.img, 0, 0);
    if (P) P.g.putImageData(P.img, 0, 0);
    return { albedo: A.c, clouds: C.c, shade: S.c, emissive: E ? E.c : null, spec: P ? P.c : null };
  }

  /* --------------------------- Voronoiho střepy ------------------------ */
  function clipPoly(poly, ax, ay, bx, by) { // ponechá body, kde (p - m)·(b - a) <= 0, m = střed úsečky ab
    var mx = (ax + bx) / 2, my = (ay + by) / 2, nx = bx - ax, ny = by - ay, out = [];
    for (var i = 0; i < poly.length; i++) {
      var p = poly[i], q = poly[(i + 1) % poly.length];
      var dp = (p.x - mx) * nx + (p.y - my) * ny, dq = (q.x - mx) * nx + (q.y - my) * ny;
      if (dp <= 0) out.push(p);
      if ((dp <= 0) !== (dq <= 0)) { var t = dp / (dp - dq); out.push({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t }); }
    }
    return out;
  }
  function makeShards(R, n, impact, rng) {
    var sites = [], i, j;
    for (i = 0; i < n; i++) {
      var x, y;
      if (rng() < 0.4) { x = impact.x + (rng() - 0.5) * R * 0.9; y = impact.y + (rng() - 0.5) * R * 0.9; }
      else { var a = rng() * TAU, r = Math.sqrt(rng()) * R * 0.99; x = Math.cos(a) * r; y = Math.sin(a) * r; }
      var l = Math.sqrt(x * x + y * y); if (l > R * 0.99) { x *= R * 0.99 / l; y *= R * 0.99 / l; }
      sites.push({ x: x, y: y });
    }
    var disc = []; for (i = 0; i < 48; i++) disc.push({ x: Math.cos(i / 48 * TAU) * R * 1.004, y: Math.sin(i / 48 * TAU) * R * 1.004 });
    var shards = [];
    for (i = 0; i < n; i++) {
      var poly = disc;
      for (j = 0; j < n && poly.length > 2; j++) if (j !== i) poly = clipPoly(poly, sites[i].x, sites[i].y, sites[j].x, sites[j].y);
      if (poly.length < 3) continue;
      var cx = 0, cy = 0; poly.forEach(function (p) { cx += p.x; cy += p.y; }); cx /= poly.length; cy /= poly.length;
      shards.push({ poly: poly, cx: cx, cy: cy });
    }
    return shards;
  }

  /* ------------------------------ Bézier ------------------------------ */
  function bez(p0, p1, p2, p3, u) {
    var v = 1 - u, a = v * v * v, b = 3 * v * v * u, c = 3 * v * u * u, d = u * u * u;
    return { x: a * p0.x + b * p1.x + c * p2.x + d * p3.x, y: a * p0.y + b * p1.y + c * p2.y + d * p3.y };
  }
  function dbez(p0, p1, p2, p3, u) {
    var v = 1 - u, a = 3 * v * v, b = 6 * v * u, c = 3 * u * u;
    return { x: a * (p1.x - p0.x) + b * (p2.x - p1.x) + c * (p3.x - p2.x), y: a * (p1.y - p0.y) + b * (p2.y - p1.y) + c * (p3.y - p2.y) };
  }

  /* ================================ SCÉNA ============================== */
  function Scene(opts) {
    this.canvas = opts.canvas;
    this.mk = opts.createCanvas || function (w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
    this.ctx = this.canvas.getContext('2d');
    this.sound = opts.onSound || function () {};
    this.onDone = opts.onDone || null;
    this.W = 1280; this.H = 720; this.dpr = 1; this.u = 720 / 1080;
    this.mode = 'lobby';              // lobby | game | finale
    this.names = ['AQUA', 'IGNIS'];
    this.colors = [
      { main: '#3db8ff', rgb: '61,184,255', glow: [90, 190, 255], dark: '#0b4f8a', light: '#bfe8ff' },
      { main: '#ff7a3c', rgb: '255,122,60', glow: [255, 120, 60], dark: '#8b2208', light: '#ffd2b8' }
    ];
    this.players = [0, 0]; this.power = [0, 0]; this.shown = [0, 0];
    this.remain = null; this.total = 180;
    this.t = 0; this.wt = 0; this.timeScale = 1; this.targetTS = 1;
    this.particles = []; this.rings = []; this.popups = []; this.pulse = [0, 0];
    this.cam = { x: 640, y: 360, z: 1, tx: 640, ty: 360, tz: 1, amp: 0 };
    this.flash = 0; this.flashX = 0; this.flashY = 0; this.fin = null; this.destroyed = [false, false];
    this.rng = mulberry32(2024);
    this._build();
    this.resize(this.W, this.H, 1);
  }

  Scene.prototype._build = function () {
    var self = this;
    this.layers = [makePlanetLayers(0, this.mk), makePlanetLayers(1, this.mk)];
    this.spr = {};
    function rad(name, stops, size) {
      var c = self.mk(size, size), g = c.getContext('2d');
      var gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      stops.forEach(function (s) { gr.addColorStop(s[0], s[1]); });
      g.fillStyle = gr; g.fillRect(0, 0, size, size); self.spr[name] = c;
    }
    rad('glow', [[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,255,255,0.5)'], [1, 'rgba(255,255,255,0)']], 128);
    rad('fire', [[0, 'rgba(255,240,200,0.95)'], [0.25, 'rgba(255,190,85,0.75)'], [0.6, 'rgba(255,95,20,0.3)'], [1, 'rgba(255,40,0,0)']], 128);
    rad('smoke', [[0, 'rgba(78,78,86,0.8)'], [0.55, 'rgba(56,56,64,0.4)'], [1, 'rgba(40,40,48,0)']], 128);
    rad('dust', [[0, 'rgba(200,180,160,0.5)'], [1, 'rgba(160,140,120,0)']], 128);
    rad('ember', [[0, 'rgba(255,235,170,1)'], [0.4, 'rgba(255,125,30,0.8)'], [1, 'rgba(255,60,0,0)']], 64);
  };

  Scene.prototype.resize = function (w, h, dpr) {
    this.W = w; this.H = h; this.dpr = dpr || 1; this.u = h / 1080;
    this.canvas.width = Math.round(w * this.dpr); this.canvas.height = Math.round(h * this.dpr);
    if (this.canvas.style) { this.canvas.style.width = w + 'px'; this.canvas.style.height = h + 'px'; }
    this.R = Math.min(h * 0.195, w * 0.135);
    this.planets = [{ x: w * 0.19, y: h * 0.52 }, { x: w * 0.81, y: h * 0.52 }];
    this.rh = h * 0.19;
    this.cam.x = this.cam.tx = w / 2; this.cam.y = this.cam.ty = h / 2;
    this._makeBackground();
  };
  Scene.prototype.layout = function () { return { R: this.R, planets: this.planets, W: this.W, H: this.H }; };

  Scene.prototype._makeBackground = function () {
    var W = this.W, H = this.H, d = this.dpr;
    var c = this.mk(Math.round(W * d), Math.round(H * d)), g = c.getContext('2d'); g.scale(d, d);
    var gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, '#03040d'); gr.addColorStop(0.55, '#0a0f26'); gr.addColorStop(1, '#150d2c');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    var rng = mulberry32(77), i;
    [[0.5, 0.22, 0.55, '70,50,150', 0.24], [0.15, 0.8, 0.4, '30,90,170', 0.2], [0.86, 0.18, 0.42, '160,50,95', 0.17], [0.55, 0.88, 0.5, '60,40,125', 0.15]].forEach(function (n) {
      var rr = n[2] * Math.max(W, H) * 0.6, q = g.createRadialGradient(n[0] * W, n[1] * H, 0, n[0] * W, n[1] * H, rr);
      q.addColorStop(0, 'rgba(' + n[3] + ',' + n[4] + ')'); q.addColorStop(1, 'rgba(' + n[3] + ',0)');
      g.fillStyle = q; g.fillRect(0, 0, W, H);
    });
    for (i = 0; i < 520; i++) {
      var x = rng() * W, y = rng() * H, r = rng() < 0.06 ? 1.7 : rng() * 0.9 + 0.3;
      g.fillStyle = 'rgba(255,255,255,' + (0.25 + rng() * 0.6).toFixed(2) + ')'; g.fillRect(x, y, r, r);
    }
    this.bg = c;
    this.stars = [];
    for (i = 0; i < 150; i++) this.stars.push({ x: rng() * W, y: rng() * H, r: 0.8 + rng() * 1.6, ph: rng() * TAU, sp: 0.8 + rng() * 2.2, tint: rng() });
  };

  /* ------------------------------ veřejné API ------------------------- */
  Scene.prototype.setNames = function (a, b) { this.names = [a, b]; };
  Scene.prototype.setState = function (s) {
    if (s.power) { this.power = s.power.slice(); }
    if (s.players) this.players = s.players.slice();
    if (s.total) this.total = s.total;
    if (s.remain !== undefined) this.remain = s.remain;
    if (s.mode && this.mode !== 'finale') this.mode = s.mode;
  };
  Scene.prototype.popup = function (team, text) {
    var p = this.planets[team];
    this.popups.push({ x: p.x + (this.rng() - 0.5) * this.R * 0.7, y: p.y - this.R - this.rh * 1.05, t: 0, text: text, team: team });
    this.pulse[team] = 1;
    if (this.popups.length > 14) this.popups.shift();
  };
  Scene.prototype.reset = function () {
    this.fin = null; this.destroyed = [false, false]; this.particles = []; this.rings = []; this.popups = [];
    this.mode = 'lobby'; this.timeScale = this.targetTS = 1; this.flash = 0;
    this.cam.tx = this.W / 2; this.cam.ty = this.H / 2; this.cam.tz = 1; this.cam.x = this.W / 2; this.cam.y = this.H / 2; this.cam.z = 1;
    this.power = [0, 0]; this.shown = [0, 0];
  };

  /* ------------------------------ částice ----------------------------- */
  Scene.prototype._p = function (o) { this.particles.push(o); return o; };
  Scene.prototype._fire = function (x, y, vx, vy, s0, s1, life, a) {
    this._p({ k: 'fire', x: x, y: y, vx: vx, vy: vy, s0: s0, s1: s1, life: life, max: life, a: a || 1, drag: 0.96 });
  };
  Scene.prototype._smoke = function (x, y, vx, vy, s0, s1, life, a) {
    this._p({ k: 'smoke', x: x, y: y, vx: vx, vy: vy, s0: s0, s1: s1, life: life, max: life, a: a || 0.6, drag: 0.985 });
  };
  Scene.prototype._dust = function (x, y, vx, vy, s0, s1, life, a) {
    this._p({ k: 'dust', x: x, y: y, vx: vx, vy: vy, s0: s0, s1: s1, life: life, max: life, a: a || 0.5, drag: 0.97 });
  };
  Scene.prototype._spark = function (x, y, vx, vy, life, g, col) {
    this._p({ k: 'spark', x: x, y: y, vx: vx, vy: vy, life: life, max: life, g: g || 0, col: col || '255,215,140', drag: 0.985 });
  };
  Scene.prototype._ring = function (x, y, r1, dur, col, w) {
    this.rings.push({ x: x, y: y, r1: r1, t: 0, dur: dur, col: col || '255,220,160', w: w || 0.16 });
  };
  Scene.prototype._flash = function (wx, wy, k) {            // záblesk v místě výbuchu (souřadnice světa)
    var c = this.cam;
    this.flash = k; this.flashX = this.W / 2 + (wx - c.x) * c.z; this.flashY = this.H / 2 + (wy - c.y) * c.z;
  };
  Scene.prototype._shake = function (amp) { this.cam.amp = Math.max(this.cam.amp, amp * this.u); };

  Scene.prototype._explosion = function (x, y, size, n) {
    var i, u = this.u, rng = this.rng;
    for (i = 0; i < n; i++) {
      var a = rng() * TAU, sp = (60 + rng() * 520) * u * size;
      this._fire(x, y, Math.cos(a) * sp, Math.sin(a) * sp, (36 + rng() * 60) * u * size, (110 + rng() * 100) * u * size, 0.6 + rng() * 0.9, 0.42);
    }
    for (i = 0; i < n * 0.8; i++) {
      var a2 = rng() * TAU, sp2 = (200 + rng() * 900) * u * size;
      this._spark(x, y, Math.cos(a2) * sp2, Math.sin(a2) * sp2, 0.6 + rng() * 1.2, 180 * u, rng() < 0.3 ? '255,255,230' : '255,170,80');
    }
    for (i = 0; i < n * 0.35; i++) {
      var a3 = rng() * TAU, sp3 = (30 + rng() * 240) * u * size;
      this._smoke(x, y, Math.cos(a3) * sp3, Math.sin(a3) * sp3, (50 + rng() * 60) * u * size, (150 + rng() * 150) * u * size, 1.8 + rng() * 1.8, 0.5);
    }
  };

  /* ------------------------------- krok ------------------------------- */
  Scene.prototype._ambient = function (dt) {
    var W = this.W, H = this.H, u = this.u, i, m;
    if (!this.meteors) { this.meteors = []; this.rocks = []; this.nextMeteor = 1.5; for (i = 0; i < 7; i++) this.rocks.push(this._newRock(true)); }
    this.nextMeteor -= dt;
    if (this.nextMeteor <= 0 && this.meteors.length < 3) {
      this.nextMeteor = 2.5 + Math.random() * 4;
      var ang = (0.18 + Math.random() * 0.35) * (Math.random() < 0.5 ? 1 : -1) + (Math.random() < 0.5 ? 0 : Math.PI);
      var sp = (900 + Math.random() * 700) * u;
      this.meteors.push({ x: Math.random() * W, y: Math.random() * H * 0.5, vx: Math.cos(ang) * sp, vy: Math.abs(Math.sin(ang)) * sp * 0.5 + 60 * u, life: 0, max: 0.7 + Math.random() * 0.5 });
    }
    for (i = this.meteors.length - 1; i >= 0; i--) { m = this.meteors[i]; m.life += dt; m.x += m.vx * dt; m.y += m.vy * dt; if (m.life > m.max) this.meteors.splice(i, 1); }
    for (i = 0; i < this.rocks.length; i++) {
      var r = this.rocks[i]; r.x += r.vx * dt; r.y += r.vy * dt; r.a += r.va * dt;
      if (r.x < -80 || r.x > W + 80 || r.y < -80 || r.y > H + 80) this.rocks[i] = this._newRock(false);
    }
  };
  Scene.prototype._newRock = function (anywhere) {
    var W = this.W, H = this.H, u = this.u, left = Math.random() < 0.5, sp = (6 + Math.random() * 14) * u;
    var pts = [], n = 8, k; for (k = 0; k < n; k++) pts.push(0.7 + Math.random() * 0.35);
    return { x: anywhere ? Math.random() * W : (left ? -60 : W + 60), y: H * (0.1 + Math.random() * 0.8), vx: (left ? 1 : -1) * sp, vy: (Math.random() - 0.5) * sp * 0.4,
      a: Math.random() * 6.28, va: (Math.random() - 0.5) * 0.4, r: (7 + Math.random() * 16) * u, pts: pts, shade: 0.5 + Math.random() * 0.5 };
  };
  Scene.prototype._drawAmbient = function () {
    var ctx = this.ctx, i, k, m, r;
    if (!this.meteors) return;
    for (i = 0; i < this.rocks.length; i++) {
      r = this.rocks[i];
      // skály nad středem mezi planetami neruší – jen jemné pozadí
      ctx.save(); ctx.translate(r.x, r.y); ctx.rotate(r.a); ctx.globalAlpha = 0.55 * r.shade;
      ctx.beginPath(); for (k = 0; k < r.pts.length; k++) { var an = k / r.pts.length * 6.283; ctx[k ? 'lineTo' : 'moveTo'](Math.cos(an) * r.r * r.pts[k], Math.sin(an) * r.r * r.pts[k]); }
      ctx.closePath(); ctx.fillStyle = 'rgb(' + Math.round(70 * r.shade) + ',' + Math.round(66 * r.shade) + ',' + Math.round(84 * r.shade) + ')'; ctx.fill();
      ctx.strokeStyle = 'rgba(180,190,230,0.25)'; ctx.lineWidth = 1; ctx.stroke(); ctx.restore();
    }
    ctx.globalAlpha = 1; ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (i = 0; i < this.meteors.length; i++) {
      m = this.meteors[i]; var f = m.life / m.max, a = Math.sin(Math.min(1, f) * Math.PI), len = 0.12, grd;
      grd = ctx.createLinearGradient(m.x, m.y, m.x - m.vx * len, m.y - m.vy * len);
      grd.addColorStop(0, 'rgba(255,255,255,' + (0.9 * a).toFixed(2) + ')'); grd.addColorStop(1, 'rgba(160,200,255,0)');
      ctx.strokeStyle = grd; ctx.lineWidth = 2.2 * this.u + 0.6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(m.x - m.vx * len, m.y - m.vy * len); ctx.stroke();
    }
    ctx.restore();
  };

  Scene.prototype.step = function (rdt) {
    rdt = clamp(rdt || 0, 0, 0.05);
    this.timeScale += (this.targetTS - this.timeScale) * (1 - Math.exp(-rdt * 7));
    var dt = rdt * this.timeScale, i;
    this.t += rdt; this.wt += dt;
    for (i = 0; i < 2; i++) {
      this.shown[i] += (this.power[i] - this.shown[i]) * (1 - Math.exp(-rdt * 6));
      this.pulse[i] = Math.max(0, this.pulse[i] - rdt * 2.4);
    }
    for (i = this.popups.length - 1; i >= 0; i--) { this.popups[i].t += rdt; if (this.popups[i].t > 1.6) this.popups.splice(i, 1); }
    this._ambient(rdt);
    if (this.fin) this._stepFinale(dt, rdt);
    else this._idleEffects(dt);
    // částice
    for (i = this.particles.length - 1; i >= 0; i--) {
      var p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) { this.particles.splice(i, 1); continue; }
      var dr = Math.pow(p.drag, dt * 60);
      p.vx *= dr; p.vy *= dr; if (p.g) p.vy += p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
    for (i = this.rings.length - 1; i >= 0; i--) { this.rings[i].t += dt; if (this.rings[i].t >= this.rings[i].dur) this.rings.splice(i, 1); }
    // kamera
    var c = this.cam, k = 1 - Math.exp(-rdt * 3.2);
    c.x += (c.tx - c.x) * k; c.y += (c.ty - c.y) * k; c.z += (c.tz - c.z) * k;
    c.amp *= Math.pow(0.04, rdt);
    this.flash = Math.max(0, this.flash - rdt * 2.4);
  };

  Scene.prototype._idleEffects = function (dt) {
    // parní oblaka u raket na rampě (jemné)
    if (this.rng() < dt * 3) {
      for (var i = 0; i < 2; i++) {
        var pd = this._pad(i);
        this._smoke(pd.x + (this.rng() - 0.5) * 30 * this.u, pd.y, (this.rng() - 0.5) * 20 * this.u, -10 * this.u, 10 * this.u, 46 * this.u, 1.8, 0.16);
      }
    }
  };

  Scene.prototype._pad = function (i) { return { x: this.planets[i].x, y: this.planets[i].y - this.R * 0.985 }; };
  Scene.prototype._rocketH = function (i) {
    if (this.fin) return this.rh * this.fin.scale[i];
    var mx = Math.max(this.power[0], this.power[1], 30);
    return this.rh * (0.82 + 0.38 * clamp(this.shown[i] / mx, 0, 1)) * (1 + this.pulse[i] * 0.06);
  };

  /* ============================ FINÁLE ================================= */
  Scene.prototype.startFinale = function (winner, powers) {
    var W = this.W, H = this.H, tie = winner < 0, self = this;
    var mx = Math.max(powers[0], powers[1], 1);
    var scale = tie ? [1.12, 1.12] : [0.84 + 0.36 * powers[0] / mx, 0.84 + 0.36 * powers[1] / mx];
    var fin = {
      t: 0, winner: winner, tie: tie, powers: powers.slice(), scale: scale, rockets: [],
      launchT: 6.6, FD: 3.4, ev: {}, impactT: -1, shatterT: -1, destroyed: -1, done: false, heat: 0, cracks: null, shards: null, core: null, seed: 4242
    };
    this.fin = fin; this.mode = 'finale'; this.destroyed = [false, false];
    this.cam.tz = 1; this.cam.tx = W / 2; this.cam.ty = H / 2;
    for (var i = 0; i < 2; i++) {
      var j = 1 - i, h = this.rh * scale[i];
      var S = this._pad(i), sgn = this.planets[j].x > this.planets[i].x ? 1 : -1;
      var n = norm2(-sgn * 0.55, -0.83);
      var Tp = { x: this.planets[j].x + n.x * this.R, y: this.planets[j].y + n.y * this.R };
      var p3 = { x: Tp.x + n.x * h * 0.92, y: Tp.y + n.y * h * 0.92 };
      var p2 = { x: p3.x + n.x * 0.3 * H, y: p3.y + n.y * 0.3 * H };
      var p1 = { x: S.x + sgn * 0.02 * W, y: S.y - 0.25 * H };
      var isWin = tie || i === winner, f = null;
      if (!isWin) { var r = powers[i] / Math.max(1, powers[winner]); f = 0.22 + 0.28 * clamp(r, 0, 1); }
      fin.rockets.push({ team: i, h: h, state: 'pad', path: [S, p1, p2, p3], tip: Tp, n: n, sgn: sgn, x: S.x, y: S.y, ang: 0, flame: 0.28, failAt: f, vx: 0, vy: 0, spin: 0, bt: 0, tt: 0 });
    }
    this.sound('horn');
  };

  Scene.prototype._ev = function (name, at, fn) {
    var fin = this.fin;
    if (!fin.ev[name] && fin.t >= at) { fin.ev[name] = true; fn.call(this); }
  };

  Scene.prototype._stepFinale = function (dt, rdt) {
    var fin = this.fin, W = this.W, H = this.H, u = this.u, rng = this.rng, i, k;
    fin.t += dt;
    var t = fin.t, tt = clamp((t - fin.launchT) / fin.FD, 0, 1);
    var targetTS = 1;

    this._ev('cd3', 4.2, function () { this.sound('tick'); });
    this._ev('cd2', 5.0, function () { this.sound('tick'); });
    this._ev('cd1', 5.8, function () { this.sound('tick'); this.sound('ignite'); });
    this._ev('go', fin.launchT, function () { this.sound('launch'); this._shake(10); fin.go = t; });

    // rakety
    var win = fin.tie ? -1 : fin.winner;
    for (i = 0; i < 2; i++) {
      var r = fin.rockets[i], pad = this._pad(i);
      if (r.state === 'pad') {
        r.x = pad.x; r.y = pad.y; r.ang = 0;
        var target = t > 5.8 ? 1 : 0.28; r.flame += (target - r.flame) * (1 - Math.exp(-rdt * 5));
        if (t > 5.8) {                 // zážeh – kouř, jiskry a otřesy
          this._shake(3 + (t - 5.8) * 3);
          if (rng() < dt * 90) this._fire(r.x + (rng() - 0.5) * 18 * u, r.y + 4 * u, (rng() - 0.5) * 260 * u, (60 + rng() * 120) * u, 14 * u, 50 * u, 0.5, 0.8);
          if (rng() < dt * 60) this._dust(r.x + (rng() - 0.5) * 20 * u, r.y, (rng() < 0.5 ? -1 : 1) * (80 + rng() * 220) * u, -10 * u, 20 * u, 90 * u, 1.8, 0.45);
        }
        if (tt > 0) r.state = 'fly';
      }
      if (r.state === 'fly') {
        r.tt = tt; var uu = Math.pow(tt, 1.75);
        var P = bez(r.path[0], r.path[1], r.path[2], r.path[3], uu), D = dbez(r.path[0], r.path[1], r.path[2], r.path[3], uu);
        r.x = P.x; r.y = P.y; r.ang = Math.atan2(D.x, -D.y); r.flame += (1 - r.flame) * (1 - Math.exp(-rdt * 8));
        this._exhaust(r, dt, 1);
        if (r.failAt !== null && tt >= r.failAt) {
          var dud = 1.75 * Math.pow(Math.max(tt, 0.001), 0.75) / fin.FD;
          r.vx = D.x * dud; r.vy = D.y * dud; r.spin = (r.sgn > 0 ? 1 : -1) * 2.6; r.state = 'ballistic'; r.bt = 0;
          this.sound('fail');
          for (k = 0; k < 24; k++) this._smoke(r.x, r.y, (rng() - 0.5) * 120 * u, (rng() - 0.5) * 120 * u, 20 * u, 90 * u, 1.8, 0.5);
        }
      } else if (r.state === 'ballistic') {
        r.bt += dt; r.vy += H * 0.42 * dt; r.x += r.vx * dt; r.y += r.vy * dt; r.ang += r.spin * dt;
        r.flame = r.bt < 0.9 ? (rng() < 0.5 ? 0.45 : 0.0) * (1 - r.bt / 0.9) : 0;
        if (rng() < dt * 40) this._smoke(r.x, r.y, (rng() - 0.5) * 60 * u, (rng() - 0.5) * 60 * u, 12 * u, 60 * u, 1.6, 0.4);
        if (rng() < dt * 26) this._fire(r.x, r.y, (rng() - 0.5) * 140 * u, (rng() - 0.5) * 140 * u, 10 * u, 40 * u, 0.5, 0.6);
        if (r.bt > 1.7) { r.state = 'dead'; this._explosion(r.x, r.y, 0.55, 46); this._ring(r.x, r.y, 120 * u, 0.7, '255,200,140'); this.sound('boom_small'); this._shake(5); }
      }
    }

    // srážka při remíze
    if (fin.tie && !fin.ev.collide && fin.rockets[0].state === 'fly' && fin.rockets[1].state === 'fly') {
      var a = fin.rockets[0], b = fin.rockets[1];
      if (Math.abs(a.x - b.x) < this.rh * 0.45) {
        fin.ev.collide = true; fin.collideT = t;
        var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        a.state = b.state = 'dead';
        this._explosion(mx, my, 1.3, 150); this._ring(mx, my, 520 * u, 1.3, '255,230,180', 0.2); this._ring(mx, my, 340 * u, 0.9, '255,150,80', 0.14);
        this._flash(mx, my, 1); this._shake(26); this.sound('explode'); fin.collideAt = { x: mx, y: my };
        this.cam.tx = mx; this.cam.ty = my; this.cam.tz = 1.35;
      }
    }
    if (fin.tie && fin.collideT) {
      var ct = t - fin.collideT;
      targetTS = ct < 0.9 ? 0.25 : 1;
      if (ct > 3.2) { this.cam.tx = W / 2; this.cam.ty = H / 2; this.cam.tz = 1; }
      this._fireworks(dt, -1, ct > 3.5);
      if (ct > 4.0 && !fin.done) { fin.done = true; if (this.onDone) this.onDone(fin); }
    }

    // zásah + zničení planety
    if (!fin.tie) {
      var W0 = fin.rockets[win], tgt = 1 - win, tp = this.planets[tgt];
      // kamera se při přiblížení přibližuje k cílové planetě
      if (t > fin.launchT) {
        var kz = smooth((tt - 0.3) / 0.6);
        if (fin.impactT < 0) {
          var mxp = (W0.x + W0.tip.x) / 2, myp = (W0.y + W0.tip.y) / 2;
          this.cam.tx = lerp(W / 2, mxp, kz * 0.92); this.cam.ty = lerp(H / 2, myp, kz * 0.92); this.cam.tz = 1 + 0.55 * kz;
        }
      }
      if (fin.impactT < 0 && tt > 0.8 && tt < 1) targetTS = 0.5;
      if (fin.impactT < 0 && W0.state === 'fly' && tt >= 1) this._impact(win, tgt);
      if (fin.impactT >= 0) {
        var it = t - fin.impactT;
        fin.heat = clamp((it - 0.1) / 1.5, 0, 1);
        if (fin.shatterT < 0) {
          targetTS = it < 0.3 ? 0.28 : (it > 1.2 ? 0.5 : 0.9);
          this.cam.tz = 1.75 + 0.3 * smooth(it / 1.6); this.cam.tx = tp.x + W0.n.x * this.R * 0.2; this.cam.ty = tp.y + W0.n.y * this.R * 0.12;
          if (rng() < dt * 40) {           // žhavé kapky z trhlin
            var ca = rng() * TAU;
            this._spark(tp.x + Math.cos(ca) * this.R * rng(), tp.y + Math.sin(ca) * this.R * rng(), (rng() - 0.5) * 120 * u, -(40 + rng() * 160) * u, 0.8 + rng(), 60 * u, '255,150,60');
          }
          if (it >= 1.6) this._shatter(tgt);
        } else {
          var st = t - fin.shatterT;
          targetTS = st < 1.6 ? 0.34 + 0.66 * smooth(st / 1.6) : 1;
          this._stepDebris(dt, st);
          if (st > 2.6) { this.cam.tz = 1.0 + 0.2 * (1 - smooth((st - 2.6) / 2.2)); this.cam.tx = lerp(tp.x, W / 2, smooth((st - 2.6) / 2.2)); this.cam.ty = lerp(tp.y, H / 2, smooth((st - 2.6) / 2.2)); }
          if (st > 3.6) this._fireworks(dt, win, true);
          if (st > 3.6 && !fin.done) { fin.done = true; if (this.onDone) this.onDone(fin); }
        }
      }
    }
    this.targetTS = targetTS;
  };

  Scene.prototype._exhaust = function (r, dt, k) {
    var u = this.u, rng = this.rng, c = this.colors[r.team];
    var sx = Math.sin(r.ang), sy = -Math.cos(r.ang);     // směr, kam raketa míří
    var bx = r.x, by = r.y;
    var n = dt * 150 * k * (r.h / this.rh), nn = Math.floor(n) + (rng() < n % 1 ? 1 : 0), i;
    for (i = 0; i < nn; i++) {
      var sp = (260 + rng() * 280) * u;
      this._fire(bx - sx * 6 * u, by - sy * 6 * u, -sx * sp + (rng() - 0.5) * 70 * u, -sy * sp + (rng() - 0.5) * 70 * u, (28 + rng() * 22) * u * (r.h / this.rh), (60 + rng() * 50) * u, 0.35 + rng() * 0.35, 0.9);
    }
    if (rng() < dt * 70) this._smoke(bx - sx * 24 * u, by - sy * 24 * u, -sx * 40 * u + (rng() - 0.5) * 50 * u, -sy * 40 * u + (rng() - 0.5) * 50 * u, 22 * u, 90 * u, 1.9, 0.5);
    if (rng() < dt * 30) this._spark(bx, by, -sx * 500 * u + (rng() - 0.5) * 300 * u, -sy * 500 * u + (rng() - 0.5) * 300 * u, 0.6, 120 * u, '255,200,120');
  };

  Scene.prototype._impact = function (win, tgt) {
    var fin = this.fin, u = this.u, rng = this.rng, r = fin.rockets[win], tp = this.planets[tgt];
    fin.impactT = fin.t; r.state = 'dead';
    var P = r.tip;
    fin.impactPt = { x: P.x, y: P.y };
    this._flash(P.x, P.y, 1); this._shake(22); this.sound('impact');
    this._explosion(P.x, P.y, 0.8, 120);
    this._ring(P.x, P.y, this.R * 1.4, 1.1, '255,235,200', 0.2); this._ring(P.x, P.y, this.R * 0.8, 0.7, '255,160,80', 0.14);
    // úlomky horniny letí po povrchu
    for (var i = 0; i < 60; i++) {
      var a = Math.atan2(r.n.y, r.n.x) + (rng() - 0.5) * 2.4, sp = (150 + rng() * 700) * u;
      this._spark(P.x, P.y, Math.cos(a) * sp, Math.sin(a) * sp, 0.8 + rng() * 1.2, 260 * u, '255,190,110');
    }
    // praskliny
    var rg = mulberry32(fin.seed), cracks = [], c, s;
    var imp = { x: (P.x - tp.x) / this.R, y: (P.y - tp.y) / this.R };
    for (c = 0; c < 17; c++) {
      var ang = Math.atan2(-imp.y, -imp.x) + (rg() - 0.5) * 2.9, len = 0.8 + rg() * 1.5, steps = 10 + Math.floor(rg() * 8);
      var pts = [{ x: imp.x, y: imp.y }], x = imp.x, y = imp.y, aa = ang, total = 0;
      for (s = 0; s < steps; s++) {
        aa += (rg() - 0.5) * 0.95; var st = len / steps; var nx = x + Math.cos(aa) * st, ny = y + Math.sin(aa) * st;
        total += st; x = nx; y = ny; pts.push({ x: x, y: y }); if (x * x + y * y > 1.06) break;
      }
      cracks.push({ pts: pts, delay: rg() * 0.3, speed: 0.75 + rg() * 0.6, w: 0.6 + rg() * 0.8, total: total });
    }
    fin.cracks = cracks;
  };

  Scene.prototype._snapshot = function (i) {
    var N = TEX, c = this.mk(N, N), g = c.getContext('2d'), L = this.layers[i], R = N / 2, col = this.colors[i];
    g.drawImage(L.albedo, 0, 0);
    g.save(); g.translate(R, R); g.rotate(this.t * 0.01 * (i ? -1 : 1)); g.drawImage(L.clouds, -R, -R); g.restore();
    g.drawImage(L.shade, 0, 0);
    g.globalCompositeOperation = 'lighter';
    if (L.emissive) g.drawImage(L.emissive, 0, 0);
    if (L.spec) g.drawImage(L.spec, 0, 0);
    return c;
  };

  Scene.prototype._shatter = function (tgt) {
    var fin = this.fin, u = this.u, rng = this.rng, tp = this.planets[tgt], R = this.R;
    fin.shatterT = fin.t; fin.destroyed = tgt; this.destroyed[tgt] = true;
    var snap = this._snapshot(tgt), TR = TEX / 2, rg = mulberry32(fin.seed + 9);
    var imp = { x: (fin.impactPt.x - tp.x) / R * TR, y: (fin.impactPt.y - tp.y) / R * TR };
    var shards = makeShards(TR, 42, imp, rg), self = this;
    fin.snap = snap; fin.hitIdx = tgt;
    fin.shards = shards.map(function (s) {
      var dx = s.cx - imp.x, dy = s.cy - imp.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
      var cl = Math.sqrt(s.cx * s.cx + s.cy * s.cy) || 1;
      var mx = dx / d * 0.55 + s.cx / cl * 0.85, my = dy / d * 0.55 + s.cy / cl * 0.85, ml = Math.sqrt(mx * mx + my * my) || 1; mx /= ml; my /= ml;
      var sp = R * (0.5 + 0.95 * rg()) * (1.25 - 0.4 * clamp(d / (TR * 2), 0, 1));
      var side = rg() - 0.5;
      return { poly: s.poly, cx: s.cx, cy: s.cy, ox: 0, oy: 0, vx: mx * sp + (-my) * side * R * 0.35, vy: my * sp + mx * side * R * 0.35, ang: 0, vr: (rg() - 0.5) * 2.4, heat: 1 };
    });
    fin.core = { t: 0 }; this.cam.tz = 1.2; this.cam.tx = tp.x; this.cam.ty = tp.y; this.cam.z = Math.min(this.cam.z, 1.7);
    this._flash(tp.x, tp.y, 0.8); this._shake(34); this.sound('explode');
    this._ring(tp.x, tp.y, R * 3.2, 1.8, '255,235,200', 0.22); this._ring(tp.x, tp.y, R * 2.0, 1.2, '255,140,60', 0.16); this._ring(tp.x, tp.y, R * 4.2, 2.4, '200,170,255', 0.1);
    this._explosion(tp.x, tp.y, 1.7, 230);
    for (var i = 0; i < 60; i++) {                   // žhavý prach
      var a = rng() * TAU, sp2 = (80 + rng() * 520) * u;
      this._dust(tp.x, tp.y, Math.cos(a) * sp2, Math.sin(a) * sp2, 50 * u, (120 + rng() * 100) * u, 2.5 + rng() * 2, 0.22);
    }
  };

  Scene.prototype._stepDebris = function (dt, st) {
    var fin = this.fin, u = this.u, rng = this.rng, R = this.R, tp = this.planets[fin.hitIdx], TR = TEX / 2;
    fin.core.t += dt;
    fin.shards.forEach(function (s) {
      s.ox += s.vx * dt; s.oy += s.vy * dt; s.ang += s.vr * dt; s.heat = Math.max(0, 1 - st / 4.2);
    });
    if (st < 2.4 && rng() < dt * 70) {                 // hořící úlomky za sebou táhnou jiskry
      var s = fin.shards[Math.floor(rng() * fin.shards.length)], sc = R / TR;
      var px = tp.x + (s.cx + 0) * sc + s.ox, py = tp.y + s.cy * sc + s.oy;
      this._fire(px, py, s.vx * 0.2, s.vy * 0.2, 16 * u, 60 * u, 0.7, 0.7);
      this._smoke(px, py, s.vx * 0.1, s.vy * 0.1, 18 * u, 80 * u, 2.2, 0.35);
    }
  };

  Scene.prototype._fireworks = function (dt, win, on) {
    if (!on) return;
    var fin = this.fin, u = this.u, rng = this.rng;
    fin.fw = (fin.fw || 0) - dt;
    if (fin.fw <= 0) {
      fin.fw = 0.35 + rng() * 0.4;
      var cx, cy, col;
      if (win >= 0) { var p = this.planets[win]; cx = p.x + (rng() - 0.5) * this.W * 0.2; cy = this.H * (0.12 + rng() * 0.25); col = this.colors[win].rgb; }
      else { cx = this.W * (0.2 + rng() * 0.6); cy = this.H * (0.12 + rng() * 0.3); col = rng() < 0.5 ? this.colors[0].rgb : this.colors[1].rgb; }
      for (var i = 0; i < 54; i++) { var a = rng() * TAU, sp = (80 + rng() * 260) * u; this._spark(cx, cy, Math.cos(a) * sp, Math.sin(a) * sp, 1.0 + rng() * 0.8, 120 * u, rng() < 0.35 ? '255,255,255' : col); }
      this.sound('pop');
    }
  };

  /* ============================= KRESLENÍ ============================== */
  Scene.prototype.render = function () {
    var ctx = this.ctx, W = this.W, H = this.H, d = this.dpr, c = this.cam, u = this.u, i;
    ctx.setTransform(d, 0, 0, d, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    // pozadí (s jemným paralaxem)
    var px = (c.x - W / 2) * 0.03, py = (c.y - H / 2) * 0.03;
    ctx.drawImage(this.bg, -W * 0.05 - px, -H * 0.05 - py, W * 1.1, H * 1.1);
    for (i = 0; i < this.stars.length; i++) {
      var s = this.stars[i], a = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(this.t * s.sp + s.ph));
      ctx.fillStyle = 'rgba(' + (s.tint < 0.3 ? '190,215,255' : s.tint > 0.8 ? '255,225,190' : '255,255,255') + ',' + a.toFixed(2) + ')';
      ctx.fillRect(s.x - px * 1.6, s.y - py * 1.6, s.r, s.r);
    }
    this._drawAmbient();
    // svět (kamera)
    ctx.save();
    var sh = c.amp, sx = (Math.sin(this.t * 63) + Math.sin(this.t * 41 + 1.3)) * 0.5 * sh, sy = (Math.cos(this.t * 57) + Math.sin(this.t * 37 + 0.4)) * 0.5 * sh;
    ctx.translate(W / 2 + sx, H / 2 + sy); ctx.scale(c.z, c.z); ctx.translate(-c.x, -c.y);

    for (i = 0; i < 2; i++) {
      if (this.destroyed[i]) continue;
      var ox = 0, oy = 0, fin = this.fin;
      if (fin && fin.hitIdx === undefined && fin.impactT >= 0 && fin.destroyed < 0 && fin.impactPt && i === 1 - fin.winner) {
        var amp = 5 * u * (0.4 + fin.heat); ox = (Math.random() - 0.5) * amp; oy = (Math.random() - 0.5) * amp;
      }
      this._drawPlanet(i, ox, oy);
      if (fin && fin.impactT >= 0 && fin.destroyed < 0 && i === 1 - fin.winner) this._drawCracks(i, ox, oy);
    }
    if (this.fin && this.fin.core) this._drawFireball();
    if (this.fin && this.fin.shards) this._drawDebris();
    for (i = 0; i < 2; i++) this._drawRocket(i);
    this._drawParticles();
    this._drawRings();
    ctx.restore();

    if (this.flash > 0.01) {
      var fa = Math.min(1, this.flash), fg2 = ctx.createRadialGradient(this.flashX, this.flashY, 0, this.flashX, this.flashY, Math.max(W, H) * 0.85);
      fg2.addColorStop(0, 'rgba(255,252,240,' + (fa * 0.95).toFixed(3) + ')'); fg2.addColorStop(0.3, 'rgba(255,225,170,' + (fa * 0.55).toFixed(3) + ')'); fg2.addColorStop(1, 'rgba(255,170,100,' + (fa * 0.12).toFixed(3) + ')');
      ctx.fillStyle = fg2; ctx.fillRect(0, 0, W, H);
    }
    this._drawHUD();
  };

  Scene.prototype._drawPlanet = function (i, ox, oy) {
    var ctx = this.ctx, p = this.planets[i], R = this.R, L = this.layers[i], col = this.colors[i];
    var x = p.x + ox, y = p.y + oy, dd = R * 2, gl = col.glow.join(',');
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    var g = ctx.createRadialGradient(x, y, R * 0.97, x, y, R * 1.34);
    g.addColorStop(0, 'rgba(' + gl + ',0.55)'); g.addColorStop(0.35, 'rgba(' + gl + ',0.16)'); g.addColorStop(1, 'rgba(' + gl + ',0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R * 1.34, 0, TAU); ctx.fill(); ctx.restore();
    ctx.drawImage(L.albedo, x - R, y - R, dd, dd);
    ctx.save(); ctx.translate(x, y); ctx.rotate(this.t * 0.01 * (i ? -1 : 1)); ctx.drawImage(L.clouds, -R, -R, dd, dd); ctx.restore();
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.clip();
    var rg = ctx.createRadialGradient(x, y, R * 0.8, x, y, R);
    rg.addColorStop(0, 'rgba(' + gl + ',0)'); rg.addColorStop(1, 'rgba(' + gl + ',0.42)');
    ctx.fillStyle = rg; ctx.fillRect(x - R, y - R, dd, dd); ctx.restore();
    ctx.drawImage(L.shade, x - R, y - R, dd, dd);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    if (L.emissive) { ctx.globalAlpha = 0.8 + 0.2 * Math.sin(this.t * 2 + i); ctx.drawImage(L.emissive, x - R, y - R, dd, dd); }
    ctx.globalAlpha = 1;
    if (L.spec) ctx.drawImage(L.spec, x - R, y - R, dd, dd);
    var fin = this.fin;
    if (fin && fin.impactT >= 0 && fin.destroyed < 0 && i === 1 - fin.winner && fin.heat > 0) {   // planeta žhne zevnitř
      ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.clip();
      var hg = ctx.createRadialGradient(x, y, 0, x, y, R);
      hg.addColorStop(0, 'rgba(255,170,60,' + (0.5 * fin.heat).toFixed(3) + ')'); hg.addColorStop(0.7, 'rgba(255,90,20,' + (0.3 * fin.heat).toFixed(3) + ')'); hg.addColorStop(1, 'rgba(255,60,0,' + (0.15 * fin.heat).toFixed(3) + ')');
      ctx.fillStyle = hg; ctx.fillRect(x - R, y - R, dd, dd);
    }
    ctx.restore();
  };

  Scene.prototype._drawCracks = function (i, ox, oy) {
    var fin = this.fin, ctx = this.ctx, p = this.planets[i], R = this.R, u = this.u;
    if (!fin.cracks) return;
    var age = fin.t - fin.impactT, x0 = p.x + ox, y0 = p.y + oy;
    ctx.save(); ctx.beginPath(); ctx.arc(x0, y0, R, 0, TAU); ctx.clip(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    var pass, c, j;
    for (pass = 0; pass < 4; pass++) {
      for (c = 0; c < fin.cracks.length; c++) {
        var cr = fin.cracks[c], prog = clamp((age - 0.1 - cr.delay) * cr.speed / 1.3, 0, 1);
        if (prog <= 0) continue;
        var want = prog * cr.total, acc = 0;
        ctx.beginPath(); ctx.moveTo(x0 + (cr.pts[0].x) * R, y0 + (cr.pts[0].y) * R);
        for (j = 1; j < cr.pts.length; j++) {
          var a = cr.pts[j - 1], b = cr.pts[j], sl = Math.sqrt((b.x - a.x) * (b.x - a.x) + (b.y - a.y) * (b.y - a.y));
          if (acc + sl <= want) { ctx.lineTo(x0 + b.x * R, y0 + b.y * R); acc += sl; }
          else { var f = (want - acc) / sl; ctx.lineTo(x0 + (a.x + (b.x - a.x) * f) * R, y0 + (a.y + (b.y - a.y) * f) * R); break; }
        }
        var wv = cr.w * u;
        if (pass === 0) { ctx.globalCompositeOperation = 'source-over'; ctx.strokeStyle = 'rgba(10,4,2,0.8)'; ctx.lineWidth = (7 + wv * 5) * u; }
        else if (pass === 1) { ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(255,90,20,' + (0.28 + 0.2 * fin.heat).toFixed(2) + ')'; ctx.lineWidth = (14 + wv * 9) * u; }
        else if (pass === 2) { ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(255,170,60,0.85)'; ctx.lineWidth = (4.5 + wv * 3) * u; }
        else { ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(255,245,210,0.95)'; ctx.lineWidth = (1.6 + wv) * u; }
        ctx.stroke();
      }
    }
    ctx.restore(); ctx.globalCompositeOperation = 'source-over';
  };

  Scene.prototype._drawDebris = function () {
    var fin = this.fin, ctx = this.ctx, tp = this.planets[fin.hitIdx], R = this.R, sc = R / (TEX / 2), st = fin.t - fin.shatterT;
    var fade = clamp(1 - (st - 5.5) / 4, 0.0, 1);
    fin.shards.forEach(function (s) {
      var gx = tp.x + s.cx * sc + s.ox, gy = tp.y + s.cy * sc + s.oy;
      ctx.save(); ctx.globalAlpha = fade; ctx.translate(gx, gy); ctx.rotate(s.ang); ctx.scale(sc, sc); ctx.translate(-s.cx, -s.cy);
      ctx.beginPath(); ctx.moveTo(s.poly[0].x, s.poly[0].y); for (var k = 1; k < s.poly.length; k++) ctx.lineTo(s.poly[k].x, s.poly[k].y); ctx.closePath();
      ctx.save(); ctx.clip(); ctx.drawImage(fin.snap, -TEX / 2, -TEX / 2);
      if (s.heat > 0.01) {
        ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,100,20,' + (s.heat * 0.5).toFixed(3) + ')'; ctx.fillRect(-TEX / 2, -TEX / 2, TEX, TEX);
      }
      ctx.restore();
      if (s.heat > 0.01) { ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(255,190,90,' + (s.heat * 0.9).toFixed(3) + ')'; ctx.lineWidth = 5 / sc * 0.5 + 2; ctx.lineJoin = 'round'; ctx.stroke(); }
      ctx.restore();
    });
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  };

  Scene.prototype._drawFireball = function () {
    var fin = this.fin, ctx = this.ctx, tp = this.planets[fin.hitIdx], R = this.R, t = fin.core.t;
    var r = R * (0.45 + 1.0 * easeOut(t / 1.3)), a = 0.62 * clamp(1 - (t - 0.3) / 1.9, 0, 1);
    if (a <= 0) return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    var g = ctx.createRadialGradient(tp.x, tp.y, 0, tp.x, tp.y, r);
    g.addColorStop(0, 'rgba(255,255,240,' + (a).toFixed(3) + ')'); g.addColorStop(0.25, 'rgba(255,215,110,' + (a * 0.9).toFixed(3) + ')');
    g.addColorStop(0.55, 'rgba(255,110,30,' + (a * 0.55).toFixed(3) + ')'); g.addColorStop(1, 'rgba(180,30,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(tp.x, tp.y, r, 0, TAU); ctx.fill();
    // žhavé jádro, které pomalu vychládá
    var ca = 0.8 * clamp(1 - t / 6, 0, 1), cr = R * 0.2 * (1 - 0.35 * clamp(t / 6, 0, 1));
    var cg = ctx.createRadialGradient(tp.x, tp.y, 0, tp.x, tp.y, cr * 2.2);
    cg.addColorStop(0, 'rgba(255,240,190,' + ca.toFixed(3) + ')'); cg.addColorStop(0.4, 'rgba(255,140,40,' + (ca * 0.8).toFixed(3) + ')'); cg.addColorStop(1, 'rgba(255,60,0,0)');
    ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(tp.x, tp.y, cr * 2.2, 0, TAU); ctx.fill();
    ctx.restore();
  };

  Scene.prototype._drawRocket = function (i) {
    var ctx = this.ctx, fin = this.fin, r = fin ? fin.rockets[i] : null, x, y, ang = 0, h, flame, col = this.colors[i];
    if (r) { if (r.state === 'dead') return; x = r.x; y = r.y; ang = r.ang; h = r.h; flame = r.flame; }
    else { var pd = this._pad(i); x = pd.x; y = pd.y; h = this._rocketH(i); flame = 0.22 + 0.04 * Math.sin(this.t * 30 + i); }
    var w = h * 0.27, t = this.t, k;
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    // záře kolem rakety
    var gl = clamp(this.pulse[i] * 0.9 + (r && r.state === 'fly' ? 0.25 : 0), 0, 1);
    if (gl > 0.02) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      var gg = ctx.createRadialGradient(0, -h * 0.5, 0, 0, -h * 0.5, h * 0.95);
      gg.addColorStop(0, 'rgba(' + col.rgb + ',' + (0.45 * gl).toFixed(3) + ')'); gg.addColorStop(1, 'rgba(' + col.rgb + ',0)');
      ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(0, -h * 0.5, h * 0.95, 0, TAU); ctx.fill(); ctx.restore();
    }
    // plamen (za tělem)
    if (flame > 0.02) {
      var fl = h * (0.3 + 0.95 * flame) * (0.88 + 0.12 * Math.sin(t * 38 + i) + 0.06 * Math.sin(t * 61)), fw = w * 0.36 * (0.7 + 0.5 * flame);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      var layers = [[1, 1, 'rgba(255,120,30,0.0)', 'rgba(255,170,60,0.9)', 'rgba(255,70,10,0.55)'], [0.62, 0.72, '', 'rgba(255,230,150,0.95)', 'rgba(255,150,40,0.5)'], [0.3, 0.46, '', 'rgba(255,255,245,1)', 'rgba(255,230,160,0.4)']];
      for (k = 0; k < layers.length; k++) {
        var wl = fw * layers[k][0], ll = fl * layers[k][1];
        var lg = ctx.createLinearGradient(0, 0, 0, ll);
        lg.addColorStop(0, layers[k][3]); lg.addColorStop(0.55, layers[k][4]); lg.addColorStop(1, 'rgba(255,40,0,0)');
        ctx.fillStyle = lg; ctx.beginPath(); ctx.moveTo(-wl, -2); ctx.quadraticCurveTo(-wl * 0.95, ll * 0.55, 0, ll); ctx.quadraticCurveTo(wl * 0.95, ll * 0.55, wl, -2); ctx.closePath(); ctx.fill();
      }
      var fg = ctx.createRadialGradient(0, 0, 0, 0, 0, h * 0.45 * (0.5 + flame));
      fg.addColorStop(0, 'rgba(255,200,120,0.75)'); fg.addColorStop(1, 'rgba(255,100,20,0)');
      ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(0, 0, h * 0.45 * (0.5 + flame), 0, TAU); ctx.fill(); ctx.restore();
    }
    // křídla
    ctx.fillStyle = col.dark; ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1.5;
    for (k = -1; k <= 1; k += 2) {
      ctx.beginPath(); ctx.moveTo(k * w * 0.48, -h * 0.36); ctx.lineTo(k * w * 1.05, -h * 0.07); ctx.lineTo(k * w * 1.05, h * 0.02); ctx.lineTo(k * w * 0.48, -h * 0.1); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    // tryska
    ctx.fillStyle = '#3a3f4a'; ctx.beginPath(); ctx.moveTo(-w * 0.2, -h * 0.07); ctx.lineTo(w * 0.2, -h * 0.07); ctx.lineTo(w * 0.28, 0); ctx.lineTo(-w * 0.28, 0); ctx.closePath(); ctx.fill();
    // trup
    var bg = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
    bg.addColorStop(0, '#ffffff'); bg.addColorStop(0.45, '#dfe6ee'); bg.addColorStop(1, '#8c98ab');
    ctx.beginPath(); ctx.moveTo(-w / 2, -h * 0.07); ctx.lineTo(w / 2, -h * 0.07); ctx.lineTo(w / 2, -h * 0.62);
    ctx.quadraticCurveTo(w / 2, -h * 0.87, 0, -h); ctx.quadraticCurveTo(-w / 2, -h * 0.87, -w / 2, -h * 0.62); ctx.closePath();
    ctx.fillStyle = bg; ctx.fill(); ctx.strokeStyle = 'rgba(20,24,34,0.65)'; ctx.lineWidth = Math.max(1.5, h * 0.012); ctx.stroke();
    ctx.save(); ctx.clip();
    var ng = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
    ng.addColorStop(0, col.light); ng.addColorStop(0.4, col.main); ng.addColorStop(1, col.dark);
    ctx.fillStyle = ng; ctx.fillRect(-w, -h * 1.1, w * 2, h * 0.48);
    ctx.fillStyle = col.main; ctx.fillRect(-w, -h * 0.3, w * 2, h * 0.05);
    ctx.fillStyle = col.dark; ctx.fillRect(-w, -h * 0.16, w * 2, h * 0.035);
    ctx.restore();
    // okénko
    var pr = w * 0.2;
    ctx.beginPath(); ctx.arc(0, -h * 0.47, pr * 1.2, 0, TAU); ctx.fillStyle = '#9aa7b8'; ctx.fill(); ctx.strokeStyle = 'rgba(20,24,34,0.7)'; ctx.lineWidth = 1.2; ctx.stroke();
    var wg = ctx.createRadialGradient(-pr * 0.3, -h * 0.47 - pr * 0.3, 0, 0, -h * 0.47, pr);
    wg.addColorStop(0, '#d8f2ff'); wg.addColorStop(1, '#1f5f9f');
    ctx.beginPath(); ctx.arc(0, -h * 0.47, pr, 0, TAU); ctx.fillStyle = wg; ctx.fill();
    ctx.restore();
  };

  Scene.prototype._drawParticles = function () {
    var ctx = this.ctx, ps = this.particles, i, p, k, s, a, spr = this.spr;
    ctx.save(); ctx.globalCompositeOperation = 'source-over';
    for (i = 0; i < ps.length; i++) {
      p = ps[i]; if (p.k !== 'smoke' && p.k !== 'dust') continue;
      k = 1 - p.life / p.max; s = p.s0 + (p.s1 - p.s0) * k; a = p.a * Math.pow(1 - k, 1.3) * Math.min(1, k * 8);
      ctx.globalAlpha = a; ctx.drawImage(p.k === 'smoke' ? spr.smoke : spr.dust, p.x - s / 2, p.y - s / 2, s, s);
    }
    ctx.globalCompositeOperation = 'lighter';
    for (i = 0; i < ps.length; i++) {
      p = ps[i]; k = 1 - p.life / p.max;
      if (p.k === 'fire') { s = p.s0 + (p.s1 - p.s0) * k; ctx.globalAlpha = p.a * Math.pow(1 - k, 1.1); ctx.drawImage(spr.fire, p.x - s / 2, p.y - s / 2, s, s); }
      else if (p.k === 'spark') {
        ctx.globalAlpha = Math.pow(1 - k, 0.8); ctx.strokeStyle = 'rgba(' + p.col + ',1)'; ctx.lineWidth = 2 * this.u + 0.6;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035); ctx.stroke();
        s = 14 * this.u; ctx.globalAlpha *= 0.55; ctx.drawImage(spr.ember, p.x - s / 2, p.y - s / 2, s, s);
      }
    }
    ctx.restore(); ctx.globalAlpha = 1;
  };

  Scene.prototype._drawRings = function () {
    var ctx = this.ctx, i;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (i = 0; i < this.rings.length; i++) {
      var r = this.rings[i], k = r.t / r.dur, rad = r.r1 * easeOut(k), a = Math.pow(1 - k, 1.4), wd = rad * r.w + 6;
      var g = ctx.createRadialGradient(r.x, r.y, Math.max(0, rad - wd), r.x, r.y, rad + wd * 0.35);
      g.addColorStop(0, 'rgba(' + r.col + ',0)'); g.addColorStop(0.7, 'rgba(' + r.col + ',' + (0.55 * a).toFixed(3) + ')'); g.addColorStop(1, 'rgba(' + r.col + ',0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(r.x, r.y, rad + wd * 0.35, 0, TAU); ctx.fill();
    }
    ctx.restore();
  };

  /* ================================ HUD ================================ */
  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  }
  var FONT = '"Segoe UI","Trebuchet MS","Helvetica Neue",Arial,sans-serif';
  Scene.prototype._text = function (txt, x, y, size, color, align, weight, glow) {
    var ctx = this.ctx; ctx.font = (weight || 800) + ' ' + size + 'px ' + FONT; ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle';
    if (glow) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = glow; for (var k = 0; k < 2; k++) ctx.fillText(txt, x, y); ctx.restore(); }
    ctx.fillStyle = color; ctx.fillText(txt, x, y);
  };
  Scene.prototype._spaced = function (txt, x, y, size, color, sp) {
    var ctx = this.ctx; ctx.font = '700 ' + size + 'px ' + FONT; ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.fillStyle = color;
    var w = 0, i; for (i = 0; i < txt.length; i++) w += ctx.measureText(txt[i]).width + sp; w -= sp;
    var cx = x - w / 2; for (i = 0; i < txt.length; i++) { ctx.fillText(txt[i], cx, y); cx += ctx.measureText(txt[i]).width + sp; }
  };

  Scene.prototype._teamPanel = function (i, reveal) {
    var ctx = this.ctx, u = this.u, p = this.planets[i], col = this.colors[i], y0 = p.y + this.R + 52 * u;
    var pow = reveal !== undefined ? reveal : this.shown[i], fin = this.fin;
    var mx = Math.max(20, Math.max(this.power[0], this.power[1]) * 1.25), fill = clamp(pow / mx, 0, 1);
    ctx.save(); ctx.globalAlpha = (fin && this.destroyed[i]) ? 0.25 : 1;
    this._text(this.names[i], p.x, y0, 62 * u, '#ffffff', 'center', 900, 'rgba(' + col.rgb + ',0.5)');
    if (this.mode !== 'finale') {
      var n0 = this.players[i];
      this._text(n0 + (n0 === 1 ? ' hráč' : n0 >= 2 && n0 <= 4 ? ' hráči' : ' hráčů'), p.x, y0 + 46 * u, 22 * u, 'rgba(255,255,255,0.6)', 'center', 600);
    }
    if (this.mode === 'lobby') { ctx.restore(); return; }
    var bw = 400 * u, bh = 28 * u, bx = p.x - bw / 2, by = y0 + 70 * u, n = 20, gap = 4 * u, sw = (bw - gap * (n - 1)) / n, k;
    for (k = 0; k < n; k++) {
      var on = (k + 0.5) / n <= fill, x = bx + k * (sw + gap);
      rr(ctx, x, by, sw, bh, 4 * u); ctx.fillStyle = on ? col.main : 'rgba(255,255,255,0.1)'; ctx.fill();
      if (on) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; rr(ctx, x, by, sw, bh, 4 * u); ctx.fillStyle = 'rgba(' + col.rgb + ',0.45)'; ctx.fill(); ctx.restore(); }
    }
    this._text(String(Math.round(pow)), p.x, by + bh + 50 * u, 66 * u, col.light, 'center', 900, 'rgba(' + col.rgb + ',0.45)');
    this._spaced('SÍLA RAKETY', p.x, by + bh + 98 * u, 20 * u, 'rgba(255,255,255,0.65)', 5 * u);
    ctx.restore();
  };

  Scene.prototype._drawHUD = function () {
    var ctx = this.ctx, W = this.W, H = this.H, u = this.u, fin = this.fin, i, p;
    ctx.save(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';

    if (this.mode === 'lobby') {
      this._text('KOSMICKÁ BITVA', W / 2, 92 * u, 104 * u, '#ffffff', 'center', 900, 'rgba(120,170,255,0.55)');
      this._spaced('MARIE TEREZIE · TÝMOVÝ KVÍZ', W / 2, 168 * u, 28 * u, 'rgba(255,255,255,0.75)', 8 * u);
    }
    if (this.mode === 'game') {
      var rem = this.remain === null ? this.total : Math.max(0, this.remain), low = rem <= 10;
      var tot = Math.ceil(rem - 0.0001), m = Math.floor(tot / 60), s = tot % 60, txt = m + ':' + (s < 10 ? '0' : '') + s;
      var bw = 340 * u, bh = 124 * u, bx = W / 2 - bw / 2, by = 26 * u, pul = low ? 0.5 + 0.5 * Math.sin(this.t * 8) : 0;
      rr(ctx, bx, by, bw, bh, 28 * u); ctx.fillStyle = 'rgba(8,12,30,0.62)'; ctx.fill();
      ctx.lineWidth = 3 * u; ctx.strokeStyle = low ? 'rgba(255,' + Math.round(70 + 60 * (1 - pul)) + ',70,0.95)' : 'rgba(150,190,255,0.55)'; ctx.stroke();
      this._text(txt, W / 2, by + bh / 2 - 8 * u, 86 * u, low ? '#ff6a5a' : '#ffffff', 'center', 900, low ? 'rgba(255,60,40,' + (0.3 + 0.4 * pul).toFixed(2) + ')' : 'rgba(150,190,255,0.35)');
      var frac = clamp(rem / this.total, 0, 1);
      rr(ctx, bx + 26 * u, by + bh - 22 * u, bw - 52 * u, 8 * u, 4 * u); ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fill();
      rr(ctx, bx + 26 * u, by + bh - 22 * u, Math.max(8 * u, (bw - 52 * u) * frac), 8 * u, 4 * u); ctx.fillStyle = low ? '#ff6a5a' : '#7fb8ff'; ctx.fill();
      if (rem <= 5 && rem > 0) {
        var cs = Math.ceil(rem), ph = 1 - (rem - Math.floor(rem));
        ctx.globalAlpha = 0.3 * (1 - ph); this._text(String(cs), W / 2, H * 0.4, 380 * u * (0.9 + 0.3 * ph), '#ffffff', 'center', 900); ctx.globalAlpha = 1;
      }
    }
    if (this.mode === 'game' || this.mode === 'lobby') { this._teamPanel(0); this._teamPanel(1); }
    if (this.mode === 'game') {
      var sa = this.shown[0], sb = this.shown[1], st = sa + sb, ratio = st > 0.05 ? sa / st : 0.5;
      var tw = Math.min(W * 0.3, 560 * u), th = 26 * u, tx = W / 2 - tw / 2, ty = H * 0.56;
      ctx.save();
      rr(ctx, tx - 6 * u, ty - 6 * u, tw + 12 * u, th + 12 * u, (th + 12 * u) / 2); ctx.fillStyle = 'rgba(8,12,30,0.6)'; ctx.fill();
      ctx.lineWidth = 2 * u; ctx.strokeStyle = 'rgba(150,190,255,0.35)'; ctx.stroke();
      ctx.save(); rr(ctx, tx, ty, tw, th, th / 2); ctx.clip();
      var gA = ctx.createLinearGradient(tx, 0, tx + tw * ratio, 0); gA.addColorStop(0, '#1a79c9'); gA.addColorStop(1, '#3db8ff');
      ctx.fillStyle = gA; ctx.fillRect(tx, ty, tw * ratio, th);
      var gB = ctx.createLinearGradient(tx + tw * ratio, 0, tx + tw, 0); gB.addColorStop(0, '#ff7a3c'); gB.addColorStop(1, '#c13a10');
      ctx.fillStyle = gB; ctx.fillRect(tx + tw * ratio, ty, tw * (1 - ratio), th);
      ctx.restore();
      var kx = tx + tw * ratio; ctx.save(); ctx.globalCompositeOperation = 'lighter';
      var kg = ctx.createRadialGradient(kx, ty + th / 2, 0, kx, ty + th / 2, 34 * u); kg.addColorStop(0, 'rgba(255,255,255,0.85)'); kg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = kg; ctx.fillRect(kx - 34 * u, ty - 24 * u, 68 * u, th + 48 * u); ctx.restore();
      this._text('VS', W / 2, ty - 44 * u, 54 * u, 'rgba(255,255,255,0.92)', 'center', 900, 'rgba(160,190,255,0.5)');
      var lead = sa === sb || st < 0.5 ? 'VYROVNANÝ SOUBOJ' : (sa > sb ? 'AQUA VEDE' : 'IGNIS VEDE'), lc = st < 0.5 || Math.abs(sa - sb) < 0.5 ? 'rgba(255,255,255,0.65)' : (sa > sb ? this.colors[0].light : this.colors[1].light);
      this._spaced(lead, W / 2, ty + th + 40 * u, 20 * u, lc, 5 * u);
      ctx.restore();
    }

    // vznášející se „+1“
    for (i = 0; i < this.popups.length; i++) {
      p = this.popups[i]; var k = p.t / 1.6, c = this.colors[p.team];
      ctx.globalAlpha = Math.pow(1 - k, 0.8);
      this._text(p.text, p.x, p.y - k * 150 * u, 36 * u, c.light, 'center', 800, 'rgba(' + c.rgb + ',0.6)');
    }
    ctx.globalAlpha = 1;

    if (fin) this._drawFinaleHUD();
    ctx.restore();
  };

  Scene.prototype._drawFinaleHUD = function () {
    var fin = this.fin, ctx = this.ctx, W = this.W, H = this.H, u = this.u, t = fin.t, i;
    var pa = fin.powers, c = this.colors;
    // odhalení skóre
    var rev = easeOut((t - 0.5) / 2.2);
    if (t < fin.launchT + 0.6) {
      this._teamPanel(0, pa[0] * rev); this._teamPanel(1, pa[1] * rev);
    }
    if (t < 3.1) {
      var al = smooth(t / 0.4) * (1 - smooth((t - 2.7) / 0.4));
      ctx.globalAlpha = al; this._text('ČAS VYPRŠEL!', W / 2, H * 0.17, 120 * u * (1 + 0.12 * (1 - smooth(t / 0.5))), '#ffffff', 'center', 900, 'rgba(255,80,70,0.55)'); ctx.globalAlpha = 1;
    }
    if (t >= 3.0 && t < fin.launchT - 0.3) {
      var al2 = smooth((t - 3.0) / 0.5), msg, col;
      if (fin.tie) { msg = 'REMÍZA – STEJNĚ SILNÉ RAKETY!'; col = '#ffffff'; }
      else { msg = 'TÝM ' + this.names[fin.winner] + ' MÁ SILNĚJŠÍ RAKETU!'; col = c[fin.winner].light; }
      ctx.globalAlpha = al2; this._text(msg, W / 2, H * 0.17, 66 * u, col, 'center', 900, fin.tie ? 'rgba(255,255,255,0.3)' : 'rgba(' + c[fin.winner].rgb + ',0.6)'); ctx.globalAlpha = 1;
    }
    // odpočet
    var cd = [[4.2, '3'], [5.0, '2'], [5.8, '1'], [fin.launchT, 'START!']];
    for (i = 0; i < cd.length; i++) {
      var d0 = t - cd[i][0];
      if (d0 >= 0 && d0 < 0.8) {
        var pk = d0 / 0.8, sz = (i === 3 ? 190 : 300) * u * (1.35 - 0.35 * easeOut(d0 / 0.25));
        ctx.globalAlpha = 1 - smooth((pk - 0.55) / 0.45);
        this._text(cd[i][1], W / 2, H * 0.34, sz, i === 3 ? '#ffd27a' : '#ffffff', 'center', 900, i === 3 ? 'rgba(255,150,40,0.7)' : 'rgba(150,190,255,0.6)'); ctx.globalAlpha = 1;
      }
    }
    // malé skóre nahoře při letu
    if (t >= fin.launchT + 0.6 && !fin.tie || (fin.tie && t >= fin.launchT + 0.6)) {
      var show = 1 - smooth((t - (fin.impactT >= 0 ? fin.impactT : 1e9) - 3.5) / 1);
      ctx.globalAlpha = 0.9 * show;
      this._text(this.names[0] + '  ' + pa[0] + '  :  ' + pa[1] + '  ' + this.names[1], W / 2, 52 * u, 46 * u, '#ffffff', 'center', 900, 'rgba(150,190,255,0.35)'); ctx.globalAlpha = 1;
    }
    // vítězný banner
    var bt = fin.shatterT >= 0 ? t - fin.shatterT : -1;
    if (fin.tie && fin.collideT) bt = t - fin.collideT - 0.6;
    if (bt > 2.4) {
      var ba = smooth((bt - 2.4) / 0.7), main, sub, wc;
      if (fin.tie) { main = 'REMÍZA!'; sub = 'Rakety se srazily – obě planety přežily  (' + pa[0] + ' : ' + pa[1] + ')'; wc = '#ffffff'; }
      else { main = 'TÝM ' + this.names[fin.winner] + ' VYHRÁL!'; sub = 'Zničil planetu ' + this.names[1 - fin.winner] + '   (' + pa[fin.winner] + ' : ' + pa[1 - fin.winner] + ')'; wc = c[fin.winner].light; }
      var by = H * 0.19 + (1 - ba) * -30 * u;
      ctx.globalAlpha = ba;
      rr(ctx, W / 2 - 640 * u, by - 100 * u, 1280 * u, 220 * u, 34 * u); ctx.fillStyle = 'rgba(6,10,26,0.6)'; ctx.fill();
      this._text(main, W / 2, by - 28 * u, 104 * u, wc, 'center', 900, fin.tie ? 'rgba(255,255,255,0.35)' : 'rgba(' + c[fin.winner].rgb + ',0.7)');
      this._text(sub, W / 2, by + 62 * u, 36 * u, 'rgba(255,255,255,0.88)', 'center', 600);
      ctx.globalAlpha = 1;
    }
  };

  /* ---------- pomocné pro testy: přeskočí v čase o daný počet sekund ---------- */
  Scene.prototype.advance = function (seconds, fps) {
    fps = fps || 60; var n = Math.round(seconds * fps);
    for (var i = 0; i < n; i++) this.step(1 / fps);
  };

  /* ------------------------------ zvuky (WebAudio) ------------------------------ */
  var AudioFX = (function () {
    var ctx = null, master = null, nb = null, muted = false;
    function init() {
      if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)(); master = ctx.createGain(); master.gain.value = 0.8; master.connect(ctx.destination);
        var n = ctx.sampleRate * 3.5; nb = ctx.createBuffer(1, n, ctx.sampleRate); var d = nb.getChannelData(0); for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      } catch (e) { ctx = null; }
    }
    function tone(f0, f1, dur, type, vol, delay) {
      if (!ctx || muted) return; var t = ctx.currentTime + (delay || 0), o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
    }
    function noise(dur, f0, f1, vol, type, delay) {
      if (!ctx || muted) return; var t = ctx.currentTime + (delay || 0), s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      s.buffer = nb; f.type = type; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.08, dur / 4)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random()); s.stop(t + dur + 0.05);
    }
    var S = {
      tick: function () { tone(880, 880, 0.14, 'sine', 0.28); },
      horn: function () { tone(190, 140, 1.0, 'sawtooth', 0.26); tone(143, 105, 1.0, 'sawtooth', 0.2); },
      ignite: function () { noise(2.2, 180, 1400, 0.55, 'lowpass'); },
      launch: function () { noise(3.6, 500, 2600, 0.6, 'bandpass'); tone(55, 130, 3.2, 'sawtooth', 0.14); },
      fail: function () { tone(420, 55, 1.2, 'sawtooth', 0.18); noise(0.7, 3000, 200, 0.25, 'lowpass'); },
      boom_small: function () { noise(0.9, 2500, 100, 0.55, 'lowpass'); tone(95, 35, 0.8, 'sine', 0.5); },
      impact: function () { noise(1.8, 3400, 80, 0.95, 'lowpass'); tone(115, 28, 1.5, 'sine', 0.95); },
      explode: function () { noise(3.4, 4200, 55, 1.0, 'lowpass'); tone(72, 20, 2.8, 'sine', 1.0); noise(1.3, 8000, 400, 0.4, 'highpass', 0.15); noise(2.2, 900, 60, 0.6, 'lowpass', 0.4); },
      pop: function () { noise(0.3, 6000, 1500, 0.22, 'bandpass'); tone(900, 200, 0.22, 'triangle', 0.1); },
      correct: function () { tone(660, 990, 0.12, 'triangle', 0.1); }
    };
    return { init: init, play: function (n) { if (S[n]) S[n](); }, setMuted: function (v) { muted = !!v; }, isMuted: function () { return muted; } };
  })();

  var api = { Scene: Scene, Audio: AudioFX };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.KB = api;
})(typeof window !== 'undefined' ? window : globalThis);
