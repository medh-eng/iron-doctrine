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
}
for (const d of Object.values(PART_LIBRARY.parts).sort((a, b) => a.tier - b.tier || a.stats.mass - b.stats.mass)) {
  if (d.planned) continue;
  PARTS[d.id] = Object.assign({ id: d.id, name: d.name, cat: d.category, w: d.footprint.w, h: d.footprint.h, cost: d.cost, tier: d.tier }, d.stats, d.behaviour);
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
const TEMPLATES = PART_LIBRARY.vehicles;

// Templates offered in the Workshop and the Drafting Office (design/01 §8.3).
const STARTING_TEMPLATES = ['medium', 'light', 'scout', 'assault', 'truck', 'gunboat', 'destroyer', 'sub', 'fighter', 'bomber', 'heli'];
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
  inland: ['medium', 'light', 'assault', 'mgcar', 'scout', 'hunter'],
  coast: ['medium', 'light', 'gunboat', 'assault', 'destroyer', 'mgcar'],
  sea: ['gunboat', 'destroyer', 'sub', 'gunboat', 'destroyer'],
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
