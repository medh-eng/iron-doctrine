/* ==== 15i AI DESIGNS THAT EVOLVE ==== */
// Part 6b (design/01 §13). After every campaign battle the game notes what you fielded (a tally
// that fades each day). Every week each AI faction reviews it; when one kind of threat makes up
// a large share of what you field, it refits its designs part for part to answer it: a part of the
// same size, allowed on that vehicle and within its tech tier. Ships it builds afterwards use the
// refit (a new mark of the same design). When the threat fades, the answer is dropped again.
// The player is told facts only: which faction refitted what.

// What each counter answers, and the fact the journal states.
const COUNTERS = {
  armour: 'guns with more penetration',
  air: 'anti-aircraft guns',
  sub: 'depth charges',
  missiles: 'flares',
  energy: 'composite armour',
};

function intelState() {
  if (!campaign.intel) campaign.intel = { n: 0, t: { land: 0, sea: 0, air: 0, sub: 0, armour: 0, missiles: 0, drones: 0, energy: 0 } };
  return campaign.intel;
}

// A design's traits, 0 or 1 each.
function designTraits(d) {
  const dom = domainOf(d);
  const t = { land: dom === 'ground' ? 1 : 0, sea: seaDomain(dom) ? 1 : 0, air: airDomain(dom) ? 1 : 0, sub: dom === 'sub' ? 1 : 0, armour: 0, missiles: 0, drones: 0, energy: 0 };
  let best = 0;
  for (const c of d.cells) {
    const P = PARTS[c.p];
    if (!P) continue;
    if (P.cat === 'structure') best = Math.max(best, P.armor || 0);
    if (P.id === 'rack' || P.id === 'vls' || P.id === 'atgm' || P.id === 'sam') t.missiles = 1;
    if (P.id === 'hangar_d' || P.id === 'hangar_a') t.drones = 1;
    if (P.energy || P.flame) t.energy = 1;
  }
  t.armour = best >= INTEL.heavyArmour ? 1 : 0;
  return t;
}

// From applyBattleOutcome: your ships that took part.
function noteFielded(designs) {
  const I = intelState();
  for (const d of designs) {
    const t = designTraits(d);
    I.n++;
    for (const k in I.t) I.t[k] += t[k];
  }
}
// Once a day (aiDay): the tally fades.
function intelDay() {
  const I = intelState();
  I.n *= INTEL.fade;
  for (const k in I.t) I.t[k] *= INTEL.fade;
}
// The counters your fielded mix calls for now. Drones count as air.
function wantedCounters(held) {
  const I = intelState();
  if (I.n < INTEL.minSeen) return [];
  const share = (k) => (k === 'air' ? I.t.air + I.t.drones : I.t[k]) / I.n;
  // Once adopted, a counter is kept until the share falls to half the threshold.
  return Object.keys(COUNTERS).filter((k) => share(k) >= (held.includes(k) ? INTEL.share / 2 : INTEL.share));
}

// ---------- refitting
const partDomainKey = (dom) => (dom === 'ground' ? 'land' : seaDomain(dom) ? 'sea' : dom === 'airship' ? 'airship' : 'aircraft');
function refitAllowed(P, fid, tier, key) {
  if (!P || P.tier > tier || !P.domains || !P.domains.includes(key)) return false;
  const lib = PART_LIBRARY.parts[P.id];
  return !(lib && lib.unlock && lib.unlock.faction && lib.unlock.faction !== fid);
}
function aiDesignOf(id) {
  if (TEMPLATES[id]) return designFromTemplate(id);
  const d = campaign.aiDesigns && campaign.aiDesigns[id];
  return d ? JSON.parse(JSON.stringify(d)) : null;
}

// Refit a design for the given counters. Returns the new design, or null when nothing changed.
function refitDesign(base, counters, fid, tier) {
  const d = JSON.parse(JSON.stringify(base));
  const dom = domainOf(d), key = partDomainKey(dom);
  const mass0 = d.cells.reduce((a, c) => a + PARTS[c.p].mass, 0);
  const cands = (fit) => Object.values(PARTS).filter((P) => P.cat !== 'structure' && refitAllowed(P, fid, tier, key) && fit(P));
  const weapons = () => d.cells.map((c, i) => ({ c, i, P: PARTS[c.p] })).filter((e) => e.P.cat === 'weapon');
  const sameSize = (a, b) => a.w === b.w && a.h === b.h;
  let changed = false;
  // Swap cell i to part id; kept only if the design stays valid (and an aircraft doesn't get heavier).
  const trySwap = (i, id) => {
    const was = d.cells[i].p;
    if (was === id) return false;
    d.cells[i].p = id;
    const mass = d.cells.reduce((a, c) => a + PARTS[c.p].mass, 0);
    if (!validateDesign(d).ok || (airDomain(dom) && mass > mass0 * 1.05)) { d.cells[i].p = was; return false; }
    changed = true;
    return true;
  };
  const weakest = (list) => list.sort((a, b) => (a.P.dmg || 0) - (b.P.dmg || 0))[0];
  for (const k of counters) {
    if (k === 'armour') {
      // Every direct-fire gun: the most penetrating gun of the same size.
      for (const e of weapons()) {
        if (e.P.auto || e.P.secondary || e.P.indirect || e.P.energy) continue;
        const best = cands((P) => P.cat === 'weapon' && sameSize(P, e.P) && !P.auto && !P.secondary && !P.indirect && !P.energy && (P.pen || 0) > (e.P.pen || 0)).sort((a, b) => b.pen - a.pen);
        for (const P of best) if (trySwap(e.i, P.id)) break;
      }
    } else if (k === 'air') {
      // The weakest weapon (if there are two or more) becomes an anti-aircraft gun of its size.
      const ws = weapons();
      if (ws.length < 2 || ws.some((e) => e.P.aa)) continue;
      const e = weakest(ws);
      const aa = cands((P) => P.cat === 'weapon' && P.aa && sameSize(P, e.P)).sort((a, b) => (b.dmg || 0) - (a.dmg || 0));
      for (const P of aa) if (trySwap(e.i, P.id)) break;
    } else if (k === 'sub') {
      if (!seaDomain(dom)) continue;
      const ws = weapons();
      if (ws.length < 2 || ws.some((e) => e.P.id === 'dc' || e.P.id === 'torp')) continue;
      const fit = ws.filter((e) => sameSize(e.P, PARTS.dc));
      if (fit.length && refitAllowed(PARTS.dc, fid, tier, key)) trySwap(weakest(fit).i, 'dc');
    } else if (k === 'missiles') {
      if (!refitAllowed(PARTS.flare, fid, tier, key) || d.cells.some((c) => c.p === 'flare')) continue;
      // Smoke or a radio makes room first; else a machine gun if there are other weapons.
      const order = ['smoke', 'radio'].map((id) => d.cells.findIndex((c) => c.p === id)).filter((i) => i >= 0);
      if (weapons().length >= 2) { const mg = d.cells.findIndex((c) => c.p === 'mg'); if (mg >= 0) order.push(mg); }
      for (const i of order) if (trySwap(i, 'flare')) break;
    } else if (k === 'energy') {
      if (airDomain(dom) || !PARTS.composite || PARTS.composite.tier > tier) continue;
      d.cells.forEach((c, i) => { const P = PARTS[c.p]; if (P.cat === 'structure' && P.armor >= 20 && P.armor < PARTS.composite.armor) trySwap(i, 'composite'); });
    }
  }
  return changed ? d : null;
}

// ---------- the weekly review (from aiDay)
// The designs a faction might build: its own starting designs and the shared ones up to its tier.
function aiDesignPool(fid) {
  const ids = new Set();
  for (const k of Object.keys(START_DESIGN_KIND)) { const id = `${fid}_${START_DESIGN_KIND[k]}_t0`; if (TEMPLATES[id]) ids.add(id); }
  for (let t = 1; t <= 4; t++) for (const dom in AI_DESIGNS[t]) for (const id of AI_DESIGNS[t][dom]) if (TEMPLATES[id]) ids.add(id);
  return [...ids];
}
function aiReview(fid, news) {
  const st = aiState(fid);
  st.counters = st.counters || [];
  const want = wantedCounters(st.counters);
  const tier = aiTierOf(fid);
  if (want.join() === st.counters.join() && tier === st.refitTier) return;
  const added = want.filter((k) => !st.counters.includes(k));
  st.counters = want;
  st.refitTier = tier;
  st.refit = {};
  campaign.aiDesigns = campaign.aiDesigns || {};
  st.marks = st.marks || {};
  const names = [];
  if (want.length) {
    for (const id of aiDesignPool(fid)) {
      const base = designFromTemplate(id);
      const d = refitDesign(base, want, fid, tier);
      if (!d) continue;
      st.marks[id] = (st.marks[id] || 1) + 1;
      d.id = `ai_${fid}_${id}_${st.marks[id]}`;
      d.family = TEMPLATES[id].name;
      d.mark = st.marks[id];
      d.name = markName(d);
      campaign.aiDesigns[d.id] = d;
      st.refit[id] = d.id;
      names.push(d.name);
    }
  }
  st.refits = (st.refits || 0) + (names.length ? 1 : 0);
  if (added.length && names.length) {
    const msg = `Day ${campaign.day}: the ${factionOf(fid).name} refit ${names.length} design${names.length > 1 ? 's' : ''} with ${added.map((k) => COUNTERS[k]).join(', ')}.`;
    campaign.journal.push(msg);
    news.push(msg.replace(/^Day \d+: t/, 'T'));
  }
}
// The design a faction actually builds for a base design id.
const aiBuildId = (fid, id) => (aiState(fid).refit && aiState(fid).refit[id]) || id;
