# slinktool-website

A website for receiving real-time waveforms from IRIS FDSNWS SeedLink server. This project provides a web-based interface to visualize seismic data in real-time, building upon the functionality of the original [slinktool](https://github.com/oceanicdayi/slinktool).

## Features

- **Real-time waveform visualization**: Connect to IRIS SeedLink server and display waveforms in your browser
- **Multi-station support**: Subscribe to multiple seismic stations simultaneously
- **Interactive controls**: Easy-to-use interface for managing connections and station selections
- **WebSocket-based**: Efficient real-time data streaming without polling
- **Responsive design**: Works on desktop, tablet, and mobile devices

## Architecture

The system consists of two main components:

1. **Node.js Server** (`server/index.js`): Acts as a bridge between web browsers and the IRIS SeedLink server
   - Connects to IRIS SeedLink server (default: `rtserve.iris.washington.edu:18000`)
   - Handles SeedLink protocol communication
   - Forwards Mini-SEED data to connected web clients via WebSocket

2. **Web Client** (`public/index.html`): Browser-based waveform viewer
   - Connects to the Node.js server via WebSocket
   - Displays real-time waveforms using [seisplotjs](https://github.com/crotwell/seisplotjs)
   - Provides controls for station selection and connection management

## Quick Start

### Prerequisites

- Node.js (v14 or later)
- npm (v6 or later)

### Installation

```bash
# Clone or navigate to the project directory
cd slinktool-website

# Install dependencies
npm install

# Start the server
npm start
```

The server will start on port 3000 by default. Open your browser and navigate to:
```
http://localhost:3000
```

### Development Mode

For development with automatic restart on file changes:

```bash
npm run dev
```

## Configuration

### Environment Variables

You can configure the server using environment variables:

- `PORT`: Web server port (default: 3000)
- `SEEDLINK_HOST`: SeedLink server host (default: `rtserve.iris.washington.edu`)
- `SEEDLINK_PORT`: SeedLink server port (default: 18000)

Example:
```bash
SEEDLINK_HOST=geofon.gfz-potsdam.de SEEDLINK_PORT=18000 npm start
```

### Command-line Arguments

Alternatively, you can modify the server configuration in `server/index.js`:

```javascript
const SEEDLINK_HOST = process.env.SEEDLINK_HOST || 'your-seedlink-server.com';
const SEEDLINK_PORT = parseInt(process.env.SEEDLINK_PORT) || 18000;
```

## Usage

1. **Connect to Server**: Click the "Connect" button to establish a connection to the WebSocket server
2. **Add Stations**: Enter station codes (e.g., `IU_KONO`, `GE_WLF`, `MN_AQU`) and click "Add"
3. **Subscribe**: Click "Subscribe" to start receiving data from the selected stations
4. **View Waveforms**: Real-time waveforms will appear in the plot area

### Station Codes

Station codes follow the format `NETWORK_STATION` or `NETWORK_STATION.CHANNEL`. Examples:

- `IU_KONO` - Kono station from IU network
- `GE_WLF` - WLF station from GE network
- `MN_AQU` - AQU station from MN network
- `US_TUC` - Tucson station from US network

You can also specify channels:
- `IU_KONO.BHZ` - BHZ channel at Kono station
- `GE_WLF.BH?.D` - All BH channels with data records

### SeedLink Selectors

For advanced selection, you can use SeedLink selectors:
- `BH?` - All BH channels
- `BHZ.D` - BHZ channel, data records only
- `00BH?.D` - BH channels with location code '00', data records only

## Technical Details

### SeedLink Protocol

The server implements the SeedLink protocol (version 3) to communicate with IRIS and other SeedLink servers. The protocol uses TCP for reliable data transmission and supports:

- Connection handshaking with HELLO messages
- Station selection in multi-station mode
- Mini-SEED record transmission
- Keep-alive packets
- Error handling

### Mini-SEED Format

Mini-SEED is the standard format for seismic data exchange. Each record is 512 bytes and contains:

- Fixed Section of Data Header (FSDH): 48 bytes
- Blockettes: Variable length
- Data samples: Remaining bytes

The server parses incoming Mini-SEED records and forwards them to web clients.

### WebSocket Communication

The client-server communication uses WebSocket for efficient real-time data transfer:

- **JSON messages**: For control messages (connect, subscribe, etc.)
- **Binary messages**: For Mini-SEED data records

## Project Structure

```
slinktool-website/
├── server/
│   ├── index.js          # Main server entry point
│   ├── seedlink.js       # SeedLink protocol handler
│   └── miniseed.js       # Mini-SEED record parser
├── public/
│   └── index.html        # Web client interface
├── package.json
└── README.md
```

## Dependencies

- **express**: Web server framework
- **ws**: WebSocket server implementation
- **seisplotjs**: Seismic data visualization library
- **miniseed**: Mini-SEED parsing library

## Troubleshooting

### Connection Issues

1. **Cannot connect to SeedLink server**: Verify the server address and port are correct
2. **WebSocket connection fails**: Ensure the Node.js server is running and accessible
3. **No data received**: Check that the station codes are valid and data is available

### Performance

- For high-volume data streams, consider limiting the number of subscribed stations
- The browser may struggle with very high data rates (> 100 packets/second)

## License

MIT License - see LICENSE file for details.

## Acknowledgments

- [IRIS DMC](https://www.iris.edu/hq/) for providing SeedLink access to real-time seismic data
- [Philip Crotwell](https://github.com/crotwell) for [seisplotjs](https://github.com/crotwell/seisplotjs)
- Original [slinktool](https://github.com/oceanicdayi/slinktool) by Chad Trabant

## Links

- [IRIS SeedLink Documentation](http://ds.iris.edu/ds/nodes/dmc/services/seedlink/)
- [FDSN Web Services](https://service.iris.edu/fdsnws/)
- [SeedLink Protocol Specification](https://docs.fdsn.org/projects/seedlink/)
- [Mini-SEED Format](https://www.fdsn.org/pdf/SEEDManual_V2.4.pdf)
