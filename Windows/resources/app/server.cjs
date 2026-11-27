'use strict';

const http = require('node:http');
const os = require('node:os');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomBytes, randomInt, timingSafeEqual } = require('node:crypto');
const { defaults, normalize, CATALOG, CANVASES, wallpaperPattern } = require('./layout.cjs');

const WEB = path.join(__dirname, 'web');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' };
const STATIC = new Set(['/styles.css', '/app.js', '/widgets.js', '/connect.js', '/assets/alpine-dusk.png']);
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'none'";
const errorStatus = (status, message) => Object.assign(new Error(message), { status });
const privateIp = ip => /^(?:10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.|169\.254\.)/.test(ip);

function addresses() {
  return [...new Set(Object.values(os.networkInterfaces()).flat().filter(
    item => item?.family === 'IPv4' && !item.internal && privateIp(item.address),
  ).map(item => item.address))];
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': CSP, ...headers });
  res.end(body);
}

const json = (res, status, value) => send(res, status, JSON.stringify(value), { 'Content-Type': 'application/json; charset=utf-8' });

async function read(req, cap) {
  let length = 0;
  const chunks = [];
  for await (const chunk of req) {
    length += chunk.length;
    if (length > cap) throw errorStatus(413, 'File or request is too large.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, length);
}

async function readJson(req) {
  if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) {
    throw errorStatus(415, 'Use a JSON request.');
  }
  const bytes = await read(req, 200 * 1024);
  try { return JSON.parse(bytes.toString('utf8')); }
  catch { throw errorStatus(400, 'Invalid JSON request.'); }
}

function imageType(bytes) {
  if (bytes.length > 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  if (bytes.length > 8 && bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) return 'png';
  if (bytes.length > 3 && bytes.subarray(0, 3).equals(Buffer.from('ffd8ff', 'hex'))) return 'jpg';
  throw errorStatus(415, 'Choose a PNG, JPEG or WebP image.');
}

function startListening(server, port, host) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.removeListener('error', reject);
      resolve(server.address().port);
    });
  });
}

async function createHost({ dataDir, editorPort = 0, requestedViewerPort = 38141 } = {}) {
  const stateFile = path.join(dataDir, 'layout.json');
  const wallpaperDir = path.join(dataDir, 'wallpapers');
  await fs.mkdir(wallpaperDir, { recursive: true });
  let state;
  try {
    const file = JSON.parse(await fs.readFile(stateFile, 'utf8'));
    const rev = Number.isSafeInteger(file.revision) && file.revision >= 0 ? file.revision : 0;
    state = normalize(file, rev);
  } catch (e) {
    if (e.code !== 'ENOENT') throw new Error('The saved layout could not be read: ' + e.message);
    state = defaults();
  }
  let writes = Promise.resolve();
  let viewerServer;
  let viewerPort;
  let startingViewer;
  let pairing;
  const sessions = new Map();
  const attempts = new Map();
  const streams = new Map();
  let closeSession;

  const snapshot = () => ({ state, catalog: CATALOG, canvases: CANVASES, host: os.hostname() });
  const sendEvent = (res, event, payload) => res.write('event: ' + event + '\ndata: ' + JSON.stringify(payload) + '\n\n');
  const broadcast = (event, payload) => {
    for (const res of streams.keys()) {
      if (res.writableEnded || res.writableLength > 160000) res.end();
      else sendEvent(res, event, payload);
    }
  };
  let lastCpu = os.cpus().map(cpu => cpu.times);
  const stats = () => {
    const current = os.cpus().map(cpu => cpu.times);
    let idle = 0, total = 0;
    current.forEach((times, i) => {
      if (!lastCpu[i]) return;
      idle += times.idle - lastCpu[i].idle;
      for (const key of Object.keys(times)) total += times[key] - lastCpu[i][key];
    });
    lastCpu = current;
    return {
      cpu: total ? Math.max(0, Math.min(100, Math.round(100 * (1 - idle / total)))) : 0,
      memory: Math.round(100 * (1 - os.freemem() / os.totalmem())),
      uptime: Math.floor(os.uptime()), cores: current.length,
    };
  };

  const heartbeat = setInterval(() => {
    if (streams.size) broadcast('stats', stats());
    if (sessions.size) for (const [token, expiry] of sessions) if (expiry < Date.now()) {
      sessions.delete(token);
      closeSession(token);
    }
    for (const [ip, recent] of attempts) if (recent.until < Date.now()) attempts.delete(ip);
  }, 1000);
  heartbeat.unref();
  closeSession = token => {
    for (const [res, session] of streams) if (session === token) res.end();
  };

  const serveFile = async (res, file) => {
    let bytes;
    try { bytes = await fs.readFile(file); }
    catch (e) { if (e.code === 'ENOENT') throw errorStatus(404, 'Not found.'); throw e; }
    send(res, 200, bytes, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  };
  const editorServer = http.createServer((req, res) => handle(req, res, true));
  const actualEditorPort = await startListening(editorServer, editorPort, '127.0.0.1');

  async function startViewer() {
    if (viewerServer?.listening) return;
    if (!startingViewer) startingViewer = (async () => {
      const server = http.createServer((req, res) => handle(req, res, false));
      try { viewerPort = await startListening(server, requestedViewerPort, '0.0.0.0'); }
      catch (error) {
        if (error.code !== 'EADDRINUSE') throw error;
        viewerPort = await startListening(server, 0, '0.0.0.0');
      }
      viewerServer = server;
    })().finally(() => { startingViewer = null; });
    await startingViewer;
  }

  function pairingInfo() {
    return { port: viewerPort || null, addresses: addresses(), code: pairing?.expires > Date.now() ? pairing.code : null,
      expires: pairing?.expires || null, viewers: sessions.size };
  }

  async function handle(req, res, editor) {
    try {
      const port = editor ? actualEditorPort : viewerPort;
      const local = new Set(['127.0.0.1:' + port, 'localhost:' + port]);
      if (!editor) addresses().forEach(ip => local.add(ip + ':' + port));
      if (!local.has(req.headers.host)) throw errorStatus(400, 'Unknown host.');
      if (req.url?.[0] !== '/' || req.url.startsWith('//')) throw errorStatus(400, 'Invalid request.');
      const route = new URL(req.url, 'http://' + req.headers.host).pathname;
      const method = req.method;
      if (editor && method === 'POST' && req.headers.origin !== 'http://' + req.headers.host) {
        throw errorStatus(403, 'Only the local editor can make changes.');
      }
      if (!editor && method === 'POST' && req.headers.origin && req.headers.origin !== 'http://' + req.headers.host) {
        throw errorStatus(403, 'Open pairing in GlassDeck.');
      }

      if (!editor && method === 'GET' && route === '/connect') return serveFile(res, path.join(WEB, 'connect.html'));
      if (!editor && method === 'POST' && route === '/connect') {
        const key = req.socket.remoteAddress;
        const now = Date.now();
        if (!attempts.has(key) && attempts.size >= 512) throw errorStatus(429, 'Try again later.');
        const recent = attempts.get(key);
        const count = recent?.until > now ? recent : { count: 0, until: now + 60000 };
        if (++count.count > 6) throw errorStatus(429, 'Try again in a minute.');
        attempts.set(key, count);
        if (sessions.size >= 24) throw errorStatus(429, 'Disconnect a viewer from the Windows app first.');
        const form = new URLSearchParams((await read(req, 2048)).toString('utf8'));
        const code = form.get('code') || '';
        if (!/^\d{6}$/.test(code) || !pairing || pairing.expires < now
          || !timingSafeEqual(Buffer.from(code), Buffer.from(pairing.code))) throw errorStatus(401, 'Use a fresh pairing code from Windows.');
        pairing = null;
        attempts.delete(key);
        const token = randomBytes(32).toString('hex');
        sessions.set(token, now + 30 * 86400000);
        return send(res, 303, '', { Location: '/display', 'Set-Cookie': 'glass_session=' + token + '; Path=/; Max-Age=2592000; HttpOnly; SameSite=Strict' });
      }

      const token = !editor && /(?:^|;\s*)glass_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '')?.[1];
      if (!editor && (!token || (sessions.get(token) || 0) < Date.now())) {
        if (method === 'GET' && (route === '/' || route === '/display')) return send(res, 303, '', { Location: '/connect' });
        if (method === 'GET' && (route === '/styles.css' || route === '/connect.js')) return serveFile(res, path.join(WEB, route.slice(1)));
        throw errorStatus(401, 'Pair this viewer with GlassDeck.');
      }

      if (method === 'GET' && (route === '/' || route === '/display' || (editor && route === '/editor'))) {
        return serveFile(res, path.join(WEB, 'index.html'));
      }
      if (method === 'GET' && STATIC.has(route)) return serveFile(res, path.join(WEB, route.slice(1)));
      if (method === 'GET' && route.startsWith('/wallpaper/')) {
        const file = route.slice('/wallpaper/'.length);
        if (!wallpaperPattern.test(file) || file !== state.wallpaper) throw errorStatus(404, 'Wallpaper not found.');
        return serveFile(res, path.join(wallpaperDir, file));
      }
      if (method === 'GET' && route === '/api/state') return json(res, 200, snapshot());
      if (method === 'GET' && route === '/api/events') {
        if (streams.size >= 40) throw errorStatus(503, 'Too many displays connected.');
        res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
        streams.set(res, token);
        res.on('close', () => streams.delete(res));
        sendEvent(res, 'layout', snapshot());
        return;
      }
      if (!editor) throw errorStatus(404, 'Not found.');

      if (method === 'GET' && route === '/api/pair') return json(res, 200, pairingInfo());
      if (method === 'POST' && route === '/api/pair') {
        await startViewer();
        pairing = { code: String(randomInt(100000, 1000000)), expires: Date.now() + 120000 };
        return json(res, 200, pairingInfo());
      }
      if (method === 'POST' && route === '/api/unpair') {
        pairing = null;
        for (const session of sessions.keys()) closeSession(session);
        sessions.clear();
        return json(res, 200, pairingInfo());
      }
      if (method === 'POST' && route === '/api/wallpaper') {
        const bytes = await read(req, 6 * 1024 * 1024);
        const file = 'wall-' + randomBytes(12).toString('hex') + '.' + imageType(bytes);
        await fs.writeFile(path.join(wallpaperDir, file), bytes, { flag: 'wx' });
        return json(res, 201, { file });
      }
      if (method === 'POST' && route === '/api/state') {
        const requested = await readJson(req);
        const operation = writes.then(async () => {
          if (requested.baseRevision !== state.revision) return json(res, 409, { error: 'The layout changed in another editor.', ...snapshot() });
          let updated;
          try { updated = normalize(requested.state, state.revision + 1); }
          catch (e) { throw errorStatus(400, e.message); }
          if (updated.wallpaper) await fs.access(path.join(wallpaperDir, updated.wallpaper));
          const temp = stateFile + '.' + randomBytes(5).toString('hex') + '.tmp';
          try {
            await fs.writeFile(temp, JSON.stringify(updated) + '\n', { flag: 'wx' });
            await fs.rename(temp, stateFile);
          } finally { await fs.rm(temp, { force: true }).catch(() => {}); }
          state = updated;
          broadcast('layout', snapshot());
          return json(res, 200, snapshot());
        });
        writes = operation.catch(() => {});
        return await operation;
      }
      throw errorStatus(404, 'Not found.');
    } catch (e) {
      if (!res.headersSent && !res.destroyed) json(res, e.status || 500, { error: e.status ? e.message : 'GlassDeck could not complete that request.' });
      else res.end();
    }
  }

  return {
    editorUrl: 'http://127.0.0.1:' + actualEditorPort,
    async close() {
      clearInterval(heartbeat);
      for (const res of streams.keys()) res.end();
      await writes;
      await Promise.all([editorServer, viewerServer].filter(Boolean).map(server => new Promise(resolve => server.close(resolve))));
    },
  };
}

module.exports = { createHost };
