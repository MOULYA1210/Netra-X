const { WebSocketServer, WebSocket } = require('ws');
const logger = require('./logger');

let wss = null;

/**
 * Initialize WebSocket server attached to an HTTP server
 * Called once from server.js
 */
const initWebSocket = (httpServer) => {
  wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const clientIp = req.socket.remoteAddress;
    logger.info(`[WebSocket] Client connected: ${clientIp}`);

    // Send welcome message with current server time
    ws.send(JSON.stringify({
      type: 'CONNECTED',
      message: 'Connected to NetraX real-time feed',
      timestamp: new Date().toISOString(),
    }));

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        // Handle client messages (e.g. subscribe to specific device)
        if (msg.type === 'PING') {
          ws.send(JSON.stringify({ type: 'PONG', timestamp: new Date().toISOString() }));
        }
      } catch {
        // Ignore malformed messages
      }
    });

    ws.on('close', () => {
      logger.info(`[WebSocket] Client disconnected: ${clientIp}`);
    });

    ws.on('error', (err) => {
      logger.error(`[WebSocket] Client error: ${err.message}`);
    });
  });

  logger.info('[WebSocket] Server initialized on path /ws');
  return wss;
};

/**
 * Broadcast a message to ALL connected clients
 * Used by monitoring services to push live updates
 */
const broadcast = (type, data) => {
  if (!wss) return;

  const message = JSON.stringify({
    type,
    data,
    timestamp: new Date().toISOString(),
  });

  let sent = 0;
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
      sent++;
    }
  });

  if (sent > 0) {
    logger.debug(`[WebSocket] Broadcast '${type}' to ${sent} clients`);
  }
};

/**
 * Get count of connected clients
 */
const getClientCount = () => {
  if (!wss) return 0;
  return [...wss.clients].filter((c) => c.readyState === WebSocket.OPEN).length;
};

module.exports = { initWebSocket, broadcast, getClientCount };