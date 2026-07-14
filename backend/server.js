require('express-async-errors');
require('dotenv').config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const http = require('http');
const app = require('./src/app');
const connectDB = require('./src/config/db');
const logger = require('./src/utils/logger');
const { initWebSocket } = require('./src/utils/websocket');
const { startAllMonitors, stopAllMonitors } = require('./src/services/monitorScheduler');
const { startEscalationEngine, stopEscalationEngine } = require('./src/services/escalationService');
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();

  // Create HTTP server from Express app
  // Why? We need to attach WebSocket to the same port as REST API
  const server = http.createServer(app);

  // Initialize WebSocket on the same HTTP server
  initWebSocket(server);

  server.listen(PORT, () => {
    logger.info(`🚀 NetraX Backend     → http://localhost:${PORT}`);
    logger.info(`📡 REST API           → http://localhost:${PORT}/api`);
    logger.info(`⚡ WebSocket          → ws://localhost:${PORT}/ws`);
    logger.info(`🌍 Environment        → ${process.env.NODE_ENV}`);
  });

  // Start monitoring engine after server is ready
  startAllMonitors();
startEscalationEngine();
  // Graceful shutdown
  const shutdown = (signal) => {
    logger.warn(`${signal} received — shutting down...`);
    stopAllMonitors();
    server.close(() => {
      logger.info('Server closed.');
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000);
  };
stopEscalationEngine();
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
  process.on('unhandledRejection', (err) => {
    logger.error(`Unhandled Rejection: ${err.message}`);
    shutdown('unhandledRejection');
  });
  
};

startServer();