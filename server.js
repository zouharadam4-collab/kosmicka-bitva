/* ============================================================================
   KOSMICKÁ BITVA – herní server
   Spuštění:  node server.js     (potom otevři  http://localhost:3000/host)
   Spolužáci se připojí telefonem přes QR kód ze stránky /host.
   ========================================================================== */
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { WebSocketServer } = require('ws');
const QRCode = require('qrcode');
const QUESTIONS = require('./questions');

const PORT = parseInt(process.env.PORT, 10) || 3000;
const HOST_KEY = process.env.HOST_KEY || '';            // volitelné heslo pro ovládání z jiného zařízení
const PUBLIC = path.join(__dirname, 'public');
const TEAM_NAMES = ['AQUA', 'IGNIS'];
const BOT_NAMES = ['Karel', 'Tereza', 'Matěj', 'Eliška', 'Jakub', 'Anežka', 'Ondra', 'Klára', 'Vojta', 'Lucka', 'Filip', 'Natálie', 'Dan', 'Barbora', 'Šimon', 'Adéla'];

/* ------------------------------ stav hry ------------------------------- */
const g = {
  phase: 'lobby',                // lobby | running | ended
  durationMs: 180000,
  startedAt: 0, endsAt: 0,
  power: [0, 0],
  result: null,
  endTimer: null,
};
const players = new Map();       // id -> player
let hostSockets = new Set();
let nextBot = 0;

function rnd(n) { return Math.floor(Math.random() * n); }
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function cleanName(s) {
  s = String(s || '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16);
  return s || 'Hráč';
}
function teamCounts() { const c = [0, 0]; players.forEach(p => c[p.team]++); return c; }
function send(ws, obj) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj)); }
function sendP(p, obj) { if (p.ws) send(p.ws, obj); }
function isLoopback(req) {                       // požadavek z tohoto počítače (localhost i jeho vlastní IP v síti)
  const a = (req.socket.remoteAddress || '').replace('::ffff:', '');
  if (a === '127.0.0.1' || a === '::1') return true;
  return lanIps().some(i => i.ip === a);
}

/* ------------------------------ týmy ----------------------------------- */
function pickTeam() {
  const c = teamCounts();
  if (c[0] === c[1]) return rnd(2);
  return c[0] < c[1] ? 0 : 1;
}
function rebalance() {            // v lobby drží týmy vyvážené (rozdíl max 1 hráč)
  if (g.phase !== 'lobby') return;
  for (let guard = 0; guard < 50; guard++) {
    const c = teamCounts();
    if (Math.abs(c[0] - c[1]) < 2) break;
    const from = c[0] > c[1] ? 0 : 1;
    const cand = [...players.values()].filter(p => p.team === from);
    const mv = cand[cand.length - 1];
    mv.team = 1 - from;
    sendP(mv, { t: 'team', team: mv.team, name: TEAM_NAMES[mv.team] });
  }
}
function reshuffleTeams() {
  const ids = shuffle([...players.keys()]);
  ids.forEach((id, i) => { const p = players.get(id); p.team = i % 2; sendP(p, { t: 'team', team: p.team, name: TEAM_NAMES[p.team] }); });
}

/* ----------------------------- otázky ---------------------------------- */
function nextQuestion(p) {
  if (g.phase !== 'running') return;
  if (!p.queue.length) {
    p.queue = shuffle(QUESTIONS.map((_, i) => i));
    if (p.last !== undefined && p.queue[p.queue.length - 1] === p.last) p.queue.unshift(p.queue.pop());
  }
  clearTimeout(p.timer);
  const qi = p.queue.pop(); p.last = qi;
  const q = QUESTIONS[qi];
  const order = shuffle([0, 1, 2, 3]);                // order[k] = původní index možnosti na pozici k
  p.cur = { qi, order, sent: Date.now() };
  p.asked++;
  sendP(p, { t: 'q', n: p.asked, text: q.q, opts: order.map(i => q.o[i]) });
}
function handleAnswer(p, choice) {
  if (g.phase !== 'running' || !p.cur) return;
  const now = Date.now();
  if (now > g.endsAt) return;
  if (now - p.cur.sent < 150) return;                 // ochrana proti automatickému klikání
  choice = parseInt(choice, 10);
  if (!(choice >= 0 && choice < 4)) return;
  const cur = p.cur; p.cur = null;
  const ok = cur.order[choice] === 0;
  const correctIdx = cur.order.indexOf(0);
  if (ok) {
    p.score++; g.power[p.team]++;
    toHosts({ t: 'ev', k: 'correct', team: p.team, name: p.name });
    markDirty();
  }
  sendP(p, { t: 'res', ok, correct: correctIdx, picked: choice, score: p.score });
  clearTimeout(p.timer);
  if (!p.bot) p.timer = setTimeout(() => nextQuestion(p), ok ? 650 : 1900);
}

/* ------------------------------ boti (test) ----------------------------- */
function addBots(n) {
  for (let i = 0; i < n; i++) {
    const id = 'bot' + (++nextBot) + '_' + Date.now().toString(36);
    const p = {
      id, name: BOT_NAMES[(nextBot - 1) % BOT_NAMES.length] + (nextBot > BOT_NAMES.length ? nextBot : ''), team: pickTeam(), score: 0, ws: null,
      online: true, bot: true, queue: [], cur: null, asked: 0, timer: null, acc: 0.5 + Math.random() * 0.4, speed: 2500 + Math.random() * 4500, loop: null
    };
    players.set(id, p);
  }
  rebalance(); markDirty();
}
function botTick(p) {
  clearTimeout(p.loop);
  if (g.phase !== 'running') return;
  p.loop = setTimeout(() => {
    if (g.phase !== 'running') return;
    if (!p.cur) nextQuestion(p);
    const cur = p.cur;
    if (cur) {
      const ci = cur.order.indexOf(0);
      let choice = ci;
      if (Math.random() >= p.acc) { const wrong = [0, 1, 2, 3].filter(k => k !== ci); choice = wrong[rnd(3)]; }
      cur.sent = 0;
      handleAnswer(p, choice);
    }
    botTick(p);
  }, p.speed * (0.6 + Math.random() * 0.8));
}

/* ------------------------------ průběh hry ------------------------------ */
function startGame(seconds) {
  if (g.phase === 'running') return { ok: false, err: 'Hra už běží.' };
  if (players.size < 2) return { ok: false, err: 'Potřebuješ aspoň 2 hráče (nebo přidej testovací boty).' };
  rebalance();
  g.phase = 'running'; g.result = null;
  g.durationMs = Math.max(5, Math.min(900, seconds || 180)) * 1000;
  g.startedAt = Date.now(); g.endsAt = g.startedAt + g.durationMs; g.power = [0, 0];
  players.forEach(p => { p.score = 0; p.queue = []; p.cur = null; p.asked = 0; clearTimeout(p.timer); });
  players.forEach(p => { if (p.bot) botTick(p); else nextQuestion(p); });
  clearTimeout(g.endTimer); g.endTimer = setTimeout(endGame, g.durationMs + 80);
  broadcastAll();
  return { ok: true };
}
function endGame() {
  if (g.phase !== 'running') return;
  g.phase = 'ended';
  players.forEach(p => { clearTimeout(p.timer); clearTimeout(p.loop); p.cur = null; });
  const [a, b] = g.power;
  const top = [...players.values()].sort((x, y) => y.score - x.score).slice(0, 5).map(p => ({ name: p.name, team: p.team, score: p.score }));
  g.result = { winner: a === b ? -1 : (a > b ? 0 : 1), powers: [a, b], top };
  broadcastAll();
}
function resetGame(reshuffle) {
  clearTimeout(g.endTimer);
  players.forEach(p => { clearTimeout(p.timer); clearTimeout(p.loop); p.score = 0; p.cur = null; p.queue = []; });
  for (const [id, p] of players) if (!p.bot && !p.online && !p.ws) players.delete(id);
  g.phase = 'lobby'; g.power = [0, 0]; g.result = null;
  if (reshuffle) reshuffleTeams(); else rebalance();
  broadcastAll();
}

/* ------------------------------ vysílání -------------------------------- */
function hostState() {
  return {
    t: 'state', phase: g.phase, endsAt: g.endsAt, durationMs: g.durationMs, now: Date.now(), power: g.power.slice(), result: g.result,
    teams: [0, 1].map(i => ({ name: TEAM_NAMES[i], players: [...players.values()].filter(p => p.team === i).map(p => ({ name: p.name, bot: !!p.bot, online: !!p.online })) }))
  };
}
function playerState() {
  const c = teamCounts();
  return { t: 'state', phase: g.phase, endsAt: g.endsAt, durationMs: g.durationMs, now: Date.now(), power: g.power.slice(), counts: c, result: g.result };
}
function toHosts(o) { hostSockets.forEach(ws => send(ws, o)); }
let dirty = false;
function markDirty() { dirty = true; }
setInterval(() => {
  if (!dirty) return; dirty = false;
  const hs = hostState(), ps = playerState();
  toHosts(hs);
  players.forEach(p => sendP(p, Object.assign({ you: { team: p.team, score: p.score } }, ps)));
}, 150);
function broadcastAll() {
  const hs = hostState(), ps = playerState();
  toHosts(hs);
  players.forEach(p => {
    sendP(p, Object.assign({ you: { team: p.team, score: p.score } }, ps));
    if (g.phase === 'ended') sendP(p, { t: 'end', result: g.result, you: { team: p.team, score: p.score } });
  });
  if (g.phase === 'ended') toHosts({ t: 'end', result: g.result });
}

/* ------------------------------- HTTP ----------------------------------- */
function lanIps() {
  const out = [];
  const ifs = os.networkInterfaces();
  Object.keys(ifs).forEach(name => (ifs[name] || []).forEach(i => { if (i.family === 'IPv4' && !i.internal) out.push({ ip: i.address, name }); }));
  const rank = ip => ip.startsWith('192.168.') ? 0 : ip.startsWith('10.') ? 1 : /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ? 2 : 3;
  return out.sort((a, b) => rank(a.ip) - rank(b.ip));
}
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
const ROUTES = { '/': 'play.html', '/host': 'host.html', '/demo': 'demo.html' };

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/api/info') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      const fh = req.headers['x-forwarded-host'];
      const cloud = !!fh;
      const joinUrl = cloud ? (req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim() + '://' + fh.split(',')[0].trim() + '/' : null;
      return res.end(JSON.stringify({ port: PORT, ips: cloud ? [] : lanIps(), local: isLoopback(req), needKey: !!HOST_KEY, cloud, joinUrl }));
    }
    if (url.pathname === '/qr.svg') {
      const u = (url.searchParams.get('u') || '').slice(0, 200);
      if (!/^https?:\/\//.test(u)) { res.writeHead(400); return res.end('bad'); }
      const svg = await QRCode.toString(u, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0b1020', light: '#ffffff' } });
      res.writeHead(200, { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'no-store' });
      return res.end(svg);
    }
    const file = ROUTES[url.pathname] || (url.pathname === '/render.js' ? 'render.js' : null);
    if (!file) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Nenalezeno'); }
    const full = path.join(PUBLIC, file);
    fs.readFile(full, (err, data) => {
      if (err) { res.writeHead(404); return res.end('Nenalezeno'); }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      res.end(data);
    });
  } catch (e) { res.writeHead(500); res.end('Chyba serveru'); }
});

/* ----------------------------- WebSocket -------------------------------- */
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 4096 });
wss.on('connection', (ws, req) => {
  const local = isLoopback(req);
  let me = null, isHost = false, last = 0;
  ws.isAlive = true; ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', raw => {
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    if (!m || typeof m.t !== 'string') return;

    if (m.t === 'host') {
      if (!(HOST_KEY ? m.key === HOST_KEY : local)) return send(ws, { t: 'denied', needKey: !!HOST_KEY });
      isHost = true; hostSockets.add(ws); send(ws, hostState());
      if (g.phase === 'ended') send(ws, { t: 'end', result: g.result });
      return;
    }
    if (isHost) {
      if (m.t === 'start') { const r = startGame(Number(m.seconds) || 180); if (!r.ok) send(ws, { t: 'err', msg: r.err }); }
      else if (m.t === 'reset') resetGame(!!m.reshuffle);
      else if (m.t === 'bots') { if (g.phase !== 'running') addBots(Math.max(1, Math.min(20, parseInt(m.n, 10) || 6))); }
      else if (m.t === 'shuffle') { if (g.phase === 'lobby') { reshuffleTeams(); broadcastAll(); } }
      else if (m.t === 'kick') { const p = players.get(m.id); if (p) { players.delete(m.id); clearTimeout(p.timer); if (p.ws) { try { p.ws.close(); } catch (e) {} } markDirty(); } }
      return;
    }

    if (m.t === 'join') {
      let p = typeof m.id === 'string' ? players.get(m.id) : null;
      if (p && !p.bot) { p.ws = ws; p.online = true; if (m.name) p.name = cleanName(m.name); }
      else {
        if (players.size >= 150) return send(ws, { t: 'full' });
        const id = 'p' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
        p = { id, name: cleanName(m.name), team: pickTeam(), score: 0, ws, online: true, bot: false, queue: [], cur: null, asked: 0, timer: null };
        players.set(id, p); rebalance();
      }
      me = p;
      send(ws, { t: 'joined', id: p.id, name: p.name, team: p.team, teamName: TEAM_NAMES[p.team] });
      send(ws, Object.assign({ you: { team: p.team, score: p.score } }, playerState()));
      if (g.phase === 'running') { if (p.cur) send(ws, { t: 'q', n: p.asked, text: QUESTIONS[p.cur.qi].q, opts: p.cur.order.map(i => QUESTIONS[p.cur.qi].o[i]) }); else nextQuestion(p); }
      if (g.phase === 'ended') send(ws, { t: 'end', result: g.result, you: { team: p.team, score: p.score } });
      markDirty();
      return;
    }
    if (m.t === 'answer' && me) {
      const now = Date.now(); if (now - last < 120) return; last = now;
      handleAnswer(me, m.c);
    }
  });

  ws.on('close', () => {
    if (isHost) hostSockets.delete(ws);
    if (me && me.ws === ws) {
      me.ws = null; me.online = false;
      if (g.phase === 'lobby') setTimeout(() => { if (me && !me.online && g.phase === 'lobby' && players.get(me.id) === me) { players.delete(me.id); rebalance(); markDirty(); } }, 20000);
      markDirty();
    }
  });
  ws.on('error', () => {});
});
setInterval(() => { wss.clients.forEach(ws => { if (!ws.isAlive) return ws.terminate(); ws.isAlive = false; try { ws.ping(); } catch (e) {} }); }, 15000);

server.listen(PORT, '0.0.0.0', () => {
  const ips = lanIps();
  console.log('\n  ★  KOSMICKÁ BITVA  ★\n');
  console.log('  Ovládací obrazovka (na projektor):   http://localhost:' + PORT + '/host');
  if (ips.length) { console.log('  Hráči se připojí na (QR kód je na obrazovce):'); ips.forEach(i => console.log('     http://' + i.ip + ':' + PORT + '/   (' + i.name + ')')); }
  else console.log('  ⚠ Nenašel jsem síť – připoj se k wifi / hotspotu.');
  console.log('\n  Ukončení: Ctrl + C\n');
});
module.exports = { g, players, startGame, endGame, resetGame, addBots, server };
