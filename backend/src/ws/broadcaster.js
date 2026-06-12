// WebSocket broadcaster — maps userId to Set of ws connections
const clients = new Map();

function registerClient(userId, ws) {
  if (!clients.has(userId)) clients.set(userId, new Set());
  clients.get(userId).add(ws);

  ws.on('close', () => {
    clients.get(userId)?.delete(ws);
    if (clients.get(userId)?.size === 0) clients.delete(userId);
  });
}

function broadcastToUser(userId, payload) {
  const userClients = clients.get(userId);
  if (!userClients) return;
  const msg = JSON.stringify(payload);
  for (const ws of userClients) {
    if (ws.readyState === 1 /* OPEN */) {
      ws.send(msg);
    }
  }
}

function broadcastToAll(payload) {
  const msg = JSON.stringify(payload);
  for (const [, userClients] of clients) {
    for (const ws of userClients) {
      if (ws.readyState === 1) ws.send(msg);
    }
  }
}

module.exports = { registerClient, broadcastToUser, broadcastToAll };
