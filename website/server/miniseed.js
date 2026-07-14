/**
 * Mini-SEED Record Parser
 * 
 * Parses Mini-SEED v3 binary format records.
 * Based on the SEED format specification.
 */

// Mini-SEED record structure
const RECORD_LENGTH = 512;

// Fixed Section of Data Header (FSDH)
const FSDH_OFFSET = 0;
const FSDH_LENGTH = 48;

// Blockette 1000 (Data Only)
const BLOCKETTE_1000_OFFSET = 48;
const BLOCKETTE_1000_LENGTH = 16;

/**
 * Parse a Mini-SEED record
 * 
 * @param {Buffer} buffer - 512-byte Mini-SEED record
 * @returns {Object|null} Parsed record or null if invalid
 */
function parseMiniSeed(buffer) {
  if (!buffer || buffer.length < RECORD_LENGTH) {
    return null;
  }
  
  try {
    const record = {};
    
    // Parse Fixed Section of Data Header (FSDH)
    const fsdh = parseFSDH(buffer.slice(FSDH_OFFSET, FSDH_OFFSET + FSDH_LENGTH));
    Object.assign(record, fsdh);
    
    // Check record type
    if (record.recordType !== 'D') {
      // Not a data record
      return null;
    }
    
    // Parse Blockette 1000 (Data Only)
    const blockette1000 = parseBlockette1000(buffer.slice(BLOCKETTE_1000_OFFSET, BLOCKETTE_1000_OFFSET + BLOCKETTE_1000_LENGTH));
    Object.assign(record, blockette1000);
    
    // Extract data samples
    const dataOffset = getDataOffset(record);
    if (dataOffset < RECORD_LENGTH) {
      const dataLength = RECORD_LENGTH - dataOffset;
      record.data = buffer.slice(dataOffset, dataOffset + dataLength);
    }
    
    return record;
  } catch (err) {
    console.error('Error parsing Mini-SEED:', err.message);
    return null;
  }
}

/**
 * Parse Fixed Section of Data Header (FSDH)
 */
function parseFSDH(buffer) {
  const result = {};
  
  // Byte 0: Record type (1 byte)
  result.recordType = buffer.toString('ascii', 0, 1);
  
  // Bytes 1-2: Continuation flag (2 bytes)
  result.continuation = buffer.readUInt16BE(1);
  
  // Bytes 3-5: Sequence number (3 bytes)
  result.sequenceNumber = buffer.readUIntBE(3, 3);
  
  // Bytes 6-7: Data header length (2 bytes)
  result.headerLength = buffer.readUInt16BE(6);
  
  // Bytes 8-15: Station identifier (8 bytes)
  result.station = buffer.toString('ascii', 8, 16).trim();
  
  // Bytes 16-23: Location identifier (8 bytes)
  result.location = buffer.toString('ascii', 16, 24).trim();
  
  // Bytes 24-31: Channel identifier (8 bytes)
  result.channel = buffer.toString('ascii', 24, 32).trim();
  
  // Bytes 32-39: Network code (8 bytes)
  result.network = buffer.toString('ascii', 32, 40).trim();
  
  // Bytes 40-47: Start time (8 bytes) - B-time
  result.startTime = parseBTime(buffer.slice(40, 48));
  
  // Bytes 48-49: Number of samples (2 bytes)
  result.numSamples = buffer.readUInt16BE(48);
  
  // Bytes 50-51: Sample rate factor (2 bytes)
  result.sampleRateFactor = buffer.readInt16BE(50);
  
  // Bytes 52-53: Sample rate multiplier (2 bytes)
  result.sampleRateMultiplier = buffer.readInt16BE(52);
  
  // Bytes 54: Activity flags (1 byte)
  result.activityFlags = buffer.readUInt8(54);
  
  // Bytes 55: IO and clock flags (1 byte)
  result.ioClockFlags = buffer.readUInt8(55);
  
  // Bytes 56: Data quality flags (1 byte)
  result.dataQualityFlags = buffer.readUInt8(56);
  
  // Bytes 57: Number of blockettes (1 byte)
  result.numBlockettes = buffer.readUInt8(57);
  
  // Bytes 58-59: Time correction (2 bytes)
  result.timeCorrection = buffer.readInt16BE(58);
  
  // Bytes 60-61: Begin data offset (2 bytes)
  result.dataOffset = buffer.readUInt16BE(60);
  
  // Bytes 62-63: First blockette offset (2 bytes)
  result.firstBlocketteOffset = buffer.readUInt16BE(62);
  
  return result;
}

/**
 * Parse Blockette 1000 (Data Only)
 */
function parseBlockette1000(buffer) {
  const result = {};
  
  // Bytes 0-1: Blockette type (2 bytes)
  result.blocketteType = buffer.readUInt16BE(0);
  
  // Bytes 2-3: Next blockette offset (2 bytes)
  result.nextBlocketteOffset = buffer.readUInt16BE(2);
  
  // Bytes 4-7: Encoding format (4 bytes)
  result.encodingFormat = buffer.readUInt32BE(4);
  
  // Bytes 8-11: Word order (4 bytes)
  result.wordOrder = buffer.readUInt32BE(8);
  
  // Bytes 12-15: Data record length (4 bytes)
  result.dataRecordLength = buffer.readUInt32BE(12);
  
  return result;
}

/**
 * Parse B-time (SEED time format)
 * 
 * B-time is a compact time representation:
 * - Year: 2 bytes (1900-2099)
 * - Day of year: 2 bytes (1-366)
 * - Hour: 1 byte (0-23)
 * - Minute: 1 byte (0-59)
 * - Second: 1 byte (0-59)
 * - Unused: 1 byte
 */
function parseBTime(buffer) {
  if (buffer.length < 6) {
    return null;
  }
  
  const year = 1900 + buffer.readUInt16BE(0);
  const dayOfYear = buffer.readUInt16BE(2);
  const hour = buffer.readUInt8(4);
  const minute = buffer.readUInt8(5);
  const second = buffer.readUInt8(6);
  
  // Convert to Date object
  const date = new Date(year, 0, 1);
  date.setDate(dayOfYear);
  date.setHours(hour, minute, second, 0);
  
  return date;
}

/**
 * Calculate data offset in record
 */
function getDataOffset(record) {
  // Data starts after FSDH and all blockettes
  // For simple records with only Blockette 1000:
  // FSDH (48 bytes) + Blockette 1000 (16 bytes) = 64 bytes
  if (record.dataOffset && record.dataOffset > 0) {
    return record.dataOffset;
  }
  
  // Default offset for data-only records
  return 64;
}

/**
 * Calculate sample rate from factor and multiplier
 */
function calculateSampleRate(record) {
  if (record.sampleRateFactor && record.sampleRateMultiplier) {
    return record.sampleRateFactor * record.sampleRateMultiplier;
  }
  return null;
}

/**
 * Decode data samples based on encoding format
 */
function decodeSamples(record) {
  if (!record.data || !record.encodingFormat) {
    return [];
  }
  
  const samples = [];
  const data = record.data;
  
  // Common encoding formats
  switch (record.encodingFormat) {
    case 0: // ASCII
      // Not implemented
      break;
    case 1: // 16-bit integers
      for (let i = 0; i < record.numSamples && i * 2 < data.length; i++) {
        samples.push(data.readInt16BE(i * 2));
      }
      break;
    case 2: // 24-bit integers
      for (let i = 0; i < record.numSamples && i * 3 < data.length; i++) {
        const bytes = data.slice(i * 3, i * 3 + 3);
        const value = (bytes[0] << 16) | (bytes[1] << 8) | bytes[2];
        samples.push(value > 0x7FFFFF ? value - 0x1000000 : value);
      }
      break;
    case 3: // 32-bit integers
      for (let i = 0; i < record.numSamples && i * 4 < data.length; i++) {
        samples.push(data.readInt32BE(i * 4));
      }
      break;
    case 4: // IEEE float
      for (let i = 0; i < record.numSamples && i * 4 < data.length; i++) {
        samples.push(data.readFloatBE(i * 4));
      }
      break;
    case 5: // IEEE double
      for (let i = 0; i < record.numSamples && i * 8 < data.length; i++) {
        samples.push(data.readDoubleBE(i * 8));
      }
      break;
    case 10: // Steim1 compression
      // Not implemented
      break;
    case 11: // Steim2 compression
      // Not implemented
      break;
    default:
      console.log(`Unsupported encoding format: ${record.encodingFormat}`);
  }
  
  return samples;
}

module.exports = {
  parseMiniSeed,
  parseFSDH,
  parseBlockette1000,
  parseBTime,
  calculateSampleRate,
  decodeSamples
};
