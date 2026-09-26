import { SKINS } from '../game/skins.js';
import { ACHIEVEMENTS } from '../game/achievements.js';
import { missionDef } from '../game/missions.js';
import { FLAGS, GOLD_UNLOCK } from '../config.js';
import { reasonText, timeRemaining, challengeLabel } from '../game/nodeChallenge.js';
import { t } from '../i18n.js';
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
            this.hud.login.textContent = t('login.withPi');
            this.hud.user.textContent = inPiBrowser ? t('login.notSignedIn') : t('login.openInBrowser');
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
        this.hud.best.textContent = t('hud.best') + ' ' + best;
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
      <div class="panel-eyebrow">${t('app.subtitle')}</div>
      <h1 class="panel-title">${t('app.title')}</h1>
      <p class="panel-sub">${t('menu.tagline')}</p>
      <div class="panel-stats"><div><span>${best}</span><small>${t('menu.best')}</small></div><div><span>${totalCoins}</span><small>${t('menu.total')}</small></div></div>
      <button class="btn-primary" data-a="play">${t('menu.play')}</button>
      <button class="btn-node" data-a="nodechallenge">
        <span class="btn-node-mark">◆</span>
        <span class="btn-node-text"><b>${t('menu.nodeChallenge')}</b><small>${t('menu.nodeChallengeSub')}</small></span>
      </button>
      <div class="btn-row">
        <button class="btn-ghost" data-a="season">${t('menu.season')}</button>
        <button class="btn-ghost" data-a="daily">${t('menu.daily')}</button>
      </div>
      <div class="btn-row">
        <button class="btn-ghost" data-a="missions">${t('menu.missions')}</button>
        <button class="btn-ghost" data-a="skins">${t('menu.skins')}</button>
      </div>
      <div class="btn-row">
        <button class="btn-ghost" data-a="settings">${t('menu.settings')}</button>
      </div>
      <p class="panel-note">${t('menu.free')} · <a class="link" data-a="nodedash">${t('menu.nodeStatus')}</a></p>`);
        this.wire(p);
    }
    showTutorial() {
        this.current = 'tutorial';
        const p = this.panel(`
      <div class="panel-eyebrow">${t('tutorial.howToPlay')}</div>
      <h1 class="panel-title">${t('tutorial.ready')}</h1>
      <ul class="how">
        <li><b>←/→</b> ${t('tutorial.lane')}</li>
        <li><b>↑ / space</b> ${t('tutorial.jump')}</li>
        <li><b>↓</b> ${t('tutorial.slide')}</li>
        <li>${t('tutorial.combo')}</li>
        <li>${t('tutorial.powerups')}</li>
      </ul>
      <button class="btn-primary" data-a="play">${t('tutorial.start')}</button>
      <button class="btn-ghost" data-a="back">${t('common.back')}</button>`);
        this.wire(p);
    }
    showPause() {
        this.current = 'pause';
        const p = this.panel(`
      <div class="panel-eyebrow">${t('pause.title')}</div>
      <h1 class="panel-title">${t('pause.sub')}</h1>
      <button class="btn-primary" data-a="resume">${t('pause.resume')}</button>
      <div class="btn-row"><button class="btn-ghost" data-a="settings">${t('menu.settings')}</button><button class="btn-ghost" data-a="quit">${t('pause.quit')}</button></div>`);
        this.wire(p);
    }
    showGameOver(res, opts = {}) {
        this.current = 'gameover';
        const unlockBtn = FLAGS.PI_PAYMENTS_ENABLED && opts.unlockAvailable ? `<button class="btn-ghost" data-a="unlock">${t('gameover.unlock')} · <b>${GOLD_UNLOCK.price}</b></button>` : '';
        const reviveBtn = FLAGS.PI_ADS_ENABLED && opts.canRevive ? `<button class="btn-revive" data-a="revive">${t('gameover.revive')}</button>` : '';
        const claimBtn = FLAGS.REWARDS_ENABLED && opts.canClaim ? `<button class="btn-earn" data-a="claim">${t('gameover.claim')}</button>` : '';
        const p = this.panel(`
      <div class="panel-eyebrow">${res.newBest ? t('gameover.newBest') : t('gameover.runOver')}</div>
      <h1 class="panel-title">${res.newBest ? t('gameover.record') : t('gameover.niceRun')}</h1>
      <div class="panel-stats">
        <div><span>${res.score}</span><small>${t('gameover.score')}</small></div>
        <div><span>${res.best}</span><small>${t('menu.best')}</small></div>
        <div><span>${res.coins}</span><small>π</small></div>
        <div><span>${res.distance}</span><small>${t('gameover.meters')}</small></div>
      </div>
      ${reviveBtn}
      <button class="btn-primary" data-a="restart">${t('gameover.again')}</button>
      ${claimBtn}
      <div class="btn-row">
        <button class="btn-ghost" data-a="replay">${t('gameover.replay')}</button>
        <button class="btn-ghost" data-a="share">${t('gameover.share')}</button>
      </div>
      ${unlockBtn}
      <button class="btn-ghost" data-a="quit">${t('common.menu')}</button>`);
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
        <span>${t('nc.playAs')}</span>
        <input type="text" id="ncName" maxlength="24" placeholder="${t('nc.player')}" value="${esc(d.localName)}" />
      </label>`;
        const top = d.top.length ? `<ol class="nc-mini-board">${d.top.map((e)=>`<li><span>${e.rank}</span><b>${esc(e.username)}</b><em>${e.score}</em></li>`).join('')}</ol>` : `<p class="panel-note">${t('nc.noneToday')}</p>`;
        const p = this.panel(`
      <div class="panel-eyebrow">${t('nc.title')}</div>
      <h1 class="panel-title">${t('nc.todaysRun')}</h1>
      <p class="panel-sub">${t('nc.sameCourse')}</p>
      <div class="nc-meta">
        <div><span>${esc(challengeLabel(c.id))}</span><small>${t('nc.challenge')}</small></div>
        <div><span id="ncTime">${timeRemaining(c.endsAt)}</span><small>${t('nc.remaining')}</small></div>
        <div><span>${d.myBest || '—'}</span><small>${t('nc.yourBest')}</small></div>
      </div>
      <div class="nc-seed" title="${esc(c.id)}">
        <span class="nc-seed-k">${t('nc.seed')}</span>
        <code>${(c.seed >>> 0).toString(16).padStart(8, '0')}</code>
        <span class="nc-seed-tag">${c.seedNamespace === 'public' ? t('nc.shared') : t('nc.nodePrivate')}</span>
      </div>
      ${nameField}
      <button class="btn-primary" data-a="ncplay">${t('nc.start')}</button>
      <div class="nc-board-head">${t('nc.topVerified')}</div>
      ${top}
      <div class="btn-row">
        <button class="btn-ghost" data-a="ncboard">${t('nc.fullBoard')}</button>
        <button class="btn-ghost" data-a="back">${t('common.back')}</button>
      </div>
      <p class="panel-note">${t('nc.verifiedBy', {
            node: esc(d.nodeLabel)
        })}</p>`);
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
      <div class="panel-eyebrow">${t('nc.title')}</div>
      <h1 class="panel-title">${t('nc.verifying')}</h1>
      <div class="nc-verify">
        <div class="nc-spinner"></div>
        <p class="panel-sub">${t('nc.verifyingSub')}</p>
      </div>`);
    }
    showChallengeResult(res, challengeId, name) {
        this.current = 'challengeresult';
        if (res.ok && res.verified) {
            const r = res.result;
            const rank = res.rank ? `#${res.rank}` : '—';
            const p = this.panel(`
        <div class="panel-eyebrow ok">${t('nc.verified')}</div>
        <div class="nc-seal"><span>✓</span>${t('nc.verifiedByNode', {
                node: esc(res.nodeIdShort)
            })}</div>
        <div class="panel-stats">
          <div><span>${r.score}</span><small>${t('nc.verifiedScore')}</small></div>
          <div><span>${rank}</span><small>${t('nc.rank')}</small></div>
          <div><span>${r.distance}</span><small>${t('gameover.meters')}</small></div>
          <div><span>${r.coins}</span><small>π</small></div>
        </div>
        <p class="panel-note">${esc(challengeLabel(challengeId))} · ${esc(name)}${res.idempotent ? ' · ' + t('nc.alreadyRecorded') : ''} · ${t('nc.replayedIn', {
                ms: res.latencyMs
            })}</p>
        <button class="btn-primary" data-a="ncplay">${t('gameover.again')}</button>
        <div class="btn-row">
          <button class="btn-ghost" data-a="ncboard">${t('nc.leaderboard')}</button>
          <button class="btn-ghost" data-a="back">${t('common.menu')}</button>
        </div>`);
            this.wire(p);
            return;
        }
        const reason = res.reason;
        const p = this.panel(`
      <div class="panel-eyebrow bad">${t('nc.rejected')}</div>
      <h1 class="panel-title">${t('nc.notVerified')}</h1>
      <p class="panel-sub">${esc(reason === 'NETWORK' ? t('nc.couldNotReach') : reasonText(reason))}</p>
      <p class="panel-note">${t('nc.onlyReproduced')}</p>
      <button class="btn-primary" data-a="ncplay">${t('nc.tryAgain')}</button>
      <button class="btn-ghost" data-a="back">${t('common.menu')}</button>`);
        this.wire(p);
    }
    showNodeDashboard(s) {
        this.current = 'nodedash';
        const up = fmtUptime(s.node.uptimeSeconds);
        const p = this.panel(`
      <div class="panel-eyebrow">${t('node.title')}</div>
      <h1 class="panel-title">${esc(s.node.label)}</h1>
      <div class="nc-status"><span class="nc-dot"></span>${esc(s.node.status)}</div>
      <dl class="nc-kv">
        <div><dt>${t('node.id')}</dt><dd><code>${esc(s.node.idShort)}</code></dd></div>
        <div><dt>${t('node.appVersion')}</dt><dd>${esc(s.node.appVersion)}</dd></div>
        <div><dt>${t('node.simulation')}</dt><dd>${esc(s.node.simulationVersion)}</dd></div>
        <div><dt>${t('node.uptime')}</dt><dd>${up}</dd></div>
        <div><dt>${t('node.todaysChallenge')}</dt><dd>${esc(challengeLabel(s.challenge.id))}</dd></div>
        <div><dt>${t('node.verifiedToday')}</dt><dd>${s.today.verifiedRuns}</dd></div>
        <div><dt>${t('node.rejectedToday')}</dt><dd>${s.today.rejectedRuns}</dd></div>
        <div><dt>${t('node.bestVerified')}</dt><dd>${s.today.bestVerifiedScore || '—'}</dd></div>
        <div><dt>${t('node.storage')}</dt><dd>${s.node.persistentStorage ? t('node.ready') : t('node.unavailable')}</dd></div>
      </dl>
      <button class="btn-primary" data-a="back">${t('common.back')}</button>`);
        this.wire(p);
    }
    showChallengeLeaderboard(board, name) {
        this.current = 'challengeboard';
        const rows = board.entries.length ? board.entries.map((e)=>`
        <div class="nc-row ${e.username === name ? 'me' : ''}">
          <span class="nc-rank">${e.rank}</span>
          <span class="nc-user">${esc(e.username)}${e.identityKind === 'pi' ? ' <em class="nc-pi">π</em>' : ''}</span>
          <span class="nc-score">${e.score}</span>
        </div>`).join('') : `<p class="panel-note">${t('nc.none')}</p>`;
        const p = this.panel(`
      <div class="panel-eyebrow">${t('nc.boardTitle')}</div>
      <h1 class="panel-title">${esc(challengeLabel(board.challengeId))}</h1>
      <p class="panel-note">${t('nc.boardCount', {
            count: board.count,
            scope: esc(board.scope),
            node: esc(board.nodeIdShort)
        })}</p>
      <div class="nc-board">${rows}</div>
      <button class="btn-primary" data-a="back">${t('common.back')}</button>`);
        this.wire(p);
    }
    showSeason(season) {
        this.current = 'season';
        const rows = season.entries.length ? season.entries.map((e)=>`
        <div class="nc-row">
          <span class="nc-rank">${e.rank}</span>
          <span class="nc-user">${esc(e.username)}</span>
          <span class="nc-score">${e.score}</span>
        </div>`).join('') : `<p class="panel-note">${t('season.empty')}</p>`;
        const p = this.panel(`
      <div class="panel-eyebrow">${t('season.title')}</div>
      <h1 class="panel-title">${esc(season.id)}</h1>
      <div class="nc-meta">
        <div><span>${esc(season.id)}</span><small>${t('season.current')}</small></div>
        <div><span>${esc(season.endsAt)}</span><small>${t('season.ends')}</small></div>
        <div><span>${season.count}</span><small>${t('gameover.score')}</small></div>
      </div>
      <div class="nc-board-head">${t('season.top')}</div>
      <div class="nc-board">${rows}</div>
      <p class="panel-note">${t('season.note')}</p>
      <button class="btn-primary" data-a="back">${t('common.back')}</button>`);
        this.wire(p);
    }
    showSettings(meta, back) {
        this.current = 'settings';
        const s = meta.settings;
        const p = this.panel(`
      <div class="panel-eyebrow">${t('settings.title')}</div>
      <h1 class="panel-title">${t('settings.options')}</h1>
      <label class="row-toggle"><span>${t('settings.sound')}</span><input type="checkbox" data-t="sound" ${s.sound ? 'checked' : ''}></label>
      <label class="row-toggle"><span>${t('settings.music')}</span><input type="checkbox" data-t="music" ${s.music ? 'checked' : ''}></label>
      <label class="row-toggle"><span>${t('settings.motion')}</span><input type="checkbox" data-t="motion" ${s.reducedMotion ? 'checked' : ''}></label>
      <label class="row-toggle"><span>${t('settings.language')}</span><button class="btn-ghost" data-a="lang" type="button">English / தமிழ்</button></label>
      <button class="btn-primary" data-a="${back === 'pause' ? 'resume-back' : 'back'}">${t('common.done')}</button>`);
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
        <span class="skin-unlock">${unlocked ? sel ? t('skins.selected') : t('skins.tapToEquip') : sk.unlock}</span>
      </button>`;
        }).join('');
        const p = this.panel(`
      <div class="panel-eyebrow">${t('skins.title')}</div>
      <h1 class="panel-title">${t('skins.skins')}</h1>
      <div class="skins">${cards}</div>
      <button class="btn-primary" data-a="back">${t('common.back')}</button>`);
        p.querySelectorAll('[data-skin]').forEach((b)=>{
            const idx = Number(b.dataset.skin);
            b.addEventListener('click', ()=>this.handlers.onSelectSkin(idx));
        });
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
      <div class="panel-eyebrow">${t('missions.title')}</div>
      <h1 class="panel-title">${t('missions.goals')}</h1>
      <div class="missions">${missions || `<p class="panel-note">${t('missions.rollNew')}</p>`}</div>
      <div class="panel-eyebrow" style="margin-top:14px">${t('missions.achievements')}</div>
      <div class="achs">${achs}</div>
      <button class="btn-primary" data-a="back">${t('common.back')}</button>`);
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
            season: h.onOpenSeason,
            back: h.onBack,
            unlock: h.onBuyUnlock,
            replay: h.onWatchReplay,
            share: h.onShare,
            lang: h.onToggleLanguage,
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
export function esc(s) {
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
