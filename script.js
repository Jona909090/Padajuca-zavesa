import {
  getPointID,
  smoothstep
} from "https://codepen.io/shubniggurath/pen/OPyPdmm.js";

console.clear();

const MESSAGE_LINES = [
  "",
  "kažu da čovek u životu sretne mnogo ljudi.",
  "Neki dođu i prođu, neki ostave uspomene.",
  "A onda se pojavi jedna osoba koja ne traži",
  "dozvolu da uđe u tvoje srce. Samo se pojavi...",
  "i od tog trenutka više ništa nije isto.",
  "",
  "────────────── ✦ ──────────────",
  "",
  "ne znam da li si ikada shvatila šta si probudila",
  "u meni. Nisam tražio ljubav, nisam je ni očekivao.",
  "A onda si ti jednim pogledom uspela da vratiš",
  "život delu mene za koji sam mislio da je",
  "odavno nestao.",
  "",
  "────────────── ✦ ──────────────",
  "",
  "od tada se borim sa jednom čudnom tišinom.",
  "Spolja se smejem, razgovaram sa ljudima,",
  "radim, živim... a u sebi svaki dan vodim",
  "isti razgovor sa srcem koje uporno bira tebe.",
  "I ne zna da odustane.",
  "",
  "────────────── ✦ ──────────────",
  "",
  "najviše boli to što ljubav nekad nije dovoljna",
  "da bi dvoje ljudi bili zajedno. Nekad ostane",
  "samo ono „šta bi bilo kad bi bilo“, a upravo",
  "te neizgovorene priče najviše bole.",
  "",
  "────────────── ✦ ──────────────",
  "",
  "ali znaš šta... Ako ikada u životu budeš",
  "pomislila da nisi bila dovoljno voljena, seti se",
  "da je negde postojao čovek koji nije želeo da",
  "promeni ništa na tebi. Nije želeo savršenu",
  "devojku. Želeo je samo tebe.",
  ""
];

const GRID_W = Math.max(...MESSAGE_LINES.map(line => line.length)) + 2;
const GRID_H = MESSAGE_LINES.length;
const dpr = Math.min(window.devicePixelRatio || 1, 2);

function getCurtainSize() {
  return {
    width: Math.min(1120, Math.max(340, window.innerWidth * 0.92)),
    height: Math.min(900, Math.max(560, window.innerHeight * 0.90))
  };
}

const initialSize = getCurtainSize();

const CONFIG = {
  awidth: initialSize.width,
  aheight: initialSize.height,
  gridW: GRID_W,
  gridH: GRID_H,
  gravity: 0.2,
  damping: 0.99,
  iterationsPerFrame: 5,
  compressFactor: 0.02,
  stretchFactor: 1.1,
  mouseSize: 6500,
  mouseStrength: 4,
  contain: false,
  randomSolve: false
};

function updateCellSize() {
  CONFIG.cellWidth = CONFIG.awidth / (CONFIG.gridW - 1);
  CONFIG.cellHeight = CONFIG.aheight / (CONFIG.gridH - 1);
}

updateCellSize();

let rafID;
let input;
let c;
let resizeTimer;

function sizeCanvas() {
  if (!c) return;
  c.style.width = window.innerWidth + "px";
  c.style.height = window.innerHeight + "px";
  c.width = Math.round(window.innerWidth * dpr);
  c.height = Math.round(window.innerHeight * dpr);
}

window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    const next = getCurtainSize();
    CONFIG.awidth = next.width;
    CONFIG.aheight = next.height;
    updateCellSize();
    main();
  }, 160);
});

function centerLine(line) {
  const usable = CONFIG.gridW - 2;
  const trimmed = line.slice(0, usable);
  const left = Math.max(0, Math.floor((usable - trimmed.length) / 2));
  return (" ".repeat(left) + trimmed).padEnd(usable, " ");
}

function buildMessageGrid() {
  return MESSAGE_LINES.map(line => " " + centerLine(line) + " ");
}

function createGlyphAtlas(fontSize) {
  const normal = {};
  const accent = {};
  const allChars = new Set(MESSAGE_LINES.join(""));
  const box = Math.ceil(fontSize * 2.2);

  for (const ch of allChars) {
    if (ch === " ") continue;

    for (const type of ["normal", "accent"]) {
      const off = document.createElement("canvas");
      off.width = off.height = Math.ceil(box * dpr);
      const octx = off.getContext("2d");
      octx.scale(dpr, dpr);
      octx.font = `italic 600 ${fontSize}px "Cormorant Garamond", Georgia, serif`;
      octx.textAlign = "center";
      octx.textBaseline = "middle";

      if (type === "accent") {
        octx.fillStyle = "#f2c85c";
        octx.shadowColor = "rgba(255, 196, 70, 0.85)";
        octx.shadowBlur = 7;
      } else {
        octx.fillStyle = "#f1dba8";
        octx.shadowColor = "rgba(255, 205, 112, 0.46)";
        octx.shadowBlur = 4.5;
      }

      octx.fillText(ch, box / 2, box / 2);
      off.logicalSize = box;

      if (type === "accent") accent[ch] = off;
      else normal[ch] = off;
    }
  }

  return { normal, accent };
}

function main() {
  if (rafID) cancelAnimationFrame(rafID);
  if (input) input.unbind();

  const {
    awidth: width,
    aheight: height,
    gridW,
    gridH,
    iterationsPerFrame,
    compressFactor,
    stretchFactor,
    cellWidth,
    cellHeight
  } = CONFIG;

  const fontSize = Math.max(
    12,
    Math.min(22, cellHeight * 0.86, cellWidth * 1.85)
  );

  const glyphs = createGlyphAtlas(fontSize);
  const messageGrid = buildMessageGrid();

  c = document.createElement("canvas");
  container.innerHTML = "";
  container.appendChild(c);
  sizeCanvas();

  const ctx = c.getContext("2d");
  const particles = [];
  const constraints = [];

  input = new Input({ c, particles });

  for (let i = 0; i < gridW; i++) {
    for (let j = 0; j < gridH; j++) {
      const x = i * cellWidth;
      const y = j * cellHeight;
      const id = getPointID(j, i, gridH);
      const pinned = j === 0;
      const row = messageGrid[j] || "";
      const char = row[i] || " ";
      const accentRow = MESSAGE_LINES[j]?.includes("✦") || MESSAGE_LINES[j]?.includes("─");

      const particle = new Particle({
        x,
        y,
        pinned,
        id,
        char,
        accent: accentRow
      });

      particles.push(particle);
    }
  }

  for (let i = 0; i < gridW; i++) {
    for (let j = 0; j < gridH; j++) {
      const id = getPointID(j, i, gridH);
      const p = particles[id];

      if (j < gridH - 1) {
        const bottomP = particles[getPointID(j + 1, i, gridH)];
        const vc = new Constraint({
          p1: p,
          p2: bottomP,
          length: cellHeight,
          compressFactor,
          stretchFactor,
          isSpacer: false
        });
        constraints.push(vc);
        p.downConstraint = vc;
      }

      if (i < gridW - 1) {
        const rightP = particles[getPointID(j, i + 1, gridH)];
        constraints.push(new Constraint({
          p1: p,
          p2: rightP,
          length: cellWidth,
          compressFactor: 0.68,
          stretchFactor: 3.2,
          isSpacer: true
        }));
      }
    }
  }

  function drawMessage() {
    const offsetX = (c.width / dpr - width) / 2;
    const offsetY = (c.height / dpr - height) / 2;

    particles.forEach(p => {
      if (!p.char || p.char === " ") return;
      const atlas = p.accent ? glyphs.accent : glyphs.normal;
      const img = atlas[p.char];
      if (!img) return;

      let cos = 1;
      let sin = 0;
      const constraint = p.downConstraint;

      if (constraint) {
        const dx = constraint.p2.pos.x - constraint.p1.pos.x;
        const dy = constraint.p2.pos.y - constraint.p1.pos.y;
        const angle = Math.atan2(dy, dx) - Math.PI / 2;
        cos = Math.cos(angle);
        sin = Math.sin(angle);
      }

      const tx = p.pos.x + offsetX;
      const ty = p.pos.y + offsetY;

      ctx.setTransform(
        dpr * cos,
        dpr * sin,
        -dpr * sin,
        dpr * cos,
        dpr * tx,
        dpr * ty
      );

      const half = img.logicalSize / 2;
      ctx.globalAlpha = p.accent ? 0.97 : 0.94;
      ctx.drawImage(img, -half, -half, img.logicalSize, img.logicalSize);
    });

    ctx.globalAlpha = 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  let lastDelta = 0;

  function runloop(delta) {
    rafID = requestAnimationFrame(runloop);

    ctx.save();
    ctx.clearRect(0, 0, c.width, c.height);

    const frameDelta = lastDelta ? Math.min(delta - lastDelta, 32) : 16;
    particles.forEach(p => p.update(frameDelta));
    lastDelta = delta;

    for (let i = 0; i < iterationsPerFrame; i++) {
      for (let j = 0; j < constraints.length; j++) {
        constraints[j].solve();
      }
    }

    drawMessage();
    ctx.restore();
  }

  rafID = requestAnimationFrame(runloop);
}

class Input {
  constructor({ c, particles }) {
    this.c = c;
    this.particles = particles;
    this.mousePos = new Vec2();
    this.grabRadius = Math.max(18, CONFIG.cellWidth * 1.2);
    this.bind();
  }

  setMouse(e) {
    const rect = this.c.getBoundingClientRect();
    const cssX = e.clientX - rect.left;
    const cssY = e.clientY - rect.top;
    const offsetX = (this.c.width / dpr - CONFIG.awidth) / 2;
    const offsetY = (this.c.height / dpr - CONFIG.aheight) / 2;
    this.mousePos.x = cssX - offsetX;
    this.mousePos.y = cssY - offsetY;
  }

  pointerdown(e) {
    this.setMouse(e);

    for (const p of this.particles) {
      if (this.mousePos.subtractNew(p.pos).length < this.grabRadius) {
        this.grabbedParticle = p;
        this.grabbedParticle.originalPinnedState = this.grabbedParticle.pinned;
        this.grabbedParticle.pinned = true;
        break;
      }
    }
  }

  pointerup() {
    if (this.grabbedParticle) {
      this.grabbedParticle.pinned = this.grabbedParticle.originalPinnedState;
      this.grabbedParticle = null;
    }
  }

  pointermove(e) {
    this.setMouse(e);

    if (this.grabbedParticle) {
      this.grabbedParticle.pos.reset(this.mousePos.x, this.mousePos.y);
      this.grabbedParticle.oldPos.reset(this.mousePos.x, this.mousePos.y);
    }

    for (const p of this.particles) {
      const diff = this.mousePos.subtractNew(p.pos);
      const ls = diff.lengthSquared;

      if (ls < CONFIG.mouseSize) {
        const a = diff.angle - Math.PI;
        const strength = smoothstep(CONFIG.mouseSize, -2000, ls) * CONFIG.mouseStrength / 300;
        p.applyForce(new Vec2(Math.cos(a) * strength, Math.sin(a) * strength));
      }
    }
  }

  contextmenu(e) {
    e.preventDefault();
  }

  bind() {
    this.pointerdown = this.pointerdown.bind(this);
    this.pointerup = this.pointerup.bind(this);
    this.pointermove = this.pointermove.bind(this);
    this.contextmenu = this.contextmenu.bind(this);

    document.addEventListener("pointerdown", this.pointerdown);
    document.addEventListener("pointerup", this.pointerup);
    document.addEventListener("pointermove", this.pointermove);
    document.addEventListener("contextmenu", this.contextmenu);
  }

  unbind() {
    document.removeEventListener("pointerdown", this.pointerdown);
    document.removeEventListener("pointerup", this.pointerup);
    document.removeEventListener("pointermove", this.pointermove);
    document.removeEventListener("contextmenu", this.contextmenu);
  }
}

class Vec2 {
  constructor(x = 0, y = 0) {
    this.reset(x, y);
  }

  zero() {
    this.reset(0, 0);
  }

  reset(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }

  clone() {
    return new Vec2(this.x, this.y);
  }

  add(v) {
    this.x += v.x;
    this.y += v.y;
    return this;
  }

  subtract(v) {
    this.x -= v.x;
    this.y -= v.y;
    return this;
  }

  subtractNew(v) {
    return this.clone().subtract(v);
  }

  get lengthSquared() {
    return this.x ** 2 + this.y ** 2;
  }

  get length() {
    return Math.hypot(this.x, this.y);
  }

  get angle() {
    return Math.atan2(this.y, this.x);
  }

  get array() {
    return [this.x, this.y];
  }

  [Symbol.iterator]() {
    const values = this.array;
    let i = 0;
    return {
      next() {
        if (i < values.length) {
          return { value: values[i++], done: false };
        }
        return { done: true };
      }
    };
  }
}

class Particle {
  constructor({ x, y, pinned, id, char, accent } = {}) {
    this.pos = new Vec2(x, y);
    this.oldPos = new Vec2(x, y);
    this.velocity = new Vec2();
    this.acceleration = new Vec2();
    this.pinned = pinned;
    this.id = id;
    this.char = char;
    this.accent = accent;
    this.gravityVec = new Vec2();
  }

  update(delta) {
    if (this.pinned) {
      this.acceleration.zero();
      return;
    }

    this.velocity.reset(
      (this.pos.x - this.oldPos.x) * CONFIG.damping,
      (this.pos.y - this.oldPos.y) * CONFIG.damping
    );

    this.oldPos.reset(...this.pos);

    const dd = Math.max(delta ** 2, 1);
    this.gravityVec.reset(0, CONFIG.gravity / dd);
    this.applyForce(this.gravityVec);

    this.pos.x += this.velocity.x + this.acceleration.x * dd;
    this.pos.y += this.velocity.y + this.acceleration.y * dd;
    this.acceleration.reset();
  }

  applyForce(v) {
    this.acceleration.add(v);
  }
}

class Constraint {
  constructor({ p1, p2, length, compressFactor, stretchFactor, isSpacer }) {
    this.p1 = p1;
    this.p2 = p2;
    this.length = length;
    this.isSpacer = isSpacer;
    this.minLength = length * compressFactor;
    this.maxLength = length * stretchFactor;
  }

  solve() {
    const dx = this.p2.pos.x - this.p1.pos.x;
    const dy = this.p2.pos.y - this.p1.pos.y;
    const distance = Math.hypot(dx, dy);

    if (distance === 0) return;

    let targetLength = this.length;

    if (distance < this.minLength) targetLength = this.minLength;
    else if (distance > this.maxLength) targetLength = this.maxLength;
    else return;

    const difference = targetLength - distance;
    const percent = difference / distance / 2;
    const offsetX = dx * percent;
    const offsetY = dy * percent;

    if (!this.p1.pinned) {
      this.p1.pos.x -= offsetX;
      this.p1.pos.y -= offsetY;
    }

    if (!this.p2.pinned) {
      this.p2.pos.x += offsetX;
      this.p2.pos.y += offsetY;
    }
  }
}

if (document.fonts?.ready) {
  document.fonts.ready.then(() => main());
} else {
  setTimeout(() => main(), 500);
}
