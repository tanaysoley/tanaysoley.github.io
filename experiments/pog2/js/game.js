import { WORLD, CENTER, PLANET, GUN, AMMO, POGS, SPAWN, POWERS, SHIELD_TYPES } from './config.js';
import { sfx } from './audio.js';

const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const MAX_PARTICLES = 700;
const SHIELD_RADIUS = PLANET.radius + PLANET.shieldPadding;
const TAP_BUFFER = 0.12; // a tap this close to the end of a reload is fired when it finishes

function weightedPick(entries) {
  let total = 0;
  for (const [, w] of entries) total += w;
  let r = Math.random() * total;
  for (const [k, w] of entries) if ((r -= w) <= 0) return k;
  return entries[entries.length - 1][0];
}

// Stat keys a power touches. Powers sharing a key cannot be active together.
export function powerKeys(def) {
  return def.shield ? ['shield'] : Object.keys(def.mods || {});
}

// 0..1 for how much of a power is left (whichever limit is closest to running out).
export function powerRemaining(p, planet) {
  let f = 1;
  if (p.def.duration) f = Math.min(f, p.timeLeft / p.def.duration);
  if (p.def.shots) f = Math.min(f, p.usesLeft / p.def.shots);
  if (p.def.shield && planet.shield && planet.shield.power === p) {
    f = Math.min(f, planet.shield.dp / planet.shield.maxDp);
  }
  return Math.max(0, f);
}

export class Game {
  constructor(canvas, events = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.events = events;
    this.stars = Array.from({ length: 160 }, () => ({
      x: Math.random() * WORLD, y: Math.random() * WORLD,
      r: rand(0.6, 2.2), p: rand(0, TAU), s: rand(0.4, 1.8),
    }));
    this.continents = Array.from({ length: 7 }, () => ({
      a: rand(0, TAU), d: rand(0, PLANET.radius * 0.85), r: rand(10, 24),
    }));
    this.clock = 0;
    this.phase = 'menu';
    this.reset();
  }

  reset() {
    this.time = 0;
    this.kills = 0;
    this.planet = { health: PLANET.maxHealth, maxHealth: PLANET.maxHealth, shield: null, flash: 0 };
    this.gun = { angle: -Math.PI / 2, cooldown: 0, fireBuffer: 0, volleys: [] };
    this.bullets = [];
    this.pogs = [];
    this.crystals = [];
    this.particles = [];
    this.floaters = [];
    this.powers = { active: [], queue: [] };
    this.spawnTimer = 1.2;
    this.crystalTimer = SPAWN.firstCrystal;
    this.shake = 0;
    this.dyingTimer = 0;
    this.stats = this.computeStats();
  }

  start() {
    this.reset();
    this.phase = 'playing';
  }

  pause()  { if (this.phase === 'playing') this.phase = 'paused'; }
  resume() { if (this.phase === 'paused') this.phase = 'playing'; }

  // ---------------------------------------------------------------- stats

  computeStats() {
    const s = {
      rotationSpeed: GUN.rotationSpeed, barrels: GUN.barrels, reloadTime: GUN.reloadTime,
      ammo: GUN.ammo, burst: GUN.burst, burstInterval: GUN.burstInterval,
      spread: GUN.spread, spreadAngle: GUN.spreadAngle,
    };
    for (const p of this.powers.active) {
      for (const [k, m] of Object.entries(p.def.mods || {})) {
        if ('set' in m) s[k] = m.set;
        if ('mul' in m) s[k] *= m.mul;
        if ('add' in m) s[k] += m.add;
      }
    }
    return s;
  }

  // ---------------------------------------------------------------- input

  tap() {
    if (this.phase !== 'playing') return;
    if (this.gun.cooldown <= 0) this.fire();
    else if (this.gun.cooldown <= TAP_BUFFER) this.gun.fireBuffer = TAP_BUFFER;
  }

  fire() {
    const st = { ...this.stats };
    this.gun.cooldown = st.reloadTime;
    for (const p of this.powers.active) if (p.usesLeft != null) p.usesLeft--;
    this.fireVolley(st);
    for (let b = 1; b < st.burst; b++) this.gun.volleys.push({ delay: b * st.burstInterval, st });
    sfx.shoot();
  }

  fireVolley(st) {
    const ammo = AMMO[st.ammo] || AMMO.standard;
    const tipR = PLANET.radius + GUN.length;
    for (let i = 0; i < st.barrels; i++) {
      const base = this.gun.angle + (i * TAU) / st.barrels;
      const ox = CENTER + Math.cos(base) * tipR;
      const oy = CENTER + Math.sin(base) * tipR;
      for (let j = 0; j < st.spread; j++) {
        const off = st.spread > 1 ? -st.spreadAngle / 2 + (j * st.spreadAngle) / (st.spread - 1) : 0;
        const a = base + off;
        this.bullets.push({
          x: ox, y: oy, vx: Math.cos(a) * ammo.speed, vy: Math.sin(a) * ammo.speed,
          r: ammo.radius, damage: ammo.damage, pierce: ammo.pierce, color: ammo.color, hit: new Set(),
        });
      }
      this.burstParticles(ox, oy, ammo.color, 3, 120, 0.15, base);
    }
  }

  // ---------------------------------------------------------------- spawning

  spawnPog(kind, opts = null) {
    const k = POGS[kind];
    let x, y, vx, vy;
    if (opts) {
      ({ x, y, vx, vy } = opts);
    } else {
      const a = rand(0, TAU);
      x = CENTER + Math.cos(a) * SPAWN.radius;
      y = CENTER + Math.sin(a) * SPAWN.radius;
      // Aim at a point offset sideways from the planet (triangular distribution → most come close).
      const off = (Math.random() - Math.random()) * SPAWN.missSpread;
      const tx = CENTER - Math.sin(a) * off;
      const ty = CENTER + Math.cos(a) * off;
      const d = Math.hypot(tx - x, ty - y);
      const sp = rand(k.speed[0], k.speed[1]) * SPAWN.speedMul(this.time);
      vx = ((tx - x) / d) * sp;
      vy = ((ty - y) / d) * sp;
    }
    const hp = k.hp > 1 ? k.hp + SPAWN.hpBonus(this.time) : k.hp;
    const n = 9 + Math.floor(Math.random() * 4);
    const shape = Array.from({ length: n }, () => rand(0.78, 1.1));
    const craters = Array.from({ length: 2 + Math.floor(Math.random() * 2) }, () => ({
      a: rand(0, TAU), d: rand(0, 0.5), r: rand(0.14, 0.26),
    }));
    this.pogs.push({
      kind, k, x, y, vx, vy, r: k.radius, hp, maxHp: hp,
      rot: rand(0, TAU), spin: rand(-1.6, 1.6), shape, craters, flash: 0,
    });
  }

  spawnCrystal() {
    const entries = Object.entries(POWERS).map(([key, def]) => {
      let w = def.weight;
      if (key === 'repair') w *= this.planet.health < this.planet.maxHealth * 0.6 ? 2 : 0.3;
      return [key, w];
    });
    const key = weightedPick(entries);
    const a = rand(0, TAU);
    const x = CENTER + Math.cos(a) * SPAWN.radius;
    const y = CENTER + Math.sin(a) * SPAWN.radius;
    // Crystals drift across the field without targeting the planet.
    const off = (Math.random() < 0.5 ? -1 : 1) * rand(170, 360);
    const tx = CENTER - Math.sin(a) * off;
    const ty = CENTER + Math.cos(a) * off;
    const d = Math.hypot(tx - x, ty - y);
    const sp = rand(SPAWN.crystalSpeed[0], SPAWN.crystalSpeed[1]);
    this.crystals.push({ key, def: POWERS[key], x, y, vx: ((tx - x) / d) * sp, vy: ((ty - y) / d) * sp, r: 22, rot: 0 });
  }

  // ---------------------------------------------------------------- powers

  acquirePower(c) {
    const def = c.def;
    sfx.power();
    this.burstParticles(c.x, c.y, def.color, 22, 260, 0.6);
    this.floater(c.x, c.y, def.name, def.color);
    if (def.instant) {
      if (def.heal) {
        this.planet.health = Math.min(this.planet.maxHealth, this.planet.health + def.heal);
        this.floater(CENTER, CENTER - PLANET.radius - 30, `+${def.heal} HP`, def.color);
      }
      return;
    }
    this.powers.queue.push({
      id: Math.random().toString(36).slice(2), key: c.key, def,
      timeLeft: def.duration ?? null, usesLeft: def.shots ?? null,
    });
  }

  activatePower(p) {
    this.powers.active.push(p);
    if (p.def.shield) {
      this.planet.shield = {
        type: p.def.shield.type, dp: p.def.shield.dp, maxDp: p.def.shield.dp, power: p, flash: 1,
      };
    }
    sfx.powerOn();
  }

  deactivatePower(p) {
    if (this.planet.shield && this.planet.shield.power === p) this.planet.shield = null;
  }

  updatePowers(dt) {
    const { active, queue } = this.powers;
    for (let i = active.length - 1; i >= 0; i--) {
      const p = active[i];
      if (p.timeLeft != null) p.timeLeft -= dt;
      const shieldGone = p.def.shield && (!this.planet.shield || this.planet.shield.power !== p || this.planet.shield.dp <= 0);
      if ((p.timeLeft != null && p.timeLeft <= 0) || (p.usesLeft != null && p.usesLeft <= 0) || shieldGone) {
        active.splice(i, 1);
        this.deactivatePower(p);
      }
    }
    // Activate queued powers in order, unless an active/earlier-queued power touches the same stats.
    const blocked = new Set(active.flatMap((p) => powerKeys(p.def)));
    for (let i = 0; i < queue.length; ) {
      const p = queue[i];
      const keys = powerKeys(p.def);
      if (keys.some((k) => blocked.has(k))) {
        keys.forEach((k) => blocked.add(k));
        i++;
      } else {
        queue.splice(i, 1);
        keys.forEach((k) => blocked.add(k));
        this.activatePower(p);
      }
    }
  }

  // ---------------------------------------------------------------- damage

  destroyPog(p) {
    p.dead = true;
    this.kills++;
    this.burstParticles(p.x, p.y, p.k.color, 10 + p.r, 60 + p.r * 6, 0.8);
    this.burstParticles(p.x, p.y, '#ffffff', 6, 200, 0.3);
    sfx.explode(p.r > 25);
    if (p.k.splitInto) {
      const sp = Math.hypot(p.vx, p.vy) * 1.25;
      const base = Math.atan2(p.vy, p.vx);
      for (let i = 0; i < p.k.splitCount; i++) {
        const a = base + (i - (p.k.splitCount - 1) / 2) * 0.9;
        this.spawnPog(p.k.splitInto, {
          x: p.x + Math.cos(a) * 10, y: p.y + Math.sin(a) * 10,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        });
      }
    }
  }

  damagePlanet(dmg) {
    const sh = this.planet.shield;
    if (sh) {
      const absorbed = Math.min(sh.dp, dmg);
      sh.dp -= absorbed;
      sh.flash = 1;
      dmg -= absorbed;
      sfx.shieldHit();
    }
    if (dmg > 0) {
      this.planet.health = Math.max(0, this.planet.health - dmg);
      this.planet.flash = 1;
      this.shake = Math.min(18, this.shake + 6 + dmg * 0.4);
      sfx.planetHit();
    }
  }

  die() {
    this.phase = 'dying';
    this.dyingTimer = 1.6;
    this.gun.volleys = [];
    this.planet.shield = null;
    this.shake = 26;
    this.burstParticles(CENTER, CENTER, '#ff9f40', 90, 520, 1.6);
    this.burstParticles(CENTER, CENTER, '#4fa3ff', 60, 360, 1.4);
    this.burstParticles(CENTER, CENTER, '#ffffff', 30, 650, 0.6);
    sfx.gameOver();
  }

  // ---------------------------------------------------------------- update

  update(dt) {
    if (this.phase === 'paused') return;
    this.clock += dt;
    const playing = this.phase === 'playing';
    this.stats = this.computeStats();
    const st = this.stats;
    const gun = this.gun;

    if (playing || this.phase === 'menu') gun.angle = (gun.angle + st.rotationSpeed * dt) % TAU;

    if (playing) {
      this.time += dt;

      gun.cooldown = Math.max(0, gun.cooldown - dt);
      if (gun.fireBuffer > 0) {
        gun.fireBuffer -= dt;
        if (gun.cooldown <= 0) { gun.fireBuffer = 0; this.fire(); }
      }
      for (let i = gun.volleys.length - 1; i >= 0; i--) {
        const v = gun.volleys[i];
        if ((v.delay -= dt) <= 0) { gun.volleys.splice(i, 1); this.fireVolley(v.st); }
      }

      if ((this.spawnTimer -= dt) <= 0) {
        this.spawnTimer = SPAWN.interval(this.time) * rand(0.75, 1.25);
        this.spawnPog(weightedPick(SPAWN.weights(this.time)));
      }
      if ((this.crystalTimer -= dt) <= 0) {
        this.crystalTimer = rand(SPAWN.crystalInterval[0], SPAWN.crystalInterval[1]);
        this.spawnCrystal();
      }
    }

    if (playing || this.phase === 'dying') {
      this.moveEntities(dt);
      if (playing) {
        this.collide();
        this.updatePowers(dt);
        this.stats = this.computeStats();
        if (this.planet.health <= 0) this.die();
      }
    }

    if (this.phase === 'dying' && (this.dyingTimer -= dt) <= 0) {
      this.phase = 'over';
      this.events.onGameOver?.({ time: this.time, kills: this.kills });
    }

    // Cosmetics
    this.planet.flash = Math.max(0, this.planet.flash - dt * 3);
    if (this.planet.shield) this.planet.shield.flash = Math.max(0, this.planet.shield.flash - dt * 4);
    this.shake = Math.max(0, this.shake - dt * 40);
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 1 - dt * 2.2; p.vy *= 1 - dt * 2.2;
      if ((p.life -= dt) <= 0) this.particles.splice(i, 1);
    }
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.y -= 40 * dt;
      if ((f.life -= dt) <= 0) this.floaters.splice(i, 1);
    }
  }

  moveEntities(dt) {
    const away = (o) => (o.x - CENTER) * o.vx + (o.y - CENTER) * o.vy > 0;
    const far = (o) => Math.hypot(o.x - CENTER, o.y - CENTER) > SPAWN.despawnRadius;

    for (const b of this.bullets) {
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.x < -60 || b.y < -60 || b.x > WORLD + 60 || b.y > WORLD + 60) b.dead = true;
    }
    for (const p of this.pogs) {
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.rot += p.spin * dt;
      p.flash = Math.max(0, p.flash - dt * 6);
      if (far(p) && away(p)) p.dead = true;
    }
    for (const c of this.crystals) {
      c.x += c.vx * dt; c.y += c.vy * dt;
      c.rot += dt * 1.2;
      if (far(c) && away(c)) c.dead = true;
    }
    this.sweep();
  }

  collide() {
    for (const b of this.bullets) {
      if (b.dead) continue;
      for (const c of this.crystals) {
        if (c.dead) continue;
        if (Math.hypot(b.x - c.x, b.y - c.y) < b.r + c.r) {
          c.dead = true;
          b.dead = true;
          this.acquirePower(c);
          break;
        }
      }
      if (b.dead) continue;
      for (const p of this.pogs) {
        if (p.dead || b.hit.has(p)) continue;
        if (Math.hypot(b.x - p.x, b.y - p.y) < b.r + p.r * 0.95) {
          b.hit.add(p);
          p.hp -= b.damage;
          p.flash = 1;
          this.burstParticles(b.x, b.y, p.k.color, 5, 160, 0.35);
          if (p.hp <= 0) this.destroyPog(p);
          else sfx.hit();
          if (b.pierce > 0) b.pierce--;
          else { b.dead = true; break; }
        }
      }
    }

    const sh = this.planet.shield;
    for (const p of this.pogs) {
      if (p.dead) continue;
      const dx = p.x - CENTER, dy = p.y - CENTER;
      const dist = Math.hypot(dx, dy);
      if (sh && sh.dp > 0 && dist < SHIELD_RADIUS + p.r * 0.85) {
        if (sh.type === 'reflector') {
          const nx = dx / dist, ny = dy / dist;
          const vn = p.vx * nx + p.vy * ny;
          if (vn < 0) { p.vx -= 2 * vn * nx; p.vy -= 2 * vn * ny; }
          p.x = CENTER + nx * (SHIELD_RADIUS + p.r * 0.85 + 1);
          p.y = CENTER + ny * (SHIELD_RADIUS + p.r * 0.85 + 1);
          sh.dp = Math.max(0, sh.dp - p.k.damage * 0.35);
          sh.flash = 1;
          sfx.shieldHit();
          p.hp -= 1;
          p.flash = 1;
          if (p.hp <= 0) this.destroyPog(p);
        } else {
          this.damagePlanet(p.k.damage);
          this.destroyPog(p);
        }
      } else if (dist < PLANET.radius + p.r * 0.8) {
        this.damagePlanet(p.k.damage);
        p.dead = true;
        this.burstParticles(p.x, p.y, p.k.color, 18, 220, 0.7);
        this.burstParticles(p.x, p.y, '#ff6b4a', 12, 160, 0.6);
      }
    }
    this.sweep();
  }

  sweep() {
    this.bullets = this.bullets.filter((o) => !o.dead);
    this.pogs = this.pogs.filter((o) => !o.dead);
    this.crystals = this.crystals.filter((o) => !o.dead);
  }

  burstParticles(x, y, color, n, speed, life, dir = null) {
    n = Math.round(n);
    for (let i = 0; i < n && this.particles.length < MAX_PARTICLES; i++) {
      const a = dir == null ? rand(0, TAU) : dir + rand(-0.5, 0.5);
      const s = rand(0.2, 1) * speed;
      const l = rand(0.5, 1) * life;
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: l, maxLife: l, size: rand(1.5, 4), color });
    }
  }

  floater(x, y, text, color) {
    this.floaters.push({ x, y, text, color, life: 1.4, maxLife: 1.4 });
  }

  // ---------------------------------------------------------------- render

  render() {
    const { canvas, ctx } = this;
    const s = canvas.width / WORLD;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#05060d';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const sx = this.shake ? rand(-1, 1) * this.shake : 0;
    const sy = this.shake ? rand(-1, 1) * this.shake : 0;
    ctx.setTransform(s, 0, 0, s, sx * s, sy * s);

    this.drawStars(ctx);
    if (this.phase !== 'dying' && this.phase !== 'over') {
      this.drawAimGuides(ctx);
      this.drawPlanet(ctx);
      this.drawGun(ctx);
      this.drawShield(ctx);
    }
    for (const c of this.crystals) this.drawCrystal(ctx, c);
    for (const p of this.pogs) this.drawPog(ctx, p);
    this.drawBullets(ctx);
    this.drawParticles(ctx);
    this.drawFloaters(ctx);
  }

  drawStars(ctx) {
    ctx.fillStyle = '#ffffff';
    for (const st of this.stars) {
      ctx.globalAlpha = 0.35 + 0.35 * Math.sin(this.clock * st.s + st.p);
      ctx.fillRect(st.x, st.y, st.r, st.r);
    }
    ctx.globalAlpha = 1;
  }

  drawAimGuides(ctx) {
    const st = this.stats;
    const r0 = PLANET.radius + GUN.length + 8;
    ctx.save();
    ctx.setLineDash([6, 14]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.09)';
    ctx.beginPath();
    for (let i = 0; i < st.barrels; i++) {
      const a = this.gun.angle + (i * TAU) / st.barrels;
      ctx.moveTo(CENTER + Math.cos(a) * r0, CENTER + Math.sin(a) * r0);
      ctx.lineTo(CENTER + Math.cos(a) * WORLD, CENTER + Math.sin(a) * WORLD);
    }
    ctx.stroke();
    ctx.restore();
  }

  drawPlanet(ctx) {
    const R = PLANET.radius;
    const pl = this.planet;
    // Atmosphere glow
    const glow = ctx.createRadialGradient(CENTER, CENTER, R * 0.9, CENTER, CENTER, R * 1.6);
    glow.addColorStop(0, 'rgba(90,170,255,0.35)');
    glow.addColorStop(1, 'rgba(90,170,255,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(CENTER, CENTER, R * 1.6, 0, TAU); ctx.fill();

    ctx.save();
    ctx.beginPath(); ctx.arc(CENTER, CENTER, R, 0, TAU); ctx.clip();
    const body = ctx.createRadialGradient(CENTER - R * 0.35, CENTER - R * 0.35, R * 0.1, CENTER, CENTER, R);
    body.addColorStop(0, '#6fc0ff');
    body.addColorStop(1, '#173a8a');
    ctx.fillStyle = body;
    ctx.fillRect(CENTER - R, CENTER - R, R * 2, R * 2);
    ctx.fillStyle = 'rgba(80,210,140,0.75)';
    const turn = this.clock * 0.08;
    for (const c of this.continents) {
      const x = CENTER + Math.cos(c.a + turn) * c.d;
      const y = CENTER + Math.sin(c.a + turn) * c.d * 0.9;
      ctx.beginPath(); ctx.arc(x, y, c.r, 0, TAU); ctx.fill();
    }
    // Night side shading
    const shade = ctx.createRadialGradient(CENTER - R * 0.5, CENTER - R * 0.5, R * 0.4, CENTER, CENTER, R * 1.25);
    shade.addColorStop(0, 'rgba(0,0,0,0)');
    shade.addColorStop(1, 'rgba(0,0,20,0.65)');
    ctx.fillStyle = shade;
    ctx.fillRect(CENTER - R, CENTER - R, R * 2, R * 2);
    // Damage tint + hit flash
    const dmg = 1 - pl.health / pl.maxHealth;
    ctx.fillStyle = `rgba(255,60,40,${dmg * 0.35 + pl.flash * 0.5})`;
    ctx.fillRect(CENTER - R, CENTER - R, R * 2, R * 2);
    ctx.restore();

    // Reload ring
    const st = this.stats;
    const ready = 1 - Math.min(1, this.gun.cooldown / st.reloadTime);
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath(); ctx.arc(CENTER, CENTER, R + 10, 0, TAU); ctx.stroke();
    ctx.strokeStyle = ready >= 1 ? 'rgba(160,255,200,0.7)' : 'rgba(255,220,120,0.8)';
    ctx.beginPath(); ctx.arc(CENTER, CENTER, R + 10, -Math.PI / 2, -Math.PI / 2 + ready * TAU); ctx.stroke();
  }

  drawGun(ctx) {
    const st = this.stats;
    const R = PLANET.radius;
    const ammo = AMMO[st.ammo] || AMMO.standard;
    const recoil = this.gun.cooldown > st.reloadTime - 0.06 ? 5 : 0;
    for (let i = 0; i < st.barrels; i++) {
      const a = this.gun.angle + (i * TAU) / st.barrels;
      ctx.save();
      ctx.translate(CENTER, CENTER);
      ctx.rotate(a);
      // mount
      ctx.fillStyle = '#2a3350';
      ctx.strokeStyle = '#9fb4ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(R - 2, 0, 13, 0, TAU);
      ctx.fill(); ctx.stroke();
      // barrel(s) — spread shows as a wider muzzle
      const w = st.spread > 1 ? 14 : 9;
      ctx.fillStyle = '#d9e2ff';
      ctx.fillRect(R - recoil, -w / 2, GUN.length, w);
      ctx.fillStyle = ammo.color;
      ctx.fillRect(R - recoil + GUN.length - 6, -w / 2, 6, w);
      ctx.restore();
    }
  }

  drawShield(ctx) {
    const sh = this.planet.shield;
    if (!sh) return;
    const color = SHIELD_TYPES[sh.type]?.color || '#6ff7d4';
    const p = sh.power;
    const ending = p.timeLeft != null && p.timeLeft < 2.5;
    let alpha = 0.25 + 0.55 * (sh.dp / sh.maxDp) + sh.flash * 0.4;
    if (ending && Math.sin(this.clock * 20) > 0) alpha *= 0.35;
    ctx.save();
    ctx.globalAlpha = Math.min(1, alpha);
    const g = ctx.createRadialGradient(CENTER, CENTER, SHIELD_RADIUS * 0.7, CENTER, CENTER, SHIELD_RADIUS);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, color + '55');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(CENTER, CENTER, SHIELD_RADIUS, 0, TAU); ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    if (sh.type === 'reflector') ctx.setLineDash([14, 8]);
    ctx.lineDashOffset = -this.clock * 30;
    ctx.beginPath(); ctx.arc(CENTER, CENTER, SHIELD_RADIUS, 0, TAU); ctx.stroke();
    ctx.restore();
  }

  drawPog(ctx, p) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    const n = p.shape.length;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      const r = p.r * p.shape[i];
      if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    const g = ctx.createRadialGradient(-p.r * 0.35, -p.r * 0.35, p.r * 0.1, 0, 0, p.r * 1.1);
    g.addColorStop(0, p.k.color);
    g.addColorStop(1, p.k.dark);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = p.k.dark;
    ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    for (const c of p.craters) {
      ctx.beginPath();
      ctx.arc(Math.cos(c.a) * c.d * p.r, Math.sin(c.a) * c.d * p.r, c.r * p.r, 0, TAU);
      ctx.fill();
    }
    if (p.flash > 0) {
      ctx.globalAlpha = p.flash * 0.8;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(0, 0, p.r, 0, TAU); ctx.fill();
    }
    ctx.restore();
    if (p.maxHp > 1 && p.hp < p.maxHp) {
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r + 7, -Math.PI / 2, -Math.PI / 2 + (p.hp / p.maxHp) * TAU);
      ctx.stroke();
    }
  }

  drawCrystal(ctx, c) {
    const pulse = 1 + Math.sin(this.clock * 6) * 0.08;
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.save();
    ctx.rotate(c.rot);
    const hex = (r) => {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
    };
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = c.def.color;
    hex(c.r * 1.55 * pulse); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#0b1020';
    ctx.strokeStyle = c.def.color;
    ctx.lineWidth = 3;
    hex(c.r); ctx.fill(); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = c.def.color;
    ctx.font = 'bold 17px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(c.def.glyph, 0, 1);
    ctx.restore();
  }

  drawBullets(ctx) {
    for (const b of this.bullets) {
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = b.color;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 2.2, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
    }
  }

  drawParticles(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.restore();
  }

  drawFloaters(ctx) {
    ctx.save();
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const f of this.floaters) {
      ctx.globalAlpha = Math.min(1, (f.life / f.maxLife) * 1.5);
      ctx.fillStyle = f.color;
      const x = Math.max(110, Math.min(WORLD - 110, f.x));
      const y = Math.max(30, Math.min(WORLD - 30, f.y));
      ctx.fillText(f.text, x, y);
    }
    ctx.restore();
  }
}
