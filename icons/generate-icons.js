#!/usr/bin/env node
// Pure Node.js PNG icon generator — no npm dependencies required
// AIRS accent color: #fa582d (R:250 G:88 B:45), dark bg: #1c2530 (R:28 G:37 B:48)
'use strict';
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

function crc32(buf) {
  const table = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = (table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)) >>> 0;
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const t = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crcBuf]);
}

function makePNG(size, pixels) {
  // pixels: Uint8Array of size*size*4 (RGBA)
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4);
    row[0] = 0;
    for (let x = 0; x < size; x++) {
      const pi = (y * size + x) * 4;
      row[1 + x * 4] = pixels[pi]; row[2 + x * 4] = pixels[pi + 1];
      row[3 + x * 4] = pixels[pi + 2]; row[4 + x * 4] = pixels[pi + 3];
    }
    rows.push(row);
  }
  const compressed = zlib.deflateSync(Buffer.concat(rows));
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', compressed), chunk('IEND', Buffer.alloc(0))]);
}

function drawIcon(size) {
  const pixels = new Uint8Array(size * size * 4);
  const cx = size / 2, cy = size / 2;
  const r = size / 2 - 1;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const dx = x - cx + 0.5, dy = y - cy + 0.5;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > r) {
        // transparent outside circle
        pixels[idx] = 0; pixels[idx+1] = 0; pixels[idx+2] = 0; pixels[idx+3] = 0;
      } else {
        // dark background
        pixels[idx] = 28; pixels[idx+1] = 37; pixels[idx+2] = 48; pixels[idx+3] = 255;
      }
    }
  }

  // Draw stylized "A" shield shape in orange (#fa582d)
  const s = size / 16; // scale factor
  const orange = [250, 88, 45];
  const setOrange = (x, y) => {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    if (pixels[i + 3] === 0) return; // only draw over non-transparent
    pixels[i] = orange[0]; pixels[i+1] = orange[1]; pixels[i+2] = orange[2]; pixels[i+3] = 255;
  };

  // Draw thick lines of "A": left leg, right leg, crossbar
  const thick = Math.max(1, Math.round(s * 1.5));
  const top = Math.round(cy - size * 0.3);
  const bot = Math.round(cy + size * 0.35);
  const mid = Math.round(cy + size * 0.02);
  const lx = Math.round(cx - size * 0.22);
  const rx = Math.round(cx + size * 0.22);

  for (let t = -thick; t <= thick; t++) {
    // left leg of A (top-center to bottom-left)
    for (let step = 0; step <= 20; step++) {
      const frac = step / 20;
      const x = cx + (lx - cx) * frac + t;
      const y = top + (bot - top) * frac;
      setOrange(Math.round(x), Math.round(y));
    }
    // right leg of A (top-center to bottom-right)
    for (let step = 0; step <= 20; step++) {
      const frac = step / 20;
      const x = cx + (rx - cx) * frac + t;
      const y = top + (bot - top) * frac;
      setOrange(Math.round(x), Math.round(y));
    }
    // crossbar of A
    for (let x = lx + Math.round((rx - lx) * 0.2); x <= rx - Math.round((rx - lx) * 0.2); x++) {
      setOrange(x, mid + t);
    }
  }

  return pixels;
}

const outDir = __dirname;
for (const size of [16, 48, 128]) {
  const pixels = drawIcon(size);
  const png = makePNG(size, pixels);
  const outPath = path.join(outDir, `icon${size}.png`);
  fs.writeFileSync(outPath, png);
  console.log(`Created ${outPath} (${png.length} bytes)`);
}
console.log('Icons generated successfully.');
