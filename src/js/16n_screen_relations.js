/* ==== 16n RELATIONS CARD ==== */
// Part 6c (design/02 map panels, 09 Relations): each faction's relation with you, your reputation
// with it, contested-border days, and the truce and war buttons. Facts and numbers only.

function openRelations() {
  const wasRunning = campaign.running;
  campaign.running = false;                    // the clock waits while you choose
  const c = ui.card('', 'card-research');
  let close = null, confirm = null;
  const draw = () => {
    c.textContent = '';
    const head = el('div', 'rs-head');
    head.appendChild(el('h2', 'card-title', 'Relations'));
    head.appendChild(el('span', 'ws-fact', `Money ${Math.floor(campaign.treasury)}`));
    c.appendChild(head);
    const top = el('div', 'card-row rs-tabs');
    top.appendChild(button('Close', () => close(), 'btn btn-small', 'back'));
    c.appendChild(top);
    const box = el('div', 'rel-list');
    relState();
    for (const F of FACTIONS) {
      if (F.id === campaign.faction) continue;
      const rel = relation(F.id, campaign.faction);
      const alive = settlementsOf(F.id).length > 0;
      const row = el('div', 'rel-row');
      row.appendChild(el('div', 'rel-name', F.name));
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
