/**
 * SeedLink Protocol Handler
 * 
 * This module handles the SeedLink protocol for connecting to IRIS and other
 * SeedLink servers to receive real-time waveform data.
 */

const net = require('net');

// SeedLink packet types
const SL_PACKET_TYPES = {
  SLNONE: 0,
  SLHELLO: 1,
  SLINFO: 2,
  SLDATA: 3,
  SLACK: 4,
  SLNACK: 5,
  SLTERMINATE: 6,
  SLERROR: 7,
  SLSTATION: 8,
  SLSELECT: 9
};

// SeedLink packet size (8-byte header + 512-byte miniSEED record)
const SL_PACKET_SIZE = 512 + 8;

/**
 * SeedLink Client Connection
 * 
 * Manages a connection to a SeedLink server and processes incoming packets.
 */
class SeedLinkClient {
  constructor(host, port) {
    this.host = host;
    this.port = port;
    this.socket = null;
    this.connected = false;
    this.handshakeComplete = false;
    this.stationSelectors = null;
    this.callbacks = {
      onConnect: null,
      onDisconnect: null,
      onError: null,
      onData: null,
      onInfo: null
    };
    
    this.buffer = Buffer.alloc(0);
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectTimeout = null;
  }
  
  /**
   * Set callback for connection events
   */
  on(event, callback) {
    this.callbacks[event] = callback;
  }
  
  /**
   * Connect to SeedLink server
   */
  connect() {
    this.socket = new net.Socket();
    
    this.socket.on('connect', () => {
      this.connected = true;
      this.buffer = Buffer.alloc(0);
      this.reconnectAttempts = 0;
      
      console.log(`[SeedLink] Connected to ${this.host}:${this.port}`);
      
      // Send HELLO message
      const helloMsg = 'HELLO slinktool-website\r\n';
      this.socket.write(helloMsg);
      console.log(`[SeedLink] Sent HELLO`);
      
      if (this.callbacks.onConnect) {
        this.callbacks.onConnect();
      }
    });
    
    this.socket.on('data', (data) => {
      this.buffer = Buffer.concat([this.buffer, data]);
      this.processBuffer();
    });
    
    this.socket.on('error', (err) => {
      this.connected = false;
      this.handshakeComplete = false;
      
      console.error(`[SeedLink] Connection error: ${err.message}`);
      
      if (this.callbacks.onError) {
        this.callbacks.onError(err);
      }
      
      // Attempt to reconnect
      this.scheduleReconnect();
    });
    
    this.socket.on('close', () => {
      this.connected = false;
      this.handshakeComplete = false;
      
      console.log(`[SeedLink] Connection closed`);
      
      if (this.callbacks.onDisconnect) {
        this.callbacks.onDisconnect();
      }
      
      // Attempt to reconnect
      this.scheduleReconnect();
    });
    
    // Set timeout for connection
    this.socket.setTimeout(30000, () => {
      console.error(`[SeedLink] Connection timeout`);
      this.socket.destroy();
    });
    
    console.log(`[SeedLink] Connecting to ${this.host}:${this.port}...`);
    this.socket.connect(this.port, this.host);
  }
  
  /**
   * Schedule reconnection
   */
  scheduleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
      console.log(`[SeedLink] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
      }
      
      this.reconnectTimeout = setTimeout(() => {
        console.log(`[SeedLink] Reconnecting...`);
        this.connect();
      }, delay);
    } else {
      console.error(`[SeedLink] Max reconnection attempts reached`);
    }
  }
  
  /**
   * Disconnect from server
   */
  disconnect() {
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    this.connected = false;
    this.handshakeComplete = false;
  }
  
  /**
   * Process incoming data buffer
   */
  processBuffer() {
    while (this.buffer.length >= SL_PACKET_SIZE) {
      const packet = this.buffer.slice(0, SL_PACKET_SIZE);
      this.buffer = this.buffer.slice(SL_PACKET_SIZE);
      
      this.processPacket(packet);
    }
  }
  
  /**
   * Process a single SeedLink packet
   */
  processPacket(packet) {
    const header = this.parsePacketHeader(packet);
    const payload = packet.slice(8); // Skip 8-byte header
    
    switch (header.packetType) {
      case SL_PACKET_TYPES.SLHELLO:
        this.handleHelloPacket(payload);
        break;
      case SL_PACKET_TYPES.SLINFO:
        this.handleInfoPacket(payload);
        break;
      case SL_PACKET_TYPES.SLDATA:
        this.handleDataPacket(payload, header.seqNum);
        break;
      case SL_PACKET_TYPES.SLSTATION:
        this.handleStationPacket(payload);
        break;
      case SL_PACKET_TYPES.SLERROR:
        this.handleErrorPacket(payload);
        break;
      default:
        console.log(`[SeedLink] Unknown packet type: ${header.packetType}`);
    }
  }
  
  /**
   * Parse SeedLink packet header
   */
  parsePacketHeader(packet) {
    const seqNum = packet.readUInt32BE(0);
    const packetType = packet.readUInt16BE(4);
    return { seqNum, packetType };
  }
  
  /**
   * Handle HELLO packet from server
   */
  handleHelloPacket(payload) {
    const response = payload.toString('ascii').trim();
    console.log(`[SeedLink] HELLO response: ${response}`);
    
    // After HELLO, send station selection if provided
    if (this.stationSelectors) {
      const stationMsg = `STATION ${this.stationSelectors}\r\n`;
      console.log(`[SeedLink] Sending STATION: ${this.stationSelectors}`);
      this.socket.write(stationMsg);
    } else {
      // Request station list
      console.log(`[SeedLink] Requesting INFO ID`);
      this.socket.write('INFO ID\r\n');
    }
  }
  
  /**
   * Handle INFO packet
   */
  handleInfoPacket(payload) {
    const info = payload.toString('ascii').trim();
    console.log(`[SeedLink] INFO: ${info}`);
    
    if (this.callbacks.onInfo) {
      this.callbacks.onInfo(info);
    }
  }
  
  /**
   * Handle DATA packet (contains Mini-SEED record)
   */
  handleDataPacket(payload, seqNum) {
    console.log(`[SeedLink] Received DATA packet (seq: ${seqNum}, size: ${payload.length})`);
    
    // Forward the raw Mini-SEED record to callback
    if (this.callbacks.onData) {
      this.callbacks.onData(payload, seqNum);
    }
  }
  
  /**
   * Handle STATION packet
   */
  handleStationPacket(payload) {
    const stationInfo = payload.toString('ascii').trim();
    console.log(`[SeedLink] STATION: ${stationInfo}`);
    this.handshakeComplete = true;
  }
  
  /**
   * Handle ERROR packet
   */
  handleErrorPacket(payload) {
    const errorMsg = payload.toString('ascii').trim();
    console.error(`[SeedLink] ERROR: ${errorMsg}`);
  }
  
  /**
   * Set station selectors for multi-station mode
   */
  setStationSelectors(selectors) {
    this.stationSelectors = selectors;
    
    // If already connected, send station selection
    if (this.connected && !this.handshakeComplete) {
      const stationMsg = `STATION ${selectors}\r\n`;
      console.log(`[SeedLink] Setting stations: ${selectors}`);
      this.socket.write(stationMsg);
    }
  }
  
  /**
   * Send INFO request
   */
  requestInfo(level = 'ID') {
    if (this.connected) {
      console.log(`[SeedLink] Requesting INFO ${level}`);
      this.socket.write(`INFO ${level}\r\n`);
    }
  }
}

module.exports = { SeedLinkClient, SL_PACKET_TYPES };
