const WebSocket = require('ws');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET || 'mostajir_secret_key_change_in_prod';

let wss = null;
const clients = new Map(); // userId -> Set<WebSocket>

function initWS(server) {
  wss = new WebSocket.Server({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      const token = url.searchParams.get('token');
      let userId = null;
      if (token) {
        try {
          const decoded = jwt.verify(token, JWT_SECRET);
          userId = decoded.userId;
        } catch {}
      }
      ws.isAlive = true;
      ws._userId = userId;

      if (userId) {
        if (!clients.has(userId)) clients.set(userId, new Set());
        clients.get(userId).add(ws);
      }

      ws.on('pong', () => { ws.isAlive = true; });
      ws.on('close', () => {
        if (userId && clients.has(userId)) {
          clients.get(userId).delete(ws);
          if (clients.get(userId).size === 0) clients.delete(userId);
        }
      });
      ws.on('error', () => {});
    } catch {}
  });

  // Heartbeat every 30s
  const heartbeat = setInterval(() => {
    if (!wss) return;
    wss.clients.forEach(ws => {
      if (ws.isAlive === false) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => clearInterval(heartbeat));
  console.log('[WS] WebSocket server initialized on path /ws');
}

function sendToUser(userId, data) {
  if (!clients.has(userId)) return;
  const msg = JSON.stringify(data);
  for (const ws of clients.get(userId)) {
    try {
      if (ws.readyState === WebSocket.OPEN) ws.send(msg);
    } catch {}
  }
}

function broadcast(data) {
  if (!wss) return;
  const msg = JSON.stringify(data);
  for (const [, userSockets] of clients) {
    for (const ws of userSockets) {
      try {
        if (ws.readyState === WebSocket.OPEN) ws.send(msg);
      } catch {}
    }
  }
}

function getConnectedCount() {
  return clients.size;
}

module.exports = { initWS, sendToUser, broadcast, getConnectedCount };
