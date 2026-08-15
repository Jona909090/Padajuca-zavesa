import { getPointID, smoothstep } from "https://codepen.io/shubniggurath/pen/OPyPdmm.js";

const MESSAGE = `kažu da čovek u životu sretne mnogo ljudi. Neki dođu i prođu, neki ostave uspomene. A onda se pojavi jedna osoba koja ne traži dozvolu da uđe u tvoje srce. Samo se pojavi... i od tog trenutka više ništa nije isto. ne znam da li si ikada shvatila šta si probudila u meni. Nisam tražio ljubav, nisam je ni očekivao. A onda si ti jednim pogledom uspela da vratiš život delu mene za koji sam mislio da je odavno nestao. od tada se borim sa jednom čudnom tišinom. Spolja se smejem, razgovaram sa ljudima, radim, živim... a u sebi svaki dan vodim isti razgovor sa srcem koje uporno bira tebe. I ne zna da odustane. najviše boli to što ljubav nekad nije dovoljna da bi dvoje ljudi bili zajedno. Nekad ostane samo ono „šta bi bilo kad bi bilo“, a upravo te neizgovorene priče najviše bole. ali znaš šta... Ako ikada u životu budeš pomislila da nisi bila dovoljno voljena, seti se da je negde postojao čovek koji nije želeo da promeni ništa na tebi. Nije želeo savršenu devojku. Želeo je samo tebe.`;

const dpr = Math.min(window.devicePixelRatio || 1, 2);
let c, rafID, input, resizeTimer, layout;

function justifyLine(words, cols, isLast) {
  if (words.length === 1 || isLast) return words.join(" ").padEnd(cols, " ");
  const letters = words.reduce((n, w) => n + w.length, 0);
  const gaps = words.length - 1;
  const totalSpaces = Math.max(gaps, cols - letters);
  const base = Math.floor(totalSpaces / gaps);
  let extra = totalSpaces % gaps;
  let out = "";
  words.forEach((word, i) => {
    out += word;
    if (i < gaps) out += " ".repeat(base + (extra-- > 0 ? 1 : 0));
  });
  return out.slice(0, cols).padEnd(cols, " ");
}

function wrapAndJustify(text, cols) {
  const words = text.trim().split(/\s+/);
  const rows = [];
  let line = [], len = 0;
  for (const word of words) {
    const next = len + (line.length ? 1 : 0) + word.length;
    if (next > cols && line.length) {
      rows.push(line); line = [word]; len = word.length;
    } else { line.push(word); len = next; }
  }
  if (line.length) rows.push(line);
  return rows.map((row, i) => justifyLine(row, cols, i === rows.length - 1));
}

function computeLayout() {
  const vw = window.innerWidth, vh = window.innerHeight;
  const cols = vw < 600 ? 30 : vw < 900 ? 40 : 52;
  const lines = wrapAndJustify(MESSAGE, cols);
  const width = Math.min(vw * 0.67, 850);
  const top = vw < 700 ? 120 : 168;
  const bottomGap = vw < 700 ? 55 : 70;
  const maxHeight = Math.max(360, vh - top - bottomGap);
  const height = Math.min(maxHeight, Math.max(560, lines.length * 29));
  return {
    cols,
    rows: lines.length,
    lines,
    width,
    height,
    top,
    cellWidth: width / Math.max(1, cols - 1),
    cellHeight: height / Math.max(1, lines.length - 1)
  };
}

const CONFIG = { gravity: 0.2, damping: 0.99, iterationsPerFrame: 5, compressFactor: 0.03, stretchFactor: 1.12, mouseSize: 7000, mouseStrength: 4 };

function sizeCanvas() {
  c.style.width = window.innerWidth + "px";
  c.style.height = window.innerHeight + "px";
  c.width = Math.round(window.innerWidth * dpr);
  c.height = Math.round(window.innerHeight * dpr);
}

function makeGlyphAtlas(fontSize) {
  const atlas = {}, chars = new Set(MESSAGE), box = Math.ceil(fontSize * 2.4);
  for (const ch of chars) {
    if (ch === " ") continue;
    const off = document.createElement("canvas");
    off.width = off.height = Math.ceil(box * dpr);
    const ctx = off.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.font = `italic 600 ${fontSize}px "Cormorant Garamond", Georgia, serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#f0c85b";
    ctx.shadowColor = "rgba(255, 198, 70, 0.72)";
    ctx.shadowBlur = 5;
    ctx.fillText(ch, box / 2, box / 2);
    off.logicalSize = box;
    atlas[ch] = off;
  }
  return atlas;
}

function main() {
  if (rafID) cancelAnimationFrame(rafID);
  if (input) input.unbind();
  layout = computeLayout();

  c = document.createElement("canvas");
  container.innerHTML = "";
  container.appendChild(c);
  sizeCanvas();

  const ctx = c.getContext("2d"), particles = [], constraints = [];
  const fontSize = Math.max(13, Math.min(22, layout.cellHeight * 0.75, layout.cellWidth * 1.42));
  const glyphs = makeGlyphAtlas(fontSize);

  for (let i = 0; i < layout.cols; i++) {
    for (let j = 0; j < layout.rows; j++) {
      particles.push(new Particle({
        x: i * layout.cellWidth,
        y: j * layout.cellHeight,
        pinned: j === 0,
        char: layout.lines[j]?.[i] || " "
      }));
    }
  }

  for (let i = 0; i < layout.cols; i++) {
    for (let j = 0; j < layout.rows; j++) {
      const p = particles[getPointID(j, i, layout.rows)];
      if (j < layout.rows - 1) {
        const down = particles[getPointID(j + 1, i, layout.rows)];
        const vc = new Constraint(p, down, layout.cellHeight, CONFIG.compressFactor, CONFIG.stretchFactor);
        constraints.push(vc);
        p.downConstraint = vc;
      }
      if (i < layout.cols - 1) {
        constraints.push(new Constraint(p, particles[getPointID(j, i + 1, layout.rows)], layout.cellWidth, 0.72, 3.2));
      }
    }
  }

  input = new Input(c, particles);

  function draw() {
    const offsetX = (c.width / dpr - layout.width) / 2;
    const offsetY = layout.top;

    for (const p of particles) {
      if (!p.char || p.char === " ") continue;
      const img = glyphs[p.char];
      if (!img) continue;

      let cos = 1, sin = 0;
      if (p.downConstraint) {
        const dx = p.downConstraint.p2.pos.x - p.downConstraint.p1.pos.x;
        const dy = p.downConstraint.p2.pos.y - p.downConstraint.p1.pos.y;
        const a = Math.atan2(dy, dx) - Math.PI / 2;
        cos = Math.cos(a);
        sin = Math.sin(a);
      }

      ctx.setTransform(
        dpr * cos, dpr * sin,
        -dpr * sin, dpr * cos,
        dpr * (p.pos.x + offsetX),
        dpr * (p.pos.y + offsetY)
      );
      const half = img.logicalSize / 2;
      ctx.globalAlpha = 0.98;
      ctx.drawImage(img, -half, -half, img.logicalSize, img.logicalSize);
    }

    ctx.globalAlpha = 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  let last = 0;
  function loop(now) {
    rafID = requestAnimationFrame(loop);
    ctx.clearRect(0, 0, c.width, c.height);
    const dt = last ? Math.min(now - last, 32) : 16;
    last = now;
    particles.forEach(p => p.update(dt));
    for (let k = 0; k < CONFIG.iterationsPerFrame; k++) constraints.forEach(con => con.solve());
    draw();
  }
  rafID = requestAnimationFrame(loop);
}

class Input {
  constructor(canvas, particles) {
    this.c = canvas; this.particles = particles; this.mouse = new Vec2();
    this.radius = Math.max(18, layout.cellWidth * 1.25); this.bind();
  }
  setMouse(e) {
    const rect = this.c.getBoundingClientRect();
    const ox = (this.c.width / dpr - layout.width) / 2;
    const oy = layout.top;
    this.mouse.x = e.clientX - rect.left - ox;
    this.mouse.y = e.clientY - rect.top - oy;
  }
  down(e) {
    this.setMouse(e);
    for (const p of this.particles) {
      if (this.mouse.subtractNew(p.pos).length < this.radius) {
        this.grabbed = p; p.wasPinned = p.pinned; p.pinned = true; break;
      }
    }
  }
  move(e) {
    this.setMouse(e);
    if (this.grabbed) {
      this.grabbed.pos.reset(this.mouse.x, this.mouse.y);
      this.grabbed.oldPos.reset(this.mouse.x, this.mouse.y);
    }
    for (const p of this.particles) {
      const diff = this.mouse.subtractNew(p.pos), ls = diff.lengthSquared;
      if (ls < CONFIG.mouseSize) {
        const a = diff.angle - Math.PI;
        const strength = smoothstep(CONFIG.mouseSize, -2000, ls) * CONFIG.mouseStrength / 300;
        p.applyForce(new Vec2(Math.cos(a) * strength, Math.sin(a) * strength));
      }
    }
  }
  up() { if (this.grabbed) { this.grabbed.pinned = this.grabbed.wasPinned; this.grabbed = null; } }
  context(e) { e.preventDefault(); }
  bind() {
    this.down = this.down.bind(this); this.move = this.move.bind(this); this.up = this.up.bind(this); this.context = this.context.bind(this);
    document.addEventListener("pointerdown", this.down);
    document.addEventListener("pointermove", this.move);
    document.addEventListener("pointerup", this.up);
    document.addEventListener("contextmenu", this.context);
  }
  unbind() {
    document.removeEventListener("pointerdown", this.down);
    document.removeEventListener("pointermove", this.move);
    document.removeEventListener("pointerup", this.up);
    document.removeEventListener("contextmenu", this.context);
  }
}

class Vec2 {
  constructor(x = 0, y = 0) { this.reset(x, y); }
  reset(x = 0, y = 0) { this.x = x; this.y = y; return this; }
  zero() { return this.reset(0, 0); }
  clone() { return new Vec2(this.x, this.y); }
  add(v) { this.x += v.x; this.y += v.y; return this; }
  subtract(v) { this.x -= v.x; this.y -= v.y; return this; }
  subtractNew(v) { return this.clone().subtract(v); }
  get lengthSquared() { return this.x * this.x + this.y * this.y; }
  get length() { return Math.hypot(this.x, this.y); }
  get angle() { return Math.atan2(this.y, this.x); }
}

class Particle {
  constructor({ x, y, pinned, char }) {
    this.pos = new Vec2(x, y); this.oldPos = new Vec2(x, y); this.acc = new Vec2();
    this.pinned = pinned; this.char = char; this.downConstraint = null;
  }
  applyForce(v) { this.acc.add(v); }
  update(delta) {
    if (this.pinned) { this.acc.zero(); return; }
    const vx = (this.pos.x - this.oldPos.x) * CONFIG.damping;
    const vy = (this.pos.y - this.oldPos.y) * CONFIG.damping;
    this.oldPos.reset(this.pos.x, this.pos.y);
    const dd = Math.max(1, delta * delta);
    this.applyForce(new Vec2(0, CONFIG.gravity / dd));
    this.pos.x += vx + this.acc.x * dd;
    this.pos.y += vy + this.acc.y * dd;
    this.acc.zero();
  }
}

class Constraint {
  constructor(p1, p2, length, compressFactor, stretchFactor) {
    this.p1 = p1; this.p2 = p2; this.length = length;
    this.min = length * compressFactor; this.max = length * stretchFactor;
  }
  solve() {
    const dx = this.p2.pos.x - this.p1.pos.x;
    const dy = this.p2.pos.y - this.p1.pos.y;
    const dist = Math.hypot(dx, dy);
    if (!dist) return;
    let target = this.length;
    if (dist < this.min) target = this.min;
    else if (dist > this.max) target = this.max;
    else return;
    const percent = (target - dist) / dist / 2;
    const ox = dx * percent, oy = dy * percent;
    if (!this.p1.pinned) { this.p1.pos.x -= ox; this.p1.pos.y -= oy; }
    if (!this.p2.pinned) { this.p2.pos.x += ox; this.p2.pos.y += oy; }
  }
}

window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(main, 150);
});

setTimeout(main, 300);
