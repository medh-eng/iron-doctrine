/* ==== 16n WAR ROOM CARD ==== */
// Part 6c (design/02 map panels, 09 Relations): each faction's relation with you, your reputation
// with it, contested-border days, and the truce and war buttons. Part 6d (02 §8): the war journal,
// campaign medals, and how far you are from winning. Facts and numbers only.

function openRelations(tab = 'relations') {
  const wasRunning = campaign.running;
  campaign.running = false;                    // the clock waits while you choose
  const c = ui.card('', 'card-research');
  let close = null, confirm = null;
  const draw = () => {
    c.textContent = '';
    const head = el('div', 'rs-head');
    head.appendChild(el('h2', 'card-title', 'War room'));
    head.appendChild(el('span', 'ws-fact', `Day ${campaign.day}`));
    head.appendChild(el('span', 'ws-fact', `Money ${Math.floor(campaign.treasury)}`));
    c.appendChild(head);
    const top = el('div', 'card-row rs-tabs');
    for (const [id, label] of [['relations', 'Relations'], ['journal', 'Journal'], ['medals', 'Medals'], ['victory', 'Victory']]) top.appendChild(button(label, () => { tab = id; draw(); }, 'btn btn-small map-tab' + (tab === id ? ' on' : '')));
    top.appendChild(button('Close', () => close(), 'btn btn-small', 'back'));
    c.appendChild(top);
    if (tab !== 'relations') { c.appendChild(warRoomTab(tab)); return; }
    const box = el('div', 'rel-list');
    relState();
    for (const F of FACTIONS) {
      if (F.id === campaign.faction) continue;
      const rel = relation(F.id, campaign.faction);
      const alive = settlementsOf(F.id).length > 0;
      const row = el('div', 'rel-row');
      const nm = el('div', 'rel-name'); nm.appendChild(factionMarkEl(F.id)); nm.appendChild(document.createTextNode(F.name)); row.appendChild(nm);
      const facts = [
        alive ? (rel === 'war' ? 'At war' : 'Truce') : 'No settlements left',
        `Reputation ${repOf(F.id) > 0 ? '+' : ''}${repOf(F.id)}`,
        `Settlements ${settlementsOf(F.id).length}`,
      ];
      if (rel === 'truce') facts.push(`Contested border ${Math.round(campaign.tension[relKey(campaign.faction, F.id)] || 0)} of ${REL.tensionDays} days`);
      const last = campaign.lastFought[F.id];
      if (last !== undefined) facts.push(`Last battle day ${last}`);
      row.appendChild(el('div', 'card-text map-note', facts.join(' · ')));
      if (alive && rel === 'war') {
        const why = truceBlock(F.id);
        if (why) row.appendChild(el('div', 'card-text map-note', why));
        else row.appendChild(button(`Offer truce: tribute ${truceTribute(F.id)}`, () => { const w = proposeTruce(F.id); ui.toast(w || `Truce with the ${F.name}.`); audio.sfx('order'); draw(); }, 'btn btn-small btn-primary'));
      } else if (alive && rel === 'truce') {
        if (confirm === F.id) {
          const r = el('div', 'map-row');
          r.appendChild(button(`Confirm: war with the ${F.name}`, () => { confirm = null; declareWar(F.id); ui.toast(`War with the ${F.name}.`); draw(); }, 'btn btn-small btn-primary'));
          r.appendChild(button('Cancel', () => { confirm = null; draw(); }, 'btn btn-small'));
          row.appendChild(r);
        } else row.appendChild(button('Declare war', () => { confirm = F.id; draw(); }, 'btn btn-small'));
      }
      box.appendChild(row);
    }
    // Between the other factions.
    const ids = FACTIONS.map((F) => F.id).filter((f) => f !== campaign.faction && settlementsOf(f).length);
    const truces = [];
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) if (relation(ids[i], ids[j]) === 'truce') truces.push(`${factionOf(ids[i]).name} and ${factionOf(ids[j]).name}`);
    box.appendChild(el('div', 'ws-label', 'Between the others'));
    box.appendChild(el('div', 'card-text map-note', truces.length ? `In truce: ${truces.join('; ')}. All others at war.` : 'All at war with each other.'));
    c.appendChild(box);
  };
  draw();
  close = ui.open(c, () => { campaign.running = wasRunning; if (screens.name === 'map') SCREENS.map.refresh(); });
}

// The other War room tabs.
function warRoomTab(tab) {
  const box = el('div', 'rel-list');
  const line = (t, cls = 'card-text map-note') => box.appendChild(el('div', cls, t));
  if (tab === 'journal') {
    // Newest first; the daily income lines can be hidden.
    const list = campaign.journal.slice().reverse().filter((j) => SCREENS.map.journalAll || !/: income \d/.test(j));
    box.appendChild(button(SCREENS.map.journalAll ? 'Hide daily income' : 'Show daily income', () => { SCREENS.map.journalAll = !SCREENS.map.journalAll; const n = warRoomTab('journal'); box.replaceWith(n); }, 'btn btn-small'));
    if (!list.length) line('Nothing yet.');
    for (const j of list) line(j, 'card-text rel-journal');
  } else if (tab === 'medals') {
    const got = campaign.medals || [];
    line(`${got.length} of ${CAMPAIGN_MEDALS.length}`, 'ws-label');
    const st = warStats();
    for (const m of CAMPAIGN_MEDALS) {
      const r = el('div', 'bp-medal' + (got.includes(m.id) ? ' got' : ''));
      r.appendChild(el('span', 'bp-dot', got.includes(m.id) ? '★' : '·'));
      const t = el('span', 'bp-medal-txt');
      t.appendChild(el('b', '', m.name));
      t.appendChild(el('small', '', `${m.how} (${Math.min(st[m.stat], m.n)} of ${m.n})`));
      r.appendChild(t);
      box.appendChild(r);
    }
    line('War record', 'ws-label');
    line(`Battles won ${st.won} · lost ${st.lost} · enemy vehicles destroyed ${st.destroyed} · yours lost ${st.lostShips || 0} · convoys beaten ${st.convoys} · enemy flagships sunk ${st.flagships}`);
    line(`Settlements captured ${st.captures} (capitals ${st.capitals}) · charters ${st.charters} · truces ${st.truces} · families reverse-engineered ${st.studied}`);
  } else {
    const v = victoryProgress();
    if (campaign.over) line(`${campaign.over.result === 'win' ? 'Victory' : 'Defeat'} on day ${campaign.over.day}: ${campaign.over.how}.`, 'ws-label');
    line('You win by taking every rival capital, or by holding 60% of all settlements. You lose with no settlements and no fleets left.');
    line(`Rival capitals taken: ${v.capitals} of ${v.capitalsAll}`);
    line(`Settlements held: ${v.held} of ${v.all} (${Math.round(v.share * 100)}%; ${v.need} needed)`);
    line(`Fleets: ${v.fleets}`);
    for (const F of FACTIONS) line(`${F.name}: ${settlementsOf(F.id).length} settlements${F.id === campaign.faction ? ' (you)' : ''}`);
    line(`Neutral: ${world.settlements.filter((s) => !s.faction).length}`);
  }
  return box;
}

// The end of the war (6d): shown once, from the map. A victory can be played on.
function openWarEnd() {
  const o = campaign.over;
  if (!o) return;
  campaign.overSeen = true;
  const c = ui.card(o.result === 'win' ? 'Victory' : 'Defeat');
  const st = warStats();
  c.appendChild(el('p', 'card-text', `Day ${o.day}: ${o.how}.`));
  c.appendChild(el('p', 'card-text', `Battles won ${st.won}, lost ${st.lost}. Enemy vehicles destroyed ${st.destroyed}. Settlements captured ${st.captures}. Medals ${(campaign.medals || []).length} of ${CAMPAIGN_MEDALS.length}.`));
  const row = el('div', 'card-row');
  let close = null;
  row.appendChild(button('War room', () => { close(); openRelations('victory'); }, 'btn'));
  if (o.result === 'win') row.appendChild(button('Keep playing', () => close(), 'btn btn-primary'));
  row.appendChild(button('Title', () => { close(); campaignStore.save(); screens.go('title'); }, o.result === 'win' ? 'btn' : 'btn btn-primary'));
  c.appendChild(row);
  close = ui.open(c);
  audio.sfx(o.result === 'win' ? 'fanfare' : 'lifeLost');
}

