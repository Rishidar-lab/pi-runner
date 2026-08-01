/**
 * UI layer: HUD updates, screen/overlay management, toasts.
 *
 * Screen panels are built here (not in index.html) so their markup stays in one
 * place and can't drift out of sync. All actions are delivered via the handlers
 * object — the UI never reaches into game logic directly.
 */
import type { RunnerHandle } from '../core/coreLoader.js';
import { SKINS } from '../game/skins.js';
import { ACHIEVEMENTS } from '../game/achievements.js';
import { missionDef } from '../game/missions.js';
import type { MetaDoc } from '../persistence/store.js';
import { FLAGS, GOLD_UNLOCK } from '../config.js';

export interface UIHandlers {
  onPlay(): void;
  onDaily(): void;
  onResume(): void;
  onRestart(): void;
  onQuitToMenu(): void;
  onOpenSettings(): void;
  onOpenSkins(): void;
  onOpenMissions(): void;
  onBack(): void;
  onSelectSkin(index: number): void;
  onWatchReplay(): void;
  onShare(): void;
  onLogin(): void;
  onBuyUnlock(): void;
  onToggleSound(on: boolean): void;
  onToggleMusic(on: boolean): void;
  onToggleReducedMotion(on: boolean): void;
}

type ScreenName = 'menu' | 'tutorial' | 'pause' | 'gameover' | 'settings' | 'skins' | 'missions' | null;

export class UI {
  private overlay: HTMLElement;
  private toastEl: HTMLElement;
  private hud: {
    score: HTMLElement; best: HTMLElement; coins: HTMLElement;
    mult: HTMLElement; power: HTMLElement; login: HTMLElement; user: HTMLElement;
  };
  private toastTimer = 0;
  private replayHud: HTMLElement | null = null;
  current: ScreenName = null;

  constructor(private root: HTMLElement, private handlers: UIHandlers) {
    this.overlay = must(root.querySelector('#overlay'));
    this.toastEl = must(root.querySelector('#toast'));
    this.hud = {
      score: must(root.querySelector('#score')),
      best: must(root.querySelector('#best')),
      coins: must(root.querySelector('#coinCount')),
      mult: must(root.querySelector('#mult')),
      power: must(root.querySelector('#power')),
      login: must(root.querySelector('#loginBtn')),
      user: must(root.querySelector('#userTag')),
    };
    this.hud.login.addEventListener('click', () => handlers.onLogin());
  }

  toast(msg: string): void {
    this.toastEl.textContent = msg;
    this.toastEl.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toastEl.classList.remove('show'), 2600);
  }

  setLoginState(username: string | null, inPiBrowser: boolean): void {
    if (username) { this.hud.login.textContent = '@' + username; this.hud.login.classList.add('signed'); this.hud.user.textContent = '@' + username; }
    else { this.hud.login.textContent = 'Login with Pi'; this.hud.user.textContent = inPiBrowser ? 'Not signed in' : 'Open in Pi Browser'; }
  }

  updateHUD(core: RunnerHandle): void {
    this.hud.score.textContent = String(core.score());
    this.hud.coins.textContent = String(core.coins());
    const m = core.multiplier();
    this.hud.mult.textContent = 'x' + m;
    this.hud.mult.classList.toggle('hot', m >= 3);
    // power-up chips
    const chips: string[] = [];
    if (core.hasShield()) chips.push('🛡');
    if (core.magnetLeft() > 0) chips.push('🧲' + Math.ceil(core.magnetLeft()));
    if (core.boostLeft() > 0) chips.push('»' + Math.ceil(core.boostLeft()));
    if (core.slowmoLeft() > 0) chips.push('◷' + Math.ceil(core.slowmoLeft()));
    this.hud.power.textContent = chips.join('  ');
  }

  setBest(best: number): void { this.hud.best.textContent = 'BEST ' + best; }

  hideAll(): void { this.overlay.classList.add('hidden'); this.overlay.innerHTML = ''; this.current = null; }

  private panel(html: string): HTMLElement {
    this.overlay.classList.remove('hidden');
    this.overlay.innerHTML = `<div class="panel">${html}</div>`;
    return this.overlay.firstElementChild as HTMLElement;
  }

  // ---------------------------- screens ----------------------------------
  showMenu(best: number, totalCoins: number): void {
    this.current = 'menu';
    const p = this.panel(`
      <div class="panel-eyebrow">ENDLESS ARCADE</div>
      <h1 class="panel-title">PI&nbsp;RUNNER</h1>
      <p class="panel-sub">Dash through the Pi grid. Switch lanes, <b>jump</b> hurdles, <b>slide</b> under bars, and bank <b>π</b>.</p>
      <div class="panel-stats"><div><span>${best}</span><small>BEST</small></div><div><span>${totalCoins}</span><small>π TOTAL</small></div></div>
      <button class="btn-primary" data-a="play">PLAY</button>
      <div class="btn-row">
        <button class="btn-ghost" data-a="daily">Daily Run</button>
        <button class="btn-ghost" data-a="skins">Skins</button>
      </div>
      <div class="btn-row">
        <button class="btn-ghost" data-a="missions">Missions</button>
        <button class="btn-ghost" data-a="settings">Settings</button>
      </div>
      <p class="panel-note">Free to play. Controls: arrows / WASD, or swipe & tap.</p>`);
    this.wire(p);
  }

  showTutorial(): void {
    this.current = 'tutorial';
    const p = this.panel(`
      <div class="panel-eyebrow">HOW TO PLAY</div>
      <h1 class="panel-title">READY?</h1>
      <ul class="how">
        <li><b>←/→</b> or <b>swipe</b> — switch lane</li>
        <li><b>↑ / space</b> or <b>swipe up</b> — jump low hurdles</li>
        <li><b>↓</b> or <b>swipe down</b> — slide under bars</li>
        <li>Collect <b>π</b> to build a combo & multiplier</li>
        <li>Grab power-ups: 🛡 shield · 🧲 magnet · » boost · ◷ slow-mo</li>
      </ul>
      <button class="btn-primary" data-a="play">START RUN</button>
      <button class="btn-ghost" data-a="back">Back</button>`);
    this.wire(p);
  }

  showPause(): void {
    this.current = 'pause';
    const p = this.panel(`
      <div class="panel-eyebrow">PAUSED</div>
      <h1 class="panel-title">TAKE FIVE</h1>
      <button class="btn-primary" data-a="resume">RESUME</button>
      <div class="btn-row"><button class="btn-ghost" data-a="settings">Settings</button><button class="btn-ghost" data-a="quit">Quit</button></div>`);
    this.wire(p);
  }

  showGameOver(res: { score: number; best: number; coins: number; distance: number; newBest: boolean }, unlockAvailable: boolean): void {
    this.current = 'gameover';
    const unlockBtn = FLAGS.PI_PAYMENTS_ENABLED && unlockAvailable
      ? `<button class="btn-ghost" data-a="unlock">Unlock Gold Orb + Shield · <b>${GOLD_UNLOCK.price}</b></button>`
      : '';
    const p = this.panel(`
      <div class="panel-eyebrow">${res.newBest ? 'NEW BEST!' : 'RUN OVER'}</div>
      <h1 class="panel-title">${res.newBest ? 'RECORD' : 'NICE RUN'}</h1>
      <div class="panel-stats">
        <div><span>${res.score}</span><small>SCORE</small></div>
        <div><span>${res.best}</span><small>BEST</small></div>
        <div><span>${res.coins}</span><small>π</small></div>
        <div><span>${res.distance}</span><small>METERS</small></div>
      </div>
      <button class="btn-primary" data-a="restart">PLAY AGAIN</button>
      <div class="btn-row">
        <button class="btn-ghost" data-a="replay">▶ Watch Replay</button>
        <button class="btn-ghost" data-a="share">Share</button>
      </div>
      ${unlockBtn}
      <button class="btn-ghost" data-a="quit">Menu</button>`);
    this.wire(p);
  }

  /** Lightweight banner shown while a replay plays; tap/Skip returns to game-over. */
  showReplayHud(onSkip: () => void): void {
    this.hideReplayHud();
    const el = document.createElement('div');
    el.className = 'replay-hud';
    el.innerHTML = `<span class="rdot"></span> REPLAY <button class="rskip" type="button">Skip</button>`;
    el.querySelector('.rskip')!.addEventListener('click', (e) => { e.stopPropagation(); onSkip(); });
    this.root.appendChild(el);
    this.replayHud = el;
  }
  hideReplayHud(): void { this.replayHud?.remove(); this.replayHud = null; }

  showSettings(meta: MetaDoc, back: ScreenName): void {
    this.current = 'settings';
    const s = meta.settings;
    const p = this.panel(`
      <div class="panel-eyebrow">SETTINGS</div>
      <h1 class="panel-title">OPTIONS</h1>
      <label class="row-toggle"><span>Sound effects</span><input type="checkbox" data-t="sound" ${s.sound ? 'checked' : ''}></label>
      <label class="row-toggle"><span>Music</span><input type="checkbox" data-t="music" ${s.music ? 'checked' : ''}></label>
      <label class="row-toggle"><span>Reduced motion</span><input type="checkbox" data-t="motion" ${s.reducedMotion ? 'checked' : ''}></label>
      <button class="btn-primary" data-a="${back === 'pause' ? 'resume-back' : 'back'}">Done</button>`);
    p.querySelector('[data-t="sound"]')!.addEventListener('change', (e) => this.handlers.onToggleSound((e.target as HTMLInputElement).checked));
    p.querySelector('[data-t="music"]')!.addEventListener('change', (e) => this.handlers.onToggleMusic((e.target as HTMLInputElement).checked));
    p.querySelector('[data-t="motion"]')!.addEventListener('change', (e) => this.handlers.onToggleReducedMotion((e.target as HTMLInputElement).checked));
    this.wire(p);
  }

  showSkins(unlockedMask: number, selected: number, goldOwned: boolean): void {
    this.current = 'skins';
    const cards = SKINS.map((sk) => {
      const unlocked = sk.index === 0 || (sk.index === 1 ? goldOwned : (unlockedMask & (1 << sk.index)) !== 0);
      const sel = sk.index === selected;
      return `<button class="skin ${sel ? 'sel' : ''} ${unlocked ? '' : 'locked'}" data-skin="${sk.index}" ${unlocked ? '' : 'disabled'}>
        <span class="swatch" style="background:radial-gradient(circle at 35% 35%, ${sk.inner}, ${sk.outer})"></span>
        <span class="skin-name">${sk.name}</span>
        <span class="skin-unlock">${unlocked ? (sel ? 'Selected' : 'Tap to equip') : sk.unlock}</span>
      </button>`;
    }).join('');
    const p = this.panel(`
      <div class="panel-eyebrow">COSMETICS</div>
      <h1 class="panel-title">SKINS</h1>
      <div class="skins">${cards}</div>
      <button class="btn-primary" data-a="back">Back</button>`);
    p.querySelectorAll('[data-skin]').forEach((b) => b.addEventListener('click', () => {
      const idx = Number((b as HTMLElement).dataset.skin);
      this.handlers.onSelectSkin(idx);
    }));
    this.wire(p);
  }

  showMissions(meta: MetaDoc, achievementsMask: number): void {
    this.current = 'missions';
    const missions = meta.missions.items.map((it) => {
      const def = missionDef(it.id); if (!def) return '';
      const pct = Math.min(100, Math.round((it.progress / def.target) * 100));
      return `<div class="mission ${it.done ? 'done' : ''}">
        <div class="mission-top"><span>${def.label}</span><span>${it.done ? '✓' : `${Math.min(it.progress, def.target)}/${def.target}`}</span></div>
        <div class="bar"><i style="width:${pct}%"></i></div></div>`;
    }).join('');
    const achs = ACHIEVEMENTS.map((a) => {
      const has = (achievementsMask & (1 << a.bit)) !== 0;
      return `<div class="ach ${has ? 'has' : ''}"><b>${has ? '★' : '☆'} ${a.name}</b><small>${a.desc}</small></div>`;
    }).join('');
    const p = this.panel(`
      <div class="panel-eyebrow">DAILY MISSIONS</div>
      <h1 class="panel-title">GOALS</h1>
      <div class="missions">${missions || '<p class="panel-note">Play a run to roll new missions.</p>'}</div>
      <div class="panel-eyebrow" style="margin-top:14px">ACHIEVEMENTS</div>
      <div class="achs">${achs}</div>
      <button class="btn-primary" data-a="back">Back</button>`);
    this.wire(p);
  }

  private wire(p: HTMLElement): void {
    const h = this.handlers;
    const map: Record<string, () => void> = {
      play: h.onPlay, daily: h.onDaily, resume: h.onResume, restart: h.onRestart,
      quit: h.onQuitToMenu, settings: h.onOpenSettings, skins: h.onOpenSkins,
      missions: h.onOpenMissions, back: h.onBack, unlock: h.onBuyUnlock,
      replay: h.onWatchReplay, share: h.onShare,
      'resume-back': h.onResume,
    };
    p.querySelectorAll('[data-a]').forEach((b) => {
      const a = (b as HTMLElement).dataset.a!;
      if (map[a]) b.addEventListener('click', () => map[a]());
    });
  }
}

function must<T extends Element>(el: T | null): T {
  if (!el) throw new Error('UI element missing');
  return el;
}
