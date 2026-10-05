import { SKINS } from '../game/skins.js';
import { ACHIEVEMENTS } from '../game/achievements.js';
import { missionDef } from '../game/missions.js';
import { FLAGS, GOLD_UNLOCK } from '../config.js';
import { reasonText, timeRemaining, challengeLabel } from '../game/nodeChallenge.js';
export class UI {
    root;
    handlers;
    overlay;
    toastEl;
    hud;
    toastTimer = 0;
    replayHud = null;
    challengeBadge = null;
    current = null;
    constructor(root, handlers){
        this.root = root;
        this.handlers = handlers;
        this.overlay = must(root.querySelector('#overlay'));
        this.toastEl = must(root.querySelector('#toast'));
        this.hud = {
            score: must(root.querySelector('#score')),
            best: must(root.querySelector('#best')),
            coins: must(root.querySelector('#coinCount')),
            mult: must(root.querySelector('#mult')),
            power: must(root.querySelector('#power')),
            login: must(root.querySelector('#loginBtn')),
            user: must(root.querySelector('#userTag'))
        };
        this.hud.login.addEventListener('click', ()=>handlers.onLogin());
    }
    toast(msg) {
        this.toastEl.textContent = msg;
        this.toastEl.classList.add('show');
        clearTimeout(this.toastTimer);
        this.toastTimer = window.setTimeout(()=>this.toastEl.classList.remove('show'), 2600);
    }
    setLoginState(username, inPiBrowser) {
        if (username) {
            this.hud.login.textContent = '@' + username;
            this.hud.login.classList.add('signed');
            this.hud.user.textContent = '@' + username;
        } else {
            this.hud.login.textContent = 'Login with Pi';
            this.hud.user.textContent = inPiBrowser ? 'Not signed in' : 'Open in Pi Browser';
        }
    }
    updateHUD(core) {
        this.hud.score.textContent = String(core.score());
        this.hud.coins.textContent = String(core.coins());
        const m = core.multiplier();
        this.hud.mult.textContent = 'x' + m;
        this.hud.mult.classList.toggle('hot', m >= 3);
        const chips = [];
        if (core.hasShield()) chips.push('🛡');
        if (core.magnetLeft() > 0) chips.push('🧲' + Math.ceil(core.magnetLeft()));
        if (core.boostLeft() > 0) chips.push('»' + Math.ceil(core.boostLeft()));
        if (core.slowmoLeft() > 0) chips.push('◷' + Math.ceil(core.slowmoLeft()));
        this.hud.power.textContent = chips.join('  ');
    }
    setBest(best) {
        this.hud.best.textContent = 'BEST ' + best;
    }
    hideAll() {
        this.overlay.classList.add('hidden');
        this.overlay.innerHTML = '';
        this.current = null;
    }
    panel(html) {
        this.overlay.classList.remove('hidden');
        this.overlay.innerHTML = `<div class="panel">${html}</div>`;
        return this.overlay.firstElementChild;
    }
    showMenu(best, totalCoins) {
        this.current = 'menu';
        const p = this.panel(`
      <div class="panel-eyebrow">ENDLESS ARCADE</div>
      <h1 class="panel-title">PI&nbsp;RUNNER</h1>
      <p class="panel-sub">Dash through the Pi grid. Switch lanes, <b>jump</b> hurdles, <b>slide</b> under bars, and bank <b>π</b>.</p>
      <div class="panel-stats"><div><span>${best}</span><small>BEST</small></div><div><span>${totalCoins}</span><small>π TOTAL</small></div></div>
      <button class="btn-primary" data-a="play">PLAY</button>
      <button class="btn-node" data-a="nodechallenge">
        <span class="btn-node-mark">◆</span>
        <span class="btn-node-text"><b>NODE CHALLENGE</b><small>Same course · verified by your Node</small></span>
      </button>
      <div class="btn-row">
        <button class="btn-ghost" data-a="daily">Daily Run</button>
        <button class="btn-ghost" data-a="skins">Skins</button>
      </div>
      <div class="btn-row">
        <button class="btn-ghost" data-a="missions">Missions</button>
        <button class="btn-ghost" data-a="settings">Settings</button>
      </div>
      <p class="panel-note">Free to play · <a class="link" data-a="nodedash">Node status</a></p>`);
        this.wire(p);
    }
    showTutorial() {
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
    showPause() {
        this.current = 'pause';
        const p = this.panel(`
      <div class="panel-eyebrow">PAUSED</div>
      <h1 class="panel-title">TAKE FIVE</h1>
      <button class="btn-primary" data-a="resume">RESUME</button>
      <div class="btn-row"><button class="btn-ghost" data-a="settings">Settings</button><button class="btn-ghost" data-a="quit">Quit</button></div>`);
        this.wire(p);
    }
    showGameOver(res, opts = {}) {
        this.current = 'gameover';
        const unlockBtn = FLAGS.PI_PAYMENTS_ENABLED && opts.unlockAvailable ? `<button class="btn-ghost" data-a="unlock">Unlock Gold Orb + Shield · <b>${GOLD_UNLOCK.price}</b></button>` : '';
        const reviveBtn = FLAGS.PI_ADS_ENABLED && opts.canRevive ? `<button class="btn-revive" data-a="revive">▶ Watch ad to REVIVE</button>` : '';
        const claimBtn = FLAGS.REWARDS_ENABLED && opts.canClaim ? `<button class="btn-earn" data-a="claim">Claim <b>π</b> reward</button>` : '';
        const p = this.panel(`
      <div class="panel-eyebrow">${res.newBest ? 'NEW BEST!' : 'RUN OVER'}</div>
      <h1 class="panel-title">${res.newBest ? 'RECORD' : 'NICE RUN'}</h1>
      <div class="panel-stats">
        <div><span>${res.score}</span><small>SCORE</small></div>
        <div><span>${res.best}</span><small>BEST</small></div>
        <div><span>${res.coins}</span><small>π</small></div>
        <div><span>${res.distance}</span><small>METERS</small></div>
      </div>
      ${reviveBtn}
      <button class="btn-primary" data-a="restart">PLAY AGAIN</button>
      ${claimBtn}
      <div class="btn-row">
        <button class="btn-ghost" data-a="replay">▶ Watch Replay</button>
        <button class="btn-ghost" data-a="share">Share</button>
      </div>
      ${unlockBtn}
      <button class="btn-ghost" data-a="quit">Menu</button>`);
        this.wire(p);
    }
    showReplayHud(onSkip) {
        this.hideReplayHud();
        const el = document.createElement('div');
        el.className = 'replay-hud';
        el.innerHTML = `<span class="rdot"></span> REPLAY <button class="rskip" type="button">Skip</button>`;
        el.querySelector('.rskip').addEventListener('click', (e)=>{
            e.stopPropagation();
            onSkip();
        });
        this.root.appendChild(el);
        this.replayHud = el;
    }
    hideReplayHud() {
        this.replayHud?.remove();
        this.replayHud = null;
    }
    setChallengeBadge(on) {
        if (on) {
            if (this.challengeBadge) return;
            const el = document.createElement('div');
            el.className = 'nc-badge';
            el.innerHTML = '<span class="nc-dot"></span> NODE CHALLENGE';
            this.root.appendChild(el);
            this.challengeBadge = el;
        } else {
            this.challengeBadge?.remove();
            this.challengeBadge = null;
        }
    }
    showLoading(msg) {
        this.current = 'loading';
        this.panel(`<div class="nc-spinner"></div><p class="panel-sub" style="margin-top:14px">${esc(msg)}</p>`);
    }
    showNodeChallenge(d) {
        this.current = 'nodechallenge';
        const c = d.challenge;
        const nameField = d.isPiUser ? '' : `
      <label class="nc-name">
        <span>Play as</span>
        <input type="text" id="ncName" maxlength="24" placeholder="Player" value="${esc(d.localName)}" />
      </label>`;
        const top = d.top.length ? `<ol class="nc-mini-board">${d.top.map((e)=>`<li><span>${e.rank}</span><b>${esc(e.username)}</b><em>${e.score}</em></li>`).join('')}</ol>` : '<p class="panel-note">No verified runs yet today — be first.</p>';
        const p = this.panel(`
      <div class="panel-eyebrow">NODE CHALLENGE</div>
      <h1 class="panel-title">TODAY'S RUN</h1>
      <p class="panel-sub">Same course. Same rules. <b>Verified by your Pi Runner Node.</b></p>
      <div class="nc-meta">
        <div><span>${esc(challengeLabel(c.id))}</span><small>CHALLENGE</small></div>
        <div><span id="ncTime">${timeRemaining(c.endsAt)}</span><small>REMAINING</small></div>
        <div><span>${d.myBest || '—'}</span><small>YOUR BEST</small></div>
      </div>
      <div class="nc-seed" title="${esc(c.id)}">
        <span class="nc-seed-k">SEED</span>
        <code>${(c.seed >>> 0).toString(16).padStart(8, '0')}</code>
        <span class="nc-seed-tag">${c.seedNamespace === 'public' ? 'shared' : 'node-private'}</span>
      </div>
      ${nameField}
      <button class="btn-primary" data-a="ncplay">START CHALLENGE</button>
      <div class="nc-board-head">TOP VERIFIED</div>
      ${top}
      <div class="btn-row">
        <button class="btn-ghost" data-a="ncboard">Full leaderboard</button>
        <button class="btn-ghost" data-a="back">Back</button>
      </div>
      <p class="panel-note">Verified by ${esc(d.nodeLabel)} · the browser's score is never trusted.</p>`);
        const nameInput = p.querySelector('#ncName');
        if (nameInput) {
            nameInput.addEventListener('change', ()=>this.handlers.onSetLocalName(nameInput.value.trim()));
        }
        const timeEl = p.querySelector('#ncTime');
        if (timeEl) {
            const iv = window.setInterval(()=>{
                if (this.current !== 'nodechallenge' || !document.body.contains(timeEl)) {
                    clearInterval(iv);
                    return;
                }
                timeEl.textContent = timeRemaining(c.endsAt);
            }, 1000);
        }
        this.wire(p);
    }
    showVerifying() {
        this.current = 'verifying';
        this.panel(`
      <div class="panel-eyebrow">NODE CHALLENGE</div>
      <h1 class="panel-title">VERIFYING RUN…</h1>
      <div class="nc-verify">
        <div class="nc-spinner"></div>
        <p class="panel-sub">Your Pi Runner Node is independently re-simulating the run from its seed and your input tape.</p>
      </div>`);
    }
    showChallengeResult(res, challengeId, name) {
        this.current = 'challengeresult';
        if (res.ok && res.verified) {
            const r = res.result;
            const rank = res.rank ? `#${res.rank}` : '—';
            const p = this.panel(`
        <div class="panel-eyebrow ok">RUN VERIFIED</div>
        <div class="nc-seal"><span>✓</span>VERIFIED BY NODE ${esc(res.nodeIdShort)}</div>
        <div class="panel-stats">
          <div><span>${r.score}</span><small>VERIFIED SCORE</small></div>
          <div><span>${rank}</span><small>RANK</small></div>
          <div><span>${r.distance}</span><small>METERS</small></div>
          <div><span>${r.coins}</span><small>π</small></div>
        </div>
        <p class="panel-note">${esc(challengeLabel(challengeId))} · ${esc(name)}${res.idempotent ? ' · already recorded' : ''} · replayed in ${res.latencyMs} ms</p>
        <button class="btn-primary" data-a="ncplay">PLAY AGAIN</button>
        <div class="btn-row">
          <button class="btn-ghost" data-a="ncboard">Leaderboard</button>
          <button class="btn-ghost" data-a="back">Menu</button>
        </div>`);
            this.wire(p);
            return;
        }
        const reason = res.reason;
        const p = this.panel(`
      <div class="panel-eyebrow bad">RUN REJECTED</div>
      <h1 class="panel-title">NOT VERIFIED</h1>
      <p class="panel-sub">${esc(reason === 'NETWORK' ? 'Could not reach your Pi Runner Node — the run was not submitted.' : reasonText(reason))}</p>
      <p class="panel-note">Only runs the Node can reproduce from your input tape are recorded. Nothing was added to the leaderboard.</p>
      <button class="btn-primary" data-a="ncplay">TRY AGAIN</button>
      <button class="btn-ghost" data-a="back">Menu</button>`);
        this.wire(p);
    }
    showNodeDashboard(s) {
        this.current = 'nodedash';
        const up = fmtUptime(s.node.uptimeSeconds);
        const p = this.panel(`
      <div class="panel-eyebrow">PI RUNNER NODE</div>
      <h1 class="panel-title">${esc(s.node.label)}</h1>
      <div class="nc-status"><span class="nc-dot"></span>${esc(s.node.status)}</div>
      <dl class="nc-kv">
        <div><dt>Node ID</dt><dd><code>${esc(s.node.idShort)}</code></dd></div>
        <div><dt>App version</dt><dd>${esc(s.node.appVersion)}</dd></div>
        <div><dt>Simulation</dt><dd>${esc(s.node.simulationVersion)}</dd></div>
        <div><dt>Uptime</dt><dd>${up}</dd></div>
        <div><dt>Today's challenge</dt><dd>${esc(challengeLabel(s.challenge.id))}</dd></div>
        <div><dt>Verified runs today</dt><dd>${s.today.verifiedRuns}</dd></div>
        <div><dt>Rejected runs today</dt><dd>${s.today.rejectedRuns}</dd></div>
        <div><dt>Best verified score</dt><dd>${s.today.bestVerifiedScore || '—'}</dd></div>
        <div><dt>Persistent storage</dt><dd>${s.node.persistentStorage ? 'ready' : 'unavailable'}</dd></div>
      </dl>
      <button class="btn-primary" data-a="back">Back</button>`);
        this.wire(p);
    }
    showChallengeLeaderboard(board, name) {
        this.current = 'challengeboard';
        const rows = board.entries.length ? board.entries.map((e)=>`
        <div class="nc-row ${e.username === name ? 'me' : ''}">
          <span class="nc-rank">${e.rank}</span>
          <span class="nc-user">${esc(e.username)}${e.identityKind === 'pi' ? ' <em class="nc-pi">π</em>' : ''}</span>
          <span class="nc-score">${e.score}</span>
        </div>`).join('') : '<p class="panel-note">No verified runs yet.</p>';
        const p = this.panel(`
      <div class="panel-eyebrow">VERIFIED LEADERBOARD</div>
      <h1 class="panel-title">${esc(challengeLabel(board.challengeId))}</h1>
      <p class="panel-note">${board.count} verified run${board.count === 1 ? '' : 's'} on ${esc(board.scope)} · Node ${esc(board.nodeIdShort)}</p>
      <div class="nc-board">${rows}</div>
      <button class="btn-primary" data-a="back">Back</button>`);
        this.wire(p);
    }
    showSettings(meta, back) {
        this.current = 'settings';
        const s = meta.settings;
        const p = this.panel(`
      <div class="panel-eyebrow">SETTINGS</div>
      <h1 class="panel-title">OPTIONS</h1>
      <label class="row-toggle"><span>Sound effects</span><input type="checkbox" data-t="sound" ${s.sound ? 'checked' : ''}></label>
      <label class="row-toggle"><span>Music</span><input type="checkbox" data-t="music" ${s.music ? 'checked' : ''}></label>
      <label class="row-toggle"><span>Reduced motion</span><input type="checkbox" data-t="motion" ${s.reducedMotion ? 'checked' : ''}></label>
      <button class="btn-primary" data-a="${back === 'pause' ? 'resume-back' : 'back'}">Done</button>`);
        p.querySelector('[data-t="sound"]').addEventListener('change', (e)=>this.handlers.onToggleSound(e.target.checked));
        p.querySelector('[data-t="music"]').addEventListener('change', (e)=>this.handlers.onToggleMusic(e.target.checked));
        p.querySelector('[data-t="motion"]').addEventListener('change', (e)=>this.handlers.onToggleReducedMotion(e.target.checked));
        this.wire(p);
    }
    showSkins(unlockedMask, selected, goldOwned) {
        this.current = 'skins';
        const cards = SKINS.map((sk)=>{
            const unlocked = sk.index === 0 || (sk.index === 1 ? goldOwned : (unlockedMask & 1 << sk.index) !== 0);
            const sel = sk.index === selected;
            return `<button class="skin ${sel ? 'sel' : ''} ${unlocked ? '' : 'locked'}" data-skin="${sk.index}" ${unlocked ? '' : 'disabled'}>
        <span class="swatch" style="background:radial-gradient(circle at 35% 35%, ${sk.inner}, ${sk.outer})"></span>
        <span class="skin-name">${sk.name}</span>
        <span class="skin-unlock">${unlocked ? sel ? 'Selected' : 'Tap to equip' : sk.unlock}</span>
      </button>`;
        }).join('');
        const p = this.panel(`
      <div class="panel-eyebrow">COSMETICS</div>
      <h1 class="panel-title">SKINS</h1>
      <div class="skins">${cards}</div>
      <button class="btn-primary" data-a="back">Back</button>`);
        p.querySelectorAll('[data-skin]').forEach((b)=>b.addEventListener('click', ()=>{
                const idx = Number(b.dataset.skin);
                this.handlers.onSelectSkin(idx);
            }));
        this.wire(p);
    }
    showMissions(meta, achievementsMask) {
        this.current = 'missions';
        const missions = meta.missions.items.map((it)=>{
            const def = missionDef(it.id);
            if (!def) return '';
            const pct = Math.min(100, Math.round(it.progress / def.target * 100));
            return `<div class="mission ${it.done ? 'done' : ''}">
        <div class="mission-top"><span>${def.label}</span><span>${it.done ? '✓' : `${Math.min(it.progress, def.target)}/${def.target}`}</span></div>
        <div class="bar"><i style="width:${pct}%"></i></div></div>`;
        }).join('');
        const achs = ACHIEVEMENTS.map((a)=>{
            const has = (achievementsMask & 1 << a.bit) !== 0;
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
    wire(p) {
        const h = this.handlers;
        const map = {
            play: h.onPlay,
            daily: h.onDaily,
            resume: h.onResume,
            restart: h.onRestart,
            quit: h.onQuitToMenu,
            settings: h.onOpenSettings,
            skins: h.onOpenSkins,
            missions: h.onOpenMissions,
            back: h.onBack,
            unlock: h.onBuyUnlock,
            replay: h.onWatchReplay,
            share: h.onShare,
            revive: h.onWatchAdRevive,
            claim: h.onClaimReward,
            'resume-back': h.onResume,
            nodechallenge: h.onNodeChallenge,
            ncplay: h.onNodeChallengePlay,
            nodedash: h.onOpenNodeDashboard,
            ncboard: h.onOpenChallengeLeaderboard
        };
        p.querySelectorAll('[data-a]').forEach((b)=>{
            const a = b.dataset.a;
            if (map[a]) b.addEventListener('click', ()=>map[a]());
        });
    }
}
function must(el) {
    if (!el) throw new Error('UI element missing');
    return el;
}
function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c)=>({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        })[c]);
}
function fmtUptime(sec) {
    if (sec < 60) return `${sec}s`;
    if (sec < 3600) return `${Math.floor(sec / 60)}m`;
    if (sec < 86400) return `${Math.floor(sec / 3600)}h ${Math.floor(sec % 3600 / 60)}m`;
    return `${Math.floor(sec / 86400)}d ${Math.floor(sec % 86400 / 3600)}h`;
}
