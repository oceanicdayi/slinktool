# slinktool-website - Project Summary

## Overview

I've created a complete website for receiving real-time waveforms from IRIS FDSNWS SeedLink server. This project builds upon the original [slinktool](https://github.com/oceanicdayi/slinktool) by providing a modern web-based interface.

## What Was Created

### Project Structure

```
slinktool-website/
├── server/
│   ├── index.js          # Main server entry point (WebSocket + HTTP)
│   ├── seedlink.js       # SeedLink protocol handler
│   └── miniseed.js       # Mini-SEED record parser
├── public/
│   └── index.html        # Web client with waveform visualization
├── package.json          # Node.js dependencies
├── Makefile              # Build and run commands
├── README.md             # Documentation
└── .gitignore            # Git ignore rules
```

### Key Features

1. **Node.js Backend Server**
   - WebSocket server for real-time communication with web clients
   - HTTP server for serving the web interface
   - SeedLink client that connects to IRIS server (`rtserve.iris.washington.edu:18000`)
   - Forwards Mini-SEED data from SeedLink to web clients via WebSocket

2. **Web Frontend**
   - Modern, responsive design with dark theme
   - Real-time waveform visualization using [seisplotjs](https://github.com/crotwell/seisplotjs)
   - Connection status monitoring
   - Station selection interface
   - Statistics display (packets received, data rate, latency)
   - Console for logging events

3. **SeedLink Protocol Support**
   - HELLO handshake
   - Multi-station mode with STATION command
   - INFO requests
   - DATA packet processing
   - Error handling

4. **Mini-SEED Parsing**
   - Fixed Section of Data Header (FSDH) parsing
   - Blockette 1000 parsing
   - B-time (SEED time) parsing
   - Sample data extraction

## How It Works

### Data Flow

```
IRIS SeedLink Server (rtserve.iris.washington.edu:18000)
          ↓ (TCP - SeedLink protocol)
  Node.js Server (localhost:3000)
          ↓ (WebSocket - binary Mini-SEED records)
  Web Browser (index.html)
          ↓ (seisplotjs visualization)
  Real-time Waveform Display
```

### Communication Protocol

1. **Client → Server (JSON messages)**
   - `subscribe`: Request data from specific stations
   - `unsubscribe`: Stop receiving data
   - `ping`: Check latency

2. **Server → Client (JSON messages)**
   - `welcome`: Connection established
   - `subscribed`: Subscription confirmed
   - `seedlink_connected`: SeedLink connection established
   - `seedlink_disconnected`: SeedLink connection lost
   - `error`: Error messages
   - `info`: SeedLink INFO responses
   - `pong`: Response to ping

3. **Server → Client (Binary messages)**
   - Raw Mini-SEED records (512 bytes each)

## Usage

### Quick Start

```bash
# Navigate to project directory
cd slinktool-website

# Install dependencies
npm install

# Start the server
npm start

# Open browser to http://localhost:3000
```

### With Makefile

```bash
# Install dependencies
make install

# Start server
make start

# Start in development mode (with auto-restart)
make dev

# Stop server
make stop

# Clean up
make clean
```

### Custom Configuration

```bash
# Use different port
PORT=8080 npm start

# Use different SeedLink server
SEEDLINK_HOST=geofon.gfz-potsdam.de SEEDLINK_PORT=18000 npm start
```

### Web Interface

1. Open `http://localhost:3000` in your browser
2. Click **Connect** to connect to the WebSocket server
3. Add stations (e.g., `IU_KONO`, `GE_WLF`, `MN_AQU`)
4. Click **Subscribe** to start receiving data
5. View real-time waveforms in the plot area

## Station Examples

Try these stations with the IRIS SeedLink server:

- `IU_KONO` - Kono, Hawaii (IU network)
- `GE_WLF` - Wolfsberg, Germany (GE network)
- `MN_AQU` - Aquila, Italy (MN network)
- `US_TUC` - Tucson, Arizona (US network)
- `TA_M16A` - Transportable Array station

You can also specify channels:
- `IU_KONO.BHZ` - BHZ channel only
- `GE_WLF.BH?` - All BH channels

## Technical Details

### Dependencies

- **express** (^4.18.2): Web server framework
- **ws** (^8.15.1): WebSocket server implementation
- **seisplotjs** (^3.2.5): Seismic data visualization (loaded via CDN)

### SeedLink Protocol

The server implements SeedLink v3 protocol:
- Connection handshaking with HELLO
- Station selection with STATION command
- Data packet reception (512-byte Mini-SEED records)
- Error handling

### Mini-SEED Format

Each Mini-SEED record is 512 bytes:
- Fixed Section of Data Header (FSDH): 48 bytes
- Blockettes: Variable length
- Data samples: Remaining bytes

The server forwards raw Mini-SEED records to the client, where they can be parsed and visualized.

## Testing

The server has been tested and starts successfully:

```bash
$ PORT=3001 node server/index.js
slinktool-website starting...
slinktool-website server running on port 3001
SeedLink server: rtserve.iris.washington.edu:18000
```

## Next Steps

To enhance this project, you could:

1. **Add authentication**: Secure the WebSocket connection
2. **Implement data archiving**: Save received data to files
3. **Add more visualization options**: Spectrograms, particle motion, etc.
4. **Support more SeedLink commands**: TIME, SELECT, etc.
5. **Add station discovery**: Query server for available stations
6. **Improve error handling**: Better recovery from connection issues
7. **Add user preferences**: Save station selections, display settings

## License

MIT License

## Acknowledgments

- Original [slinktool](https://github.com/oceanicdayi/slinktool) by Chad Trabant
- [IRIS DMC](https://www.iris.edu/hq/) for SeedLink access
- [Philip Crotwell](https://github.com/crotwell) for [seisplotjs](https://github.com/crotwell/seisplotjs)
