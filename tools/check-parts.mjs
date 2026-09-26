#!/usr/bin/env node
// Checks every part and vehicle in src/parts and src/vehicles against design/07 (format) and design/08 (balance).
//   node tools/check-parts.mjs            -> errors, warnings, balance table, vehicle summaries
//   node tools/check-parts.mjs --quiet    -> errors and warnings only
// Exit code 1 if there are format errors. Balance warnings never fail the build.
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadLibrary, balanceReport, vehicleSummary } from './part-lib.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const quiet = process.argv.includes('--quiet');
const { lib, errors, warnings } = loadLibrary(ROOT);
const bal = balanceReport(lib);

console.log(`Parts: ${Object.keys(lib.parts).length}  Materials: ${Object.keys(lib.materials).length}  Vehicles: ${Object.keys(lib.vehicles).length}`);

if (!quiet) {
  console.log('\nBalance (P = performance vs family base, value = P / cost ratio; 1.00 = base)');
  console.log('  ' + 'part'.padEnd(40) + 'tier  P     cost   value');
  for (const r of bal.rows) {
    console.log('  ' + r.id.padEnd(40) + String(r.tier).padEnd(6) + r.p.toFixed(2).padEnd(6) + String(Math.round(r.cost)).padEnd(7) + r.value.toFixed(2));
  }
  const vs = Object.values(lib.vehicles);
  if (vs.length) {
    console.log('\nVehicles');
    for (const v of vs) {
      const s = vehicleSummary(v, lib);
      console.log(`  ${v.id.padEnd(28)} ${v.domain}/${v.class}  ${(s.mass / 1000).toFixed(1)} t  cost ${Math.round(s.cost)}  ` +
        `cells ${s.cells}  parts ${s.parts}  centre of mass ${s.com.map((n) => n.toFixed(1)).join(', ')}`);
    }
  }
}

const allWarn = [...warnings, ...bal.warnings];
if (allWarn.length) { console.log(`\nWarnings (${allWarn.length})`); for (const w of allWarn) console.log('  - ' + w); }
if (errors.length) {
  console.log(`\nERRORS (${errors.length})`);
  for (const e of errors) console.log('  x ' + e);
  process.exit(1);
}
console.log('\nNo format errors.');
