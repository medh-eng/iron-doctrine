// Minimal PNG writer and reader (Node built-ins only). Used by build.mjs and tools/.
import { deflateSync } from 'node:zlib';

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1));
  }
  return ~c >>> 0;
}

// pixel(u, v) → [r, g, b, a] for u, v in 0..1 (pixel centres), 3×3 supersampled.
export function png(width, height, pixel, supersample = 3) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  const n = supersample * supersample;
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < supersample; sy++) for (let sx = 0; sx < supersample; sx++) {
        const c = pixel((x + (sx + 0.5) / supersample) / width, (y + (sy + 0.5) / supersample) / height, x, y);
        const al = c[3] === undefined ? 255 : c[3];
        r += c[0] * al; g += c[1] * al; b += c[2] * al; a += al;
      }
      const o = y * (width * 4 + 1) + 1 + x * 4;
      raw[o] = a ? r / a : 0; raw[o + 1] = a ? g / a : 0; raw[o + 2] = a ? b / a : 0; raw[o + 3] = a / n;
    }
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// Width, height and colour type of a PNG file buffer, or null if it isn't a PNG.
export function pngInfo(buf) {
  if (buf.length < 29 || buf.readUInt32BE(0) !== 0x89504e47) return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), colorType: buf[25], hasAlpha: buf[25] === 6 || buf[25] === 4 };
}
