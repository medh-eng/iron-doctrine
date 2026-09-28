/* ==== 16l RESEARCH AND PERKS ==== */
// The Research card on the campaign map (design/02 §7): the Grand Admiral card (level, XP,
// Command Points), the tech tree with branches left to right and tiers top to bottom, the perk
// list, and the campaign Drafting Office, which offers researched parts only. Numbers only.

function openResearch(tab = 'tech') {
  const wasRunning = campaign.running;
  campaign.running = false;                    // the clock waits while you choose
  const c = ui.card('', 'card-research');
  let close = null;
  const draw = () => {
    c.textContent = '';
    const ga = grandAdmiral();
    const head = el('div', 'rs-head');
    head.appendChild(el('h2', 'card-title', 'Research'));
    const next = ga && ga.level < 30 ? Math.round(150 * Math.pow(ga.level, 1.7)) : null;
    head.appendChild(el('span', 'ws-fact', `Grand Admiral L${ga ? ga.level : 1}`));
    head.appendChild(el('span', 'ws-fact', `XP ${ga ? Math.round(ga.xp) : 0}${next ? `/${next}` : ''}`));
    head.appendChild(el('span', 'ws-fact', `CP ${cpFree()} free of ${cpEarned()}`));
    c.appendChild(head);
    const tabs = el('div', 'card-row rs-tabs');
    for (const [id, label] of [['tech', 'Tech tree'], ['perks', 'Perks']]) tabs.appendChild(button(label, () => { tab = id; draw(); }, 'btn btn-small map-tab' + (tab === id ? ' on' : '')));
    tabs.appendChild(button('Drafting Office', () => { close(); SCREENS.designer.returnTo = 'map'; SCREENS.designer.campaignParts = true; screens.go('designer'); }, 'btn btn-small'));
    tabs.appendChild(button('Close', () => close(), 'btn btn-small', 'back'));
    c.appendChild(tabs);
    const job = techState().job;
    if (job) c.appendChild(el('p', 'card-text rs-job', `Researching ${TECH_BY_ID[job.node].name} at ${(world.settlements.find((s) => s.id === job.at) || { name: '?' }).name}: ${job.daysLeft} day${job.daysLeft === 1 ? '' : 's'} left.`));
    c.appendChild(tab === 'tech' ? techGrid(draw) : perkList(draw));
  };
  draw();
  close = ui.open(c, () => { campaign.running = wasRunning; if (screens.name === 'map') SCREENS.map.refresh(); });
}

// Branches as columns, tiers as rows; each node a button showing its state and CP.
function techGrid(redraw) {
  const box = el('div', 'rs-tree');
  box.appendChild(el('div', 'rs-corner'));
  for (const b of TECH_BRANCHES) box.appendChild(el('div', 'rs-branch', b));
  for (let tier = 1; tier <= 4; tier++) {
    const T = TECH_TIERS[tier];
    box.appendChild(el('div', 'rs-tier', `T${tier} · ${T.days} d · ${T.at === 'metropolis' ? 'metropolis' : 'city'}`));
    for (const b of TECH_BRANCHES) {
      const cell = el('div', 'rs-cell');
      for (const n of TECH.filter((q) => q.branch === b && q.tier === tier)) {
        const st = nodeStatus(n);
        const nb = button('', () => techCard(n, redraw), `rs-node rs-${st}`);
        nb.dataset.node = n.id;
        nb.appendChild(el('b', '', n.name));
        nb.appendChild(el('small', '', st === 'known' ? 'Known' : st === 'researching' ? 'Researching' : `${nodeCp(n)} CP`));
        cell.appendChild(nb);
      }
      box.appendChild(cell);
    }
  }
  return box;
}

// One node: what it unlocks, its costs, prerequisites, and a research button per place.
function techCard(n, redraw) {
  const T = TECH_TIERS[n.tier];
  const c = ui.card(n.name, 'card-scroll');
  let close = null;
  const facts = el('div', 'result-facts');
  const row = (k, v) => { const r = el('div', 'fact'); r.appendChild(el('span', '', k)); r.appendChild(el('b', '', String(v))); facts.appendChild(r); };
  row('Tier', n.tier);
  row('Command Points', nodeCp(n));
  row('Money', T.money);
  if (T.elec) row('Electronics (warehouse)', T.elec);
  if (T.scrap) row('Scrap (warehouse)', T.scrap);
  row('Days', T.days);
  row('Needs', n.needs.length ? n.needs.map((id) => `${TECH_BY_ID[id].name}${techKnown(id) ? ' (known)' : ''}`).join(', ') : '—');
  const parts = nodeParts(n.id).map((id) => PARTS[id].name);
  row('Unlocks', parts.length ? parts.join(', ') : n.later ? `${n.later} (not in the game yet)` : '—');
  c.appendChild(facts);
  const col = el('div', 'card-col');
  const st = nodeStatus(n);
  if (st === 'known' || st === 'researching') col.appendChild(el('p', 'card-text', st === 'known' ? 'Known.' : 'Being researched.'));
  else {
    const places = researchPlaces(n);
    const first = researchBlock(n, null);
    if (first && !/^Needs one of/.test(first)) col.appendChild(el('p', 'card-text bad', first));
    else if (!places.length) col.appendChild(el('p', 'card-text bad', researchBlock(n, null)));
    for (const s of places) {
      const why = researchBlock(n, s);
      const b = button(`Research at ${s.name}`, () => {
        const w = startResearch(n, s);
        if (w) { ui.toast(w); return; }
        audio.sfx('medal');
        ui.toast(`Research on ${n.name} began at ${s.name}.`);
        close(); redraw();
      }, why ? 'btn' : 'btn btn-primary');
      if (why) { b.disabled = true; col.appendChild(b); col.appendChild(el('small', 'rs-why', why)); } else col.appendChild(b);
    }
  }
  col.appendChild(button('Close', () => close(), 'btn', 'back'));
  c.appendChild(col);
  close = ui.open(c);
}

function perkList(redraw) {
  const box = el('div', 'rs-perks');
  for (const group of ['Command', 'Logistics', 'Engineering', 'Trade']) {
    box.appendChild(el('div', 'rs-branch', group));
    for (const P of PERKS.filter((q) => q.group === group)) {
      const has = techState().perks.includes(P.id);
      const r = el('div', 'rs-perk' + (has ? ' on' : ''));
      const t = el('div', 'rs-perk-txt');
      t.appendChild(el('b', '', `${P.name} · ${P.cp} CP`));
      t.appendChild(el('small', '', P.text));
      r.appendChild(t);
      if (has) r.appendChild(el('span', 'ws-fact', 'Taken'));
      else {
        const b = button('Take', () => { const why = buyPerk(P.id); if (why) ui.toast(why); else { audio.sfx('medal'); redraw(); } }, 'btn btn-small');
        b.dataset.perk = P.id;
        if (cpFree() < P.cp) b.disabled = true;
        r.appendChild(b);
      }
      box.appendChild(r);
    }
  }
  return box;
}
