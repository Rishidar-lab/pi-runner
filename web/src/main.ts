/**
 * Pi Runner — application orchestrator.
 *
 * Owns the fixed-timestep game loop and wires together the deterministic core,
 * renderer, input, audio, UI, persistence and the Pi adapter. Gameplay is
 * stepped from JS at a fixed rate so every input can be tagged with its exact
 * step index — this "command tape" (seed + inputs) is what the server replays
 * to validate a leaderboard score.
 */
import { loadCore, Cmd, St, Pickup, type CoreModule, type RunnerHandle } from './core/coreLoader.js';
import { Renderer } from './render/renderer.js';
import { Input, type InputEvent } from './input/input.js';
import { Audio } from './audio/audio.js';
import { UI } from './ui/ui.js';
import { Store } from './persistence/store.js';
import { PiAdapter } from './pi/piAdapter.js';
import { skinByIndex, SKINS } from './game/skins.js';
import { evaluate as evalAchievements, type RunResult } from './game/achievements.js';
import { ensureDailyMissions, applyRunToMissions, dailySeed } from './game/missions.js';
import { FLAGS } from './config.js';

const FIXED_DT = 1 / 120; // must match cfg::FIXED_DT

class Game {
  private core!: RunnerHandle;
  private mod!: CoreModule;
  private renderer!: Renderer;
  private input!: Input;
  private audio = new Audio();
  private ui!: UI;
  private store!: Store;
  private pi = new PiAdapter();

  private acc = 0;
  private last = 0;
  private stepIdx = 0;
  private pendingInputs: number[] = [];
  private tapeSteps: number[] = [];
  private tapeCmds: number[] = [];
  private curSeed = 0;
  private curUnlockShield = false;
  private curSkin = 0;
  private settingsBack: 'menu' | 'pause' = 'menu';

  // last finished run — enables a deterministic replay (same seed + input tape)
  private lastRun: { seed: number; unlockShield: boolean; skin: number; steps: number; tapeSteps: number[]; tapeCmds: number[] } | null = null;
  private lastResult: { score: number; coins: number; distance: number; newBest: boolean } | null = null;
  private replaying = false;
  private replayStep = 0;
  private replayIdx = 0;

  // event-detection snapshots (for SFX + particles)
  private prev = { coins: 0, shield: false, magnet: 0, boost: 0, slowmo: 0, gems: 0, state: 0 };

  async boot(): Promise<void> {
    this.mod = await loadCore();
    this.core = new this.mod.Runner();
    this.store = new Store(this.mod);

    const stage = document.getElementById('stage')!;
    const canvas = document.getElementById('game') as HTMLCanvasElement;
    this.renderer = new Renderer(canvas);
    this.renderer.setSkin(this.store.selectedSkin);
    this.renderer.reducedMotion = this.store.meta.settings.reducedMotion;

    this.audio.setSound(this.store.meta.settings.sound);
    this.audio.setMusic(this.store.meta.settings.music);

    this.ui = new UI(document.body, this.makeHandlers());
    this.ui.setBest(this.store.best);
    this.ui.setLoginState(null, this.pi.available);

    this.input = new Input(stage);
    this.input.on((e) => this.onInput(e));
    this.bindControlButtons();

    window.addEventListener('resize', () => this.renderer.resize());
    ensureDailyMissions(this.store.meta); this.store.flushMeta();

    this.ui.showMenu(this.store.best, this.store.totalCoins);
    this.last = performance.now();
    requestAnimationFrame((t) => this.loop(t));

    // If we're inside the Pi Browser, silently note it; login is user-initiated.
    if (!this.pi.available) this.ui.setLoginState(null, false);
  }

  // ------------------------------ input ----------------------------------
  private onInput(e: InputEvent): void {
    // Any input during a replay skips it and returns to the game-over screen.
    if (this.replaying) { this.stopReplay(); return; }
    const playing = this.core.state() === St.Playing;
    if (e === 'pause') {
      if (playing) this.doPause();
      else if (this.core.state() === St.Paused) this.doResume();
      return;
    }
    if (e === 'confirm') {
      if (this.core.state() === St.Menu) this.startRun(false);
      else if (this.core.state() === St.GameOver) this.startRun(false);
      return;
    }
    if (!playing) return;
    this.audio.resume();
    switch (e) {
      case 'left': this.queue(Cmd.Left); this.audio.lane(); break;
      case 'right': this.queue(Cmd.Right); this.audio.lane(); break;
      case 'jump': this.queue(Cmd.Jump); this.audio.jump(); break;
      case 'slide': this.queue(Cmd.Slide); this.audio.slide(); break;
    }
  }

  private queue(cmd: number): void { this.pendingInputs.push(cmd); }

  private bindControlButtons(): void {
    this.input.bindButton(document.getElementById('btnLeft'), 'left');
    this.input.bindButton(document.getElementById('btnRight'), 'right');
    this.input.bindButton(document.getElementById('btnJump'), 'jump');
    this.input.bindButton(document.getElementById('btnSlide'), 'slide');
    document.getElementById('btnPause')?.addEventListener('click', () => this.onInput('pause'));
  }

  // ------------------------------ run lifecycle --------------------------
  private startRun(daily: boolean): void {
    this.audio.resume();
    this.curSeed = daily ? dailySeed() : (Math.floor(Math.random() * 0xffffffff) >>> 0);
    this.curUnlockShield = this.store.goldUnlock;
    this.curSkin = this.store.selectedSkin;
    this.core.reset(this.curSeed, this.curUnlockShield, this.curSkin);
    this.core.start();
    this.renderer.setSkin(this.curSkin);
    this.acc = 0; this.stepIdx = 0; this.pendingInputs = [];
    this.tapeSteps = []; this.tapeCmds = [];
    this.prev = { coins: 0, shield: this.curUnlockShield, magnet: 0, boost: 0, slowmo: 0, gems: 0, state: St.Playing };
    this.toggleControls(true);
    this.ui.hideAll();
    if (this.store.meta.settings.music) this.audio.startMusic();
  }

  private doPause(): void { this.core.pause(); this.settingsBack = 'pause'; this.ui.showPause(); this.toggleControls(false); }
  private doResume(): void { this.core.resume(); this.ui.hideAll(); this.toggleControls(true); }

  private endRun(): void {
    this.audio.hit();
    this.renderer.kick(14);
    this.toggleControls(false);
    this.audio.stopMusic();

    const result: RunResult = {
      score: this.core.score(), coins: this.core.coins(), gems: this.core.gems(),
      distance: this.core.distance(), maxCombo: this.core.maxCombo(),
      multiplier: this.core.multiplier(), powerups: this.core.powerups(),
    };

    const newBest = this.store.recordRun({ score: result.score, coins: result.coins, distance: result.distance });
    this.ui.setBest(this.store.best);

    // snapshot the run so it can be replayed deterministically from game-over
    this.lastRun = { seed: this.curSeed, unlockShield: this.curUnlockShield, skin: this.curSkin, steps: this.stepIdx, tapeSteps: this.tapeSteps.slice(), tapeCmds: this.tapeCmds.slice() };
    this.lastResult = { score: result.score, coins: result.coins, distance: result.distance, newBest };

    // achievements
    const totals = { coins: this.store.totalCoins, distance: this.store.view.totalDistance, best: this.store.best, runs: this.store.view.runsPlayed };
    const { mask, newly } = evalAchievements(this.store.achievementsMask, result, totals);
    if (mask !== this.store.achievementsMask) this.store.setAchievements(mask);

    // missions
    const doneMissions = applyRunToMissions(this.store.meta, result);
    // daily best
    if (this.curSeed === dailySeed() && result.score > this.store.meta.daily.best) this.store.meta.daily.best = result.score;
    this.store.flushMeta();

    // skin unlocks from new lifetime totals
    this.checkSkinUnlocks();

    // leaderboard (best-effort, server re-simulates the tape to validate)
    if (FLAGS.LEADERBOARD_ENABLED) void this.submitScore(result);

    this.ui.showGameOver(
      { score: result.score, best: this.store.best, coins: result.coins, distance: result.distance, newBest },
      !this.store.goldUnlock,
    );

    for (const a of newly) this.ui.toast(`Achievement: ${a.name} ★`);
    for (const m of doneMissions) this.ui.toast(`Mission complete: ${m} ✓`);
  }

  private checkSkinUnlocks(): void {
    const totals = { coins: this.store.totalCoins, distance: this.store.view.totalDistance, best: this.store.best };
    for (const sk of SKINS) {
      if (sk.index <= 1) continue; // 0 default, 1 gold (via payment)
      if (!this.store.isSkinUnlocked(sk.index) && sk.unlocked(totals, this.store.goldUnlock)) {
        this.store.unlockSkin(sk.index);
        this.ui.toast(`Skin unlocked: ${sk.name}!`);
      }
    }
  }

  private async submitScore(result: RunResult): Promise<void> {
    try {
      await fetch('/api/score', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: this.pi.user?.uid ?? null,
          username: this.pi.user?.username ?? null,
          seed: this.curSeed, unlockShield: this.curUnlockShield, skin: this.curSkin,
          steps: this.stepIdx, tapeSteps: this.tapeSteps, tapeCmds: this.tapeCmds,
          score: result.score, coins: result.coins, distance: result.distance,
          daily: this.curSeed === dailySeed(),
        }),
      });
    } catch { /* offline: local best already saved */ }
  }

  // ------------------------------ replay ---------------------------------
  /** Re-run the last failed attempt deterministically from its seed + tape. */
  private startReplay(): void {
    if (!this.lastRun) return;
    const r = this.lastRun;
    this.audio.resume();
    this.core.reset(r.seed, r.unlockShield, r.skin);
    this.core.start();
    this.renderer.setSkin(r.skin);
    this.acc = 0; this.replayStep = 0; this.replayIdx = 0; this.replaying = true;
    this.prev = { coins: 0, shield: r.unlockShield, magnet: 0, boost: 0, slowmo: 0, gems: 0, state: St.Playing };
    this.ui.hideAll();
    this.toggleControls(false);
    this.ui.showReplayHud(() => this.stopReplay());
  }

  private stepReplay(dt: number): void {
    const r = this.lastRun!;
    this.acc += dt;
    while (this.acc >= FIXED_DT && this.core.state() === St.Playing && this.replayStep < r.steps) {
      while (this.replayIdx < r.tapeSteps.length && r.tapeSteps[this.replayIdx] === this.replayStep) {
        this.core.input(r.tapeCmds[this.replayIdx]); this.replayIdx++;
      }
      this.core.advance(FIXED_DT);
      this.replayStep++;
      this.acc -= FIXED_DT;
      this.detectEvents();
    }
    this.ui.updateHUD(this.core);
    if (this.core.state() !== St.Playing || this.replayStep >= r.steps) this.stopReplay();
  }

  private stopReplay(): void {
    if (!this.replaying) return;
    this.replaying = false;
    this.ui.hideReplayHud();
    if (this.core.state() === St.Playing) this.core.pause(); // halt the loop if skipped early
    const res = this.lastResult
      ? { ...this.lastResult, best: this.store.best }
      : { score: this.core.score(), best: this.store.best, coins: this.core.coins(), distance: this.core.distance(), newBest: false };
    this.ui.showGameOver(res, !this.store.goldUnlock);
  }

  // ------------------------------ loop -----------------------------------
  private loop(now: number): void {
    let dt = (now - this.last) / 1000; this.last = now;
    if (dt > 0.25) dt = 0.25;

    if (this.replaying) {
      this.stepReplay(dt);
    } else if (this.core.state() === St.Playing) {
      this.acc += dt;
      while (this.acc >= FIXED_DT && this.core.state() === St.Playing) {
        // apply this step's inputs, recording them for the verification tape
        for (const c of this.pendingInputs) {
          this.core.input(c);
          if (this.tapeSteps.length < 4096) { this.tapeSteps.push(this.stepIdx); this.tapeCmds.push(c); }
        }
        this.pendingInputs.length = 0;
        this.core.advance(FIXED_DT);
        this.stepIdx++;
        this.acc -= FIXED_DT;
        this.detectEvents();
      }
      this.ui.updateHUD(this.core);
      // The run just ended: show the game-over + replay screen. The outer
      // `state === Playing` guard ensures this fires exactly once (detectEvents
      // must NOT be used to gate this — it runs mid-loop and would mask it).
      if (this.core.state() === St.GameOver) this.endRun();
    }

    this.renderer.frame(this.core, dt, this.core.speed());
    requestAnimationFrame((t) => this.loop(t));
  }

  /** Diff core stats to fire SFX + particle bursts for collect/hit/powerup. */
  private detectEvents(): void {
    const c = this.core;
    const coins = c.coins(), gems = c.gems();
    if (coins > this.prev.coins) { this.audio.coin(c.combo()); this.renderer.burst(this.renderer.laneXAtPlayer(c.playerLane()), this.renderer.playerRowY(), '#ffcf4a', 12); }
    if (gems > this.prev.gems) { this.audio.gem(); this.renderer.burst(this.renderer.laneXAtPlayer(c.playerLane()), this.renderer.playerRowY(), '#ff7ae0', 18); }
    const shield = c.hasShield(), magnet = c.magnetLeft(), boost = c.boostLeft(), slowmo = c.slowmoLeft();
    if ((magnet > this.prev.magnet) || (boost > this.prev.boost) || (slowmo > this.prev.slowmo) || (shield && !this.prev.shield)) {
      this.audio.power(); this.renderer.burst(this.renderer.laneXAtPlayer(c.playerLane()), this.renderer.playerRowY(), '#7bd6ff', 14);
    }
    if (!shield && this.prev.shield && c.state() === St.Playing) { this.audio.hit(); this.renderer.kick(10); this.renderer.burst(this.renderer.laneXAtPlayer(c.playerLane()), this.renderer.playerRowY(), '#3ef0d8', 20); }
    this.prev = { coins, shield, magnet, boost, slowmo, gems, state: c.state() };
  }

  private toggleControls(show: boolean): void {
    document.getElementById('controls')?.classList.toggle('hidden', !show);
    document.getElementById('btnPause')?.classList.toggle('hidden', !show);
  }

  // ------------------------------ UI handlers ----------------------------
  private makeHandlers() {
    return {
      onPlay: () => this.startRun(false),
      onDaily: () => this.startRun(true),
      onResume: () => this.doResume(),
      onRestart: () => this.startRun(false),
      onQuitToMenu: () => { this.core.reset(0, false, this.store.selectedSkin); this.toggleControls(false); this.audio.stopMusic(); this.prev.state = St.Menu; this.ui.showMenu(this.store.best, this.store.totalCoins); },
      onOpenSettings: () => this.ui.showSettings(this.store.meta, this.settingsBack),
      onOpenSkins: () => this.ui.showSkins(this.store.view.skinsUnlocked, this.store.selectedSkin, this.store.goldUnlock),
      onOpenMissions: () => { ensureDailyMissions(this.store.meta); this.ui.showMissions(this.store.meta, this.store.achievementsMask); },
      onBack: () => { this.settingsBack = 'menu'; this.ui.showMenu(this.store.best, this.store.totalCoins); },
      onSelectSkin: (i: number) => {
        this.store.selectSkin(i); this.renderer.setSkin(i); this.audio.ui();
        this.ui.showSkins(this.store.view.skinsUnlocked, this.store.selectedSkin, this.store.goldUnlock);
      },
      onWatchReplay: () => this.startReplay(),
      onShare: () => void this.share(),
      onLogin: () => void this.login(),
      onBuyUnlock: () => void this.buyUnlock(),
      onToggleSound: (on: boolean) => { this.audio.setSound(on); this.store.meta.settings.sound = on; this.store.flushMeta(); },
      onToggleMusic: (on: boolean) => { this.audio.setMusic(on); this.store.meta.settings.music = on; this.store.flushMeta(); },
      onToggleReducedMotion: (on: boolean) => { this.renderer.reducedMotion = on; this.store.meta.settings.reducedMotion = on; this.store.flushMeta(); },
    };
  }

  /** Share the game (native share sheet, falling back to copying the link). */
  private async share(): Promise<void> {
    const url = location.href.split('#')[0];
    const score = this.lastResult?.score ?? this.store.best;
    const text = `I scored ${score} in Pi Runner — think you can beat me? 🏃‍♂️π`;
    try {
      if (navigator.share) { await navigator.share({ title: 'Pi Runner', text, url }); return; }
    } catch { /* user cancelled share sheet */ }
    try { await navigator.clipboard.writeText(url); this.ui.toast('Link copied — share it!'); }
    catch { this.ui.toast(url); }
  }

  private async login(): Promise<void> {
    const r = await this.pi.login();
    if (r.ok) {
      this.ui.setLoginState(r.value.username, true);
      this.ui.toast(`Signed in as ${r.value.username}`);
      if (await this.pi.ownsGoldUnlock()) { this.store.setGoldUnlock(true); this.ui.toast('Gold Orb + Shield restored ✓'); }
    } else {
      this.ui.toast(r.message);
    }
  }

  private async buyUnlock(): Promise<void> {
    const r = await this.pi.buyGoldUnlock();
    if (r.ok) { this.store.setGoldUnlock(true); this.renderer.setSkin(1); this.store.selectSkin(1); this.ui.toast('Unlocked! Gold Orb + Shield ✦'); }
    else this.ui.toast(r.message);
  }
}

// Boot robustly regardless of when this module executes: if the document has
// already finished parsing (e.g. the module was loaded via a late/dynamic
// import), start immediately; otherwise wait for DOMContentLoaded. Relying on
// the `load` event alone can miss if the module runs after `load` fired.
function bootGame(): void { void new Game().boot(); }
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootGame, { once: true });
} else {
  bootGame();
}
