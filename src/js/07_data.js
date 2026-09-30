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
// Airships (design/05 §3.2, step 2.7). An envelope cell's gasLift is in units of 100 kg.
const GAS_LIFT_KG = 100;
const AIRSHIP_CDA = 0.6;          // m² of drag area per metre of the airship's height
const AIRSHIP_MIN_LIFT = 0.85;    // valving gas: an airship can shed lift down to this share of its weight
const AIRSHIP_ALT = 30;           // metres over the ground an airship deploys at

// Missiles, sensors and constraints (Part 2d). Battle numbers.
// Lock chance at launch = base + fire control + radar, × (1 − ECM) against a jammed target.
// A missile without a lock flies at a false point and misses.
const MISSILE = {
  atgm: { base: 0.6, turn: 1.6, life: 3.2, fuse: 0 },
  sam: { base: 0.55, turn: 2.4, life: 5, fuse: 3, dmg: 90, radius: 4 },
};
const LOCK_FC = 0.2;              // added by a fire-control computer
const LOCK_ECM = 0.4;             // share of lock chance a target's ECM takes away
const ECM_RADAR = 0.3;            // share of radar range a target's ECM takes away
const ROCKET_SALVO_GAP = 0.1;     // seconds between rockets in a salvo
// Designed missiles (Part 5b, design/01 §10.5, design/05 §3.4). A missile design's numbers come
// from its parts: speed from motors against mass, range from propellant, turn from seeker and fins.
const MSL = {
  motorLoad: 100,          // kg one motor pushes at its full speed
  speedMin: 0.4, speedMax: 1.3,
  velScale: 0.25,          // catalogue speed (m/s) → battle speed
  baseRange: 1000,         // m without propellant sections
  turnScale: 0.4,          // (seeker turn + fins) → rad/s in battle
  units: { missile_s: 1, missile_m: 2, missile_l: 4 },   // launcher and magazine space per missile
  lock: { radar: 0.55, heat: 0.7 },                      // base lock chance by seeker
  flareRadar: 0.25,        // share of a flare's decoy chance that works on a radar seeker
  flareGap: 4,             // seconds between flare salvos
  flareReact: 45,          // m: a crew fires flares when a locked missile comes this close
  clusterAt: 30,           // m from the target where a cluster warhead splits
  burnDps: 6,              // napalm: damage per second to parts in the burning patch
};
// Energy weapons, flamethrowers and damage types (Part 5d, design/01 §7, design/08 §7). Battle numbers.
// Energy weapons use no ammo: they recharge from spare power (engines' power × heat factor, less
// what systems draw), a capacitor covers a shortfall, and each shot adds weapon heat; at EN.heatMax
// they lock until cooled to EN.heatResume. Materials resist damage types (materials.json resist).
const EN = {
  beamVel: 1500,           // m/s: a laser 'shell' crosses its range in a frame or two
  plasmaGravity: 0.3,      // plasma bolts drop at 30% of gravity
  capKJ: 100,              // kJ stored per unit of capacitor effect (30 → 3000 kJ)
  heatMax: 100, heatResume: 50,
  cool: 8,                 // weapon heat shed per second, plus radiators × coolRadiator
  coolRadiator: 0.25,
  flameReach: 0.2,         // a flamethrower reaches range × this (60 → 12 m)
  flameFuel: 1,            // litres per second while it burns
  igniteChance: 0.35,      // chance per second a flamed part catches fire (× (1 − fire resistance))
};
// Fabricators (Part 5e): goods a ship carries for them outside the campaign, and the work items take.
const FAB = { kit: { metal: 20, elec: 10 }, droneUnits: 2, shells: 10, shellMetal: 1 };
// Drones (Part 5c, design/01 §10.5). Battle numbers.
const DRN = {
  speed: 16,               // m/s at a lift-to-weight of 2
  liftMargin: 1.2,         // rotor lift must be 1.2 × the drone's weight
  alt: 10,                 // m above the carrier (defend) or target (attack)
  reach: 160,              // m from the carrier a drone will go after a target
  defend: 45,              // m from the carrier a defending drone takes on enemies
  standoff: 14,            // m a gun drone keeps from its target
  scoutAhead: 70,          // m ahead of the carrier a scout flies
  camRange: 40,            // m a drone camera spots
  gunRange: 30,            // m a drone gun fires at
  hitR: 0.5,               // m: a shell this close to a drone hits it
  scale: 0.8,              // drones are drawn a little smaller than ship cells
};
// Heat (design/v1/05 §7.6): heat units per second. Engines shed ENGINE_COOLING each by themselves;
// in water or in the airflow of a flier they shed EXTRA_COOLING more. Overheating cuts engine
// power and automatic fire rate; 20 s above 100% can start a fire.
const ENGINE_COOLING = 30;
const EXTRA_COOLING = 30;
const OVERHEAT_FIRE_SECS = 20;
// Reliability (design/v1/05 §7.5): checked every 30 s at 1/120 of the hourly breakdown rate.
const BREAKDOWN_CHECK = 30;
const REPAIR_RATE = 10;           // HP per second a repair workshop restores (to itself and allies within 12 m)

// Parts come from the part library (src/parts, bundled by build.mjs as PART_LIBRARY;
// design/04 §9). A game part is { id, name, cat, w, h, cost, tier, ...stats, ...behaviour };
// 1×1 structure cells come from materials.json. Entries marked planned are skipped until
// their mechanic exists. Within a category, parts are listed by tier, then mass.
const PARTS = {};
for (const [id, m] of Object.entries(PART_LIBRARY.materials)) {
  if (m.planned) continue;
  PARTS[id] = { id, name: m.name, cat: 'structure', w: 1, h: 1, mass: m.mass, hp: m.hp, armor: m.armor, power: 0, rel: 0.998, cost: m.cost, tier: m.tier };
  if (m.burns) PARTS[id].burns = m.burns;
  if (m.shape === 'slope') PARTS[id].sloped = true;
  if (m.gasLift) PARTS[id].gasLift = m.gasLift;     // airship envelopes (step 2.7)
  if (m.resist) PARTS[id].resist = m.resist;         // damage-type resistances (Part 5d)
}
for (const d of Object.values(PART_LIBRARY.parts).sort((a, b) => a.tier - b.tier || a.stats.mass - b.stats.mass)) {
  if (d.planned) continue;
  PARTS[d.id] = Object.assign({ id: d.id, name: d.name, cat: d.category, w: d.footprint.w, h: d.footprint.h, cost: d.cost, tier: d.tier, domains: d.domains }, d.stats, d.behaviour);
}

// Terrain types (design/05 §6). softness, grip μ, concealment, colour of the top soil.
const TERRAIN = [
  { id: 'plains', name: 'Plains', soft: 0.1, grip: 0.75, conceal: 0.1, heat: 1, color: '#2B3029' },
  { id: 'road', name: 'Road', soft: 0, grip: 0.9, conceal: 0, heat: 1, color: '#3A3A40' },
  { id: 'forest', name: 'Forest floor', soft: 0.3, grip: 0.6, conceal: 0.5, heat: 0.9, color: '#1F2A22' },
  { id: 'mud', name: 'Mud', soft: 1.0, grip: 0.4, conceal: 0.1, heat: 1, color: '#3B2E25' },
  { id: 'rock', name: 'Rock', soft: 0, grip: 0.8, conceal: 0.3, heat: 0.9, color: '#34363E' },
  { id: 'sand', name: 'Sand', soft: 0.5, grip: 0.5, conceal: 0.1, heat: 1.3, color: '#7A6A4A' },
];
const T_PLAINS = 0, T_ROAD = 1, T_FOREST = 2, T_MUD = 3, T_ROCK = 4, T_SAND = 5;

// ---------- templates: the designs in src/vehicles (design/05 §8). Grid rows go top (y = 0)
// to bottom; front faces right. cells: [partId, x, y]
const TEMPLATES = {};
// Missile designs (Part 5b) live in src/vehicles too, with domain 'missile'; they are kept apart.
const MISSILE_TEMPLATES = {};
// Drone designs (Part 5c) likewise, with domain 'drone'.
const DRONE_TEMPLATES = {};
for (const [id, v] of Object.entries(PART_LIBRARY.vehicles)) (v.domain === 'missile' ? MISSILE_TEMPLATES : v.domain === 'drone' ? DRONE_TEMPLATES : TEMPLATES)[id] = v;

// Templates offered in the Workshop and the Drafting Office (design/01 §8.3).
const STARTING_TEMPLATES = ['medium', 'light', 'scout', 'assault', 'truck', 'gunboat', 'destroyer', 'sub', 'fighter', 'bomber', 'heli', 'gunship_t0', 'gunship_t2', 'drone_truck', 'carrier_t3', 'laser_tank', 'flame_tank', 'dropship'];
// Fleet lent to the player on sea levels when the squad has no ships.
const LOAN_FLEET = ['destroyer', 'gunboat', 'destroyer'];

// ---------- the Gauntlet ladder (v1 Proving Ground; design/01 §15 optional Gauntlet)
// Enemy value for scoring (points per kill).
const ENEMY_VALUE = { hunter: 250, samsite: 400, fighter: 350, bomber: 600, heli: 400, sub: 600, gunboat: 400, destroyer: 800, truck: 100, mgcar: 150, scout: 150, light: 300, medium: 450, assault: 500, bunker: 400, howitzer: 350, behemoth: 1500 };

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
    name: 'Gauntlet',
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
      enemies: [['fighter', 2, 'air', 0], ['light', 1, 'attack', 0], ['samsite', 1, 'fixed', 0], ['bomber', 1, 'air', 1], ['heli', 1, 'air', 1]],
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
    // Aircraft over some maps, with a SAM site; tank hunters with guided missiles (Part 2d).
    if (rng.next() < 0.25) c.enemies.push([rng.pick(['fighter', 'fighter', 'heli', 'bomber']), 1 + rng.int(0, 1), 'air', rng.int(0, 2)], ['samsite', 1, 'fixed', 0]);
    if (n >= 3 && rng.next() < 0.3) c.enemies.push(['hunter', 1 + rng.int(0, 1), 'attack', rng.int(0, 2)]);
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
  { id: 'level10', name: 'Level 10 cleared', how: 'Clear level 10 of the Gauntlet.' },
];

// Test range (Workshop). Land: flat start, a hill, mud, a trench, forest. Sea: a short
// beach and open water with a shoal. No enemies.
// ---------- Battle Simulator (design/01 §15): a battlefield from the player's choices.
const SIM_FIELDS = { inland: 'Inland', coast: 'Coast', sea: 'Open sea' };
const SIM_WEATHER = { clear: 'Clear', rain: 'Rain' };
const SIM_LIGHT = { day: 'Day', dusk: 'Dusk', night: 'Night' };
// Enemy picks when the player leaves the force to the Simulator, by battlefield.
const SIM_MIXED = {
  inland: ['medium', 'light', 'assault', 'gunship_t0', 'mgcar', 'scout', 'hunter'],
  coast: ['medium', 'light', 'gunboat', 'gunship_t2', 'assault', 'destroyer', 'mgcar'],
  sea: ['gunboat', 'destroyer', 'gunship_t0', 'sub', 'gunboat', 'destroyer'],
};

function simulatorConfig(o) {
  const c = levelConfig(3);
  Object.assign(c, {
    name: `${SIM_FIELDS[o.field] || 'Inland'} · ${SIM_WEATHER[o.weather] || 'Clear'} · ${SIM_LIGHT[o.light] || 'Day'}`,
    goal: { type: 'destroy', text: 'Destroy the enemy force' },
    seed: o.seed, enemies: [], length: 560, hills: 0.45, forest: 1, mud: 1, gaps: 0,
    weather: o.weather === 'rain' ? 'rain' : 'clear', light: SIM_LIGHT[o.light] ? o.light : 'day',
    how: 'Three ships a side on the field; the rest wait in reserve. Long-press (or right-click) a ship or its card for orders.',
  });
  if (o.field === 'coast') c.sea = { from: Math.round(c.length * 0.62), depth: 14 };
  if (o.field === 'sea') Object.assign(c, { fleet: true, length: 640, hills: 0.2, forest: 0, mud: 0, sea: { from: 40, depth: 24 } });
  return c;
}

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

// ---------- Campaign (design/01 §2–§10, design/08, design/09). Tuning data for the world map.
const WORLD_W = 192, WORLD_H = 144;   // map cells
const WORLD_KM = 10;                  // km per map cell
// Terrain types on the map. speed: × the fleet's march speed on land; road: × on roads.
const MAP_TERRAIN = {
  sea: { name: 'Sea', color: '#23507A' },
  plains: { name: 'Plains', color: '#7E9A5A', speed: 1 },
  forest: { name: 'Forest', color: '#4E6E3E', speed: 0.6 },
  hills: { name: 'Hills', color: '#9A8F62', speed: 0.6 },
  mountains: { name: 'Mountains', color: '#8C8A86', speed: 0 },   // impassable except at passes
  pass: { name: 'Mountain pass', color: '#A09A8C', speed: 0.4 },
  desert: { name: 'Desert', color: '#CDB27A', speed: 0.7 },
  marsh: { name: 'Marsh', color: '#5F7A5E', speed: 0.4 },
  tundra: { name: 'Tundra', color: '#A9B3A4', speed: 0.7 },
  ice: { name: 'Ice', color: '#E4EAEE', speed: 0.5 },
  ruins: { name: 'Precursor ruins', color: '#8E7F6E', speed: 0.6 },
};
const WORLD_GEN = 2;                  // map generator version (saves keep the one they started with)
const ROAD_SPEED = 1.5;               // × on a road
const MARCH = 0.5;                    // a fleet marches at this share of its slowest ship's top speed
const AIR_MAP_FUEL = 1.3;             // air fleets burn more on the map (08 §8)
// Ships on the map (producer's play test, v0.6.4): they cruise economically, and every
// watertight hull section (whull, hull, phull) holds a fuel bunker.
const SEA_MAP_FUEL = 0.35;            // sea fleets' burn on the map
const HULL_BUNKER = 0.25;             // fuel units per hull section
const STRANDED_SPEED = 0.1;           // an empty fleet crawls (land, sea); air can't move
const DETECT_CELLS = { fleet: 8, settlement: 6 };
const CONTACT_CELLS = 1.6;            // hostile fleets this close meet in battle
const REINFORCE_CELLS = 4;            // fleets this close join a battle
const CLOCK_SPEEDS = [1, 3, 10];      // in-game hours per second
const LOW_FUEL = 0.15;                // the clock stops when a fleet's fuel falls below this share

// Factions (09): where their territory sits (share of the map), capital type and name, looks.
const FACTIONS = [
  { id: 'league', name: 'Harbour League', at: [0.2, 0.78], capital: 'Saltmarch', capType: 'metropolis', coastal: true, color: '#2E6DB4',
    identity: 'Merchant republic of port cities.', pros: ['Sea ships +10% speed', 'Fuel and ammo −15% at their own settlements'], cons: ['Land parts +10% cost'] },
  { id: 'directorate', name: 'Directorate', at: [0.5, 0.5], capital: 'Forge Primus', capType: 'metropolis', coastal: false, color: '#C43C2C',
    identity: 'Industrial state of foundry cities.', pros: ['Armour and tracks −15% cost', 'Metal production +20%'], cons: ['Fuel +15% price everywhere'] },
  { id: 'skyreach', name: 'Skyreach Concord', at: [0.8, 0.22], capital: 'Aerie Crown', capType: 'citadel', coastal: false, color: '#E4DFD2',
    identity: 'Mountain sky-clans sworn to a shared code.', pros: ['Lift +15%', 'Air fleets’ map fuel −15%'], cons: ['Metal production −20%'] },
  { id: 'clans', name: 'Salvage Clans', at: [0.8, 0.8], capital: 'Rustmoor', capType: 'citadel', coastal: false, color: '#D9772E',
    identity: 'Desert scavengers of the Precursor ruins.', pros: ['Salvage × 1.5'], cons: ['Few settlements produce wood'] },
  { id: 'lumen', name: 'Lumen Collective', at: [0.5, 0.14], capital: 'Glasshold', capType: 'metropolis', coastal: false, color: '#4FD1C5',
    identity: 'Relic technocrats of the frozen north.', pros: ['Research at their cities'], cons: ['Cold, slow land'] },
];
// Settlements (08 §7): money per day, market stock, garrison limit. Buy-price multipliers (08 §6).
const SETTLEMENT_TYPES = {
  village: { name: 'Village', walls: 0, armor: 0, slots: 0, militia: 1, money: 15, make: { wood: 6, metal: 4 }, store: 600, stock: { fuel: 60, ammo: 30, wood: 40, metal: 40, elec: 40, scrap: 40 }, price: 1.1, garrison: 2 },
  city: { name: 'City', walls: 3000, armor: 40, slots: 2, militia: 2, money: 50, make: { wood: 14, metal: 12 }, store: 2500, stock: { fuel: 200, ammo: 100, wood: 150, metal: 150, elec: 150, scrap: 150 }, price: 1.0, garrison: 4 },
  metropolis: { name: 'Metropolis', walls: 6000, armor: 60, slots: 4, militia: 3, money: 150, make: { wood: 24, metal: 24, elec: 6 }, store: 8000, stock: { fuel: 500, ammo: 250, wood: 400, metal: 400, elec: 400, scrap: 400 }, price: 0.95, garrison: 6 },
  fort: { name: 'Fort', walls: 8000, armor: 90, slots: 4, militia: 3, money: -20, make: {}, store: 1500, stock: { fuel: 250, ammo: 200, wood: 60, metal: 60, elec: 60, scrap: 60 }, price: 1.05, garrison: 8 },
  citadel: { name: 'Citadel', walls: 16000, armor: 120, slots: 8, militia: 5, money: -60, make: {}, store: 4000, stock: { fuel: 600, ammo: 500, wood: 200, metal: 200, elec: 200, scrap: 200 }, price: 1.0, garrison: 12 },
};
// Physical goods (01 §8.1): everything but money exists in one warehouse or hold. Units:
// fuel 100 L, ammo 100 kg, wood and metal 100 kg, electronics 20 kg, scrap 100 kg.
const GOODS = ['fuel', 'ammo', 'wood', 'metal', 'elec', 'scrap'];
const GOOD_NAMES = { fuel: 'Fuel', ammo: 'Ammo', wood: 'Wood', metal: 'Metal', elec: 'Electronics', scrap: 'Scrap' };
const GOOD_UNITS = { fuel: '100 L', ammo: '100 kg', wood: '100 kg', metal: '100 kg', elec: '20 kg', scrap: '100 kg' };
const PRICES = { fuel: 6, ammo: 12, wood: 4, metal: 10, elec: 40, scrap: 3 };   // money per unit
const SELL_ONLY = { scrap: true };           // markets buy scrap but don't sell it
const OWN_PRICE = 0.85, TRUCE_PRICE = 1.2, SELL_SHARE = 0.6, COASTAL_MONEY = 1.2;
const STOCK_REFILL = 0.1;                    // share of normal market stock refilled per day
// Biome effects on production (08 §7): wood and metal multipliers, scrap per day.
const BIOME_MAKE = {
  forest: { wood: 1.5, metal: 0.7 }, hills: { wood: 0.7, metal: 1.5 }, mountains: { wood: 0.7, metal: 1.5 }, pass: { wood: 0.7, metal: 1.5 },
  desert: { wood: 0.5, metal: 0.5, scrap: 3 }, ruins: { scrap: 6 },
};
// Settlement upgrades (08 §7): resources from that settlement's warehouse, money, days.
const UPGRADES = [
  { from: 'village', to: 'city', wood: 120, metal: 80, elec: 0, money: 1500, days: 3 },
  { from: 'city', to: 'metropolis', wood: 300, metal: 300, elec: 40, money: 6000, days: 7 },
  { from: 'village', to: 'fort', wood: 60, metal: 160, elec: 0, money: 2000, days: 4 },
  { from: 'fort', to: 'citadel', wood: 150, metal: 450, elec: 30, money: 7000, days: 8 },
];
const HOME_STORE = { wood: 80, metal: 60, elec: 5, fuel: 40, ammo: 30, scrap: 20 };   // home city warehouse (08 §13)
// Workshop and yard (08 §4–§5).
const CRAFT_FEE = 0.1;                       // money fee: this share of the goods' base value
const REFINE = { city: { scrap: 4, hours: 1 }, metropolis: { scrap: 3, hours: 0.75 } };   // scrap and hours per electronics unit
const FIELD_REPAIR_HP = 200;                 // HP per hour per repair bay on the map
const FIELD_REPAIR_COST = 0.6;               // × the dock repair goods
// Recruitment (08 §13): captains 120 × level² plus the ship at 1.2 × its cost index; admirals
// 600 × level; quartermasters 250; promotion 400 × level from captain level 6.
const RECRUIT = { captain: 120, admiral: 600, quartermaster: 250, promote: 400, listPrice: 1.2 };
const PROMOTE_LEVEL = 6;
const OFFER_DAYS = 7;                        // forts and citadels renew their offers weekly
// Salvage (08 §9).
const SALVAGE = { part: 0.12, crane: 0.06, maxCranes: 2, scrap: 0.3, craneScrap: 0.2, clans: 1.5 };
const WRECK_HOURS = 24;                      // salvage left on the field is lost after a day
const SCRAP_FIELDS = 10, SCRAP_FIELD_SIZE = [200, 600], SCRAP_FIELD_RATE = 4;   // fields, scrap each, scrap per hour
const STUDY_DAYS = 3;                        // reverse-engineering at a metropolis
// Convoys (01 §8.4).
const CONVOY_SIZE = 6, CONVOY_COMBAT = 2;    // ships in a convoy, of which combat ships
const CONVOY_WAIT = 6;                       // hours a convoy waits at its loading point when there's nothing to load
const CONVOY_REPLAN = 6;
const RAID_PULL = 0.6;                       // AI fleets treat convoys as this much closer (raiding)                     // path steps before a convoy chasing a fleet looks again
// Sieges (01 §11; 08 §7): walls and the keep (2 × the walls' HP) are fixed structures; weapon
// parts go in emplacement slots; militia join the garrison; a captured settlement restarts
// production after RESTART_DAYS and hands its captor PLUNDER of its production value.
const SIEGE = { sections: 2, keepMul: 2, emplaceAcc: 1.2, wallRepair: 0.15, restartDays: 2, plunder: 0.25, plunderDays: 10, aiFrom: 4, aiEdge: 1.3, aiRest: 72 };
const MILITIA = ['mgcar', 'scout', 'light'];  // militia designs, smallest first
const AI_EMPLACE = ['mg', 'c37', 'c75'];      // what AI settlements mount in their slots
const DESERT_DAYS = 3;                       // unpaid days before captains may desert (01 §8.5)
const DESERT_CHANCE = 0.25;                  // per captain per unpaid day after that
const START_MONEY = 1500;
const WAGES = { captain: 4, admiral: 15, quartermaster: 8 };   // money per day (captains and admirals × level)
// Ammo per shot in map units, by calibre (08 §8).
const AMMO_PER_SHOT = [[8, 0.0001], [20, 0.004], [37, 0.012], [57, 0.03], [75, 0.06], [105, 0.14], [150, 0.35], [203, 0.8]];
// XP (08 §10).
const CAPTAIN_XP = [0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3200];
const FLEET_SIZE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 11];
// Officer upgrades (producer's play test, v0.6.5). You level your captains and admirals up by
// hand once they have the XP, choosing one upgrade each time. Captains' are skills for their own
// ship (each up to 3 times); admirals' are doctrines for their fleet (each once). The Grand
// Admiral chooses a doctrine each time their command level rises. Recruits may come with some.
const OFFICER_TRAITS = {
  captain: [
    { id: 'gunnery', name: 'Gunnery drill', text: 'accuracy +6%', acc: 0.06 },
    { id: 'loaders', name: 'Fast loaders', text: 'reload 8% faster', reload: 0.08 },
    { id: 'nerves', name: 'Steady nerves', text: 'reaction time −12%', react: 0.12 },
    { id: 'thrift', name: 'Fuel discipline', text: 'this ship burns 10% less fuel on the map', burn: 0.1 },
  ],
  admiral: [
    { id: 'land_air', name: 'Combined arms: land and air', text: 'aircraft and airships can join this land fleet', mix: 'land' },
    { id: 'sea_air', name: 'Combined arms: sea and air', text: 'aircraft and airships can join this sea fleet', mix: 'sea' },
    { id: 'wide', name: 'Wide command', text: 'fleet size +1', cap: 1 },
    { id: 'march', name: 'Forced march', text: 'march speed +10%', speed: 0.1 },
    { id: 'logistics', name: 'Fuel doctrine', text: 'the fleet burns 10% less fuel', burn: 0.1 },
    { id: 'veterans', name: 'Veteran crews', text: 'every ship in the fleet: accuracy +3%', acc: 0.03 },
  ],
};
const TRAIT_STACK = { captain: 3, admiral: 1 };
const RECRUIT_GIFTED = 0.3;          // chance a recruit brings one upgrade more than their level gives
const RECRUIT_TRAIT_PRICE = 0.2;     // each upgrade a recruit brings adds this share to the price

// ---------- the tech tree and perks (design/08 §11–12, Part 5a)
// Research costs per tier: Command Points, money (treasury), electronics and scrap (from the
// warehouse of the settlement doing the research), days; and where it can be done.
const TECH_TIERS = {
  1: { cp: 2, money: 400, elec: 0, scrap: 0, days: 2, at: 'city' },
  2: { cp: 3, money: 1200, elec: 10, scrap: 0, days: 4, at: 'city' },
  3: { cp: 4, money: 3000, elec: 40, scrap: 0, days: 6, at: 'metropolis' },
  4: { cp: 6, money: 6000, elec: 100, scrap: 50, days: 10, at: 'metropolis' },
};
const CP_PER_LEVEL = 2;          // Grand Admiral: +2 CP per level from level 2 (58 by level 30)
// Nodes: id, name, branch, tier, prerequisites (all needed), and what arrives later (for nodes
// whose parts aren't in the game yet). A node's parts are the library parts whose unlock.tech names it.
const TECH_BRANCHES = ['Hulls', 'Lift', 'Propulsion', 'Guns', 'Sea', 'Air', 'Missiles and drones', 'Energy', 'Systems', 'Logistics'];
const TECH = [
  ['hull_iron', 'Iron hulls', 'Hulls', 1, []],
  ['hull_heavy', 'Heavy armour', 'Hulls', 2, ['hull_iron']],
  ['hull_advanced', 'Composite and alloy hulls', 'Hulls', 3, ['hull_heavy'], 'Composite and alloy materials'],
  ['hull_precursor', 'Precursor plating', 'Hulls', 4, ['hull_advanced'], 'Precursor plating'],
  ['lift_rigid', 'Rigid envelopes', 'Lift', 1, []],
  ['lift_engines', 'Lift engines', 'Lift', 2, ['lift_rigid']],
  ['lift_armoured', 'Armoured envelopes', 'Lift', 3, ['lift_engines'], 'Armoured envelopes'],
  ['lift_levitator', 'Levitators', 'Lift', 4, ['lift_armoured'], 'Levitators'],
  ['prop_petrol', 'Petrol engines', 'Propulsion', 1, []],
  ['prop_diesel', 'Diesels and tracks', 'Propulsion', 1, []],
  ['prop_heavy', 'Heavy and marine diesels', 'Propulsion', 2, ['prop_diesel']],
  ['prop_turbine', 'Gas turbines', 'Propulsion', 2, ['prop_diesel']],
  ['prop_reactor', 'Reactors', 'Propulsion', 4, ['prop_turbine', 'hull_advanced'], 'Reactors'],
  ['guns_medium', 'Medium guns', 'Guns', 1, []],
  ['guns_heavy', 'Heavy guns', 'Guns', 2, ['guns_medium']],
  ['flame', 'Flamethrowers', 'Guns', 2, ['guns_medium'], 'Flamethrowers'],
  ['rockets', 'Rockets', 'Guns', 2, ['guns_medium']],
  ['guns_super', 'Super-heavy guns', 'Guns', 3, ['guns_heavy'], 'The 203 mm gun'],
  ['submarines', 'Submarines', 'Sea', 2, ['hull_iron']],
  ['sonar', 'Sonar and depth charges', 'Sea', 2, ['radio']],
  ['carriers', 'Carriers', 'Sea', 3, ['aviation', 'hull_heavy'], 'Aircraft hangars'],
  ['aviation', 'Aviation', 'Air', 2, ['prop_petrol']],
  ['rotorcraft', 'Rotorcraft', 'Air', 2, ['aviation']],
  ['jets', 'Jets', 'Air', 3, ['aviation', 'prop_turbine']],
  ['missiles', 'Missiles', 'Missiles and drones', 3, ['rockets']],
  ['warheads_special', 'Napalm and acid warheads', 'Missiles and drones', 3, ['missiles'], 'Napalm and acid warheads'],
  ['drones', 'Drones', 'Missiles and drones', 3, ['radio'], 'Drone computers, hangars and parts'],
  ['drones_2', 'Drones II', 'Missiles and drones', 3, ['drones'], 'Larger drone computers'],
  ['fabricators', 'Fabricators', 'Missiles and drones', 3, ['workshop'], 'Fabricators'],
  ['detachment', 'Detachable sections', 'Missiles and drones', 3, ['hull_advanced'], 'Release clamps'],
  ['warheads_emp', 'EMP and cluster warheads', 'Missiles and drones', 4, ['warheads_special'], 'EMP and cluster warheads'],
  ['drones_3', 'Drones III', 'Missiles and drones', 4, ['drones_2'], 'The largest drone computers'],
  ['lasers', 'Lasers', 'Energy', 4, ['fire_control', 'hull_advanced'], 'Lasers, capacitors, laser seekers'],
  ['plasma', 'Plasma', 'Energy', 4, ['lasers'], 'Plasma weapons'],
  ['energy_heavy', 'Heavy energy weapons', 'Energy', 4, ['plasma'], 'Heavy lasers and plasma lances'],
  ['radio', 'Radio', 'Systems', 1, []],
  ['fire_control', 'Fire control', 'Systems', 1, []],
  ['flares', 'Flares', 'Systems', 1, [], 'Flare launchers'],
  ['radar', 'Radar', 'Systems', 2, ['radio']],
  ['stabiliser', 'Stabilisers', 'Systems', 2, ['fire_control']],
  ['workshop', 'Field workshops', 'Systems', 2, ['repair_bay'], 'Workshop parts'],
  ['ecm', 'ECM', 'Systems', 3, ['radar']],
  ['cargo_2', 'Better stores', 'Logistics', 1, []],
  ['repair_bay', 'Repair bays', 'Logistics', 1, []],
  ['salvage', 'Salvage gear', 'Logistics', 1, []],
].map(([id, name, branch, tier, needs, later]) => ({ id, name, branch, tier, needs, later: later || '' }));
// Faction research modifiers (09): Command Point discounts on nodes.
const TECH_FACTION_CP = { directorate: { guns_heavy: -1 }, lumen: { tier4Energy: 0.7 } };
// Perks (08 §12): bought with Command Points, active at once.
const PERKS = [
  ['veteran_eye', 'Veteran eye', 'Command', 1, '+5% accuracy for all your captains'],
  ['quick_rotation', 'Quick rotation', 'Command', 2, 'Pull-back and reserve entry times −40%'],
  ['iron_discipline', 'Iron discipline', 'Command', 2, 'AI captains react 20% faster'],
  ['wider_command', 'Wider command', 'Command', 3, 'Grand Admiral fleet size +2'],
  ['second_in_command', 'Second in command', 'Command', 3, 'Admirals’ fleet size +1'],
  ['deep_holds', 'Deep holds', 'Logistics', 1, 'Cargo capacity +10%'],
  ['frugal_engines', 'Frugal engines', 'Logistics', 2, 'Map fuel use −10%'],
  ['scavengers', 'Scavengers', 'Logistics', 2, 'Salvage chance +4%, scrap +20%'],
  ['quartermaster_corps', 'Quartermaster corps', 'Logistics', 2, 'Convoys +20% speed, +10% cargo'],
  ['field_engineers', 'Field engineers', 'Engineering', 1, 'Field repair +30%'],
  ['master_crafters', 'Master crafters', 'Engineering', 2, 'Crafting time −25%'],
  ['refinery_knowhow', 'Refinery know-how', 'Engineering', 2, 'Refining needs 1 less scrap'],
  ['merchant_charter', 'Merchant charter', 'Trade', 2, 'Buy prices −8%, sell prices +8%'],
  ['tax_reform', 'Tax reform', 'Trade', 3, 'Settlement money +15%'],
].map(([id, name, group, cp, text]) => ({ id, name, group, cp, text }));
// Officer levels in battle (08 §10): per level above 1.
const CAPTAIN_ACC_PER_LEVEL = 0.02, CAPTAIN_REACT_PER_LEVEL = 0.03, CAPTAIN_REPAIR_PER_LEVEL = 0.01;
// Grand Admiral XP (08 §10) besides battles.
const GA_XP = { capture: { village: 100, fort: 250, city: 300, citadel: 700, metropolis: 800 }, convoy: 20, reverse: 50 };
// Starting fleets (01 §4.3). A faction's own batch F designs (<faction>_tank_t0, _corvette_t0,
// _gunship_t0 in src/vehicles) replace these templates where they exist (startDesign in 14b).
const START_FLEETS = [
  { domain: 'land', ships: ['medium', 'light', 'scout'] },
  { domain: 'sea', ships: ['gunboat', 'gunboat', 'gunboat'] },
  { domain: 'air', ships: ['gunship_t0', 'gunship_t0', 'gunship_t0'] },
];
const START_DESIGN_KIND = { land: 'tank', sea: 'corvette', air: 'gunship' };
// Each of your starting fleets also has a support vehicle with fuel in its hold (v0.6.4).
const START_SUPPORT = { land: 'supply_wagon', sea: 'fuel_tender', air: 'supply_airship' };
const START_HOLD_FUEL = 20;
const AI_FLEETS = [
  { domain: 'land', ships: ['light', 'mgcar', 'scout'] },
  { domain: 'sea', ships: ['gunboat', 'gunboat'] },
  { domain: 'air', ships: ['gunship_t0', 'gunship_t0'] },
];
// Faction strategic AI (Part 6a; design/01 §13, design/09). AI factions keep an abstract treasury:
// their settlements' money each day, less upkeep per ship; they build ships from their own
// designs within their tech tier (which rises with the days), take neutral villages, run trade
// convoys, fight each other, besiege, and defend home.
const AI = {
  startMoney: 400,
  upkeep: 4,                 // money a day per ship
  fleetMax: 5,               // ships per AI fleet
  fleetsBase: 3, fleetsPerSettlements: 3,   // fleets allowed: base + settlements ÷ this
  tierDays: 14,              // a tech tier every this many days (to 4)
  buildEvery: 1,             // days between builds
  expandReach: 24,           // cells a fleet goes for a neutral village
  villagePrice: 350,         // what a trading faction pays to take a neutral village over
  convoyIncome: 60,          // money a convoy brings home per delivery
  defendReach: 9,            // cells from its settlements an enemy fleet draws defenders
  clashCooldown: 12,         // hours after an AI-vs-AI clash before the same fleets meet again
  clashLoss: 0.4,            // each ship's chance of being lost ∝ enemy's share of strength
};
// Personalities (09). domains: build weights; raid: how much closer convoys and stranded fleets
// look; prey: weight on damaged fleets; edge: strength needed over a settlement's defence to
// besiege it; siegeFrom: first day of sieges; calmUntil: no attacks before this day unless tier ≥ 3;
// tierDays: tech pace; convoys: trade convoys run; buyVillages: buys neutral villages.
const AI_PERSONA = {
  league: { domains: { sea: 3, land: 1, air: 1 }, raid: 1, prey: 0, edge: 1.5, siegeFrom: 6, calmUntil: 0, tierDays: 14, convoys: 2, buyVillages: true, intercept: 0.8 },
  directorate: { domains: { land: 3, sea: 1, air: 1 }, raid: 1, prey: 0, edge: 1.1, siegeFrom: 3, calmUntil: 0, tierDays: 14, convoys: 1, buyVillages: false, intercept: 0.6 },
  skyreach: { domains: { air: 3, land: 1, sea: 1 }, raid: 2, prey: 0.5, edge: 2.2, siegeFrom: 8, calmUntil: 0, tierDays: 14, convoys: 1, buyVillages: false, intercept: 0.9 },
  clans: { domains: { land: 2, sea: 1, air: 1 }, raid: 1.5, prey: 1.5, edge: 1.4, siegeFrom: 5, calmUntil: 0, tierDays: 16, convoys: 1, buyVillages: false, intercept: 0.7 },
  lumen: { domains: { land: 1, sea: 1, air: 1 }, raid: 1, prey: 0, edge: 1.6, siegeFrom: 12, calmUntil: 20, tierDays: 10, convoys: 1, buyVillages: false, intercept: 1.0 },
};
// Relations (6c, design/09): reputation −100…100 with each faction.
const REL = {
  startWar: -20, startTruce: 20,
  drift: 0.5,                // a day, back towards 0
  battleWon: -4,             // you beat their fleet
  convoyRaided: -10,         // ...and it was a trade convoy
  enemyBeaten: 2,            // with each faction at war with the one you beat
  captured: -25,             // you took their settlement
  charterRep: -8,            // with each faction within charterReach of a village you buy
  charterReach: 15, charterPrice: 500,
  truceRep: -30,             // they talk at this reputation or more
  quietDays: 5,              // days since you last fought them
  tribute: 300, tributePerSettlement: 40,
  truceMade: 10, warDeclared: -20,
  offerRep: 30,              // at war, they offer a truce at this reputation
  breakRep: -50,             // in truce, they break it at this reputation
  borderCells: 8,            // settlements this close make a contested border
  tensionDays: 20, tensionFade: 0.5,
  aiDays: 10, aiTruce: 0.08, aiTruceBorder: 0.03, aiBreak: 0.5,
};
// AI designs that evolve (6b): what you field is tallied after each battle and fades each day; a
// faction refits when a trait makes up a share of it (see 15i).
const INTEL = {
  heavyArmour: 40,           // mm: a design whose best plating is this thick counts as heavily armoured
  fade: 0.97,                // the tally kept each day
  minSeen: 4,                // vehicles seen before any refit
  share: 0.35,               // share of what you field that calls for a counter (dropped below half)
  reviewDays: 7,             // each faction reviews its designs this often
};
// What an AI faction builds by tech tier and domain (its own tier 0 designs first).
const AI_DESIGNS = {
  1: { land: ['light', 'scout'], sea: ['gunboat'], air: ['gunship_t0'] },
  2: { land: ['medium', 'assault'], sea: ['destroyer', 'gunboat'], air: ['gunship_t2'] },
  3: { land: ['assault', 'drone_truck'], sea: ['destroyer', 'sub'], air: ['gunship_t2', 'dropship'] },
  4: { land: ['laser_tank', 'assault'], sea: ['carrier_t3', 'destroyer'], air: ['dropship'] },
};
const AI_CONVOY = { land: ['truck', 'truck'], sea: ['gunboat'], air: ['gunship_t0'] };
// Name parts for officers and settlements (fictional).
const NAME_FIRST = ['Ada', 'Bram', 'Cora', 'Dex', 'Edda', 'Fenn', 'Gale', 'Hask', 'Ines', 'Jory', 'Kell', 'Lio', 'Mara', 'Nils', 'Orla', 'Pim', 'Quill', 'Rhea', 'Sten', 'Tove', 'Ulla', 'Vane', 'Wren', 'Yara'];
const NAME_LAST = ['Aldren', 'Brask', 'Corvel', 'Dunmore', 'Eskar', 'Falk', 'Garrow', 'Holt', 'Ivers', 'Jansk', 'Kestrel', 'Larkin', 'Morrow', 'Nettle', 'Orrin', 'Pell', 'Quarry', 'Rook', 'Sallow', 'Thorne', 'Vesk', 'Wick'];
const PLACE_A = ['Ash', 'Brine', 'Cinder', 'Dun', 'Elder', 'Fell', 'Gull', 'Hollow', 'Iron', 'Kiln', 'Lark', 'Mire', 'North', 'Oak', 'Pike', 'Rust', 'Salt', 'Tarn', 'Vale', 'Wind'];
const PLACE_B = ['by', 'ford', 'haven', 'mouth', 'reach', 'stead', 'wick', 'moor', 'cross', 'gate', 'hold', 'watch'];
