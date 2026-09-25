/* ==== 01 UTIL ==== */
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const lerp = (a, b, t) => a + (b - a) * t;
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

// Seeded RNG (mulberry32). All simulation randomness must come from one of these.
function makeRng(seed) {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (a, b) => a + (b - a) * next(),
    int: (a, b) => Math.floor(a + (b - a + 1) * next()),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
  };
}

// Simple object pool to avoid per-frame garbage.
function makePool(create, size) {
  const items = [];
  for (let i = 0; i < size; i++) items.push(create());
  let cursor = 0;
  return {
    items,
    // Returns the next free item, or recycles the oldest if all are busy.
    take() {
      for (let i = 0; i < items.length; i++) {
        const it = items[(cursor + i) % items.length];
        if (!it.alive) { cursor = (cursor + i + 1) % items.length; it.alive = true; return it; }
      }
      const it = items[cursor];
      cursor = (cursor + 1) % items.length;
      it.alive = true;
      return it;
    },
    forEachAlive(fn) { for (let i = 0; i < items.length; i++) if (items[i].alive) fn(items[i]); },
  };
}

const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
const midiToHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

// Tiny event bus for loose coupling between systems (e.g. settings changes).
function makeBus() {
  const map = new Map();
  return {
    on(name, fn) {
      if (!map.has(name)) map.set(name, []);
      map.get(name).push(fn);
    },
    emit(name, arg) {
      const list = map.get(name);
      if (list) for (let i = 0; i < list.length; i++) list[i](arg);
    },
  };
}
const bus = makeBus();
