/* ============================================================================
   Pi Runner — app.js
   - Pi integration layer (auth + U2A payment), with graceful fallback when the
     app is opened outside the Pi Browser (so it stays fully testable anywhere).
   - Canvas arcade game: 3-lane dodge-and-collect.
   ========================================================================== */

"use strict";

/* ----------------------------- App state ------------------------------ */
const state = {
  inPiBrowser: typeof window !== "undefined" && typeof window.Pi !== "undefined",
  user: null, // { uid, username }
  accessToken: null,
  unlocked: false, // owns the Gold Orb + Shield unlock
  best: Number(localStorage.getItem("pirunner_best") || 0),
};

/* --------------------------- Pi integration --------------------------- */
const Payments = {
  // amount/memo/metadata for the single optional unlock
  AMOUNT: 1,
  MEMO: "Unlock Gold Orb + Shield in Pi Runner",
  META: { item: "gold_shield_unlock_v1" },
};

function initPi() {
  if (!state.inPiBrowser) return;
  try {
    // Must run before any other Pi call. sandbox:true for development;
    // set to false only after your app is approved for Mainnet payments.
    window.Pi.init({ version: "2.0", sandbox: true });
  } catch (e) {
    console.error("Pi.init failed:", e);
  }
}

// Called by the SDK if a previous payment from this user never completed.
function onIncompletePaymentFound(payment) {
  try {
    const paymentId = payment && payment.identifier;
    const txid = payment && payment.transaction && payment.transaction.txid;
    if (!paymentId) return;
    fetch("/api/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentId, txid, uid: state.user && state.user.uid }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d && d.ok) {
          state.unlocked = true;
          applyUnlockUI();
          toast("Recovered a previous unlock ✓");
        }
      })
      .catch(() => {});
  } catch (e) {
    console.error(e);
  }
}

async function loginWithPi() {
  if (!state.inPiBrowser) {
    toast("Open Pi Runner in the Pi Browser to sign in.");
    return;
  }
  try {
    const scopes = ["username", "payments"];
    const auth = await window.Pi.authenticate(scopes, onIncompletePaymentFound);
    state.accessToken = auth.accessToken;
    state.user = { uid: auth.user.uid, username: auth.user.username };

    // Verify the token server-side (defence in depth).
    const res = await fetch("/api/me", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken: state.accessToken }),
    });
    if (!res.ok) throw new Error("Server could not verify the access token");

    // Check whether this Pioneer already owns the unlock.
    try {
      const u = await fetch(`/api/unlock-status?uid=${encodeURIComponent(state.user.uid)}`);
      const uj = await u.json();
      if (uj && uj.unlocked) state.unlocked = true;
    } catch (_) {}

    updateLoginUI();
    applyUnlockUI();
    toast(`Signed in as ${state.user.username}`);
  } catch (err) {
    console.error("Login failed:", err);
    toast("Login was cancelled or failed.");
  }
}

async function buyUnlock() {
  if (state.unlocked) return;
  if (!state.inPiBrowser) {
    toast("Open Pi Runner in the Pi Browser to unlock with π.");
    return;
  }
  if (!state.user) {
    toast("Sign in with Pi first.");
    await loginWithPi();
    if (!state.user) return;
  }

  const uid = state.user.uid;
  setUnlockBusy(true);

  window.Pi.createPayment(
    { amount: Payments.AMOUNT, memo: Payments.MEMO, metadata: Payments.META },
    {
      onReadyForServerApproval: (paymentId) => {
        fetch("/api/approve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentId, uid }),
        }).catch((e) => console.error("approve call failed:", e));
      },
      onReadyForServerCompletion: (paymentId, txid) => {
        fetch("/api/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentId, txid, uid }),
        })
          .then((r) => r.json())
          .then((d) => {
            setUnlockBusy(false);
            if (d && d.ok) {
              state.unlocked = true;
              applyUnlockUI();
              toast("Unlocked! Gold Orb + Shield active ✦");
            } else {
              toast("Payment completed but unlock failed — contact support.");
            }
          })
          .catch((e) => {
            setUnlockBusy(false);
            console.error("complete call failed:", e);
          });
      },
      onCancel: () => {
        setUnlockBusy(false);
        toast("Payment cancelled.");
      },
      onError: (error) => {
        setUnlockBusy(false);
        console.error("Payment error:", error);
        toast("Payment error — please try again.");
      },
    }
  );
}

/* ------------------------------- UI refs ------------------------------ */
const el = {
  canvas: document.getElementById("game"),
  score: document.getElementById("score"),
  best: document.getElementById("best"),
  loginBtn: document.getElementById("loginBtn"),
  overlay: document.getElementById("overlay"),
  playBtn: document.getElementById("playBtn"),
  unlockBtn: document.getElementById("unlockBtn"),
  panelEyebrow: document.getElementById("panelEyebrow"),
  panelTitle: document.getElementById("panelTitle"),
  panelSub: document.getElementById("panelSub"),
  panelStats: document.getElementById("panelStats"),
  finalScore: document.getElementById("finalScore"),
  finalBest: document.getElementById("finalBest"),
  panelNote: document.getElementById("panelNote"),
  toast: document.getElementById("toast"),
  userTag: document.getElementById("userTag"),
  skinTag: document.getElementById("skinTag"),
};

let toastTimer = null;
function toast(msg) {
  el.toast.textContent = msg;
  el.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.remove("show"), 2400);
}

function updateLoginUI() {
  if (state.user) {
    el.loginBtn.textContent = "@" + state.user.username;
    el.loginBtn.classList.add("signed");
    el.userTag.textContent = "@" + state.user.username;
  } else {
    el.loginBtn.textContent = "Login with Pi";
    el.userTag.textContent = state.inPiBrowser ? "Not signed in" : "Open in Pi Browser to sign in";
  }
}

function applyUnlockUI() {
  if (state.unlocked) {
    el.unlockBtn.textContent = "Gold Orb + Shield · OWNED ✓";
    el.unlockBtn.classList.add("owned");
    el.unlockBtn.disabled = true;
    el.skinTag.textContent = "Gold orb · shield ready";
    el.skinTag.classList.add("gold");
  }
}

function setUnlockBusy(busy) {
  el.unlockBtn.disabled = busy || state.unlocked;
  if (busy) el.unlockBtn.textContent = "Processing payment…";
  else if (!state.unlocked) el.unlockBtn.innerHTML = "Unlock Gold Orb + Shield · <b>1&nbsp;π</b>";
}

function updateBestUI() {
  el.best.textContent = "BEST " + state.best;
}

/* ------------------------------- Game --------------------------------- */
const ctx = el.canvas.getContext("2d");
const Game = {
  running: false,
  w: 0,
  h: 0,
  dpr: 1,
  lanes: [0, 0, 0],
  laneCount: 3,
  player: { lane: 1, x: 0, targetX: 0, y: 0, r: 18, trail: [] },
  entities: [],
  particles: [],
  stars: [],
  speed: 240,
  baseSpeed: 240,
  spawnEvery: 900,
  spawnTimer: 0,
  score: 0,
  scoreAccum: 0,
  shield: false,
  last: 0,
};

function resize() {
  const rect = el.canvas.getBoundingClientRect();
  Game.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  Game.w = Math.max(1, Math.floor(rect.width));
  Game.h = Math.max(1, Math.floor(rect.height));
  el.canvas.width = Game.w * Game.dpr;
  el.canvas.height = Game.h * Game.dpr;
  ctx.setTransform(Game.dpr, 0, 0, Game.dpr, 0, 0);

  const pad = Game.w * 0.18;
  for (let i = 0; i < Game.laneCount; i++) {
    Game.lanes[i] = pad + ((Game.w - 2 * pad) * i) / (Game.laneCount - 1);
  }
  Game.player.y = Game.h * 0.82;
  Game.player.r = Math.max(14, Math.min(22, Game.w * 0.05));
  Game.player.targetX = Game.lanes[Game.player.lane];
  if (!Game.player.x) Game.player.x = Game.player.targetX;

  if (Game.stars.length === 0) seedStars();
}

function seedStars() {
  Game.stars = [];
  const n = 70;
  for (let i = 0; i < n; i++) {
    Game.stars.push({
      x: Math.random() * Game.w,
      y: Math.random() * Game.h,
      z: 0.3 + Math.random() * 1.7,
      tw: Math.random() * Math.PI * 2,
    });
  }
}

function resetGame() {
  Game.entities = [];
  Game.particles = [];
  Game.speed = Game.baseSpeed;
  Game.spawnEvery = 900;
  Game.spawnTimer = 0;
  Game.score = 0;
  Game.scoreAccum = 0;
  Game.player.lane = 1;
  Game.player.targetX = Game.lanes[1];
  Game.player.x = Game.lanes[1];
  Game.player.trail = [];
  Game.shield = state.unlocked; // unlock grants a one-time shield each run
}

function startGame() {
  resize();
  resetGame();
  el.overlay.classList.add("hidden");
  Game.running = true;
  Game.last = performance.now();
  requestAnimationFrame(loop);
}

function endGame() {
  Game.running = false;
  if (Game.score > state.best) {
    state.best = Game.score;
    localStorage.setItem("pirunner_best", String(state.best));
    updateBestUI();
  }
  // Configure overlay as a game-over screen
  el.panelEyebrow.textContent = "RUN OVER";
  el.panelTitle.textContent = "NICE RUN";
  el.panelSub.hidden = true;
  el.panelStats.hidden = false;
  el.finalScore.textContent = Game.score;
  el.finalBest.textContent = state.best;
  el.playBtn.textContent = "PLAY AGAIN";
  el.panelNote.textContent = state.unlocked
    ? "Gold Orb + Shield active each run."
    : "Tip: the Gold Orb unlock gives you a shield each run.";
  el.overlay.classList.remove("hidden");
}

function spawnRow() {
  // Choose 1–2 blocks but always leave at least one safe lane.
  const lanes = [0, 1, 2];
  const blockCount = Math.random() < 0.35 ? 2 : 1;
  const shuffled = lanes.sort(() => Math.random() - 0.5);
  const blockLanes = shuffled.slice(0, blockCount);
  const safeLanes = lanes.filter((l) => !blockLanes.includes(l));

  for (const l of blockLanes) {
    Game.entities.push({ type: "block", lane: l, y: -30, resolved: false });
  }
  // Sometimes drop a coin in a safe lane.
  if (Math.random() < 0.7 && safeLanes.length) {
    const cl = safeLanes[Math.floor(Math.random() * safeLanes.length)];
    Game.entities.push({ type: "coin", lane: cl, y: -30 - Math.random() * 60, resolved: false, spin: 0 });
  }
}

function burst(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 40 + Math.random() * 160;
    Game.particles.push({
      x, y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: 0.5 + Math.random() * 0.4,
      age: 0,
      color,
      r: 1.5 + Math.random() * 2.5,
    });
  }
}

function update(dt) {
  // difficulty ramp
  Game.speed = Math.min(560, Game.baseSpeed + Game.score * 0.9);
  Game.spawnEvery = Math.max(440, 900 - Game.score * 1.4);

  // passive score
  Game.scoreAccum += dt * 10;
  if (Game.scoreAccum >= 1) {
    Game.score += Math.floor(Game.scoreAccum);
    Game.scoreAccum -= Math.floor(Game.scoreAccum);
    el.score.textContent = Game.score;
  }

  // spawn
  Game.spawnTimer += dt * 1000;
  if (Game.spawnTimer >= Game.spawnEvery) {
    Game.spawnTimer = 0;
    spawnRow();
  }

  // player horizontal easing
  Game.player.targetX = Game.lanes[Game.player.lane];
  Game.player.x += (Game.player.targetX - Game.player.x) * Math.min(1, dt * 14);
  Game.player.trail.unshift({ x: Game.player.x, y: Game.player.y });
  if (Game.player.trail.length > 8) Game.player.trail.pop();

  // entities
  for (const e of Game.entities) {
    e.y += Game.speed * dt;
    if (e.type === "coin") e.spin += dt * 5;

    if (!e.resolved && e.y >= Game.player.y) {
      e.resolved = true;
      if (e.lane === Game.player.lane) {
        if (e.type === "coin") {
          Game.score += 5;
          el.score.textContent = Game.score;
          burst(Game.lanes[e.lane], Game.player.y, "#ffcf4a", 14);
        } else {
          // block hit
          if (Game.shield) {
            Game.shield = false;
            burst(Game.lanes[e.lane], Game.player.y, "#3ef0d8", 22);
            toast("Shield absorbed the hit!");
          } else {
            burst(Game.player.x, Game.player.y, "#ff476f", 26);
            endGame();
            return;
          }
        }
      }
    }
  }
  Game.entities = Game.entities.filter((e) => e.y < Game.h + 40);

  // stars
  for (const s of Game.stars) {
    s.y += (Game.speed * 0.25 * s.z) * dt;
    s.tw += dt * 3;
    if (s.y > Game.h) { s.y = -2; s.x = Math.random() * Game.w; }
  }

  // particles
  for (const p of Game.particles) {
    p.age += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 120 * dt;
  }
  Game.particles = Game.particles.filter((p) => p.age < p.life);
}

function draw() {
  ctx.clearRect(0, 0, Game.w, Game.h);

  // lane guides
  ctx.save();
  ctx.strokeStyle = "rgba(160,140,255,0.10)";
  ctx.lineWidth = 1;
  for (const lx of Game.lanes) {
    ctx.beginPath();
    ctx.moveTo(lx, 0);
    ctx.lineTo(lx, Game.h);
    ctx.stroke();
  }
  ctx.restore();

  // stars
  for (const s of Game.stars) {
    const a = 0.35 + 0.35 * Math.sin(s.tw);
    ctx.fillStyle = `rgba(200,210,255,${a})`;
    ctx.fillRect(s.x, s.y, s.z, s.z);
  }

  // entities
  for (const e of Game.entities) {
    const x = Game.lanes[e.lane];
    if (e.type === "coin") {
      const r = 13;
      ctx.save();
      ctx.shadowColor = "rgba(255,188,74,0.8)";
      ctx.shadowBlur = 16;
      const g = ctx.createRadialGradient(x, e.y, 2, x, e.y, r);
      g.addColorStop(0, "#fff0c2");
      g.addColorStop(1, "#ff9d2f");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, e.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#5a3500";
      ctx.font = "bold 15px Orbitron, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("π", x, e.y + 1);
      ctx.restore();
    } else {
      const s = 26;
      ctx.save();
      ctx.shadowColor = "rgba(255,71,111,0.7)";
      ctx.shadowBlur = 14;
      ctx.fillStyle = "#ff476f";
      roundRect(ctx, x - s / 2, e.y - s / 2, s, s, 7);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      roundRect(ctx, x - s / 2 + 3, e.y - s / 2 + 3, s - 6, (s - 6) / 2, 4);
      ctx.fill();
      ctx.restore();
    }
  }

  // player trail
  for (let i = Game.player.trail.length - 1; i >= 0; i--) {
    const t = Game.player.trail[i];
    const alpha = (1 - i / Game.player.trail.length) * 0.22;
    ctx.fillStyle = state.unlocked
      ? `rgba(255,207,74,${alpha})`
      : `rgba(62,240,216,${alpha})`;
    ctx.beginPath();
    ctx.arc(t.x, t.y, Game.player.r * (1 - i / 14), 0, Math.PI * 2);
    ctx.fill();
  }

  // player orb
  const px = Game.player.x, py = Game.player.y, pr = Game.player.r;
  ctx.save();
  const og = ctx.createRadialGradient(px - pr / 3, py - pr / 3, 2, px, py, pr);
  if (state.unlocked) {
    og.addColorStop(0, "#fff4cf");
    og.addColorStop(1, "#ff9d2f");
    ctx.shadowColor = "rgba(255,188,74,0.9)";
  } else {
    og.addColorStop(0, "#ffffff");
    og.addColorStop(1, "#2bd6c0");
    ctx.shadowColor = "rgba(62,240,216,0.9)";
  }
  ctx.shadowBlur = 22;
  ctx.fillStyle = og;
  ctx.beginPath();
  ctx.arc(px, py, pr, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // shield ring
  if (Game.shield) {
    ctx.save();
    ctx.strokeStyle = "rgba(62,240,216,0.9)";
    ctx.lineWidth = 2.5;
    ctx.shadowColor = "rgba(62,240,216,0.7)";
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(px, py, pr + 7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // particles
  for (const p of Game.particles) {
    const a = 1 - p.age / p.life;
    ctx.globalAlpha = Math.max(0, a);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

function loop(now) {
  if (!Game.running) return;
  const dt = Math.min(0.05, (now - Game.last) / 1000);
  Game.last = now;
  update(dt);
  if (!Game.running) return; // endGame may have fired
  draw();
  requestAnimationFrame(loop);
}

/* ------------------------------ Input --------------------------------- */
function moveLeft() {
  if (Game.running && Game.player.lane > 0) Game.player.lane--;
}
function moveRight() {
  if (Game.running && Game.player.lane < Game.laneCount - 1) Game.player.lane++;
}

el.canvas.addEventListener("pointerdown", (ev) => {
  if (!Game.running) return;
  const rect = el.canvas.getBoundingClientRect();
  const x = ev.clientX - rect.left;
  if (x < rect.width / 2) moveLeft();
  else moveRight();
});

let touchStartX = null;
el.canvas.addEventListener("touchstart", (e) => { touchStartX = e.touches[0].clientX; }, { passive: true });
el.canvas.addEventListener("touchend", (e) => {
  if (touchStartX == null) return;
  const dx = e.changedTouches[0].clientX - touchStartX;
  if (Math.abs(dx) > 30) { dx < 0 ? moveLeft() : moveRight(); }
  touchStartX = null;
}, { passive: true });

window.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft" || e.key === "a") moveLeft();
  else if (e.key === "ArrowRight" || e.key === "d") moveRight();
  else if ((e.key === " " || e.key === "Enter") && !Game.running) startGame();
});

window.addEventListener("resize", () => { if (!Game.running) resize(); });

/* ---------------------------- Wire up UI ------------------------------ */
el.loginBtn.addEventListener("click", loginWithPi);
el.unlockBtn.addEventListener("click", buyUnlock);
el.playBtn.addEventListener("click", () => {
  // reset sub/stats to the start configuration on first show
  startGame();
});

/* ------------------------------ Boot ---------------------------------- */
function boot() {
  initPi();
  updateLoginUI();
  updateBestUI();
  applyUnlockUI();
  resize();
  if (!state.inPiBrowser) {
    el.panelNote.textContent = "Tip: open in the Pi Browser to sign in and unlock with π.";
  }
  // draw a static frame behind the overlay
  draw();
}

if (window.Pi && typeof window.Pi.init === "function") boot();
else {
  // SDK may still be loading; boot on window load regardless.
  window.addEventListener("load", () => {
    state.inPiBrowser = typeof window.Pi !== "undefined";
    boot();
  });
}
