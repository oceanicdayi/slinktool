/**
 * slinktool-website - Server for IRIS FDSNWS SeedLink waveform viewer
 * 
 * This server can run in two modes:
 * 1. Standard mode: WebSocket + HTTP server (for local/Render/Railway deployment)
 * 2. Vercel mode: HTTP only with Server-Sent Events (SSE) for real-time updates
 */

const express = require('express');
const WebSocket = require('ws');
const path = require('path');
const { SeedLinkClient } = require('./seedlink');

const app = express();
const PORT = process.env.PORT || 3000;
const SEEDLINK_HOST = process.env.SEEDLINK_HOST || 'rtserve.iris.washington.edu';
const SEEDLINK_PORT = parseInt(process.env.SEEDLINK_PORT) || 18000;

// Detect if running on Vercel (serverless environment)
const IS_VERCEL = process.env.VERCEL || process.env.NOW_REGION;

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

// Store active SSE connections for Vercel mode
const sseClients = new Set();

// Store SeedLink connection (shared for all clients in Vercel mode)
let seedlinkClient = null;
let currentStations = [];

/**
 * Start WebSocket server (for non-Vercel environments)
 */
function startWebSocketServer(server) {
  const wss = new WebSocket.Server({ server });
  const clients = new Set();
  const seedlinkConnections = new Map();
  
  wss.on('connection', (ws, req) => {
    const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    ws.clientId = clientId;
    clients.add(ws);
    
    ws.send(JSON.stringify({
      type: 'welcome',
      message: 'Connected to slinktool-website',
      seedlinkServer: `${SEEDLINK_HOST}:${SEEDLINK_PORT}`,
      clientId: clientId,
      mode: 'websocket'
    }));
    
    ws.on('message', (message) => {
      try {
        if (typeof message === 'string') {
          const msg = JSON.parse(message);
          
          switch (msg.type) {
            case 'subscribe':
              const stations = msg.stations || ['IU_KONO', 'GE_WLF', 'MN_AQU'];
              
              if (seedlinkConnections.has(clientId)) {
                seedlinkConnections.get(clientId).disconnect();
                seedlinkConnections.delete(clientId);
              }
              
              const slClient = new SeedLinkClient(SEEDLINK_HOST, SEEDLINK_PORT);
              slClient.setStationSelectors(stations.join(','));
              
              slClient.on('onData', (record) => {
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(record);
                }
              });
              
              slClient.connect();
              seedlinkConnections.set(clientId, slClient);
              
              ws.send(JSON.stringify({
                type: 'subscribed',
                stations: stations,
                message: `Subscribed to stations: ${stations.join(', ')}`
              }));
              break;
              
            case 'unsubscribe':
              if (seedlinkConnections.has(clientId)) {
                seedlinkConnections.get(clientId).disconnect();
                seedlinkConnections.delete(clientId);
              }
              break;
          }
        }
      } catch (err) {
        console.error('Error processing message:', err);
      }
    });
    
    ws.on('close', () => {
      clients.delete(ws);
      if (seedlinkConnections.has(clientId)) {
        seedlinkConnections.get(clientId).disconnect();
        seedlinkConnections.delete(clientId);
      }
    });
  });
  
  return wss;
}

/**
 * SSE endpoint for Vercel (HTTP long-polling alternative)
 */
app.get('/api/sse', (req, res) => {
  console.log('New SSE connection');
  
  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });
  
  // Send welcome message
  res.write(`data: ${JSON.stringify({
    type: 'welcome',
    message: 'Connected via SSE',
    seedlinkServer: `${SEEDLINK_HOST}:${SEEDLINK_PORT}`,
    mode: 'sse'
  })}\n\n`);
  
  // Store client
  sseClients.add(res);
  
  // Handle client disconnect
  req.on('close', () => {
    console.log('SSE client disconnected');
    sseClients.delete(res);
  });
  
  req.on('error', () => {
    sseClients.delete(res);
  });
});

/**
 * Subscribe endpoint for SSE mode
 */
app.post('/api/subscribe', express.json(), (req, res) => {
  const stations = req.body.stations || ['IU_KONO', 'GE_WLF', 'MN_AQU'];
  currentStations = stations;
  
  // Close existing connection
  if (seedlinkClient) {
    seedlinkClient.disconnect();
  }
  
  // Create new connection
  seedlinkClient = new SeedLinkClient(SEEDLINK_HOST, SEEDLINK_PORT);
  seedlinkClient.setStationSelectors(stations.join(','));
  
  seedlinkClient.on('onData', (record) => {
    // Broadcast to all SSE clients
    const message = `data: ${JSON.stringify({ type: 'data', record: record.toString('base64') })}\n\n`;
    sseClients.forEach(client => {
      try {
        client.write(message);
      } catch (err) {
        // Client disconnected
      }
    });
  });
  
  seedlinkClient.on('onConnect', () => {
    broadcastSSE({ type: 'seedlink_connected', message: 'Connected to SeedLink server' });
  });
  
  seedlinkClient.on('onDisconnect', () => {
    broadcastSSE({ type: 'seedlink_disconnected', message: 'Disconnected from SeedLink server' });
  });
  
  seedlinkClient.on('onError', (err) => {
    broadcastSSE({ type: 'error', message: err.message });
  });
  
  seedlinkClient.connect();
  
  res.json({ success: true, stations, message: 'Subscribed successfully' });
});

/**
 * Broadcast to all SSE clients
 */
function broadcastSSE(message) {
  const data = `data: ${JSON.stringify(message)}\n\n`;
  sseClients.forEach(client => {
    try {
      client.write(data);
    } catch (err) {
      // Client disconnected
    }
  });
}

/**
 * API endpoint for station list
 */
app.get('/api/stations', (req, res) => {
  res.json({
    defaultStations: ['IU_KONO', 'GE_WLF', 'MN_AQU', 'US_TUC', 'TA_M16A'],
    seedlinkServer: `${SEEDLINK_HOST}:${SEEDLINK_PORT}`
  });
});

// Start server
if (IS_VERCEL) {
  console.log('Running in Vercel mode (SSE for real-time updates)');
  console.log('Note: WebSocket features are limited on Vercel free tier');
  
  // Vercel expects the server to listen on the port they provide
  const server = app.listen(PORT, () => {
    console.log(`slinktool-website server running on port ${PORT}`);
    console.log(`SeedLink server: ${SEEDLINK_HOST}:${SEEDLINK_PORT}`);
    console.log(`Mode: ${IS_VERCEL ? 'Vercel (SSE)' : 'Standard (WebSocket)'}`);
  });
  
  // Handle Vercel serverless timeout
  server.keepAliveTimeout = 60000;
  server.headersTimeout = 60000;
} else {
  console.log('Running in standard mode (WebSocket + HTTP)');
  const server = app.listen(PORT, () => {
    console.log(`slinktool-website server running on port ${PORT}`);
    console.log(`SeedLink server: ${SEEDLINK_HOST}:${SEEDLINK_PORT}`);
    console.log(`Mode: ${IS_VERCEL ? 'Vercel (SSE)' : 'Standard (WebSocket)'}`);
  });
  
  // Start WebSocket server
  startWebSocketServer(server);
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('Shutting down...');
  if (seedlinkClient) {
    seedlinkClient.disconnect();
  }
  process.exit(0);
});
