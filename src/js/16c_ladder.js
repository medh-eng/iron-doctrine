/* ==== 16c LADDER ==== */
// The Gauntlet run (the v1 Proving Ground): lives, score, continue, rewards (design/01 §14, §15).

const ladder = {
  get run() { return save.profile.run; },

  // Start a run: fresh (level 1 or a continue after game over) or resume the one in progress.
  start(level, fresh) {
    const p = save.profile;
    if (fresh || !p.run.active) p.run = { active: true, level, lives: LIVES_START, score: 0 };
    p.run.level = level;
    save.touch('profile');
    screens.go('battle', { level });
  },

  resume() {
    const p = save.profile;
    if (p.run.active) this.start(p.run.level, false);
    else this.start(p.continueLevel, true);
  },

  // The three designs fielded in the ladder (saved designs, falling back to the starting templates).
  squadDesigns() {
    const ids = save.profile.squad.length ? save.profile.squad : ['medium', 'light', 'scout'];
    return ids.map((id) => findDesign(id) || designFromTemplate('light'));
  },

  onWin(B) {
    const p = save.profile;
    const bonus = levelBonuses(B);
    const rewards = [];
    p.run.score += bonus.total;
    if (B.cfg.lifeBonus && p.run.lives < LIVES_MAX) { p.run.lives++; rewards.push('+1 life'); }
    p.run.level = B.level + 1;
    p.continueLevel = p.run.level;
    p.highestLevel = Math.max(p.highestLevel, p.run.level);
    const earned = Math.round(bonus.total / 10);
    p.requisition += earned;
    p.bestScore = Math.max(p.bestScore, p.run.score);
    p.stats.battles++;
    p.stats.cleared++;
    p.stats.kills += B.stats.kills;
    // Boss blueprint.
    const boss = B.units.find((V) => V.boss && V.destroyed);
    if (boss && !p.blueprints.some((b) => b.level === B.level)) {
      p.blueprints.push({ id: boss.template, name: boss.name, level: B.level });
      rewards.push(`Blueprint captured: ${boss.name}`);
    }
    for (const m of this.medalsFor(B, true)) rewards.push(`Medal: ${m.name}`);
    save.touch('profile');
    save.flush();
    return { bonus, rewards, earned };
  },

  onLose(B) {
    const p = save.profile;
    p.run.lives--;
    p.stats.battles++;
    p.stats.kills += B.stats.kills;
    for (const m of this.medalsFor(B, false)) ui.toast(`Medal: ${m.name}`, 3500);
    const over = p.run.lives <= 0;
    if (over) {
      p.run.active = false;
      p.continueLevel = B.level;
      p.bestScore = Math.max(p.bestScore, p.run.score);
    }
    save.touch('profile');
    save.flush();
    return { over };
  },

  // Medals earned in this battle that weren't held yet.
  medalsFor(B, won) {
    const p = save.profile;
    const got = [];
    const give = (id) => {
      if (p.medals.includes(id)) return;
      p.medals.push(id);
      got.push(MEDALS.find((m) => m.id === id));
    };
    if (won && B.stats.ricochetsTaken > 0) give('ricochet');
    if (won && B.stats.lost === 0) give('noloss');
    if (won && B.level >= 10) give('level10');
    if (B.bestCombo >= 5) give('combo5');
    if (B.stats.crits >= 5) give('crit5');
    if (B.climbed40) give('slope40');
    if (B.units.some((V) => V.boss && V.destroyed)) give('boss');
    if (got.length) audio.sfx('medal');
    return got;
  },
};

// A saved design by id, or a template id, or a captured blueprint.
function findDesign(id) {
  const d = save.designs.list.find((x) => x.id === id);
  if (d) return JSON.parse(JSON.stringify(d));
  if (TEMPLATES[id]) return designFromTemplate(id);
  return null;
}
