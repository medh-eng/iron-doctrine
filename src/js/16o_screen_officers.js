/* ==== 16o OFFICER CARD ==== */
// Producer's play test (v0.6.5): tap a captain or an admiral in the fleet panel. The card shows
// level, XP and upgrades; levels up by hand with a choice of upgrade; and, for a captain, their
// ship: open its design in the Drafting Office, or refit it at the yard where the fleet is docked.

function openOfficer(o, fl) {
  const wasRunning = campaign.running;
  campaign.running = false;                    // the clock waits while you choose
  const c = ui.card('', 'card-research');
  let close = null, choosing = false;
  const draw = () => {
    c.textContent = '';
    const head = el('div', 'rs-head');
    const title = o.rank === 'grand' ? 'Grand Admiral' : o.rank === 'admiral' ? 'Admiral' : 'Captain';
    head.appendChild(el('h2', 'card-title', `${title} ${o.name}`));
    head.appendChild(el('span', 'ws-fact', `Level ${o.level}`));
    const next = nextLevelXp(o);
    head.appendChild(el('span', 'ws-fact', `XP ${Math.round(o.xp)}${next !== null ? ` / ${next}` : ''}`));
    c.appendChild(head);
    const top = el('div', 'card-row rs-tabs');
    top.appendChild(button('Close', () => close(), 'btn btn-small', 'back'));
    c.appendChild(top);
    const box = el('div', 'rel-list');
    const line = (t) => box.appendChild(el('div', 'card-text map-note', t));
    const kind = traitKind(o);
    const have = traitsOf(o);
    box.appendChild(el('div', 'ws-label', kind === 'captain' ? 'Upgrades' : 'Doctrines'));
    if (have.length) {
      const counts = {};
      for (const t of have) counts[t.id] = (counts[t.id] || 0) + 1;
      for (const id in counts) { const t = traitById(kind, id); line(`${t.name}${counts[id] > 1 ? ` ×${counts[id]}` : ''}: ${t.text}.`); }
    } else line('None yet.');
    // Choosing: upgrades owed (older saves, the Grand Admiral's command levels) or a level-up.
    const owed = picksOwed(o);
    const pick = (label, act) => {
      box.appendChild(el('div', 'ws-label', label));
      for (const t of traitChoices(o)) {
        const r = el('div', 'rel-row');
        r.appendChild(el('div', 'rel-name', t.name));
        r.appendChild(el('div', 'card-text map-note', t.text));
        r.appendChild(button('Choose', () => { const why = act(t.id); if (why) ui.toast(why); else audio.sfx('order'); choosing = false; draw(); }, 'btn btn-small btn-primary'));
        box.appendChild(r);
      }
    };
    if (owed > 0 && traitChoices(o).length) pick(`Choose ${owed > 1 ? `${owed} upgrades` : 'an upgrade'} (owed for levels already reached)`, (id) => takeTrait(o, id));
    else if (canLevelUp(o)) {
      if (!choosing) box.appendChild(button(`Level up to ${o.level + 1}`, () => { choosing = true; if (!traitChoices(o).length) { levelUp(o, null); choosing = false; } draw(); }, 'btn btn-small btn-primary'));
      else pick(`Level ${o.level + 1}: choose an upgrade`, (id) => levelUp(o, id));
    } else if (o.rank === 'grand') line(`Level rises by XP alone; a doctrine is chosen each time the command level rises (now ${commandLevel(o)}).`);
    else if (next !== null) line(`${next - Math.round(o.xp)} XP to the next level.`);
    else line('Top level.');
    if (o.rank === 'admiral' || o.rank === 'grand') line(`Command level ${commandLevel(o)}: fleet of ${fl ? fleetCap(fl) : FLEET_SIZE[Math.min(9, commandLevel(o) - 1)]}.`);
    // A captain's ship: its design and a refit.
    const sh = o.rank === 'captain' ? byId('ships', o.shipId) : fl ? flagshipOf(fl) : null;
    if (sh) {
      const st = shipStats(sh), d = shipDesign(sh);
      box.appendChild(el('div', 'ws-label', o.rank === 'captain' ? 'Ship' : 'Flagship'));
      line(`${st.name} · ${st.clsName} · hull ${Math.round(shipHealth(sh) * 100)}%`);
      box.appendChild(button('Edit its design in the Drafting Office', () => {
        close();
        SCREENS.designer.returnTo = 'map'; SCREENS.designer.campaignParts = true;
        screens.go('designer', { design: d, base: d, owned: !TEMPLATES[sh.design] });
      }, 'btn btn-small'));
      const s = fl && fl.docked ? byId('settlements', fl.docked) : null;
      if (s && s.faction === campaign.faction && hasWorkshop(s)) {
        box.appendChild(button(`Refit at ${s.name}'s yard`, () => { close(); const M = SCREENS.map; M.select('settlement', s.id); M.tab = 'yard'; M.refitShip = sh.id; M.panelOpen = true; M.refresh(); }, 'btn btn-small'));
      } else line('Dock the fleet at one of your cities or metropolises to refit this ship to a saved design.');
    }
    c.appendChild(box);
  };
  draw();
  close = ui.open(c, () => { campaign.running = wasRunning; if (screens.name === 'map') SCREENS.map.refresh(); });
}
