// All gameplay tunables live here so balancing never requires touching game logic.

export const GAME_URL = "https://tanaysoley.com/experiments/pog2/";

export const WORLD = 1000; // logical size of the square play area
export const CENTER = WORLD / 2;

export const PLANET = {
  radius: 62,
  maxHealth: 100, // planet defence points
  shieldPadding: 34, // shield bubble sits this far outside the surface
};

// Base gun + ammo parameters. Powers modify these keys (see POWERS[*].mods).
export const GUN = {
  rotationSpeed: 3.14, // radians / second (~2.6s per revolution)
  barrels: 1, // barrels are spaced equally around 360°
  reloadTime: 0.32, // seconds between shots
  length: 30, // barrel length in world units
  ammo: "standard", // key into AMMO
  burst: 1, // projectiles per shot, fired one after the other
  burstInterval: 0.07, // seconds between burst projectiles
  spread: 1, // projectiles per shot, fanned out at the same time
  spreadAngle: 0, // total fan angle in radians
};

export const AMMO = {
  standard: {
    name: "Standard",
    damage: 1,
    speed: 950,
    radius: 5,
    pierce: 0,
    color: "#e9f7ff",
  },
  heavy: {
    name: "Heavy",
    damage: 3,
    speed: 780,
    radius: 8,
    pierce: 0,
    color: "#ffd166",
  },
  piercing: {
    name: "Piercing",
    damage: 1,
    speed: 1250,
    radius: 4,
    pierce: 3,
    color: "#7df9ff",
  },
};

// Homing: bullets are pulled towards every POG and power crystal within `range`.
// Acceleration = strength * (refDistance / d)^exponent, i.e. inversely proportional to d^exponent,
// normalised so `strength` is the pull felt at `refDistance` (changing the exponent keeps it sane).
// Bullet speed is clamped to `maxSpeed` so a close pass can't fling it.
export const HOMING = {
  enabled: true,
  range: 220, // world units from the POG's centre
  exponent: 1.5, // n in 1 / d^n
  strength: 4000, // units/s² at refDistance
  refDistance: 100,
  minDistance: 15, // distance floor to avoid the singularity at d → 0
  maxSpeed: 1300, // units/s
};

// POG types. hp = health, damage = what it does to the planet/shield on impact.
export const POGS = {
  green: {
    name: "Green",
    hp: 1,
    radius: 15,
    speed: [120, 160],
    damage: 7,
    color: "#58f08a",
    dark: "#1d6b3c",
  },
  orange: {
    name: "Orange",
    hp: 2,
    radius: 23,
    speed: [85, 115],
    damage: 12,
    color: "#ffa040",
    dark: "#8f4508",
  },
  pink: {
    name: "Pink",
    hp: 3,
    radius: 33,
    speed: [55, 80],
    damage: 20,
    color: "#ff5fa8",
    dark: "#86204f",
    splitInto: "green",
    splitCount: 2,
  },
};

export const SPAWN = {
  radius: 745, // pogs appear on this circle (just outside the square's corners)
  despawnRadius: 800, // and are removed past this once moving away
  missSpread: 260, // max sideways offset of a pog's aim point (bigger = more misses)
  interval: (t) => Math.max(0.45, 2.0 / (1 + t / 70)),
  weights: (t) => [
    ["green", 1],
    ["orange", 0.8 * clamp01((t - 15) / 35)],
    ["pink", 0.5 * clamp01((t - 40) / 50)],
  ],
  speedMul: (t) => 1 + Math.min(0.6, t / 300),
  hpBonus: (t) => Math.floor(t / 120), // extra hp for pogs with base hp > 1
  firstCrystal: 6, // seconds until the first power crystal
  crystalInterval: [9, 15],
  crystalSpeed: [85, 115],
};

// Powers: shoot a crystal to collect one. Non-instant powers are queued.
// A queued power activates as soon as no active (or earlier queued) power touches
// the same stat keys, so e.g. a shield and a gun power run simultaneously.
// Limits: `duration` (seconds) and/or `shots` (trigger pulls) — whichever runs out first.
export const POWERS = {
  rapid: {
    name: "Rapid Fire",
    glyph: "R",
    color: "#ffe066",
    weight: 3,
    mods: { reloadTime: { mul: 0.4 } },
    duration: 8,
  },
  twin: {
    name: "Twin Barrels",
    glyph: "2x",
    color: "#8ecbff",
    weight: 3,
    mods: { barrels: { set: 2 } },
    duration: 12,
  },
  quad: {
    name: "Quad Barrels",
    glyph: "4x",
    color: "#5aa9ff",
    weight: 1.5,
    mods: { barrels: { set: 4 } },
    shots: 20,
  },
  spread: {
    name: "Spread Shot",
    glyph: "SP",
    color: "#c18bff",
    weight: 3,
    mods: { spread: { set: 3 }, spreadAngle: { set: 0.4 } },
    duration: 15,
    shots: 30,
  },
  burst: {
    name: "Burst Fire",
    glyph: "B3",
    color: "#ff8bd1",
    weight: 2.5,
    mods: { burst: { set: 3 } },
    shots: 20,
  },
  heavy: {
    name: "Heavy Rounds",
    glyph: "H",
    color: "#ffd166",
    weight: 2,
    mods: { ammo: { set: "heavy" } },
    shots: 20,
  },
  piercing: {
    name: "Piercing Rounds",
    glyph: "P",
    color: "#7df9ff",
    weight: 2,
    mods: { ammo: { set: "piercing" } },
    shots: 25,
  },
  barrier: {
    name: "Barrier Shield",
    glyph: "S",
    color: "#6ff7d4",
    weight: 2.5,
    shield: { type: "barrier", dp: 60 },
    duration: 15,
  },
  reflector: {
    name: "Reflector Shield",
    glyph: "RS",
    color: "#b6ff6b",
    weight: 1.5,
    shield: { type: "reflector", dp: 80 },
    duration: 10,
  },
  repair: {
    name: "Repair",
    glyph: "+",
    color: "#ff6b6b",
    weight: 2,
    instant: true,
    heal: 30,
  },
};

export const SHIELD_TYPES = {
  barrier: { name: "Barrier", color: "#6ff7d4", note: "absorbs impacts" },
  reflector: { name: "Reflector", color: "#b6ff6b", note: "bounces pogs away" },
};

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}
