/* ==== 07 DATA ==== */
// Part catalogue (design/05), terrain types, templates and battle setups.
// Numbers here are tuning data: raw numbers only, never shown as ratings.

const CELL = 0.5;                 // metres per grid cell
const GRAVITY = 9.81;

// Battles compress distance: 1 km on the design sheet = 50 m on the battlefield,
// so fights happen on screen. Penetration fall-off uses the nominal (sheet) range.
const BATTLE_DISTANCE_SCALE = 0.05;
// Locomotion speed caps are multiplied by this in battle (design/05 §7.1 BATTLE_TIME_SCALE).
const BATTLE_SPEED_SCALE = 0.5;

// Weapon extras used in battle. vel = muzzle speed on the battlefield (m/s),
// dmg = damage to a part per hit, spread = aiming error in degrees (1 sigma),
// cal = calibre in mm (recoil = cal² × 0.9 N·s), auto = automatic weapon.
const WEAPON_STATS = {
  mg: { vel: 260, dmg: 6, spread: 1.4, cal: 8, auto: true, burst: 6 },
  hmg: { vel: 250, dmg: 11, spread: 1.2, cal: 13, auto: true, burst: 5 },
  // burst / burstR: the shell's small bursting charge after it penetrates (damage, radius in m).
  c37: { vel: 180, dmg: 45, spread: 0.55, cal: 37, shells: 40, burst: 25, burstR: 1.0 },
  c75: { vel: 165, dmg: 95, spread: 0.5, cal: 75, shells: 30, burst: 55, burstR: 1.6, heDmg: 70, heRadius: 3 },
  c105: { vel: 155, dmg: 150, spread: 0.45, cal: 105, shells: 20, burst: 80, burstR: 2.0, heDmg: 110, heRadius: 4 },
  how: { vel: 95, dmg: 180, spread: 0.9, cal: 150, shells: 12, heDmg: 180, heRadius: 6, indirect: true },
};

// id: [name, category, w, h, mass, hp, armour, extras]
const PART_ROWS = [
  // Structure
  ['frame', 'Light frame', 'structure', 1, 1, 60, 40, 5, { cost: { metal: 1 } }],
  ['timber', 'Timber frame', 'structure', 1, 1, 40, 25, 3, { cost: { wood: 1 }, burns: true }],
  ['plate', 'Hull plate', 'structure', 1, 1, 120, 60, 15, { cost: { metal: 2 } }],
  ['arm20', 'Armour 20 mm', 'structure', 1, 1, 190, 80, 20, { cost: { metal: 3 } }],
  ['arm40', 'Armour 40 mm', 'structure', 1, 1, 380, 120, 40, { cost: { metal: 5 } }],
  ['arm80', 'Armour 80 mm', 'structure', 1, 1, 760, 180, 80, { cost: { metal: 9 } }],
  ['slope40', 'Sloped armour 40 mm', 'structure', 1, 1, 300, 110, 40, { cost: { metal: 5 }, sloped: true }],
  ['crew2', 'Crew compartment', 'structure', 2, 2, 300, 80, 10, { cost: { metal: 3 }, crew: 2 }],
  ['turret', 'Turret ring', 'structure', 3, 1, 250, 90, 20, { cost: { metal: 3 }, power: -5, ring: true }],
  // Mobility
  ['eng_s', 'Petrol engine S', 'mobility', 2, 2, 450, 60, 5, { cost: { metal: 3 }, power: 110, heat: 12, fuelUse: 30, rel: 0.990 }],
  ['eng_m', 'Diesel engine M', 'mobility', 3, 2, 1100, 90, 5, { cost: { metal: 7 }, power: 300, heat: 25, fuelUse: 55, rel: 0.994 }],
  ['eng_h', 'Diesel engine H', 'mobility', 4, 2, 1900, 120, 5, { cost: { metal: 12 }, power: 520, heat: 45, fuelUse: 95, rel: 0.992 }],
  ['radiator', 'Radiator', 'mobility', 1, 1, 70, 20, 2, { cost: { metal: 1 }, heat: -12 }],
  ['wheel_s', 'Road wheel', 'mobility', 1, 1, 80, 30, 5, { cost: { metal: 1, rubber: 1 }, loco: 'wheel', contact: 0.04, maxLoad: 2000, cap: 90, radius: 0.25 }],
  ['wheel_l', 'Off-road wheel', 'mobility', 2, 2, 200, 50, 5, { cost: { metal: 1, rubber: 3 }, loco: 'wheel', contact: 0.12, maxLoad: 5000, cap: 75, radius: 0.5 }],
  ['track', 'Track segment', 'mobility', 2, 1, 450, 70, 10, { cost: { metal: 3, rubber: 1 }, loco: 'track', contact: 0.35, maxLoad: 10000, cap: 55, radius: 0.25 }],
  // Weapons
  ['mg', 'Machine gun', 'weapon', 1, 1, 40, 20, 5, { cost: { metal: 1 }, pen: 8, rpm: 600, range: 600 }],
  ['hmg', 'Heavy machine gun', 'weapon', 1, 1, 80, 25, 5, { cost: { metal: 2 }, pen: 20, rpm: 450, range: 1000 }],
  ['c37', 'Cannon 37 mm', 'weapon', 2, 1, 250, 40, 10, { cost: { metal: 4 }, pen: 50, reload: 2.5, range: 1500 }],
  ['c75', 'Cannon 75 mm', 'weapon', 3, 1, 600, 60, 10, { cost: { metal: 7 }, pen: 90, reload: 5, range: 2000 }],
  ['c105', 'Cannon 105 mm', 'weapon', 4, 1, 1300, 80, 10, { cost: { metal: 12 }, pen: 150, reload: 8, range: 2500 }],
  ['how', 'Howitzer 150 mm', 'weapon', 4, 2, 2500, 100, 10, { cost: { metal: 18 }, pen: 40, reload: 12, range: 8000, he: true }],
  ['smoke', 'Smoke launcher', 'weapon', 1, 1, 30, 15, 2, { cost: { metal: 1, fuel: 1 }, salvos: 3 }],
  // Systems
  ['radio', 'Radio', 'system', 1, 1, 50, 15, 2, { cost: { metal: 1, elec: 1 }, power: -1 }],
  ['optics', 'Optics', 'system', 1, 1, 30, 10, 2, { cost: { metal: 1, elec: 1 }, spot: 1.4 }],
  ['fc', 'Fire-control computer', 'system', 1, 1, 60, 15, 2, { cost: { metal: 1, elec: 5 }, power: -5, accuracy: 1.35 }],
  ['stab', 'Gun stabiliser', 'system', 1, 1, 90, 15, 2, { cost: { metal: 2, elec: 4 }, power: -8 }],
  // Logistics
  ['fuel_s', 'Fuel tank 200 L', 'logistics', 1, 1, 220, 30, 3, { cost: { metal: 1 }, fuel: 200, fire: 0.35 }],
  ['fuel_ss', 'Self-sealing tank 150 L', 'logistics', 1, 1, 210, 40, 3, { cost: { metal: 1, rubber: 2 }, fuel: 150, fire: 0.10 }],
  ['ammo', 'Ammo rack', 'logistics', 1, 1, 250, 30, 3, { cost: { metal: 1 }, shells: 20, detonate: 0.40 }],
  ['ammo_p', 'Protected ammo storage', 'logistics', 1, 1, 320, 50, 10, { cost: { metal: 2 }, shells: 20, detonate: 0.10 }],
  ['cargo', 'Cargo bay', 'logistics', 2, 2, 200, 40, 3, { cost: { metal: 2, wood: 1 }, cargo: 2000 }],
];

const PARTS = {};
for (const [id, name, cat, w, h, mass, hp, armor, extra] of PART_ROWS) {
  PARTS[id] = Object.assign({ id, name, cat, w, h, mass, hp, armor, power: 0, rel: 0.998 }, extra);
  if (WEAPON_STATS[id]) Object.assign(PARTS[id], WEAPON_STATS[id]);
}

// Terrain types (design/05 §6). softness, grip μ, concealment, colour of the top soil.
const TERRAIN = [
  { id: 'plains', name: 'Plains', soft: 0.1, grip: 0.75, conceal: 0.1, color: '#2B3029' },
  { id: 'road', name: 'Road', soft: 0, grip: 0.9, conceal: 0, color: '#3A3A40' },
  { id: 'forest', name: 'Forest floor', soft: 0.3, grip: 0.6, conceal: 0.5, color: '#1F2A22' },
  { id: 'mud', name: 'Mud', soft: 1.0, grip: 0.4, conceal: 0.1, color: '#3B2E25' },
  { id: 'rock', name: 'Rock', soft: 0, grip: 0.8, conceal: 0.3, color: '#34363E' },
];
const T_PLAINS = 0, T_ROAD = 1, T_FOREST = 2, T_MUD = 3, T_ROCK = 4;

// ---------- templates (design/05 §8). Grid rows go top (y = 0) to bottom; front faces right.
// cells: [partId, x, y]
const TEMPLATES = {
  scout: {
    name: 'Scout car', w: 10, h: 5, soft: true,
    cells: [
      ['wheel_s', 1, 4], ['wheel_s', 3, 4], ['wheel_s', 6, 4], ['wheel_s', 8, 4],
      ['plate', 0, 3], ['eng_s', 1, 2], ['crew2', 3, 2], ['fuel_s', 5, 3], ['radio', 5, 2],
      ['plate', 6, 3], ['plate', 7, 3], ['plate', 8, 3], ['arm20', 6, 2], ['arm20', 7, 2], ['slope40', 8, 2],
      ['hmg', 4, 1], ['optics', 3, 1],
    ],
  },
  mgcar: {
    name: 'Machine-gun car', w: 10, h: 5, soft: true,
    cells: [
      ['wheel_s', 1, 4], ['wheel_s', 3, 4], ['wheel_s', 6, 4], ['wheel_s', 8, 4],
      ['plate', 0, 3], ['eng_s', 1, 2], ['crew2', 3, 2], ['fuel_s', 5, 3], ['plate', 5, 2],
      ['plate', 6, 3], ['plate', 7, 3], ['plate', 8, 3], ['plate', 6, 2], ['plate', 7, 2], ['slope40', 8, 2],
      ['mg', 4, 1],
    ],
  },
  light: {
    name: 'Light tank', w: 12, h: 6,
    cells: [
      ['track', 2, 5], ['track', 4, 5], ['track', 6, 5], ['track', 8, 5],
      ['arm20', 1, 3], ['arm20', 1, 4], ['eng_m', 2, 3], ['crew2', 5, 3], ['fuel_s', 7, 3], ['ammo', 7, 4],
      ['arm20', 8, 3], ['arm20', 8, 4], ['slope40', 9, 3], ['arm20', 9, 4], ['mg', 10, 4],
      ['turret', 4, 2], ['radio', 3, 1], ['arm20', 4, 1], ['arm20', 5, 1], ['c37', 6, 1], ['optics', 5, 0],
    ],
  },
  medium: {
    name: 'Medium tank', w: 14, h: 7,
    cells: [
      ['track', 2, 6], ['track', 4, 6], ['track', 6, 6], ['track', 8, 6], ['track', 10, 6],
      ['arm20', 1, 4], ['arm20', 1, 5], ['eng_m', 2, 4], ['fuel_s', 5, 4], ['fuel_s', 5, 5], ['crew2', 6, 4],
      ['ammo', 8, 4], ['plate', 8, 5], ['arm40', 9, 4], ['arm40', 9, 5], ['arm40', 10, 4], ['arm40', 10, 5],
      ['slope40', 11, 4], ['arm40', 11, 5], ['mg', 12, 5],
      ['turret', 5, 3], ['arm20', 4, 1], ['arm20', 4, 2], ['crew2', 5, 1], ['arm40', 7, 1], ['arm40', 7, 2],
      ['c75', 8, 2], ['optics', 6, 0], ['radio', 4, 0],
    ],
  },
  assault: {
    name: 'Assault gun', w: 13, h: 5,
    cells: [
      ['track', 1, 4], ['track', 3, 4], ['track', 5, 4], ['track', 7, 4], ['track', 9, 4],
      ['arm20', 0, 2], ['arm20', 0, 3], ['eng_m', 1, 2], ['ammo', 4, 2], ['fuel_s', 4, 3], ['crew2', 5, 2],
      ['arm40', 7, 2], ['arm40', 7, 3], ['slope40', 8, 2], ['arm80', 8, 3], ['slope40', 9, 2], ['arm80', 9, 3],
      ['arm40', 5, 1], ['arm40', 6, 1], ['arm40', 7, 1], ['c105', 8, 1], ['optics', 6, 0],
    ],
  },
  truck: {
    name: 'Supply truck', w: 11, h: 5, soft: true,
    cells: [
      ['wheel_l', 1, 3], ['wheel_l', 5, 3], ['wheel_l', 8, 3],
      ['timber', 0, 2], ['timber', 1, 2], ['timber', 2, 2], ['timber', 3, 2], ['timber', 4, 2], ['timber', 5, 2],
      ['timber', 6, 2], ['timber', 7, 2], ['timber', 8, 2], ['timber', 9, 2], ['timber', 10, 2],
      ['cargo', 1, 0], ['cargo', 3, 0], ['fuel_s', 5, 1], ['timber', 5, 0], ['crew2', 6, 0], ['eng_s', 8, 0],
    ],
  },
};

// ---------- battle setups for Part 1b (the ladder's full levelConfig arrives in Part 1c)
// enemies: [template, count, behaviour]; behaviour: 'parked' | 'convoy' | 'attack'
const BATTLES = [
  { name: 'Farmland', goal: 'Destroy the trucks', seed: 101, length: 420, hills: 0.15, rough: 0.2, mud: 0, forest: 0, gaps: 0,
    enemies: [['truck', 3, 'parked']], holdFire: true },
  { name: 'Supply road', goal: 'Destroy the convoy', seed: 202, length: 460, hills: 0.25, rough: 0.3, mud: 0, forest: 1, gaps: 0,
    enemies: [['truck', 2, 'convoy'], ['mgcar', 1, 'attack']] },
  { name: 'Hills', goal: 'Destroy the enemy', seed: 303, length: 480, hills: 0.8, rough: 0.4, mud: 1, forest: 1, gaps: 0,
    enemies: [['mgcar', 1, 'attack'], ['light', 1, 'attack']] },
  { name: 'Armour', goal: 'Destroy the tanks', seed: 404, length: 520, hills: 0.5, rough: 0.4, mud: 2, forest: 1, gaps: 1,
    enemies: [['light', 2, 'attack']] },
];

function battleConfig(level) {
  const base = BATTLES[(level - 1) % BATTLES.length];
  return Object.assign({ level, squad: ['medium', 'light', 'scout'] }, base, { seed: base.seed + (level - 1) * 7919 });
}
