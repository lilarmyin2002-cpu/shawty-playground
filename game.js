// Flower Meadow: a tiny pixel lobby.
// The girl is the player (WASD / arrow keys). The boy wanders on his own,
// and every so often picks a flower and brings it to her.

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const VIEW_W = canvas.width;
const VIEW_H = canvas.height;
const WORLD_W = 960;
const WORLD_H = 600;
// Walkable area (keeps characters off the tree line at the top).
const BOUNDS = { x0: 20, y0: 110, x1: WORLD_W - 20, y1: WORLD_H - 10 };

// Sprite sheets: 40x60 frames, feet at the bottom centre.
// Rows: 0 = down, 1 = right (mirrored for left), 2 = up.
// Boy row 3: crouch-pick, hold, walk-holding, give.
const FRAME_W = 40;
const FRAME_H = 60;
const ROW = { down: 0, right: 1, left: 1, up: 2 };

// Deterministic random so the meadow looks the same on every load.
function rng(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
const rand = Math.random;
const between = (a, b) => a + rand() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load ' + src));
    img.src = src;
  });
}

// ---------------------------------------------------------------- flowers

const FLOWER_COLORS = [
  { petal: '#ff3b5c', dark: '#c21f3f' }, // red
  { petal: '#ffd21f', dark: '#e09a00' }, // yellow
  { petal: '#3fa9ff', dark: '#1f6fd0' }, // blue
  { petal: '#c05cff', dark: '#8a2fd0' }, // purple
  { petal: '#ff8a1f', dark: '#d05a00' }, // orange
  { petal: '#ffffff', dark: '#c9d4e8' }, // white
  { petal: '#ff6ec7', dark: '#d03a95' }, // pink
];

function px(c, x, y, w = 1, h = 1) {
  c.fillRect(Math.round(x), Math.round(y), w, h);
}

// A flower drawn with its stem base at (x, y). `u` is the size of one art
// pixel: 2 for flowers in the meadow, 1 when held or in the HUD.
function drawFlower(c, x, y, color, grow = 1, u = 1) {
  const p = (dx, dy, w = 1, h = 1) => c.fillRect(Math.round(x) + dx * u, Math.round(y) + dy * u, w * u, h * u);
  const stem = Math.max(1, Math.round(7 * grow));
  c.fillStyle = '#1f8a2c';
  p(0, -stem, 1, stem);
  if (grow > 0.5) {
    c.fillStyle = '#34b83f';
    p(-2, -3, 2, 1);
    p(1, -4, 2, 1);
  }
  if (grow < 0.6) return;
  const cy = -stem - 2;
  c.fillStyle = color.dark;
  p(-3, cy - 1, 1, 3);
  p(3, cy - 1, 1, 3);
  p(-1, cy - 3, 3, 1);
  p(-1, cy + 3, 3, 1);
  c.fillStyle = color.petal;
  p(-2, cy - 2, 5, 5);
  c.fillStyle = color.dark;
  p(-2, cy - 2);
  p(2, cy - 2);
  p(-2, cy + 2);
  p(2, cy + 2);
  c.fillStyle = '#ffe14a';
  p(-1, cy - 1, 3, 3);
  c.fillStyle = '#b86b00';
  p(0, cy);
}

// ------------------------------------------------------------- background

function buildMeadow() {
  const bg = document.createElement('canvas');
  bg.width = WORLD_W;
  bg.height = WORLD_H;
  const c = bg.getContext('2d');
  const r = rng(7);

  // Grass: 16px tiles in a few bright greens.
  const greens = ['#5fd34a', '#5cd047', '#62d64d', '#5ad045'];
  for (let ty = 0; ty < WORLD_H; ty += 16) {
    for (let tx = 0; tx < WORLD_W; tx += 16) {
      c.fillStyle = greens[Math.floor(r() * greens.length)];
      c.fillRect(tx, ty, 16, 16);
    }
  }
  // Light patches and grass tufts.
  for (let i = 0; i < 90; i++) {
    const x = r() * WORLD_W, y = r() * WORLD_H;
    c.fillStyle = '#74e35e';
    for (let j = 0; j < 14; j++) px(c, x + r() * 24, y + r() * 12, 2, 2);
  }
  for (let i = 0; i < 700; i++) {
    const x = r() * WORLD_W, y = r() * WORLD_H;
    c.fillStyle = r() < 0.5 ? '#3fae35' : '#8af06c';
    px(c, x, y, 1, 2);
    px(c, x + 2, y - 1, 1, 3);
    px(c, x + 4, y, 1, 2);
  }

  // Dirt path winding across the meadow.
  for (let x = -10; x < WORLD_W + 10; x += 2) {
    const y = 380 + Math.sin(x / 90) * 40 + Math.sin(x / 37) * 8;
    c.fillStyle = '#e8c27a';
    c.fillRect(x, y - 9, 3, 18);
    c.fillStyle = '#d9ad5f';
    c.fillRect(x, y + 7, 3, 2);
    c.fillStyle = '#f3d79a';
    c.fillRect(x, y - 9, 3, 2);
  }
  for (let i = 0; i < 60; i++) {
    const x = r() * WORLD_W;
    const y = 380 + Math.sin(x / 90) * 40 + Math.sin(x / 37) * 8 + (r() - 0.5) * 12;
    c.fillStyle = '#c99a4e';
    px(c, x, y, 2, 1);
  }

  // Pond.
  const pond = { x: 790, y: 500, rx: 70, ry: 34 };
  c.fillStyle = '#2f9e3a';
  ellipse(c, pond.x, pond.y + 3, pond.rx + 4, pond.ry + 4);
  c.fillStyle = '#2aa7e8';
  ellipse(c, pond.x, pond.y, pond.rx, pond.ry);
  c.fillStyle = '#56c6ff';
  ellipse(c, pond.x - 10, pond.y - 6, pond.rx - 22, pond.ry - 14);
  c.fillStyle = '#b8ecff';
  px(c, pond.x - 30, pond.y - 12, 10, 2);
  px(c, pond.x + 12, pond.y + 4, 8, 2);
  for (const [lx, ly] of [[760, 505], [820, 490], [805, 518]]) {
    c.fillStyle = '#2fb84a';
    ellipse(c, lx, ly, 7, 4);
    c.fillStyle = '#ff9ad5';
    px(c, lx - 1, ly - 2, 3, 2);
  }

  // Decorative flower carpets (not pickable).
  const dots = ['#ff3b5c', '#ffd21f', '#3fa9ff', '#c05cff', '#ffffff', '#ff8a1f', '#ff6ec7'];
  for (let i = 0; i < 26; i++) {
    const cx = r() * WORLD_W, cy = 120 + r() * (WORLD_H - 120);
    if (Math.abs(cx - pond.x) < 110 && Math.abs(cy - pond.y) < 60) continue;
    const col = dots[Math.floor(r() * dots.length)];
    for (let j = 0; j < 18; j++) {
      const x = cx + (r() - 0.5) * 60, y = cy + (r() - 0.5) * 30;
      c.fillStyle = col;
      px(c, x - 1, y, 3, 1);
      px(c, x, y - 1, 1, 3);
      c.fillStyle = '#fff3a0';
      px(c, x, y);
    }
  }
  for (let i = 0; i < 160; i++) {
    const x = r() * WORLD_W, y = 110 + r() * (WORLD_H - 110);
    c.fillStyle = dots[Math.floor(r() * dots.length)];
    px(c, x, y, 2, 2);
  }

  // Tree line along the top.
  c.fillStyle = '#2f9e3a';
  c.fillRect(0, 0, WORLD_W, 70);
  for (let x = -20; x < WORLD_W + 40; x += 34 + r() * 16) {
    drawTree(c, x, 70 + r() * 30, r);
  }
  return bg;
}

function ellipse(c, x, y, rx, ry) {
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  c.fill();
}

function drawTree(c, x, y, r) {
  c.fillStyle = 'rgba(0,0,0,0.18)';
  ellipse(c, x, y, 22, 7);
  c.fillStyle = '#8a5a2b';
  c.fillRect(x - 5, y - 26, 10, 26);
  c.fillStyle = '#6b4220';
  c.fillRect(x + 2, y - 26, 3, 26);
  const leaf = ['#1f8f3a', '#27a844', '#35c252'];
  const blobs = [[0, -50, 28], [-18, -38, 18], [18, -38, 18], [0, -66, 18]];
  leaf.forEach((col, i) => {
    c.fillStyle = col;
    for (const [dx, dy, rad] of blobs) {
      ellipse(c, x + dx - i * 3, y + dy - i * 4, rad - i * 6, rad - i * 6);
    }
  });
  if (r() < 0.4) {
    c.fillStyle = '#ff4d6d';
    for (let i = 0; i < 5; i++) px(c, x + (r() - 0.5) * 36, y - 40 - r() * 30, 3, 3);
  }
}

// -------------------------------------------------------------- characters

class Character {
  constructor(sheet, x, y, speed) {
    this.sheet = sheet;
    this.x = x;
    this.y = y;
    this.speed = speed;
    this.dir = 'down';
    this.moving = false;
    this.animTime = 0;
    this.pose = null; // [row, col] override for special poses
  }

  // Move toward (tx, ty); returns true once arrived.
  walkTo(tx, ty, dt) {
    const dx = tx - this.x, dy = ty - this.y;
    const d = Math.hypot(dx, dy);
    if (d < 2) {
      this.moving = false;
      return true;
    }
    const step = Math.min(d, this.speed * dt);
    this.move(dx / d * step, dy / d * step);
    return false;
  }

  move(dx, dy) {
    this.x = clamp(this.x + dx, BOUNDS.x0, BOUNDS.x1);
    this.y = clamp(this.y + dy, BOUNDS.y0, BOUNDS.y1);
    this.moving = dx !== 0 || dy !== 0;
    if (Math.abs(dx) > Math.abs(dy)) this.dir = dx > 0 ? 'right' : 'left';
    else if (dy !== 0) this.dir = dy > 0 ? 'down' : 'up';
  }

  face(target) {
    const dx = target.x - this.x, dy = target.y - this.y;
    if (Math.abs(dx) > Math.abs(dy)) this.dir = dx > 0 ? 'right' : 'left';
    else this.dir = dy > 0 ? 'down' : 'up';
  }

  update(dt) {
    this.animTime = this.moving ? this.animTime + dt : 0;
  }

  frame() {
    if (this.pose) return this.pose;
    // Walk cycle columns: 0 step, 1 stand, 2 step, 3 stand.
    const col = this.moving ? Math.floor(this.animTime * 8) % 4 : 1;
    return [ROW[this.dir], col];
  }

  draw(c, cam) {
    const sx = Math.round(this.x - cam.x);
    const sy = Math.round(this.y - cam.y);
    c.fillStyle = 'rgba(0,0,0,0.22)';
    ellipse(c, sx, sy - 1, 11, 4);
    const [row, col] = this.frame();
    const flip = this.dir === 'left' && !this.pose;
    c.save();
    c.translate(sx, sy);
    if (flip) c.scale(-1, 1);
    c.drawImage(this.sheet, col * FRAME_W, row * FRAME_H, FRAME_W, FRAME_H,
      -FRAME_W / 2, -FRAME_H, FRAME_W, FRAME_H);
    c.restore();
  }
}

class Boy extends Character {
  constructor(sheet, x, y) {
    super(sheet, x, y, 48);
    this.state = 'wander';
    this.timer = 0;
    this.urge = between(5, 9); // seconds until he wants to pick a flower
    this.target = null;
    this.flower = null; // flower being fetched or carried
    this.carrying = null;
    this.pause = 0;
  }

  update(dt, world) {
    this.pose = null;
    this.timer += dt;
    const girl = world.girl;

    switch (this.state) {
      case 'wander': {
        this.urge -= dt;
        if (this.urge <= 0 && world.flowers.some(f => f.grow >= 1 && !f.claimed)) {
          this.pickTarget(world);
          break;
        }
        if (this.pause > 0) {
          this.pause -= dt;
          this.moving = false;
          if (dist(this, girl) < 90) this.face(girl);
          break;
        }
        if (!this.target) {
          // Mostly hang around near the girl, sometimes explore.
          const anchor = rand() < 0.7 ? girl : { x: between(BOUNDS.x0, BOUNDS.x1), y: between(BOUNDS.y0, BOUNDS.y1) };
          this.target = {
            x: clamp(anchor.x + between(-120, 120), BOUNDS.x0, BOUNDS.x1),
            y: clamp(anchor.y + between(-70, 70), BOUNDS.y0, BOUNDS.y1),
          };
        }
        if (this.walkTo(this.target.x, this.target.y, dt)) {
          this.target = null;
          this.pause = between(0.8, 2.5);
        }
        break;
      }

      case 'seek': {
        if (this.walkTo(this.flower.x + 12, this.flower.y + 1, dt)) {
          this.state = 'pick';
          this.timer = 0;
        }
        break;
      }

      case 'pick': {
        this.moving = false;
        this.dir = 'down';
        this.pose = [3, 0];
        if (this.timer > 1.0) {
          world.pickFlower(this.flower);
          this.carrying = this.flower.color;
          this.flower = null;
          this.state = 'show';
          this.timer = 0;
          world.bubble(this, '!');
        }
        break;
      }

      case 'show': {
        // Look at the flower for a moment before heading over.
        this.pose = [3, 1];
        if (this.timer > 0.9) this.state = 'carry';
        break;
      }

      case 'carry': {
        // Stand beside her, on whichever side he is already on.
        const side = this.x < girl.x ? -1 : 1;
        const tx = clamp(girl.x + side * 26, BOUNDS.x0, BOUNDS.x1);
        if (this.walkTo(tx, girl.y + 2, dt)) {
          this.state = 'give';
          this.timer = 0;
        } else if (this.dir === 'down') {
          this.pose = [3, Math.floor(this.animTime * 4) % 2 ? 2 : 1];
        }
        break;
      }

      case 'give': {
        this.moving = false;
        this.dir = 'down';
        // Hold it out, then stand normally once she has taken it.
        this.pose = this.carrying ? [3, 3] : [0, 1];
        if (dist(this, girl) > 40) {
          this.state = 'carry'; // she walked off, follow her
          break;
        }
        if (this.timer > 0.4 && this.carrying) {
          world.receiveFlower(this.carrying);
          this.carrying = null;
        }
        if (this.timer > 1.6) {
          this.state = 'wander';
          this.urge = between(7, 14);
          this.pause = between(0.5, 1.5);
          this.target = null;
        }
        break;
      }
    }
    super.update(dt);
  }

  pickTarget(world) {
    const options = world.flowers.filter(f => f.grow >= 1 && !f.claimed);
    options.sort((a, b) => dist(this, a) - dist(this, b));
    // Prefer a close flower, with a bit of randomness.
    this.flower = options[Math.floor(rand() * Math.min(3, options.length))];
    this.flower.claimed = true;
    this.state = 'seek';
    this.target = null;
  }

  draw(c, cam) {
    if (!this.carrying) return super.draw(c, cam);
    // The flower poses have a red rose baked in; paint the real flower over it.
    const poseOffsets = { 1: [11, -25], 2: [12, -25], 3: [-1, -22] };
    const walkOffsets = { right: [9, -18], left: [-9, -18], down: [10, -20], up: [-8, -22] };
    const offset = this.pose ? poseOffsets[this.pose[1]] : walkOffsets[this.dir];
    if (!offset) return super.draw(c, cam);
    const [ox, oy] = offset;
    const drawHeld = () => drawFlower(c, Math.round(this.x - cam.x + ox), Math.round(this.y - cam.y + oy), this.carrying);
    // Held behind him when walking away.
    if (!this.pose && this.dir === 'up') drawHeld();
    super.draw(c, cam);
    if (this.pose || this.dir !== 'up') drawHeld();
  }
}

// ------------------------------------------------------------------- world

const keys = new Set();
const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
};
addEventListener('keydown', e => {
  if (KEYMAP[e.code]) {
    keys.add(KEYMAP[e.code]);
    e.preventDefault();
  }
});
addEventListener('keyup', e => keys.delete(KEYMAP[e.code]));
addEventListener('blur', () => keys.clear());
// When embedded (e.g. in Streamlit) the game lives in an iframe and only
// hears the keyboard once it has focus.
canvas.addEventListener('pointerdown', () => window.focus());

class World {
  constructor(images) {
    this.meadow = buildMeadow();
    this.girl = new Character(images.girl, 420, 300, 72);
    this.boy = new Boy(images.boy, 520, 330);
    this.flowers = [];
    this.effects = [];
    this.butterflies = [];
    this.received = 0;
    this.lastColor = null;
    this.bouquetPulse = 0;
    this.time = 0;
    this.cam = { x: 0, y: 0 };
    for (let i = 0; i < 16; i++) this.spawnFlower(1);
    for (let i = 0; i < 5; i++) {
      this.butterflies.push({
        x: between(0, WORLD_W), y: between(120, WORLD_H), vx: 0, vy: 0,
        color: FLOWER_COLORS[Math.floor(rand() * FLOWER_COLORS.length)].petal,
        phase: rand() * 10,
      });
    }
  }

  spawnFlower(grow = 0) {
    let x, y;
    do {
      x = between(BOUNDS.x0 + 20, BOUNDS.x1 - 20);
      y = between(BOUNDS.y0 + 20, BOUNDS.y1 - 10);
    } while (Math.abs(x - 790) < 90 && Math.abs(y - 500) < 50); // not in the pond
    this.flowers.push({
      x, y, grow, claimed: false,
      color: FLOWER_COLORS[Math.floor(rand() * FLOWER_COLORS.length)],
    });
  }

  pickFlower(flower) {
    this.flowers.splice(this.flowers.indexOf(flower), 1);
    this.effects.push({ type: 'sparkle', x: flower.x, y: flower.y - 18, t: 0 });
    setTimeout(() => this.spawnFlower(0), 4000 + rand() * 4000);
  }

  receiveFlower(color) {
    this.received++;
    this.lastColor = color;
    this.bouquetPulse = 1;
    for (let i = 0; i < 6; i++) {
      this.effects.push({
        type: 'heart', x: (this.girl.x + this.boy.x) / 2 + between(-10, 10),
        y: this.girl.y - 56, vx: between(-12, 12), t: -i * 0.12,
      });
    }
  }

  bubble(who, text) {
    this.effects.push({ type: 'bubble', who, text, t: 0 });
  }

  update(dt) {
    this.time += dt;
    const g = this.girl;
    let dx = 0, dy = 0;
    if (keys.has('left')) dx -= 1;
    if (keys.has('right')) dx += 1;
    if (keys.has('up')) dy -= 1;
    if (keys.has('down')) dy += 1;
    if (dx || dy) {
      const len = Math.hypot(dx, dy);
      g.move(dx / len * g.speed * dt, dy / len * g.speed * dt);
    } else {
      g.moving = false;
      if (this.boy.state === 'give') g.face(this.boy);
    }
    g.update(dt);
    this.boy.update(dt, this);

    for (const f of this.flowers) f.grow = Math.min(1, f.grow + dt * 0.5);
    for (const e of this.effects) e.t += dt;
    this.effects = this.effects.filter(e => e.t < (e.type === 'bubble' ? 1.2 : 1.6));
    this.bouquetPulse = Math.max(0, this.bouquetPulse - dt * 2);

    for (const b of this.butterflies) {
      b.phase += dt;
      b.vx += (rand() - 0.5) * 60 * dt;
      b.vy += (rand() - 0.5) * 60 * dt;
      b.vx = clamp(b.vx, -25, 25);
      b.vy = clamp(b.vy, -18, 18);
      b.x = (b.x + b.vx * dt + WORLD_W) % WORLD_W;
      b.y = clamp(b.y + b.vy * dt, 110, WORLD_H - 10);
    }

    // Camera follows the girl.
    this.cam.x = clamp(g.x - VIEW_W / 2, 0, WORLD_W - VIEW_W);
    this.cam.y = clamp(g.y - 30 - VIEW_H / 2, 0, WORLD_H - VIEW_H);
  }

  draw(c) {
    const cam = { x: Math.round(this.cam.x), y: Math.round(this.cam.y) };
    c.drawImage(this.meadow, -cam.x, -cam.y);

    // Everything standing on the ground is drawn back-to-front by y.
    const things = [
      ...this.flowers.map(f => ({ y: f.y, draw: () => {
        const sway = f.grow >= 1 ? Math.round(Math.sin(this.time * 2 + f.x) * 0.6) : 0;
        drawFlower(c, f.x - cam.x + sway, f.y - cam.y, f.color, f.grow, 2);
      } })),
      { y: this.girl.y, draw: () => this.drawGirl(c, cam) },
      { y: this.boy.y, draw: () => this.boy.draw(c, cam) },
    ];
    things.sort((a, b) => a.y - b.y);
    for (const t of things) t.draw();

    for (const b of this.butterflies) {
      const flap = Math.sin(b.phase * 18) > 0;
      const x = Math.round(b.x - cam.x), y = Math.round(b.y - cam.y - 20);
      c.fillStyle = b.color;
      if (flap) {
        px(c, x - 3, y - 1, 2, 3);
        px(c, x + 2, y - 1, 2, 3);
      } else {
        px(c, x - 2, y, 1, 2);
        px(c, x + 2, y, 1, 2);
      }
      c.fillStyle = '#3a2a1a';
      px(c, x, y - 1, 1, 3);
    }

    for (const e of this.effects) this.drawEffect(c, cam, e);
    this.drawHud(c);
  }

  drawGirl(c, cam) {
    this.girl.draw(c, cam);
    // After her first flower she holds the latest one.
    if (!this.lastColor || this.girl.dir === 'up') return;
    const offsets = { right: [8, -17], left: [-8, -17], down: [-10, -18] };
    const [ox, oy] = offsets[this.girl.dir];
    const bob = this.girl.moving ? Math.floor(this.girl.animTime * 8) % 2 : 0;
    drawFlower(c, Math.round(this.girl.x - cam.x + ox), Math.round(this.girl.y - cam.y + oy + bob), this.lastColor);
  }

  drawEffect(c, cam, e) {
    if (e.t < 0) return;
    if (e.type === 'heart') {
      const x = Math.round(e.x + e.vx * e.t - cam.x);
      const y = Math.round(e.y - e.t * 26 - cam.y);
      c.globalAlpha = Math.max(0, 1 - e.t / 1.6);
      drawHeart(c, x, y);
      c.globalAlpha = 1;
    } else if (e.type === 'sparkle') {
      c.fillStyle = '#fff7a8';
      const r = 3 + e.t * 12;
      c.globalAlpha = Math.max(0, 1 - e.t / 0.8);
      for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3 + e.t * 2;
        px(c, e.x - cam.x + Math.cos(a) * r, e.y - cam.y + Math.sin(a) * r, 2, 2);
      }
      c.globalAlpha = 1;
    } else if (e.type === 'bubble') {
      const x = Math.round(e.who.x - cam.x);
      const y = Math.round(e.who.y - cam.y - 70 - Math.min(e.t, 0.15) * 20);
      c.fillStyle = '#ffffff';
      c.fillRect(x - 7, y - 8, 14, 13);
      c.fillRect(x - 2, y + 5, 4, 3);
      c.fillStyle = '#2a2140';
      c.font = '8px "Press Start 2P", monospace';
      c.textAlign = 'center';
      c.fillText(e.text, x + 1, y + 3);
    }
  }

  drawHud(c) {
    c.font = '8px "Press Start 2P", monospace';
    c.textAlign = 'left';
    const pulse = Math.round(this.bouquetPulse * 3);
    c.fillStyle = 'rgba(42, 33, 64, 0.75)';
    c.fillRect(8, 8, 104, 24);
    drawFlower(c, 21, 28 - pulse, this.lastColor || FLOWER_COLORS[0]);
    c.fillStyle = '#ffffff';
    c.fillText('x ' + this.received, 34, 24);
    drawHeart(c, 96, 20);

    if (this.time < 6) {
      c.globalAlpha = Math.min(1, (6 - this.time) / 1.5);
      const msg = 'WASD to walk';
      c.textAlign = 'center';
      c.fillStyle = 'rgba(42, 33, 64, 0.75)';
      c.fillRect(VIEW_W / 2 - 64, VIEW_H - 34, 128, 22);
      c.fillStyle = '#ffffff';
      c.fillText(msg, VIEW_W / 2, VIEW_H - 19);
      c.globalAlpha = 1;
    }
  }
}

function drawHeart(c, x, y) {
  const shape = [
    '.XX.XX.',
    'XOOXOOX',
    'XOOOOOX',
    '.XOOOX.',
    '..XOX..',
    '...X...',
  ];
  shape.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      if (row[i] === '.') continue;
      c.fillStyle = row[i] === 'X' ? '#b0123a' : '#ff4d7d';
      px(c, x - 3 + i, y - 3 + j);
    }
  });
  c.fillStyle = '#ffc2d4';
  px(c, x - 2, y - 2);
}

// -------------------------------------------------------------------- main

function fitCanvas() {
  const scale = Math.max(1, Math.min(innerWidth / VIEW_W, innerHeight / VIEW_H));
  const s = scale >= 2 ? Math.floor(scale) : scale;
  canvas.style.width = VIEW_W * s + 'px';
  canvas.style.height = VIEW_H * s + 'px';
}
addEventListener('resize', fitCanvas);
fitCanvas();

Promise.all([loadImage('assets/girl.png'), loadImage('assets/boy.png')])
  .then(([girl, boy]) => {
    const world = new World({ girl, boy });
    let last = performance.now();
    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      world.update(dt);
      world.draw(ctx);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  })
  .catch(err => {
    ctx.fillStyle = '#fff';
    ctx.font = '12px monospace';
    ctx.fillText(err.message, 20, 40);
  });
