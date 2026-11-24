import { AMMO, SHIELD_TYPES } from './config.js';
import { powerRemaining } from './game.js';

const $ = (id) => document.getElementById(id);

export class Hud {
  constructor() {
    this.el = {
      score: $('score'), best: $('best'),
      healthFill: $('healthFill'), healthText: $('healthText'),
      shieldRow: $('shieldRow'), shieldFill: $('shieldFill'), shieldText: $('shieldText'),
      stats: $('stats'), active: $('activePowers'), queue: $('queue'),
    };
    this.cache = {};
  }

  set(key, el, prop, value) {
    if (this.cache[key] === value) return;
    this.cache[key] = value;
    if (prop === 'html') el.innerHTML = value;
    else if (prop === 'text') el.textContent = value;
    else el.style[prop] = value;
  }

  update(game, best) {
    const { planet, stats: st, powers } = game;
    this.set('score', this.el.score, 'html', `${game.score}<span>s</span>`);
    this.set('best', this.el.best, 'text', `${best}s`);

    const hp = Math.max(0, planet.health / planet.maxHealth);
    this.set('hpW', this.el.healthFill, 'width', `${hp * 100}%`);
    this.set('hpC', this.el.healthFill, 'background', hp > 0.5 ? '#4ade80' : hp > 0.25 ? '#facc15' : '#f87171');
    this.set('hpT', this.el.healthText, 'text', `${Math.ceil(planet.health)}`);

    const sh = planet.shield;
    this.set('shOn', this.el.shieldRow, 'opacity', sh ? '1' : '0.35');
    this.set('shW', this.el.shieldFill, 'width', sh ? `${(sh.dp / sh.maxDp) * 100}%` : '0%');
    this.set('shC', this.el.shieldFill, 'background', sh ? SHIELD_TYPES[sh.type].color : 'transparent');
    this.set('shT', this.el.shieldText, 'text', sh ? `${Math.ceil(sh.dp)}` : '—');

    const ammoPower = powers.active.find((p) => p.def.mods && p.def.mods.ammo);
    const ammoCount = ammoPower ? ammoPower.usesLeft : '∞';
    const chips = [
      ['Barrels', st.barrels],
      ['Fire rate', `${(1 / st.reloadTime).toFixed(1)}/s`],
      ['Spin', `${Math.round((st.rotationSpeed * 180) / Math.PI)}°/s`],
      ['Ammo', `${(AMMO[st.ammo] || AMMO.standard).name} ×${ammoCount}`],
      ['Burst', `×${st.burst}`],
      ['Spread', `×${st.spread}`],
      ['Shield', sh ? SHIELD_TYPES[sh.type].name : 'None'],
    ];
    this.set('stats', this.el.stats, 'html',
      chips.map(([l, v]) => `<div class="chip"><span>${l}</span><b>${v}</b></div>`).join(''));

    const active = powers.active.map((p) => {
      const bits = [];
      if (p.timeLeft != null) bits.push(`${Math.ceil(Math.max(0, p.timeLeft))}s`);
      if (p.usesLeft != null) bits.push(`${p.usesLeft} shots`);
      if (p.def.shield && sh && sh.power === p) bits.push(`${Math.ceil(sh.dp)} DP`);
      const pct = (powerRemaining(p, planet) * 100).toFixed(1);
      return `<div class="power" style="--c:${p.def.color}">
        <span class="glyph">${p.def.glyph}</span>
        <div class="power-body"><div class="power-name">${p.def.name}<em>${bits.join(' · ')}</em></div>
        <div class="power-bar"><div style="width:${pct}%"></div></div></div></div>`;
    }).join('') || '<div class="empty">Shoot a crystal to get a power</div>';
    this.set('active', this.el.active, 'html', active);

    const queue = powers.queue.map((p) =>
      `<div class="qchip" style="--c:${p.def.color}" title="${p.def.name}"><span class="glyph">${p.def.glyph}</span>${p.def.name}</div>`
    ).join('') || '<div class="empty">Empty</div>';
    this.set('queue', this.el.queue, 'html', queue);
  }
}
