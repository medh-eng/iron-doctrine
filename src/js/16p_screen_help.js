/* ==== 16p HELP: HOW TO PLAY, OBJECTIVES, GLOSSARY ==== */
// Producer's request (v0.7.1): help that takes no screen space, opened from Settings → Help.
// How to play: short pages per subject. Objectives: what the current battle or campaign asks.
// Glossary: every vehicle, part, faction and term, read from the game's own data (so new parts
// and designs appear by themselves), with a search box. Facts only: nothing says what is best.

const HOW_TO = [
  ['Basics', [
    'You are the Grand Admiral of one faction. You drive one vehicle in battle; captains drive the rest.',
    'Hold the phone sideways. Tap ❚❚ to pause; ⚙ opens Settings, where this Help lives.',
    'Battles: up to three of your vehicles fight at a time; the rest wait in reserve and come in when one is lost or pulled back.',
    'The campaign: move fleets on the world map, fight, take settlements, trade, research, and build your own vehicles part by part.',
  ]],
  ['Battle controls', [
    'Drive: hold ◀ ▶ (keyboard A/D or arrows). Aircraft, airships, helicopters and submarines also use ▲ ▼ (W/S).',
    'Fire: tap Fire (Space) to shoot at the nearest enemy in reach. To aim by hand, hold Fire and slide out into the battlefield; let go to fire.',
    'Alt: the secondary weapon when your vehicle has one (missiles, torpedoes, bombs, rockets) (F).',
    'Swap: drive the next vehicle of your three (E or Tab). Tap a vehicle card to take it; hold a card for its command wheel.',
    'Orders for the others: Follow, Escort, Hold, Attack, Back (keys 1–5). Smoke (Q) hides you for a while.',
    'Time stop (T) freezes the battle so you can give orders calmly. Pinch to zoom, drag with two fingers to look around.',
  ]],
  ['Vehicles and damage', [
    'Vehicles are built from parts on a grid. Each part has hit points and armour; a shell must beat the armour (penetration) to hurt what is behind.',
    'Destroy the crew, engines or tracks and a vehicle stops; a hit on ammunition or a capacitor can blow it apart.',
    'Ships float by their hull and sink when flooded; submarines dive with ballast; aircraft need speed over their wings; airships float on gas.',
    'Heat, fuel, ammunition and power all run out. Energy weapons need spare engine power or a capacitor.',
  ]],
  ['Campaign map', [
    'Tap a fleet, then tap where it should go: the path shows the time and fuel. Start ▶ runs the clock (1×, 3×, 10×).',
    'Meeting an enemy fleet starts a battle: fight it yourself or auto-resolve. Settlements are taken by siege.',
    'Tap a settlement for its market, warehouse, workshop, yard and barracks. A second tap on the same spot switches between a fleet and a city.',
    'War room (top bar): relations and truces, the war journal, medals, and how close you are to victory. Research: the tech tree and perks.',
  ]],
  ['Fleets and officers', [
    'Each fleet has an admiral riding its flagship (first into battle, with a pennant). The admiral’s level sets the fleet size.',
    'Captains and admirals earn XP. Open their card from the fleet panel to level them up and choose an upgrade; admirals choose doctrines (for example combined arms, letting aircraft join a land or sea fleet).',
    'Support vehicles (supply wagon, fuel tender, supply airship) carry fuel and goods and don’t count towards the fleet size.',
    'Recruit officers at forts and citadels; promote a captain of level 6 to admiral.',
    'Ships waiting in a garrison: open the settlement, Info tab, Garrison. An admiral there (or the Grand Admiral, after losing the flag fleet) forms them into a fleet; with none, Appoint an admiral there for money.',
    'Build new vehicles at a city or metropolis yard; they wait in that garrison with a new captain.',
  ]],
  ['Economy and logistics', [
    'Only money is shared everywhere. Wood, metal, electronics, scrap, fuel and ammunition sit in one warehouse or one hold at a time and must be carried.',
    'Settlements earn money each day and produce goods; officers draw wages. Buy and sell at markets; prices differ by place and relation.',
    'Fleets burn fuel on the move. Refuel at your settlements, from a support vehicle’s hold, or with a convoy on a standing route.',
    'Win battles to salvage scrap and damaged parts; reverse-engineer parts at a metropolis to learn their family.',
  ]],
  ['Drafting Office and research', [
    'Design vehicles part by part. Each class has a grid size and part limit; the panel shows mass, speed, armour, firepower and cost as plain numbers.',
    'Test drive a design, save it as a new mark, then build it at a yard or refit a ship to it.',
    'Research unlocks part families at your cities and metropolises with Command Points from the Grand Admiral’s level. In the campaign only researched parts can be placed.',
    'Command Points come from the Grand Admiral’s level, which rises with XP: battles won, settlements captured, convoy deliveries and parts reverse-engineered.',
  ]],
];

// Terms for the glossary (game words, plain meanings).
const GLOSSARY_TERMS = [
  ['Admiral', 'Commands a fleet from its flagship. Level sets fleet size and the largest flagship class; chooses doctrines.'],
  ['Airfield', 'A city, metropolis, fort or citadel near a battle sends its owner’s aircraft in from the edge.'],
  ['Auto-resolve', 'Settles a battle without playing it, by the same rules.'],
  ['Captain', 'Drives one vehicle. Level adds accuracy and quicker reactions; upgrades add more.'],
  ['Charter', 'Buying a neutral village with a fleet docked there; costs reputation with nearby factions.'],
  ['Class', 'A vehicle’s size category (tank, behemoth, corvette, destroyer, gunship…): grid size and part limit.'],
  ['Command Points (CP)', 'Earned with the Grand Admiral’s level; spent on research and perks.'],
  ['Convoy', 'A fleet run by a quartermaster on a standing route, carrying goods between settlements.'],
  ['Doctrine', 'An admiral’s upgrade that changes the whole fleet.'],
  ['Flagship', 'The ship the admiral rides. If it is lost the admiral moves to another ship.'],
  ['Garrison', 'Ships and captains left at a settlement to defend it.'],
  ['Mark', 'A saved version of a design (Mk.I, Mk.II…).'],
  ['Penetration', 'How much armour a shot can pass through.'],
  ['Reputation', 'How a faction regards you, −100 to 100. It decides truces.'],
  ['Reserve', 'Vehicles waiting to enter a battle when one of the three on the field is lost or pulled back.'],
  ['Salvage', 'Scrap and damaged parts recovered after a battle you win and hold.'],
  ['Siege', 'A battle for a settlement: walls, emplacements and the keep.'],
  ['Stranded', 'A fleet out of fuel. Land fleets crawl; ships and aircraft wait for supply.'],
  ['Tier', 'A part’s technology level (0 to 4).'],
  ['Truce', 'Trade but no fighting with a faction. Made with tribute or offered by them; broken over contested borders.'],
];

// Settings → Help.
function helpSection(row, toggle) {
  const rows = [];
  rows.push(row('Hints on the map', toggle('hints'), 'A Hint button with ideas for what to do next'));
  const add = (label, note, fn) => rows.push(row(label, button('Open', () => { audio.sfx('tap'); fn(); }, 'btn btn-small'), note));
  add('How to play', 'Controls, battles, the campaign', openHowTo);
  add('Objectives', 'What this battle or campaign asks', openObjectives);
  add('Glossary', 'Every vehicle, part, faction and term', openGlossary);
  add('Tutorial', screens.cur && screens.cur.pausable ? 'From the title screen' : 'A guided practice battle', () => {
    if (screens.cur && screens.cur.pausable) { ui.toast('Start the tutorial from the title screen.'); return; }
    ui.closeTop();
    startTutorial();
  });
  return rows;
}

// A scrolling card with tab buttons along the top.
function helpCard(title, tabs, draw) {
  const c = ui.card('', 'card-research card-help');
  let close = null, tab = tabs[0];
  const render = () => {
    c.textContent = '';
    const head = el('div', 'rs-head');
    head.appendChild(el('h2', 'card-title', title));
    c.appendChild(head);
    const row = el('div', 'card-row rs-tabs help-tabs');
    for (const t of tabs) row.appendChild(button(t, () => { tab = t; render(); }, 'btn btn-small map-tab' + (t === tab ? ' on' : '')));
    row.appendChild(button('Close', () => close(), 'btn btn-small', 'back'));
    c.appendChild(row);
    const box = el('div', 'rel-list help-body');
    draw(tab, box, render);
    c.appendChild(box);
  };
  render();
  close = ui.open(c);
  return close;
}

function openHowTo() {
  let q = '';
  helpCard('How to play', HOW_TO.map((p) => p[0]), (tab, box, render) => {
    // Search every page and the glossary terms; empty: the page of this tab.
    const inp = el('input', 'text-in help-search');
    inp.type = 'search'; inp.placeholder = 'Search all of Help'; inp.value = q;
    inp.addEventListener('input', () => { q = inp.value.trim().toLowerCase(); const caret = inp.selectionStart; render(); const n = document.querySelector('.help-search'); if (n) { n.focus(); n.setSelectionRange(caret, caret); } });
    box.appendChild(inp);
    if (!q) { for (const t of HOW_TO.find((p) => p[0] === tab)[1]) box.appendChild(el('p', 'card-text help-p', t)); return; }
    let n = 0;
    for (const [page, lines] of HOW_TO) for (const t of lines) if (t.toLowerCase().includes(q)) { box.appendChild(el('p', 'card-text help-p', `${page}: ${t}`)); n++; }
    for (const [t, d] of GLOSSARY_TERMS) if ((t + ' ' + d).toLowerCase().includes(q)) { box.appendChild(el('p', 'card-text help-p', `${t}: ${d}`)); n++; }
    if (!n) box.appendChild(el('p', 'card-text map-note', 'Nothing matches. The Glossary covers every vehicle, part and faction.'));
  });
}

// ---------- objectives: of the battle under way, the campaign, or the game
function openObjectives() {
  const c = ui.card('Objectives', 'card-help');
  const p = (t, cls = 'card-text help-p') => c.appendChild(el('p', cls, t));
  const S = SCREENS.battle, B = screens.name === 'battle' && S ? S.B : null;
  if (B) {
    if (S.opts.tutorial) p(`Tutorial step ${S.tut.i + 1} of ${TUTORIAL.length}: ${TUTORIAL[S.tut.i].text}`);
    else if (S.opts.campaign) {
      p(B.siege ? 'Siege: break the defences and destroy the keep, or (defending) hold until the attackers are beaten.' : 'Campaign battle: destroy or drive off every enemy vehicle, on the field and in reserve. Retreating counts as a loss.');
      p(`Enemy vehicles destroyed: ${B.stats.kills || 0}. Yours on the field: ${B.squad.filter((V) => V && !V.destroyed).length}, in reserve: ${B.reserve ? B.reserve[0].length : 0}.`);
    } else if (S.opts.sim) p(`Battle Simulator: destroy every enemy vehicle (${B.goalDone} of ${B.goalTotal}). No campaign effects.`);
    else if (S.opts.test) p('Test drive: try the design on the range. Pause to go back to the Drafting Office.');
    else {
      const g = B.cfg.goal;
      p(`Level ${S.level}: ${g.text}.`);
      if (g.type === 'hold') p(`Held: ${Math.floor(B.holdT || 0)} of ${g.time} s.`);
      else if (B.goalTotal) p(`Progress: ${B.goalDone} of ${B.goalTotal}.`);
    }
  } else if (campaign && (screens.name === 'map' || screens.name === 'designer')) {
    const v = victoryProgress();
    p('Win the war by taking every rival capital, or by holding 60% of all settlements. You lose with no settlements and no fleets left.');
    p(`Rival capitals taken: ${v.capitals} of ${v.capitalsAll}. Settlements held: ${v.held} of ${v.all} (${v.need} needed). Fleets: ${v.fleets}.`);
    p(`Medals: ${(campaign.medals || []).length} of ${CAMPAIGN_MEDALS.length}. Day ${campaign.day}.`);
    if (campaign.over) p(`${campaign.over.result === 'win' ? 'Victory' : 'Defeat'} on day ${campaign.over.day}: ${campaign.over.how}.`);
  } else {
    p('Campaign: lead your faction to victory by taking every rival capital or 60% of all settlements.');
    p('Gauntlet (Play): clear levels one after another; each level states its goal at the start.');
    p('Battle Simulator: set up any battle with no consequences. Drafting Office: design and test vehicles.');
  }
  const row = el('div', 'card-row');
  let close = null;
  row.appendChild(button('Close', () => close(), 'btn btn-primary', 'back'));
  c.appendChild(row);
  close = ui.open(c);
}

// ---------- glossary
function openGlossary() {
  let q = '';
  const match = (...s) => !q || s.some((x) => String(x).toLowerCase().includes(q));
  helpCard('Glossary', ['Vehicles', 'Parts', 'Factions', 'Places', 'Terms'], (tab, box, render) => {
    const inp = el('input', 'text-in help-search');
    inp.type = 'search'; inp.placeholder = 'Search'; inp.value = q;
    inp.addEventListener('input', () => { q = inp.value.trim().toLowerCase(); const caret = inp.selectionStart; render(); const n = document.querySelector('.help-search'); if (n) { n.focus(); n.setSelectionRange(caret, caret); } });
    box.appendChild(inp);
    const item = (title, lines) => {
      const r = el('div', 'rel-row');
      r.appendChild(el('div', 'rel-name', title));
      for (const t of lines.filter(Boolean)) r.appendChild(el('div', 'card-text map-note', t));
      box.appendChild(r);
      return r;
    };
    let n = 0;
    if (tab === 'Vehicles') {
      for (const id of Object.keys(TEMPLATES)) {
        if (/^(msl_|drn_)/.test(id)) continue;
        const T = TEMPLATES[id], d = designFromTemplate(id), dom = domainOf(d), cls = classFor(d);
        const fac = T.faction ? factionOf(T.faction) : null;
        if (!match(T.name, id, dom, cls ? cls.name : '', fac ? fac.name : '')) continue;
        const st = statsOf(d), rep = designReport(d);
        const guns = [...new Set(d.cells.map((c) => PARTS[c.p]).filter((x) => x.cat === 'weapon').map((x) => x.name))].join(', ');
        const r = item(T.name, [
          `${DOMAIN_NAMES[dom]} · ${cls ? cls.name : 'outside class limits'}${fac ? ` · ${fac.name}` : ''}`,
          `${(st.mass / 1000).toFixed(1)} t · top speed ${Math.round(rep.topSpeed || 0)} km/h · ${d.cells.length} parts · cost ${costOf(d)}`,
          `Weapons: ${guns || 'none'}`,
        ]);
        if (n++ < 24) r.insertBefore(designThumb(d, 150, 54), r.firstChild.nextSibling);
      }
    } else if (tab === 'Parts') {
      const cats = {};
      for (const P of Object.values(PARTS)) (cats[P.cat] = cats[P.cat] || []).push(P);
      for (const cat of Object.keys(cats)) for (const P of cats[cat]) {
        const lib = PART_LIBRARY.parts[P.id] || PART_LIBRARY.materials[P.id] || {};
        if (!match(P.name, P.id, cat)) continue;
        const stats = ['mass', 'hp', 'armor', 'power', 'pen', 'dmg', 'range', 'reload', 'cargo', 'fuel', 'spot', 'liftForce'].filter((k) => P[k]).map((k) => `${k === 'armor' ? 'armour' : k === 'liftForce' ? 'lift' : k} ${P[k]}`).join(' · ');
        const fac = lib.unlock && lib.unlock.faction ? factionOf(lib.unlock.faction) : null;
        item(P.name, [
          `${cat} · tier ${P.tier} · ${P.w}×${P.h}${fac ? ` · ${fac.name} only` : ''}${P.domains ? ` · ${P.domains.join(', ')}` : ''}`,
          stats,
          P.info || '',
          (lib.pros || []).concat(lib.cons || []).join(' · '),
        ]);
      }
    } else if (tab === 'Factions') {
      for (const F of FACTIONS) {
        if (!match(F.name, F.identity)) continue;
        const sig = Object.values(PART_LIBRARY.parts).filter((p) => p.unlock && p.unlock.faction === F.id).map((p) => p.name)
          .concat(Object.entries(PART_LIBRARY.materials).filter(([, m]) => m.unlock && m.unlock.faction === F.id).map(([, m]) => m.name));
        const P = AI_PERSONA[F.id], doms = P ? Object.entries(P.domains).sort((a, b) => b[1] - a[1]).map(([k, w]) => `${k} ${w}`).join(', ') : '';
        item(F.name, [F.identity, `Capital: ${F.capital}`, `Strengths: ${F.pros.join('; ')}`, `Weaknesses: ${F.cons.join('; ')}`, sig.length ? `Signature parts: ${sig.join(', ')}` : '', doms ? `As an AI, builds by weight: ${doms}` : '']);
      }
    } else if (tab === 'Places') {
      for (const [id, T] of Object.entries(SETTLEMENT_TYPES)) if (match(T.name, id)) item(T.name, [`Money a day ${T.money} · garrison ${T.garrison}`, id === 'city' || id === 'metropolis' ? 'Workshop and yard' : id === 'fort' || id === 'citadel' ? 'Barracks: officers for hire' : '']);
      for (const k of GOODS) if (match(GOOD_NAMES[k])) item(GOOD_NAMES[k], [`Base price ${PRICES[k]} a unit (${GOOD_UNITS[k]})${SELL_ONLY[k] ? '; markets buy it but don\u2019t sell it' : ''}`]);
    } else {
      for (const [t, d] of GLOSSARY_TERMS) if (match(t, d)) item(t, [d]);
    }
    if (box.children.length === 1) box.appendChild(el('p', 'card-text map-note', 'Nothing matches.'));
  });
}

// ---------- hints (v0.7.2): ideas for what to do next on the campaign map, from the situation.
// They say what is possible and where, never which choice is better.
function campaignHints() {
  const out = [];
  const mine = playerFleets().filter((fl) => fl.shipIds.length && !fl.convoy);
  const own = world.settlements.filter((s) => s.faction === campaign.faction);
  const garrisoned = own.filter((s) => campaign.ships.some((sh) => sh.garrison === s.id));
  if (campaign.over) out.push(`The war is over (${campaign.over.result === 'win' ? 'victory' : 'defeat'}). You can keep playing, or start a new campaign from the title.`);
  if (!mine.length) {
    out.push(garrisoned.length
      ? `You have no fleets, but ships wait in the garrison at ${garrisoned.map((s) => s.name).join(', ')}. Tap the settlement, Info tab, Garrison: form a fleet with an admiral there, or Appoint an admiral.`
      : 'You have no fleets and no ships in garrison. Build vehicles at a city or metropolis yard (Yard tab); they wait in that garrison.');
  } else if (garrisoned.length) out.push(`Ships wait in the garrison at ${garrisoned.map((s) => s.name).join(', ')}. A docked fleet can take them aboard (Info tab), or an admiral can form a new fleet.`);
  for (const fl of mine) {
    if (fl.stranded) out.push(`${fl.name} is stranded without fuel. Send fuel by convoy or a support vehicle's hold, or move another fleet to it.`);
    else { const f = fleetFuel(fl); if (f.cap && f.fuel / f.cap < 0.3) out.push(`${fl.name} is low on fuel (${Math.round((f.fuel / f.cap) * 100)}%). Refuel at one of your settlements (Market or Stores).`); }
  }
  const ready = campaign.officers.filter((o) => o.alive && o.faction === campaign.faction && (canLevelUp(o) || picksOwed(o) > 0));
  if (ready.length) out.push(`${ready.length} officer${ready.length > 1 ? 's are' : ' is'} ready to level up or choose an upgrade: open them from the fleet panel (★).`);
  const t = techState();
  if (!t.job) out.push(cpFree() > 0 ? `${cpFree()} Command Point${cpFree() > 1 ? 's' : ''} free: open Research to start a node at one of your cities.` : 'No Command Points free. They come from the Grand Admiral’s level: win battles, capture settlements, deliver convoys, reverse-engineer parts.');
  if (campaign.treasury < 300) out.push(`Money is short (${Math.floor(campaign.treasury)}). Settlements pay daily; selling goods at a market, convoys and battle bounties add more.`);
  if (mine.length) {
    const near = world.settlements.filter((s) => s.faction !== campaign.faction && (!s.faction || relation(s.faction, campaign.faction) === 'war'))
      .map((s) => ({ s, d: Math.min(...mine.map((fl) => Math.hypot(fl.x - s.x, fl.y - s.y))) })).sort((a, b) => a.d - b.d)[0];
    if (near) out.push(`Nearest settlement you could take: ${near.s.name} (${near.s.faction ? factionOf(near.s.faction).name : 'neutral'}${near.s.type === 'village' && !near.s.faction ? ', a charter can buy it' : ''}). Move a fleet there; besiege it from its Info tab.`);
  }
  const v = victoryProgress();
  out.push(`Victory: ${v.capitals} of ${v.capitalsAll} rival capitals, ${v.held} of ${v.need} settlements needed.`);
  return out;
}
function openHints() {
  const c = ui.card('Hints', 'card-help');
  for (const h of campaignHints().slice(0, 6)) c.appendChild(el('p', 'card-text help-p', '• ' + h));
  c.appendChild(el('p', 'card-text map-note', 'Turn hints off in Settings → Help.'));
  const row = el('div', 'card-row');
  let close = null;
  row.appendChild(button('Close', () => close(), 'btn btn-primary', 'back'));
  c.appendChild(row);
  close = ui.open(c);
}

