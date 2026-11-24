import zlib from 'node:zlib';

// Precomputed CRC32 table for PNG chunk checksums
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[n] = c >>> 0;
}

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function paethPredictor(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function makeChunk(type: string, data: Uint8Array): Buffer {
  const len = data.length;
  const out = Buffer.allocUnsafe(len + 12);
  out.writeUInt32BE(len, 0);
  out.write(type, 4, 4, 'ascii');
  Buffer.from(data.buffer, data.byteOffset, data.byteLength).copy(out, 8);
  const crc = crc32(out.subarray(4, 8 + len));
  out.writeUInt32BE(crc, 8 + len);
  return out;
}

/**
 * Rotates an 8-bit RGBA PNG buffer (e.g. 1872x1404 from next/og ImageResponse)
 * by 90 degrees clockwise ('cw') or counter-clockwise ('ccw') into a 1404x1872 PNG
 * without any Satori SVG clipPath artifacts.
 */
export function rotatePng90(pngBuffer: ArrayBuffer, direction: 'cw' | 'ccw' = 'cw'): Buffer {
  const bytes = new Uint8Array(pngBuffer);
  const view = new DataView(pngBuffer);

  let width = 0;
  let height = 0;
  let bitDepth = 8;
  let colorType = 6;
  const idatChunks: Buffer[] = [];

  let offset = 8; // skip 8-byte PNG signature
  while (offset < bytes.length) {
    const length = view.getUint32(offset, false);
    const type = String.fromCharCode(
      bytes[offset + 4],
      bytes[offset + 5],
      bytes[offset + 6],
      bytes[offset + 7]
    );
    const chunkData = bytes.subarray(offset + 8, offset + 8 + length);

    if (type === 'IHDR') {
      width = view.getUint32(offset + 8, false);
      height = view.getUint32(offset + 12, false);
      bitDepth = chunkData[8];
      colorType = chunkData[9];
    } else if (type === 'IDAT') {
      idatChunks.push(Buffer.from(chunkData));
    } else if (type === 'IEND') {
      break;
    }

    offset += 12 + length;
  }

  const bpp = colorType === 6 ? 4 : colorType === 2 ? 3 : 4;
  const stride = width * bpp;
  const decompressed = zlib.inflateSync(Buffer.concat(idatChunks));

  // Unfilter scanlines into raw pixel buffer
  const raw = new Uint8Array(width * height * bpp);
  for (let y = 0; y < height; y++) {
    const filterType = decompressed[y * (stride + 1)];
    const rowInStart = y * (stride + 1) + 1;
    const rowOutStart = y * stride;
    const prevRowOutStart = (y - 1) * stride;

    for (let x = 0; x < stride; x++) {
      const filt = decompressed[rowInStart + x];
      const a = x >= bpp ? raw[rowOutStart + x - bpp] : 0;
      const b = y > 0 ? raw[prevRowOutStart + x] : 0;
      const c = x >= bpp && y > 0 ? raw[prevRowOutStart + x - bpp] : 0;

      let val = filt;
      if (filterType === 1) val = (filt + a) & 0xff;
      else if (filterType === 2) val = (filt + b) & 0xff;
      else if (filterType === 3) val = (filt + ((a + b) >> 1)) & 0xff;
      else if (filterType === 4) val = (filt + paethPredictor(a, b, c)) & 0xff;

      raw[rowOutStart + x] = val;
    }
  }

  // Rotate 90 degrees into newW = height, newH = width (with filter byte 0 per row)
  const newW = height;
  const newH = width;
  const newStride = newW * bpp;
  const rotatedScanlines = new Uint8Array(newH * (newStride + 1));

  for (let y = 0; y < height; y++) {
    const srcRow = y * stride;
    for (let x = 0; x < width; x++) {
      const srcIdx = srcRow + x * bpp;
      let dstX: number;
      let dstY: number;
      if (direction === 'cw') {
        dstX = height - 1 - y;
        dstY = x;
      } else {
        dstX = y;
        dstY = width - 1 - x;
      }
      const dstIdx = dstY * (newStride + 1) + 1 + dstX * bpp;
      for (let k = 0; k < bpp; k++) {
        rotatedScanlines[dstIdx + k] = raw[srcIdx + k];
      }
    }
  }

  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(newW, 0);
  ihdr.writeUInt32BE(newH, 4);
  ihdr[8] = bitDepth;
  ihdr[9] = colorType;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const compressed = zlib.deflateSync(rotatedScanlines, { level: 6 });
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', new Uint8Array(0)),
  ]);
}
