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
  hmg: { vel: 250, dmg: 11, spread: 1.2, cal: 13, auto: true, burst: 5, aa: true },
  // burst / burstR: the shell's small bursting charge after it penetrates (damage, radius in m).
  c37: { vel: 180, dmg: 45, spread: 0.55, cal: 37, shells: 40, burst: 25, burstR: 1.0 },
  c75: { vel: 165, dmg: 95, spread: 0.5, cal: 75, shells: 30, burst: 55, burstR: 1.6, heDmg: 70, heRadius: 3 },
  c105: { vel: 155, dmg: 150, spread: 0.45, cal: 105, shells: 20, burst: 80, burstR: 2.0, heDmg: 110, heRadius: 4 },
  how: { vel: 95, dmg: 180, spread: 0.9, cal: 150, shells: 12, heDmg: 180, heRadius: 6, indirect: true },
  // Air-capable automatic guns (Part 2c): aa = can engage aircraft; flak = bursts near them.
  ac20: { vel: 240, dmg: 16, spread: 1.0, cal: 20, auto: true, burst: 4, aa: true },
  aa40: { vel: 200, dmg: 30, spread: 0.9, cal: 40, auto: true, burst: 3, aa: true, flak: true },
  // Naval gun, twin: two barrels fire together (Part 2a).
  ngun: { vel: 120, dmg: 150, spread: 0.45, cal: 120, shells: 30, burst: 70, burstR: 2.2, twin: true },
};

// Ships (design/05 §7.3). A cell of a watertight part displaces 0.25 m² × beam of water.
// SHIP_CD is the hull resistance coefficient on the submerged cross-section (displaced
// volume ÷ hull length); PROP_EFF is the share of engine power the propellers turn into thrust.
const SHIP_CD = 0.35;
const PROP_EFF = 0.6;
const FLOOD_RATE = 500;           // kg per second through each destroyed watertight cell below the waterline
const HOLE_RATE = 350;            // kg per second through each shell hole below the waterline
const THRUSTER_FORCE = 15000;     // N of extra stopping and reversing force per manoeuvre thruster

// Submarines and underwater weapons (Part 2b). Battle numbers.
const BALLAST_RATE = 1500;        // kg per second each ballast tank floods or blows
const DIVE_RATE = 2;              // metres per second the depth order moves while ▲ or ▼ is held
const TORPEDO = { speed: 16, dmg: 320, radius: 3.2, depthRate: 3 };
const DEPTH_CHARGE = { sink: 3, dmg: 240, radius: 6, depth: 8 };

// Aircraft and helicopters (design/05 §7.4). Battles compress distance, so air speeds are
// scaled by AIR_SPEED_SCALE: air density is raised by 1 ÷ scale² (lift and drag at the
// scaled speed match the sheet) and propeller power is × scale.
const AIR_SPEED_SCALE = 0.25;
const AIR_SPOT = 2;               // aircraft are seen this many times further away
const AIR_SIGHT = 1.5;            // and see this many times further
const AIR_RHO = 1.225;
const WING_AREA = 6;              // m² of lift per wing section
const TAIL_AREA = 3;              // m² per tail unit (stabiliser and elevator)
const CL_PER_DEG = 0.1, CL_MAX = 1.2, STALL_DEG = 12;
const AIR_CD_WING = 0.01;         // parasite drag per m² of wing
const AIR_CD_FRONT = 0.1;         // parasite drag per m² of frontal area (height × 1.2 m)
const INDUCED_K = 0.06;           // induced drag: k × CL² × wing area
const DRAG_RISE_SPEED = 230;      // m/s (sheet): above this, drag climbs steeply (near the speed of sound)
const AIRPROP_EFF = 0.8;          // share of engine power an air propeller turns into thrust
const ROTOR_LIFT = 25000;         // N per rotor at full power
const ROTOR_POWER = 400;          // kW each rotor needs for full lift
const HELI_CDA = 3;               // m² drag area of a helicopter
const ELEVATOR_DEG = 25;          // elevator travel at full ▲ or ▼
const BOMB = { dmg: 200, radius: 5 };

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
  // Ship structure (Part 2a). sealed = watertight: displaces water below the waterline.
  // floods = takes in water when the hull is holed; bulkheads and keels don't.
  ['hull', 'Ship hull section', 'structure', 2, 2, 600, 150, 10, { cost: { metal: 4, wood: 1 }, sealed: 1, floods: true }],
  ['bow', 'Bow section', 'structure', 2, 2, 450, 130, 10, { cost: { metal: 3, wood: 1 }, sealed: 0.5, floods: true, bowShape: true }],
  ['keel', 'Keel', 'structure', 2, 1, 500, 120, 10, { cost: { metal: 3 }, sealed: 1, keel: true }],
  ['phull', 'Pressure hull section', 'structure', 2, 2, 2200, 220, 25, { cost: { metal: 8 }, sealed: 1, floods: true }],
  ['bulk', 'Watertight bulkhead', 'structure', 1, 2, 200, 100, 10, { cost: { metal: 2 }, sealed: 1, bulkhead: true }],
  // Mobility
  ['eng_s', 'Petrol engine S', 'mobility', 2, 2, 450, 60, 5, { cost: { metal: 3 }, power: 110, heat: 12, fuelUse: 30, rel: 0.990 }],
  ['eng_m', 'Diesel engine M', 'mobility', 3, 2, 1100, 90, 5, { cost: { metal: 7 }, power: 300, heat: 25, fuelUse: 55, rel: 0.994 }],
  ['eng_h', 'Diesel engine H', 'mobility', 4, 2, 1900, 120, 5, { cost: { metal: 12 }, power: 520, heat: 45, fuelUse: 95, rel: 0.992 }],
  ['marine', 'Marine diesel', 'mobility', 4, 3, 5000, 200, 10, { cost: { metal: 25 }, power: 1500, heat: 40, fuelUse: 300, rel: 0.995, sealed: 1, floods: true }],
  ['prop', 'Ship propeller', 'mobility', 1, 2, 300, 50, 10, { cost: { metal: 2 }, propeller: true }],
  // Submarines (Part 2b). ballast = kg of water the tank can take in or blow out.
  ['emotor', 'Electric motor + batteries', 'mobility', 2, 2, 1200, 70, 10, { cost: { metal: 6, elec: 3 }, power: 200, heat: 5, rel: 0.996, electric: true, sealed: 1, floods: true }],
  ['ballast', 'Ballast tank', 'mobility', 2, 2, 300, 80, 10, { cost: { metal: 3 }, ballast: 4000, sealed: 1 }],
  ['thrust', 'Manoeuvre thruster', 'mobility', 1, 1, 150, 30, 5, { cost: { metal: 1, elec: 1 }, power: -40, heat: 5, thruster: true }],
  // Aircraft (Part 2c). air = only works on aircraft and helicopters.
  ['wing', 'Wing section', 'structure', 2, 1, 90, 30, 2, { cost: { metal: 1, wood: 1 }, lift: WING_AREA }],
  ['tail', 'Tail unit', 'structure', 2, 2, 60, 30, 2, { cost: { metal: 1, wood: 1 }, tail: TAIL_AREA }],
  ['aero', 'Aero piston engine', 'mobility', 2, 1, 600, 50, 5, { cost: { metal: 6, elec: 1 }, power: 900, heat: 40, fuelUse: 250, rel: 0.985, air: true }],
  ['jet', 'Jet engine', 'mobility', 3, 1, 900, 70, 5, { cost: { metal: 10, elec: 4 }, jet: 25000, heat: 60, fuelUse: 900, rel: 0.970, air: true }],
  ['turb', 'Gas turbine', 'mobility', 3, 2, 900, 80, 5, { cost: { metal: 8, elec: 3 }, power: 750, heat: 70, fuelUse: 220, rel: 0.980 }],
  ['aprop', 'Air propeller', 'mobility', 1, 2, 80, 20, 2, { cost: { metal: 1, wood: 1 }, airprop: true }],
  ['rotor', 'Rotor', 'mobility', 4, 1, 400, 50, 2, { cost: { metal: 4, elec: 1 }, rotor: true, rel: 0.985 }],
  ['trotor', 'Tail rotor', 'mobility', 1, 1, 60, 20, 2, { cost: { metal: 1 }, trotor: true }],
  ['radiator', 'Radiator', 'mobility', 1, 1, 70, 20, 2, { cost: { metal: 1 }, heat: -12 }],
  ['wheel_s', 'Road wheel', 'mobility', 1, 1, 80, 30, 5, { cost: { metal: 1, rubber: 1 }, loco: 'wheel', contact: 0.04, maxLoad: 2000, cap: 90, radius: 0.25 }],
  ['wheel_l', 'Off-road wheel', 'mobility', 2, 2, 200, 50, 5, { cost: { metal: 1, rubber: 3 }, loco: 'wheel', contact: 0.12, maxLoad: 5000, cap: 75, radius: 0.5 }],
  ['track', 'Track segment', 'mobility', 2, 1, 450, 70, 10, { cost: { metal: 3, rubber: 1 }, loco: 'track', contact: 0.35, maxLoad: 10000, cap: 55, radius: 0.25 }],
  // Weapons
  ['mg', 'Machine gun', 'weapon', 1, 1, 40, 20, 5, { cost: { metal: 1 }, pen: 8, rpm: 600, range: 600 }],
  ['hmg', 'Heavy machine gun', 'weapon', 1, 1, 80, 25, 5, { cost: { metal: 2 }, pen: 20, rpm: 450, range: 1000 }],
  ['ac20', 'Autocannon 20 mm', 'weapon', 2, 1, 150, 35, 5, { cost: { metal: 3 }, pen: 35, rpm: 180, range: 1200 }],
  ['c37', 'Cannon 37 mm', 'weapon', 2, 1, 250, 40, 10, { cost: { metal: 4 }, pen: 50, reload: 2.5, range: 1500 }],
  ['c75', 'Cannon 75 mm', 'weapon', 3, 1, 600, 60, 10, { cost: { metal: 7 }, pen: 90, reload: 5, range: 2000 }],
  ['c105', 'Cannon 105 mm', 'weapon', 4, 1, 1300, 80, 10, { cost: { metal: 12 }, pen: 150, reload: 8, range: 2500 }],
  ['ngun', 'Naval gun 120 mm, twin', 'weapon', 4, 3, 9000, 200, 25, { cost: { metal: 40 }, pen: 130, reload: 6, range: 9000 }],
  // Secondary weapons (Part 2b): fired with Alt; rounds = torpedoes or charges carried.
  ['torp', 'Torpedo tube', 'weapon', 3, 1, 900, 60, 10, { cost: { metal: 8, elec: 1 }, reload: 30, range: 4000, secondary: 'torpedo', rounds: 2, wet: true }],
  ['dc', 'Depth-charge rack', 'weapon', 2, 1, 300, 40, 5, { cost: { metal: 2 }, reload: 4, range: 0, secondary: 'depth', rounds: 6 }],
  ['aa40', 'AA gun 40 mm', 'weapon', 3, 2, 1800, 80, 10, { cost: { metal: 10 }, pen: 60, rpm: 120, range: 3500 }],
  ['bomb', 'Bomb rack', 'weapon', 2, 1, 1100, 30, 3, { cost: { metal: 2 }, range: 0, reload: 0.5, secondary: 'bomb', rounds: 4, bombMass: 250, air: true, pen: 60, heDmg: BOMB.dmg, heRadius: BOMB.radius }],
  ['how', 'Howitzer 150 mm', 'weapon', 4, 2, 2500, 100, 10, { cost: { metal: 18 }, pen: 40, reload: 12, range: 8000, he: true }],
  ['smoke', 'Smoke launcher', 'weapon', 1, 1, 30, 15, 2, { cost: { metal: 1, fuel: 1 }, salvos: 3 }],
  // Systems
  ['radio', 'Radio', 'system', 1, 1, 50, 15, 2, { cost: { metal: 1, elec: 1 }, power: -1 }],
  ['optics', 'Optics', 'system', 1, 1, 30, 10, 2, { cost: { metal: 1, elec: 1 }, spot: 1.4 }],
  ['nsight', 'Night sight', 'system', 1, 1, 20, 10, 2, { cost: { metal: 1, elec: 4 }, power: -3, night: 0.7 }],
  ['fc', 'Fire-control computer', 'system', 1, 1, 60, 15, 2, { cost: { metal: 1, elec: 5 }, power: -5, accuracy: 1.35 }],
  ['sonar', 'Sonar', 'system', 2, 1, 300, 30, 5, { cost: { metal: 2, elec: 4 }, power: -10, sonar: 2000, wet: true }],
  ['stab', 'Gun stabiliser', 'system', 1, 1, 90, 15, 2, { cost: { metal: 2, elec: 4 }, power: -8 }],
  // Logistics
  ['fuel_s', 'Fuel tank 200 L', 'logistics', 1, 1, 220, 30, 3, { cost: { metal: 1 }, fuel: 200, fire: 0.35 }],
  ['fuel_ss', 'Self-sealing tank 150 L', 'logistics', 1, 1, 210, 40, 3, { cost: { metal: 1, rubber: 2 }, fuel: 150, fire: 0.10 }],
  ['ammo', 'Ammo rack', 'logistics', 1, 1, 250, 30, 3, { cost: { metal: 1 }, shells: 20, detonate: 0.40 }],
  ['ammo_p', 'Protected ammo storage', 'logistics', 1, 1, 320, 50, 10, { cost: { metal: 2 }, shells: 20, detonate: 0.10 }],
  ['fuel_l', 'Fuel tank 1000 L', 'logistics', 2, 2, 1050, 60, 3, { cost: { metal: 3 }, fuel: 1000, fire: 0.35 }],
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
  { id: 'sand', name: 'Sand', soft: 0.5, grip: 0.5, conceal: 0.1, color: '#7A6A4A' },
];
const T_PLAINS = 0, T_ROAD = 1, T_FOREST = 2, T_MUD = 3, T_ROCK = 4, T_SAND = 5;

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
  // Ships (Part 2a). The stern is on the left; the keel runs along the bottom row.
  gunboat: {
    name: 'Gunboat', w: 26, h: 9,
    cells: [
      ['prop', 3, 7],
      ['keel', 4, 8], ['keel', 6, 8], ['keel', 8, 8], ['keel', 10, 8], ['keel', 12, 8], ['keel', 14, 8], ['keel', 16, 8], ['keel', 18, 8], ['keel', 20, 8],
      ['hull', 4, 6], ['hull', 6, 6], ['hull', 8, 6], ['bulk', 10, 6], ['hull', 11, 6], ['hull', 13, 6], ['hull', 15, 6], ['hull', 17, 6],
      ['bulk', 19, 6], ['hull', 20, 6], ['hull', 22, 6], ['bow', 24, 6],
      ['eng_m', 4, 4], ['fuel_s', 7, 5], ['ammo', 8, 5], ['plate', 7, 4], ['plate', 8, 4], ['plate', 9, 5],
      ['crew2', 10, 4], ['optics', 10, 3], ['radio', 11, 3], ['plate', 12, 5], ['plate', 13, 5], ['plate', 14, 5],
      ['turret', 15, 5], ['crew2', 15, 3], ['c37', 17, 4], ['plate', 18, 5], ['plate', 19, 5], ['plate', 20, 5], ['hmg', 21, 5],
    ],
  },
  destroyer: {
    name: 'Destroyer', w: 42, h: 14,
    cells: [
      ['prop', 3, 12], ['prop', 4, 12],
      ['keel', 5, 13], ['keel', 7, 13], ['keel', 9, 13], ['keel', 11, 13], ['keel', 13, 13], ['keel', 15, 13], ['keel', 17, 13], ['keel', 19, 13],
      ['keel', 21, 13], ['keel', 23, 13], ['keel', 25, 13], ['keel', 27, 13], ['keel', 29, 13], ['keel', 31, 13], ['keel', 33, 13], ['keel', 35, 13], ['keel', 37, 13],
      // Lower hull.
      ['hull', 5, 11], ['hull', 7, 11], ['bulk', 9, 11], ['hull', 10, 11], ['hull', 12, 11], ['hull', 14, 11], ['marine', 16, 10], ['bulk', 20, 11],
      ['hull', 21, 11], ['hull', 23, 11], ['hull', 25, 11], ['hull', 27, 11], ['hull', 29, 11], ['hull', 31, 11], ['bulk', 33, 11], ['hull', 34, 11], ['hull', 36, 11], ['bow', 38, 11],
      // Upper hull.
      ['hull', 5, 9], ['hull', 7, 9], ['bulk', 9, 9], ['hull', 10, 9], ['hull', 12, 9], ['hull', 14, 9], ['plate', 16, 9], ['plate', 17, 9], ['plate', 18, 9], ['plate', 19, 9], ['bulk', 20, 9],
      ['hull', 21, 9], ['hull', 23, 9], ['hull', 25, 9], ['hull', 27, 9], ['hull', 29, 9], ['hull', 31, 9], ['bulk', 33, 9], ['hull', 34, 9], ['hull', 36, 9], ['hull', 38, 9], ['bow', 40, 9],
      // Aft gun.
      ['turret', 8, 8], ['crew2', 8, 6], ['c75', 10, 7], ['dc', 5, 8], ['plate', 7, 8], ['hmg', 5, 7],
      // Funnel deck, bridge and fuel.
      ['plate', 11, 8], ['plate', 12, 8], ['plate', 13, 8], ['hmg', 14, 8], ['plate', 15, 8], ['eng_s', 16, 7], ['fuel_l', 18, 7],
      ['fuel_l', 20, 7], ['plate', 22, 8], ['plate', 23, 8], ['crew2', 24, 7], ['crew2', 24, 5], ['optics', 24, 4], ['radio', 25, 4], ['fc', 26, 6],
      ['ammo_p', 26, 8], ['ammo_p', 27, 8], ['torp', 28, 8],
      // Forward twin 120 mm.
      ['turret', 31, 8], ['ngun', 31, 5], ['plate', 34, 8], ['plate', 35, 8], ['plate', 36, 8], ['hmg', 37, 8],
      ['sonar', 39, 13],
    ],
  },
  // Submarine (Part 2b): ballast tanks fore and aft, electric motor for running submerged,
  // a diesel for the surface, a bow torpedo tube and a periscope on the sail.
  sub: {
    name: 'Submarine', w: 27, h: 8,
    cells: [
      ['prop', 3, 6],
      ['keel', 5, 7], ['keel', 7, 7], ['keel', 9, 7], ['keel', 11, 7], ['keel', 13, 7], ['keel', 15, 7], ['keel', 17, 7], ['keel', 19, 7], ['keel', 21, 7], ['sonar', 23, 7],
      ['ballast', 4, 5], ['emotor', 6, 5], ['phull', 8, 5], ['bulk', 10, 5], ['phull', 11, 5], ['ballast', 13, 5], ['phull', 15, 5], ['bulk', 17, 5],
      ['phull', 18, 5], ['ballast', 20, 5], ['bow', 22, 5], ['torp', 24, 6],
      // Upper deck; the 80 mm plates are trim weights.
      ['arm80', 5, 4], ['arm80', 5, 3], ['ballast', 6, 3], ['phull', 8, 3], ['eng_m', 10, 3], ['arm80', 13, 3], ['fuel_s', 13, 4], ['crew2', 14, 3],
      ['phull', 16, 3], ['phull', 18, 3], ['arm80', 20, 4], ['arm80', 21, 4],
      ['optics', 14, 2], ['radio', 15, 2], ['arm80', 16, 2], ['arm80', 17, 2],
    ],
  },
  // Aircraft (Part 2c). Nose on the right.
  fighter: {
    name: 'Fighter', w: 18, h: 6,
    cells: [
      ['tail', 0, 2],
      ['frame', 2, 3], ['frame', 3, 3], ['frame', 4, 3], ['frame', 5, 3], ['fuel_ss', 6, 3], ['frame', 7, 3], ['frame', 8, 3],
      ['frame', 9, 3], ['frame', 10, 3], ['frame', 11, 3], ['frame', 12, 3], ['frame', 13, 3],
      ['aero', 14, 3], ['aprop', 16, 2],
      ['crew2', 9, 1], ['radio', 8, 2], ['hmg', 12, 2], ['hmg', 13, 2],
      ['wing', 6, 4], ['wing', 8, 4], ['wing', 10, 4],
    ],
  },
  bomber: {
    name: 'Bomber', w: 30, h: 7,
    cells: [
      ['tail', 0, 2],
      ['frame', 2, 3], ['frame', 3, 3], ['frame', 4, 3], ['frame', 5, 3], ['frame', 6, 3], ['frame', 7, 3], ['fuel_s', 8, 3], ['fuel_s', 9, 3],
      ['frame', 10, 3], ['frame', 11, 3], ['frame', 12, 3], ['frame', 13, 3], ['frame', 14, 3], ['frame', 15, 3], ['frame', 16, 3], ['frame', 17, 3],
      ['aero', 18, 3], ['frame', 20, 3], ['frame', 21, 3], ['frame', 22, 3], ['frame', 23, 3], ['aero', 24, 3], ['aprop', 26, 2],
      ['turret', 12, 2], ['crew2', 13, 0], ['hmg', 15, 1], ['crew2', 20, 1], ['optics', 22, 2],
      ['wing', 10, 4], ['wing', 12, 4], ['wing', 14, 4], ['wing', 16, 4], ['wing', 18, 4],
      ['bomb', 11, 5], ['bomb', 15, 5],
    ],
  },
  heli: {
    name: 'Scout helicopter', w: 12, h: 4,
    cells: [
      ['rotor', 5, 0], ['frame', 8, 1],
      ['trotor', 0, 3], ['frame', 1, 3], ['frame', 2, 3], ['frame', 3, 3], ['frame', 4, 3], ['frame', 5, 3],
      ['aero', 6, 2], ['fuel_ss', 6, 3], ['frame', 7, 3], ['crew2', 8, 2], ['optics', 10, 2], ['hmg', 10, 3],
    ],
  },
  // Enemy-only fixed positions (no engine, so the placement rules don't apply).
  bunker: {
    name: 'Anti-tank gun bunker', w: 8, h: 4, fixed: true,
    cells: [
      ['arm80', 0, 0], ['arm80', 1, 0], ['arm80', 2, 0], ['arm80', 3, 0], ['arm80', 4, 0],
      ['arm80', 0, 1], ['crew2', 1, 1], ['arm40', 3, 1], ['arm40', 4, 1], ['c75', 5, 1],
      ['arm80', 0, 2], ['ammo_p', 3, 2], ['plate', 4, 2], ['arm80', 5, 2], ['arm80', 6, 2], ['slope40', 7, 2],
      ['arm80', 0, 3], ['arm80', 1, 3], ['arm80', 2, 3], ['arm80', 3, 3], ['arm80', 4, 3], ['arm80', 5, 3], ['arm80', 6, 3], ['arm80', 7, 3],
    ],
  },
  howitzer: {
    name: 'Howitzer battery', w: 10, h: 5, fixed: true,
    cells: [
      ['wheel_l', 1, 3], ['wheel_l', 6, 3],
      ['frame', 0, 2], ['frame', 1, 2], ['frame', 2, 2], ['frame', 3, 2], ['frame', 4, 2], ['frame', 5, 2], ['frame', 6, 2], ['frame', 7, 2], ['frame', 8, 2], ['frame', 9, 2],
      ['crew2', 1, 0], ['ammo', 3, 1], ['how', 4, 0], ['frame', 8, 1],
    ],
  },
  behemoth: {
    name: 'Behemoth heavy tank', w: 17, h: 8,
    cells: [
      ['track', 1, 7], ['track', 3, 7], ['track', 5, 7], ['track', 7, 7], ['track', 9, 7], ['track', 11, 7], ['track', 13, 7], ['track', 15, 7],
      ['arm80', 0, 5], ['arm80', 0, 6], ['eng_h', 1, 5], ['fuel_ss', 5, 5], ['fuel_ss', 5, 6], ['ammo_p', 6, 5], ['ammo_p', 6, 6], ['crew2', 7, 5],
      ['fc', 9, 5], ['ammo_p', 9, 6], ['stab', 10, 5], ['plate', 10, 6],
      ['arm80', 11, 5], ['arm80', 12, 5], ['arm80', 13, 5], ['arm80', 14, 5], ['arm80', 15, 5], ['slope40', 16, 5],
      ['arm80', 11, 6], ['arm80', 12, 6], ['arm80', 13, 6], ['arm80', 14, 6], ['arm80', 15, 6], ['arm80', 16, 6],
      ['arm80', 0, 4], ['arm80', 1, 4], ['arm80', 2, 4], ['arm80', 3, 4], ['arm80', 4, 4], ['arm80', 5, 4],
      ['turret', 6, 4], ['arm80', 9, 4], ['arm80', 10, 4], ['arm80', 11, 4], ['arm80', 12, 4], ['arm80', 13, 4], ['arm80', 14, 4], ['slope40', 15, 4],
      ['arm80', 5, 3], ['crew2', 6, 2], ['arm80', 8, 3], ['c105', 9, 3], ['arm80', 5, 2], ['arm80', 8, 2], ['mg', 9, 2],
      ['arm80', 5, 1], ['arm80', 6, 1], ['arm80', 7, 1], ['arm80', 8, 1], ['optics', 6, 0], ['radio', 7, 0],
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

// Templates offered in the Workshop and the Drafting Office (design/01 §8.3).
const STARTING_TEMPLATES = ['medium', 'light', 'scout', 'assault', 'truck', 'gunboat', 'destroyer', 'sub', 'fighter', 'bomber', 'heli'];
// Fleet lent to the player on sea levels when the squad has no ships.
const LOAN_FLEET = ['destroyer', 'gunboat', 'destroyer'];

// ---------- the Proving Ground ladder (design/01 §14)
// Enemy value for scoring (points per kill).
const ENEMY_VALUE = { fighter: 350, bomber: 600, heli: 400, sub: 600, gunboat: 400, destroyer: 800, truck: 100, mgcar: 150, scout: 150, light: 300, medium: 450, assault: 500, bunker: 400, howitzer: 350, behemoth: 1500 };

// Caps that keep high levels possible (design/01 §14.3).
const LADDER_CAPS = { onScreen: 10, accuracy: 0.7, reaction: 0.35, speedMul: 1.5, waveGap: 6 };
const LIVES_START = 3;
const LIVES_MAX = 5;
const COMBO_WINDOW = 4;          // seconds between kills to keep a combo going

// Boss names for every 5th level from 15 on (fictional).
const BOSS_NAMES = ['Warden', 'Anvil', 'Colossus', 'Bastion', 'Leviathan', 'Rampart', 'Juggernaut', 'Citadel'];

// levelConfig(level) → everything a battle needs. Every number is clamped to the caps.
// enemies: [template, count, mode, wave]; mode: parked | convoy | attack | fixed
function levelConfig(level) {
  const L = Math.max(1, Math.floor(level));
  const c = {
    level: L,
    name: 'Proving Ground',
    goal: { type: 'destroy', text: 'Destroy the enemy' },
    seed: 1009 + L * 7919,
    length: 460,
    hills: 0.3, rough: 0.3, mud: 0, forest: 0, gaps: 0,
    weather: 'clear', light: 'day',
    enemies: [],
    wave: 18,                 // seconds between waves
    holdFire: false,
    boss: null,
    lifeBonus: L % 5 === 0,
    accuracy: 0.45 + L * 0.02,
    reaction: 1.4 - L * 0.06,
    speedMul: 1 + Math.max(0, L - 10) * 0.02,
    budget: 200 + L * 12,
    how: '',
  };
  const intro = {
    1: () => Object.assign(c, { name: 'Farmland', goal: { type: 'destroy', text: 'Destroy the trucks' }, hills: 0.1, rough: 0.15,
      enemies: [['truck', 3, 'parked', 0]], holdFire: true, length: 420,
      how: 'Hold ▶ to drive. Tap Fire to shoot the nearest truck.' }),
    2: () => Object.assign(c, { name: 'Supply road', goal: { type: 'destroy', text: 'Destroy the convoy' }, forest: 1,
      enemies: [['truck', 2, 'convoy', 0], ['mgcar', 1, 'attack', 0]], how: 'The machine-gun car shoots back. Your own machine guns fire by themselves.' }),
    3: () => Object.assign(c, { name: 'Hills', hills: 0.8, rough: 0.4, mud: 1, forest: 1,
      enemies: [['mgcar', 1, 'attack', 0], ['light', 1, 'attack', 0]], how: 'Hills: stop on a crest to fire; moving spoils your aim.' }),
    4: () => Object.assign(c, { name: 'Armour', goal: { type: 'destroy', text: 'Destroy the tanks' }, hills: 0.5, mud: 1, forest: 1,
      enemies: [['light', 2, 'attack', 0]], how: 'Armour: shells glance off steep angles. Side and rear plates are thinner.' }),
    5: () => Object.assign(c, { name: 'The ridge', goal: { type: 'hold', text: 'Hold the ridge', time: 60 }, hills: 0.6, forest: 1,
      enemies: [['mgcar', 1, 'attack', 0], ['light', 1, 'attack', 1], ['light', 1, 'attack', 2]], wave: 16,
      how: 'Keep a vehicle inside the flags for 60 s.' }),
    6: () => Object.assign(c, { name: 'Mud flats', mud: 4, hills: 0.3,
      enemies: [['mgcar', 2, 'attack', 0], ['light', 1, 'attack', 0]], how: 'Mud: wheels sink, tracks keep going.' }),
    7: () => Object.assign(c, { name: 'Under the guns', hills: 0.5, forest: 1,
      enemies: [['howitzer', 1, 'fixed', 0], ['light', 2, 'attack', 0]], how: 'Enemy artillery: a red circle marks where each shell will land. Keep moving.' }),
    8: () => Object.assign(c, { name: 'Supply run', goal: { type: 'escort', text: 'Escort the truck to the depot' }, hills: 0.4, forest: 1, length: 520,
      enemies: [['mgcar', 1, 'attack', 0], ['light', 1, 'attack', 0], ['mgcar', 1, 'attack', 1]], how: 'Your supply truck drives to the depot flag. Keep it alive.' }),
    9: () => Object.assign(c, { name: 'Forest', forest: 4, hills: 0.4,
      enemies: [['light', 2, 'attack', 0], ['mgcar', 1, 'attack', 0]], how: 'Forest hides vehicles: you only see what is close. So do they.' }),
    10: () => Object.assign(c, { name: 'The Behemoth', goal: { type: 'destroy', text: 'Destroy the Behemoth' }, hills: 0.4, length: 520,
      enemies: [['behemoth', 1, 'attack', 0], ['light', 1, 'attack', 0]], boss: 'behemoth', how: 'Boss: heavy armour. Aim for the sides and the rear.' }),
    11: () => Object.assign(c, { name: 'Rain at dusk', weather: 'rain', light: 'dusk', forest: 2, mud: 2,
      enemies: [['light', 2, 'attack', 0], ['medium', 1, 'attack', 1]], how: 'Rain and dusk: everyone sees less far.' }),
    12: () => Object.assign(c, { name: 'Gaps', gaps: 3, hills: 0.4,
      enemies: [['light', 2, 'attack', 0], ['mgcar', 2, 'attack', 1]], how: 'Trenches: long vehicles bridge them; short ones fall in.' }),
    13: () => Object.assign(c, { name: 'Bunker line', hills: 0.4,
      enemies: [['bunker', 2, 'fixed', 0], ['light', 1, 'attack', 0]], how: 'Anti-tank guns in bunkers: thick front armour, fixed arc.' }),
    14: () => Object.assign(c, { name: 'Coastal gunboats', goal: { type: 'destroy', text: 'Clear the coast' }, hills: 0.3, forest: 1, length: 560,
      sea: { from: 300, depth: 14 },
      enemies: [['gunboat', 1, 'attack', 0], ['mgcar', 1, 'attack', 0], ['gunboat', 2, 'attack', 1]],
      how: 'Gunboats: hit them at the waterline. A holed hull floods until a bulkhead stops the water.' }),
    16: () => Object.assign(c, { name: 'Submarine hunt', goal: { type: 'destroy', text: 'Clear the sea lane' }, hills: 0.2, length: 640, fleet: true,
      sea: { from: 40, depth: 24 }, lifeBonus: false,
      enemies: [['sub', 1, 'attack', 0], ['gunboat', 1, 'attack', 0], ['sub', 1, 'attack', 1]],
      how: 'Sea battle: submarines hide under water. Sonar finds them within 100 m; Alt drops depth charges over them.' }),
    17: () => Object.assign(c, { name: 'Air raid', hills: 0.4, forest: 1, length: 560,
      enemies: [['fighter', 2, 'air', 0], ['light', 1, 'attack', 0], ['bomber', 1, 'air', 1], ['heli', 1, 'air', 1]],
      how: 'Aircraft: only heavy machine guns, autocannons and AA guns reach them. Fit AA in the Workshop.' }),
    15: () => Object.assign(c, { name: 'Night', light: 'night', forest: 2,
      enemies: [['light', 2, 'attack', 0], ['medium', 2, 'attack', 1]], how: 'Night: crews see a short way. A night sight helps.' }),
  };
  if (intro[L]) intro[L]();
  else {
    // 16+: mixes of earlier ideas with rising numbers; every 5th level is a named boss.
    const rng = makeRng(c.seed);
    const n = L - 15;
    Object.assign(c, {
      name: `Sector ${L}`,
      hills: rng.range(0.2, 0.9), rough: rng.range(0.2, 0.6), mud: rng.int(0, 3), forest: rng.int(0, 3), gaps: rng.int(0, 2),
      weather: rng.next() < 0.25 ? 'rain' : 'clear',
      light: rng.pick(['day', 'day', 'dusk', 'night']),
      length: 480 + Math.min(200, n * 8),
    });
    const pool = ['mgcar', 'light', 'light', 'medium', 'medium', 'assault'];
    const waves = Math.min(4, 1 + Math.floor(n / 4));
    for (let w = 0; w < waves; w++) c.enemies.push([rng.pick(pool), 1 + rng.int(0, Math.min(3, 1 + Math.floor(n / 6))), 'attack', w]);
    if (rng.next() < 0.35) c.enemies.push(['bunker', 1 + rng.int(0, 1), 'fixed', 0]);
    if (rng.next() < 0.3) c.enemies.push(['howitzer', 1, 'fixed', 0]);
    if (rng.next() < 0.2) c.goal = { type: 'hold', text: 'Hold the ridge', time: 60 + Math.min(40, n) };
    // A coast with gunboats on some maps (Part 2a).
    if (rng.next() < 0.25) {
      c.sea = { from: Math.round(c.length * 0.64), depth: 14 };
      c.gaps = 0;
      c.enemies.push([n > 12 && rng.next() < 0.4 ? 'destroyer' : 'gunboat', 1 + rng.int(0, 1), 'attack', rng.int(0, 1)]);
    }
    if (L % 5 === 0) {
      c.boss = 'behemoth';
      c.bossName = `${BOSS_NAMES[(L / 5 - 3) % BOSS_NAMES.length]} (level ${L})`;
      c.goal = { type: 'destroy', text: `Destroy the ${BOSS_NAMES[(L / 5 - 3) % BOSS_NAMES.length]}` };
      c.enemies.unshift(['behemoth', 1, 'attack', 0]);
    }
  }
  // Caps (design/01 §14.3).
  c.accuracy = Math.min(LADDER_CAPS.accuracy, c.accuracy);
  c.reaction = Math.max(LADDER_CAPS.reaction, c.reaction);
  c.speedMul = Math.min(LADDER_CAPS.speedMul, c.speedMul);
  c.wave = Math.max(LADDER_CAPS.waveGap, c.wave);
  return c;
}

// Medals (design/01 §15): feats, stated as facts.
const MEDALS = [
  { id: 'ricochet', name: 'Survived a ricochet', how: 'Win a battle after a shell glanced off your vehicle.' },
  { id: 'combo5', name: 'Five-kill combo', how: 'Destroy 5 enemies with no more than 4 s between kills.' },
  { id: 'noloss', name: 'No losses', how: 'Win a battle without losing a squad vehicle.' },
  { id: 'slope40', name: 'Climbed a 40° slope', how: 'Drive up ground steeper than 40°.' },
  { id: 'crit5', name: 'Five critical hits', how: 'Destroy 5 engines, guns, crew or ammo racks in one battle.' },
  { id: 'boss', name: 'Boss destroyed', how: 'Destroy a boss.' },
  { id: 'level10', name: 'Level 10 cleared', how: 'Clear level 10 of the Proving Ground.' },
];

// Test range (Workshop). Land: flat start, a hill, mud, a trench, forest. Sea: a short
// beach and open water with a shoal. No enemies.
function testDriveConfig(range = 'land') {
  const c = {
    level: 0, name: 'Test range', goal: { type: 'test', text: 'Test drive' }, seed: 777, length: 520,
    hills: 0.7, rough: 0.3, mud: 2, forest: 1, gaps: 1, weather: 'clear', light: 'day',
    enemies: [], wave: 20, accuracy: 0.5, reaction: 1, speedMul: 1, how: '', range,
  };
  if (range === 'sea') Object.assign(c, { hills: 0.2, mud: 0, forest: 0, gaps: 0, sea: { from: 50, depth: 20 } });
  if (range === 'air' || range === 'heli') Object.assign(c, { length: 900, hills: 0.5, mud: 0, forest: 2, gaps: 0 });
  return c;
}
