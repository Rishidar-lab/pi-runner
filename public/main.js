import { loadCore, Cmd, St, Pickup } from './core/coreLoader.js';
import { Renderer } from './render/renderer.js';
import { Input } from './input/input.js';
import { Audio } from './audio/audio.js';
import { UI } from './ui/ui.js';
import { Store } from './persistence/store.js';
import { PiAdapter } from './pi/piAdapter.js';
import { skinByIndex, SKINS } from './game/skins.js';
import { evaluate as evalAchievements } from './game/achievements.js';
import { ensureDailyMissions, applyRunToMissions, dailySeed } from './game/missions.js';
import { FLAGS } from './config.js';
const FIXED_DT = 1 / 120;
class Game {
    core;
    mod;
    renderer;
    input;
    audio = new Audio();
    ui;
    store;
    pi = new PiAdapter();
    acc = 0;
    last = 0;
    stepIdx = 0;
    pendingInputs = [];
    tapeSteps = [];
    tapeCmds = [];
    curSeed = 0;
    curUnlockShield = false;
    curSkin = 0;
    settingsBack = 'menu';
    prev = {
        coins: 0,
        shield: false,
        magnet: 0,
        boost: 0,
        slowmo: 0,
        gems: 0,
        state: 0
    };
    async boot() {
        this.mod = await loadCore();
        this.core = new this.mod.Runner();
        this.store = new Store(this.mod);
        const stage = document.getElementById('stage');
        const canvas = document.getElementById('game');
        this.renderer = new Renderer(canvas);
        this.renderer.setSkin(this.store.selectedSkin);
        this.renderer.reducedMotion = this.store.meta.settings.reducedMotion;
        this.audio.setSound(this.store.meta.settings.sound);
        this.audio.setMusic(this.store.meta.settings.music);
        this.ui = new UI(document.body, this.makeHandlers());
        this.ui.setBest(this.store.best);
        this.ui.setLoginState(null, this.pi.available);
        this.input = new Input(stage);
        this.input.on((e)=>this.onInput(e));
        this.bindControlButtons();
        window.addEventListener('resize', ()=>this.renderer.resize());
        ensureDailyMissions(this.store.meta);
        this.store.flushMeta();
        this.ui.showMenu(this.store.best, this.store.totalCoins);
        this.last = performance.now();
        requestAnimationFrame((t)=>this.loop(t));
        if (!this.pi.available) this.ui.setLoginState(null, false);
    }
    onInput(e) {
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
        switch(e){
            case 'left':
                this.queue(Cmd.Left);
                this.audio.lane();
                break;
            case 'right':
                this.queue(Cmd.Right);
                this.audio.lane();
                break;
            case 'jump':
                this.queue(Cmd.Jump);
                this.audio.jump();
                break;
            case 'slide':
                this.queue(Cmd.Slide);
                this.audio.slide();
                break;
        }
    }
    queue(cmd) {
        this.pendingInputs.push(cmd);
    }
    bindControlButtons() {
        this.input.bindButton(document.getElementById('btnLeft'), 'left');
        this.input.bindButton(document.getElementById('btnRight'), 'right');
        this.input.bindButton(document.getElementById('btnJump'), 'jump');
        this.input.bindButton(document.getElementById('btnSlide'), 'slide');
        document.getElementById('btnPause')?.addEventListener('click', ()=>this.onInput('pause'));
    }
    startRun(daily) {
        this.audio.resume();
        this.curSeed = daily ? dailySeed() : Math.floor(Math.random() * 0xffffffff) >>> 0;
        this.curUnlockShield = this.store.goldUnlock;
        this.curSkin = this.store.selectedSkin;
        this.core.reset(this.curSeed, this.curUnlockShield, this.curSkin);
        this.core.start();
        this.renderer.setSkin(this.curSkin);
        this.acc = 0;
        this.stepIdx = 0;
        this.pendingInputs = [];
        this.tapeSteps = [];
        this.tapeCmds = [];
        this.prev = {
            coins: 0,
            shield: this.curUnlockShield,
            magnet: 0,
            boost: 0,
            slowmo: 0,
            gems: 0,
            state: St.Playing
        };
        this.toggleControls(true);
        this.ui.hideAll();
        if (this.store.meta.settings.music) this.audio.startMusic();
    }
    doPause() {
        this.core.pause();
        this.settingsBack = 'pause';
        this.ui.showPause();
        this.toggleControls(false);
    }
    doResume() {
        this.core.resume();
        this.ui.hideAll();
        this.toggleControls(true);
    }
    endRun() {
        this.audio.hit();
        this.renderer.kick(14);
        this.toggleControls(false);
        this.audio.stopMusic();
        const result = {
            score: this.core.score(),
            coins: this.core.coins(),
            gems: this.core.gems(),
            distance: this.core.distance(),
            maxCombo: this.core.maxCombo(),
            multiplier: this.core.multiplier(),
            powerups: this.core.powerups()
        };
        const newBest = this.store.recordRun({
            score: result.score,
            coins: result.coins,
            distance: result.distance
        });
        this.ui.setBest(this.store.best);
        const totals = {
            coins: this.store.totalCoins,
            distance: this.store.view.totalDistance,
            best: this.store.best,
            runs: this.store.view.runsPlayed
        };
        const { mask, newly } = evalAchievements(this.store.achievementsMask, result, totals);
        if (mask !== this.store.achievementsMask) this.store.setAchievements(mask);
        const doneMissions = applyRunToMissions(this.store.meta, result);
        if (this.curSeed === dailySeed() && result.score > this.store.meta.daily.best) this.store.meta.daily.best = result.score;
        this.store.flushMeta();
        this.checkSkinUnlocks();
        if (FLAGS.LEADERBOARD_ENABLED) void this.submitScore(result);
        this.ui.showGameOver({
            score: result.score,
            best: this.store.best,
            coins: result.coins,
            distance: result.distance,
            newBest
        }, !this.store.goldUnlock);
        for (const a of newly)this.ui.toast(`Achievement: ${a.name} ★`);
        for (const m of doneMissions)this.ui.toast(`Mission complete: ${m} ✓`);
    }
    checkSkinUnlocks() {
        const totals = {
            coins: this.store.totalCoins,
            distance: this.store.view.totalDistance,
            best: this.store.best
        };
        for (const sk of SKINS){
            if (sk.index <= 1) continue;
            if (!this.store.isSkinUnlocked(sk.index) && sk.unlocked(totals, this.store.goldUnlock)) {
                this.store.unlockSkin(sk.index);
                this.ui.toast(`Skin unlocked: ${sk.name}!`);
            }
        }
    }
    async submitScore(result) {
        try {
            await fetch('/api/score', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    uid: this.pi.user?.uid ?? null,
                    username: this.pi.user?.username ?? null,
                    seed: this.curSeed,
                    unlockShield: this.curUnlockShield,
                    skin: this.curSkin,
                    steps: this.stepIdx,
                    tapeSteps: this.tapeSteps,
                    tapeCmds: this.tapeCmds,
                    score: result.score,
                    coins: result.coins,
                    distance: result.distance,
                    daily: this.curSeed === dailySeed()
                })
            });
        } catch  {}
    }
    loop(now) {
        let dt = (now - this.last) / 1000;
        this.last = now;
        if (dt > 0.25) dt = 0.25;
        if (this.core.state() === St.Playing) {
            this.acc += dt;
            while(this.acc >= FIXED_DT && this.core.state() === St.Playing){
                for (const c of this.pendingInputs){
                    this.core.input(c);
                    if (this.tapeSteps.length < 4096) {
                        this.tapeSteps.push(this.stepIdx);
                        this.tapeCmds.push(c);
                    }
                }
                this.pendingInputs.length = 0;
                this.core.advance(FIXED_DT);
                this.stepIdx++;
                this.acc -= FIXED_DT;
                this.detectEvents();
            }
            this.ui.updateHUD(this.core);
            if (this.core.state() === St.GameOver && this.prev.state !== St.GameOver) {
                this.prev.state = St.GameOver;
                this.endRun();
            }
        }
        this.renderer.frame(this.core, dt, this.core.speed());
        requestAnimationFrame((t)=>this.loop(t));
    }
    detectEvents() {
        const c = this.core;
        const coins = c.coins(), gems = c.gems();
        if (coins > this.prev.coins) {
            this.audio.coin(c.combo());
            this.renderer.burst(this.renderer.laneXAtPlayer(c.playerLane()), this.renderer.playerRowY(), '#ffcf4a', 12);
        }
        if (gems > this.prev.gems) {
            this.audio.gem();
            this.renderer.burst(this.renderer.laneXAtPlayer(c.playerLane()), this.renderer.playerRowY(), '#ff7ae0', 18);
        }
        const shield = c.hasShield(), magnet = c.magnetLeft(), boost = c.boostLeft(), slowmo = c.slowmoLeft();
        if (magnet > this.prev.magnet || boost > this.prev.boost || slowmo > this.prev.slowmo || shield && !this.prev.shield) {
            this.audio.power();
            this.renderer.burst(this.renderer.laneXAtPlayer(c.playerLane()), this.renderer.playerRowY(), '#7bd6ff', 14);
        }
        if (!shield && this.prev.shield && c.state() === St.Playing) {
            this.audio.hit();
            this.renderer.kick(10);
            this.renderer.burst(this.renderer.laneXAtPlayer(c.playerLane()), this.renderer.playerRowY(), '#3ef0d8', 20);
        }
        this.prev = {
            coins,
            shield,
            magnet,
            boost,
            slowmo,
            gems,
            state: c.state()
        };
    }
    toggleControls(show) {
        document.getElementById('controls')?.classList.toggle('hidden', !show);
        document.getElementById('btnPause')?.classList.toggle('hidden', !show);
    }
    makeHandlers() {
        return {
            onPlay: ()=>this.startRun(false),
            onDaily: ()=>this.startRun(true),
            onResume: ()=>this.doResume(),
            onRestart: ()=>this.startRun(false),
            onQuitToMenu: ()=>{
                this.core.reset(0, false, this.store.selectedSkin);
                this.toggleControls(false);
                this.audio.stopMusic();
                this.prev.state = St.Menu;
                this.ui.showMenu(this.store.best, this.store.totalCoins);
            },
            onOpenSettings: ()=>this.ui.showSettings(this.store.meta, this.settingsBack),
            onOpenSkins: ()=>this.ui.showSkins(this.store.view.skinsUnlocked, this.store.selectedSkin, this.store.goldUnlock),
            onOpenMissions: ()=>{
                ensureDailyMissions(this.store.meta);
                this.ui.showMissions(this.store.meta, this.store.achievementsMask);
            },
            onBack: ()=>{
                this.settingsBack = 'menu';
                this.ui.showMenu(this.store.best, this.store.totalCoins);
            },
            onSelectSkin: (i)=>{
                this.store.selectSkin(i);
                this.renderer.setSkin(i);
                this.audio.ui();
                this.ui.showSkins(this.store.view.skinsUnlocked, this.store.selectedSkin, this.store.goldUnlock);
            },
            onLogin: ()=>void this.login(),
            onBuyUnlock: ()=>void this.buyUnlock(),
            onToggleSound: (on)=>{
                this.audio.setSound(on);
                this.store.meta.settings.sound = on;
                this.store.flushMeta();
            },
            onToggleMusic: (on)=>{
                this.audio.setMusic(on);
                this.store.meta.settings.music = on;
                this.store.flushMeta();
            },
            onToggleReducedMotion: (on)=>{
                this.renderer.reducedMotion = on;
                this.store.meta.settings.reducedMotion = on;
                this.store.flushMeta();
            }
        };
    }
    async login() {
        const r = await this.pi.login();
        if (r.ok) {
            this.ui.setLoginState(r.value.username, true);
            this.ui.toast(`Signed in as ${r.value.username}`);
            if (await this.pi.ownsGoldUnlock()) {
                this.store.setGoldUnlock(true);
                this.ui.toast('Gold Orb + Shield restored ✓');
            }
        } else {
            this.ui.toast(r.message);
        }
    }
    async buyUnlock() {
        const r = await this.pi.buyGoldUnlock();
        if (r.ok) {
            this.store.setGoldUnlock(true);
            this.renderer.setSkin(1);
            this.store.selectSkin(1);
            this.ui.toast('Unlocked! Gold Orb + Shield ✦');
        } else this.ui.toast(r.message);
    }
}
function bootGame() {
    void new Game().boot();
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootGame, {
        once: true
    });
} else {
    bootGame();
}
