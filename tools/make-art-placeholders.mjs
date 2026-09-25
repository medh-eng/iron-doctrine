#!/usr/bin/env node
// Writes placeholder part art that exercises the art contract (design/07):
// footprint rectangle, grid origin, barrel pivot and muzzle markers.
// Placeholders go to src/assets/parts/_placeholder/ and are used by test builds only.
// Run: node tools/make-art-placeholders.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { png } from './png.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'src', 'assets', 'parts', '_placeholder');
const PPC = 64, PAD = 8;

const inRect = (x, y, x0, y0, x1, y1) => x >= x0 && x < x1 && y >= y0 && y < y1;
const near = (x, y, cx, cy, r) => Math.hypot(x - cx, y - cy) <= r;
const ring = (x, y, cx, cy, r, w) => Math.abs(Math.hypot(x - cx, y - cy) - r) <= w;

function mount(part, w, h, hasPivot) {
  const W = w * PPC + PAD * 2, H = h * PPC + PAD * 2;
  const pivot = [PAD + PPC / 2, PAD + (h * PPC) / 2];      // first cell, half height
  const img = png(W, H, (u, v) => {
    const x = u * W, y = v * H;
    if (hasPivot && ring(x, y, pivot[0], pivot[1], 6, 1.2)) return [255, 178, 62, 255];
    if (inRect(x, y, PAD - 1, PAD - 7, PAD + 1, PAD + 7) || inRect(x, y, PAD - 7, PAD - 1, PAD + 7, PAD + 1)) return [20, 20, 20, 255];
    const inside = inRect(x, y, PAD, PAD, W - PAD, H - PAD);
    const edge = inside && !inRect(x, y, PAD + 2, PAD + 2, W - PAD - 2, H - PAD - 2);
    const grid = inside && ((x - PAD) % PPC < 1 || (y - PAD) % PPC < 1);
    if (edge) return [120, 20, 110, 255];
    if (grid) return [120, 20, 110, 160];
    if (inside) return [230, 70, 200, 150];
    return [0, 0, 0, 0];
  });
  return { img, W, H };
}

function barrel(len) {
  const pivot = [12, 12], muzzle = [12 + len, 12];
  const W = muzzle[0] + 12, H = 24;
  const img = png(W, H, (u, v) => {
    const x = u * W, y = v * H;
    if (ring(x, y, muzzle[0], muzzle[1], 7, 1.3)) return [30, 200, 230, 255];
    if (near(x, y, pivot[0], pivot[1], 4)) return [255, 178, 62, 255];
    if (inRect(x, y, pivot[0], 9, muzzle[0], 15)) return [40, 170, 210, 200];
    return [0, 0, 0, 0];
  });
  return { img, W, H, pivot, muzzle };
}

function write(part, rec, files) {
  const dir = join(OUT, part);
  mkdirSync(dir, { recursive: true });
  for (const [name, buf] of files) writeFileSync(join(dir, name), buf);
  writeFileSync(join(dir, `${part}_placeholder_r000.json`), JSON.stringify(rec, null, 2) + '\n');
}

// Cannon 37 mm: 2×1 cells; barrel pivot→muzzle = the game's barrel length 1.85 m × 128 px/m = 237 px.
const m = mount('c37', 2, 1, true);
const b = barrel(237);
write('c37', {
  artId: 'part.c37.placeholder', part: 'c37', variant: 'placeholder', revision: 'r000', status: 'placeholder',
  pxPerCell: PPC, footprint: [2, 1], canvas: [m.W, m.H], origin: [PAD, PAD], file: 'c37_placeholder_r000.png',
  barrel: { file: 'c37_placeholder_barrel_r000.png', canvas: [b.W, b.H], pivot: b.pivot, muzzle: b.muzzle },
  note: 'Contract test: magenta footprint, black cross = grid origin, amber = barrel pivot, cyan ring = muzzle.',
}, [['c37_placeholder_r000.png', m.img], ['c37_placeholder_barrel_r000.png', b.img]]);

// Light frame: 1×1.
const f = mount('frame', 1, 1, false);
write('frame', {
  artId: 'part.frame.placeholder', part: 'frame', variant: 'placeholder', revision: 'r000', status: 'placeholder',
  pxPerCell: PPC, footprint: [1, 1], canvas: [f.W, f.H], origin: [PAD, PAD], file: 'frame_placeholder_r000.png',
}, [['frame_placeholder_r000.png', f.img]]);

console.log('Placeholder part art written to src/assets/parts/_placeholder/');
