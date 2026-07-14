/**
 * slinktool-website - WebSocket bridge to IRIS SeedLink server
 * 
 * This server acts as a bridge between web browsers and the IRIS SeedLink server.
 * It connects to the IRIS SeedLink server and forwards real-time waveform data
 * to connected web clients via WebSocket.
 */

const express = require('express');
const WebSocket = require('ws');
const path = require('path');
const { SeedLinkClient } = require('./seedlink');

const app = express();
const PORT = process.env.PORT || 3000;
const SEEDLINK_HOST = process.env.SEEDLINK_HOST || 'rtserve.iris.washington.edu';
const SEEDLINK_PORT = parseInt(process.env.SEEDLINK_PORT) || 18000;

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

// Create HTTP server
const server = app.listen(PORT, () => {
  console.log(`slinktool-website server running on port ${PORT}`);
  console.log(`SeedLink server: ${SEEDLINK_HOST}:${SEEDLINK_PORT}`);
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Store all connected clients
const clients = new Set();

// Store SeedLink connections (one per client configuration)
const seedlinkConnections = new Map(); // clientId -> SeedLinkClient

// Default stations to subscribe to (can be overridden by client)
const DEFAULT_STATIONS = ['IU_KONO', 'GE_WLF', 'MN_AQU'];

/**
 * Create a new SeedLink connection for a client
 */
function createSeedLinkConnection(clientId, stations = DEFAULT_STATIONS) {
  const slClient = new SeedLinkClient(SEEDLINK_HOST, SEEDLINK_PORT);
  
  // Set up callbacks
  slClient.on('onConnect', () => {
    console.log(`[${clientId}] SeedLink connected`);
    sendToClient(clientId, {
      type: 'seedlink_connected',
      message: 'Connected to SeedLink server'
    });
  });
  
  slClient.on('onDisconnect', () => {
    console.log(`[${clientId}] SeedLink disconnected`);
    sendToClient(clientId, {
      type: 'seedlink_disconnected',
      message: 'Disconnected from SeedLink server'
    });
  });
  
  slClient.on('onError', (err) => {
    console.error(`[${clientId}] SeedLink error:`, err.message);
    sendToClient(clientId, {
      type: 'error',
      message: `SeedLink error: ${err.message}`
    });
  });
  
  slClient.on('onInfo', (info) => {
    console.log(`[${clientId}] SeedLink info:`, info);
    sendToClient(clientId, {
      type: 'info',
      message: info
    });
  });
  
  slClient.on('onData', (record, seqNum) => {
    // Forward Mini-SEED record to client as binary
    if (record && record.length > 0) {
      sendToClient(clientId, record, true); // Send as binary
    }
  });
  
  // Set station selectors
  slClient.setStationSelectors(stations.join(','));
  
  // Connect to SeedLink server
  slClient.connect();
  
  return slClient;
}

/**
 * Send message to a specific client
 */
function sendToClient(clientId, message, isBinary = false) {
  clients.forEach((client) => {
    if (client.clientId === clientId && client.readyState === WebSocket.OPEN) {
      try {
        if (isBinary) {
          client.send(message);
        } else {
          client.send(JSON.stringify(message));
        }
      } catch (err) {
        console.error(`[${clientId}] Error sending message:`, err.message);
      }
    }
  });
}

/**
 * Broadcast message to all clients
 */
function broadcast(message, isBinary = false) {
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        if (isBinary) {
          client.send(message);
        } else {
          client.send(JSON.stringify(message));
        }
      } catch (err) {
        console.error('Error broadcasting message:', err.message);
      }
    }
  });
}

/**
 * WebSocket connection handler
 */
wss.on('connection', (ws, req) => {
  const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const clientIp = req.socket.remoteAddress;
  
  console.log(`[WebSocket] New client connected: ${clientId} from ${clientIp}`);
  
  // Store client with metadata
  ws.clientId = clientId;
  ws.stations = [];
  clients.add(ws);
  
  // Send welcome message
  ws.send(JSON.stringify({
    type: 'welcome',
    message: 'Connected to slinktool-website',
    seedlinkServer: `${SEEDLINK_HOST}:${SEEDLINK_PORT}`,
    clientId: clientId,
    defaultStations: DEFAULT_STATIONS
  }));
  
  // Handle messages from client
  ws.on('message', (message) => {
    try {
      if (typeof message === 'string') {
        const msg = JSON.parse(message);
        
        console.log(`[${clientId}] Received:`, msg);
        
        switch (msg.type) {
          case 'subscribe':
            // Client wants to subscribe to specific stations
            const stations = msg.stations || DEFAULT_STATIONS;
            ws.stations = stations;
            
            // Close existing connection if exists
            if (seedlinkConnections.has(clientId)) {
              const slClient = seedlinkConnections.get(clientId);
              slClient.disconnect();
              seedlinkConnections.delete(clientId);
            }
            
            // Create new connection
            const slClient = createSeedLinkConnection(clientId, stations);
            seedlinkConnections.set(clientId, slClient);
            
            ws.send(JSON.stringify({
              type: 'subscribed',
              stations: stations,
              message: `Subscribed to stations: ${stations.join(', ')}`
            }));
            break;
            
          case 'unsubscribe':
            // Close SeedLink connection
            if (seedlinkConnections.has(clientId)) {
              const slClient = seedlinkConnections.get(clientId);
              slClient.disconnect();
              seedlinkConnections.delete(clientId);
              
              ws.send(JSON.stringify({
                type: 'unsubscribed',
                message: 'Unsubscribed from stations'
              }));
            }
            break;
            
          case 'ping':
            ws.send(JSON.stringify({
              type: 'pong',
              timestamp: msg.timestamp || Date.now()
            }));
            break;
            
          case 'get_stations':
            // Return list of available stations (for now, return defaults)
            ws.send(JSON.stringify({
              type: 'station_list',
              stations: DEFAULT_STATIONS
            }));
            break;
            
          default:
            console.log(`[${clientId}] Unknown message type: ${msg.type}`);
        }
      }
    } catch (err) {
      console.error(`[${clientId}] Error processing message:`, err);
    }
  });
  
  // Handle client disconnect
  ws.on('close', () => {
    console.log(`[WebSocket] Client disconnected: ${clientId}`);
    clients.delete(ws);
    
    // Close dedicated SeedLink connection if exists
    if (seedlinkConnections.has(clientId)) {
      const slClient = seedlinkConnections.get(clientId);
      slClient.disconnect();
      seedlinkConnections.delete(clientId);
    }
  });
  
  ws.on('error', (err) => {
    console.error(`[WebSocket] Client error: ${clientId}`, err.message);
    clients.delete(ws);
  });
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('Shutting down...');
  
  // Close all SeedLink connections
  seedlinkConnections.forEach((slClient) => {
    slClient.disconnect();
  });
  
  // Close WebSocket server
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.close(1001, 'Server shutting down');
    }
  });
  
  server.close(() => {
    console.log('Server stopped');
    process.exit(0);
  });
});

console.log('slinktool-website starting...');
