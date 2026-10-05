import { Act, Kind, Obstacle, Pickup, decodeRender } from '../core/coreLoader.js';
import { skinByIndex } from '../game/skins.js';
const SPAWN_AHEAD = 100;
const NEAR = 26;
export class Renderer {
    canvas;
    ctx;
    w = 0;
    h = 0;
    dpr = 1;
    horizonY = 0;
    playerY = 0;
    centerX = 0;
    playerX = 0;
    particles = [];
    stars = [];
    shake = 0;
    gridPhase = 0;
    skin = skinByIndex(0);
    reducedMotion = false;
    constructor(canvas){
        this.canvas = canvas;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('2D canvas unavailable');
        this.ctx = ctx;
        this.resize();
    }
    setSkin(index) {
        this.skin = skinByIndex(index);
    }
    resize() {
        const rect = this.canvas.getBoundingClientRect();
        this.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
        this.w = Math.max(1, Math.floor(rect.width));
        this.h = Math.max(1, Math.floor(rect.height));
        this.canvas.width = Math.floor(this.w * this.dpr);
        this.canvas.height = Math.floor(this.h * this.dpr);
        this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        this.horizonY = this.h * 0.30;
        this.playerY = this.h * 0.80;
        this.centerX = this.w / 2;
        if (!this.playerX) this.playerX = this.centerX;
        if (this.stars.length === 0) this.seedStars();
    }
    seedStars() {
        this.stars = [];
        for(let i = 0; i < 60; i++){
            this.stars.push({
                x: Math.random() * this.w,
                y: Math.random() * this.horizonY,
                z: 0.3 + Math.random() * 1.6,
                tw: Math.random() * Math.PI * 2
            });
        }
    }
    proj(dist) {
        return NEAR / (NEAR + Math.max(0, dist));
    }
    screenY(dist) {
        return this.horizonY + (this.playerY - this.horizonY) * this.proj(dist);
    }
    laneSpacing(p) {
        return this.w * 0.26 * p;
    }
    laneX(lane, p) {
        return this.centerX + (lane - 1) * this.laneSpacing(p);
    }
    laneXAtPlayer(lane) {
        return this.laneX(lane, 1);
    }
    playerRowY() {
        return this.playerY;
    }
    burst(x, y, color, count) {
        if (this.reducedMotion) count = Math.min(count, 6);
        for(let i = 0; i < count; i++){
            const a = Math.random() * Math.PI * 2;
            const sp = 40 + Math.random() * 170;
            this.particles.push({
                x,
                y,
                vx: Math.cos(a) * sp,
                vy: Math.sin(a) * sp - 40,
                life: 0.5 + Math.random() * 0.4,
                age: 0,
                r: 1.5 + Math.random() * 2.8,
                color
            });
        }
    }
    kick(amount = 10) {
        if (!this.reducedMotion) this.shake = Math.max(this.shake, amount);
    }
    frame(core, dt, speed) {
        const ctx = this.ctx;
        const playing = core.state() === 2;
        const targetX = this.laneX(core.playerLane(), 1);
        this.playerX += (targetX - this.playerX) * Math.min(1, dt * 14);
        this.gridPhase = (this.gridPhase + (playing ? speed : 6) * dt * 0.06) % 1;
        for (const s of this.stars){
            s.tw += dt * 3;
            s.y += (playing ? speed : 6) * 0.02 * s.z * dt;
            if (s.y > this.horizonY) {
                s.y = 0;
                s.x = Math.random() * this.w;
            }
        }
        for (const p of this.particles){
            p.age += dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy += 220 * dt;
        }
        this.particles = this.particles.filter((p)=>p.age < p.life);
        let sx = 0, sy = 0;
        if (this.shake > 0) {
            sx = (Math.random() - 0.5) * this.shake;
            sy = (Math.random() - 0.5) * this.shake;
            this.shake = Math.max(0, this.shake - dt * 40);
        }
        ctx.save();
        ctx.translate(sx, sy);
        this.drawBackground();
        this.drawRoad(speed);
        const items = decodeRender(core.renderBuffer()).sort((a, b)=>b.dist - a.dist);
        for (const e of items)this.drawEntity(e.kind, e.subtype, e.lane, e.dist);
        this.drawPlayer(core);
        this.drawParticles();
        ctx.restore();
    }
    drawBackground() {
        const ctx = this.ctx;
        const g = ctx.createLinearGradient(0, 0, 0, this.h);
        g.addColorStop(0, '#0a0618');
        g.addColorStop(0.30, '#150a2e');
        g.addColorStop(0.55, '#1e0c3a');
        g.addColorStop(1, '#0a0714');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, this.w, this.h);
        const sun = ctx.createRadialGradient(this.centerX, this.horizonY, 4, this.centerX, this.horizonY, this.w * 0.5);
        sun.addColorStop(0, 'rgba(255,120,190,0.30)');
        sun.addColorStop(0.5, 'rgba(120,80,255,0.12)');
        sun.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = sun;
        ctx.fillRect(0, 0, this.w, this.horizonY + 40);
        for (const s of this.stars){
            ctx.fillStyle = `rgba(200,210,255,${0.3 + 0.4 * Math.sin(s.tw)})`;
            ctx.fillRect(s.x, s.y, s.z, s.z);
        }
    }
    drawRoad(_speed) {
        const ctx = this.ctx;
        ctx.beginPath();
        ctx.moveTo(this.laneX(-0.6, 1), this.playerY + 60);
        ctx.lineTo(this.laneX(2.6, 1), this.playerY + 60);
        ctx.lineTo(this.laneX(2.6, this.proj(SPAWN_AHEAD)), this.screenY(SPAWN_AHEAD));
        ctx.lineTo(this.laneX(-0.6, this.proj(SPAWN_AHEAD)), this.screenY(SPAWN_AHEAD));
        ctx.closePath();
        const rg = ctx.createLinearGradient(0, this.horizonY, 0, this.h);
        rg.addColorStop(0, 'rgba(40,20,80,0.5)');
        rg.addColorStop(1, 'rgba(20,10,40,0.85)');
        ctx.fillStyle = rg;
        ctx.fill();
        for(let l = 0; l <= 3; l++){
            const lane = l - 0.5;
            ctx.beginPath();
            ctx.moveTo(this.laneX(lane, 1), this.playerY + 60);
            ctx.lineTo(this.laneX(lane, this.proj(SPAWN_AHEAD)), this.screenY(SPAWN_AHEAD));
            ctx.strokeStyle = 'rgba(150,120,255,0.18)';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }
        ctx.strokeStyle = 'rgba(120,90,255,0.16)';
        ctx.lineWidth = 1;
        for(let i = 0; i < 12; i++){
            const d = (i + this.gridPhase) / 12 * SPAWN_AHEAD;
            const y = this.screenY(d);
            const p = this.proj(d);
            ctx.beginPath();
            ctx.moveTo(this.laneX(-0.6, p), y);
            ctx.lineTo(this.laneX(2.6, p), y);
            ctx.stroke();
        }
    }
    drawEntity(kind, subtype, lane, dist) {
        if (dist > SPAWN_AHEAD + 4 || dist < -6) return;
        const ctx = this.ctx;
        const p = this.proj(dist);
        const x = this.laneX(lane, p);
        const y = this.screenY(dist);
        const s = Math.max(4, 30 * p);
        if (kind === Kind.Pickup) {
            switch(subtype){
                case Pickup.Coin:
                    this.glyphOrb(x, y, s * 0.55, '#fff0c2', '#ff9d2f', 'π');
                    break;
                case Pickup.Gem:
                    this.diamond(x, y, s * 0.6, '#ffd0ff', '#ff3bd0');
                    break;
                case Pickup.Shield:
                    this.ring(x, y, s * 0.62, 'rgba(62,240,216,');
                    break;
                case Pickup.Magnet:
                    this.icon(x, y, s * 0.6, '#8ad', 'U');
                    break;
                case Pickup.Boost:
                    this.icon(x, y, s * 0.6, '#ffd54a', '»');
                    break;
                case Pickup.SlowMo:
                    this.icon(x, y, s * 0.6, '#7bd', '◷');
                    break;
            }
            return;
        }
        ctx.save();
        if (subtype === Obstacle.Barrier) {
            ctx.shadowColor = 'rgba(255,71,111,0.7)';
            ctx.shadowBlur = 14 * p;
            ctx.fillStyle = '#ff476f';
            this.roundRect(x - s * 0.6, y - s * 1.5, s * 1.2, s * 1.5, 5 * p);
            ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.15)';
            this.roundRect(x - s * 0.6 + 3, y - s * 1.5 + 3, s * 1.2 - 6, s * 0.5, 3);
            ctx.fill();
        } else if (subtype === Obstacle.Low) {
            ctx.shadowColor = 'rgba(255,180,74,0.7)';
            ctx.shadowBlur = 12 * p;
            ctx.fillStyle = '#ffb14a';
            this.roundRect(x - s * 0.7, y - s * 0.5, s * 1.4, s * 0.5, 4 * p);
            ctx.fill();
        } else {
            ctx.shadowColor = 'rgba(62,200,255,0.7)';
            ctx.shadowBlur = 12 * p;
            ctx.fillStyle = '#3ec8ff';
            this.roundRect(x - s * 0.7, y - s * 1.7, s * 1.4, s * 0.4, 4 * p);
            ctx.fill();
            ctx.fillRect(x - s * 0.6, y - s * 1.7, 2 * p, s * 1.3);
            ctx.fillRect(x + s * 0.6 - 2 * p, y - s * 1.7, 2 * p, s * 1.3);
        }
        ctx.restore();
    }
    drawPlayer(core) {
        const ctx = this.ctx;
        const action = core.playerAction();
        const phase = core.actionPhase();
        let y = this.playerY;
        let squashY = 1;
        if (action === Act.Jumping) y -= Math.sin(phase * Math.PI) * this.h * 0.13;
        else if (action === Act.Sliding) {
            squashY = 0.6;
            y += 6;
        }
        const r = Math.max(14, Math.min(24, this.w * 0.055));
        for(let i = 6; i >= 1; i--){
            const a = (1 - i / 8) * 0.20;
            ctx.fillStyle = this.skin.trail + a + ')';
            ctx.beginPath();
            ctx.ellipse(this.playerX, y + i * 3, r * (1 - i / 12), r * (1 - i / 12) * squashY, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.save();
        const og = ctx.createRadialGradient(this.playerX - r / 3, y - r / 3, 2, this.playerX, y, r);
        og.addColorStop(0, this.skin.inner);
        og.addColorStop(1, this.skin.outer);
        ctx.shadowColor = this.skin.glow;
        ctx.shadowBlur = 22;
        ctx.fillStyle = og;
        ctx.beginPath();
        ctx.ellipse(this.playerX, y, r, r * squashY, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        if (core.hasShield()) {
            ctx.save();
            ctx.strokeStyle = 'rgba(62,240,216,0.9)';
            ctx.lineWidth = 2.5;
            ctx.shadowColor = 'rgba(62,240,216,0.7)';
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.arc(this.playerX, y, r + 7, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }
        if (core.magnetLeft() > 0) {
            ctx.strokeStyle = 'rgba(120,180,255,0.5)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(this.playerX, y, r + 12 + Math.sin(performance.now() / 120) * 2, 0, Math.PI * 2);
            ctx.stroke();
        }
    }
    drawParticles() {
        const ctx = this.ctx;
        for (const p of this.particles){
            const a = Math.max(0, 1 - p.age / p.life);
            ctx.globalAlpha = a;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }
    glyphOrb(x, y, r, c0, c1, glyph) {
        const ctx = this.ctx;
        ctx.save();
        ctx.shadowColor = 'rgba(255,188,74,0.8)';
        ctx.shadowBlur = r;
        const g = ctx.createRadialGradient(x, y, 1, x, y, r);
        g.addColorStop(0, c0);
        g.addColorStop(1, c1);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#5a3500';
        ctx.font = `bold ${Math.max(9, r * 1.1)}px Orbitron, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(glyph, x, y + 1);
        ctx.restore();
    }
    diamond(x, y, r, c0, c1) {
        const ctx = this.ctx;
        ctx.save();
        ctx.shadowColor = c1;
        ctx.shadowBlur = r;
        const g = ctx.createLinearGradient(x, y - r, x, y + r);
        g.addColorStop(0, c0);
        g.addColorStop(1, c1);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(x, y - r);
        ctx.lineTo(x + r * 0.8, y);
        ctx.lineTo(x, y + r);
        ctx.lineTo(x - r * 0.8, y);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }
    ring(x, y, r, rgba) {
        const ctx = this.ctx;
        ctx.save();
        ctx.strokeStyle = rgba + '0.95)';
        ctx.lineWidth = Math.max(2, r * 0.28);
        ctx.shadowColor = rgba + '0.8)';
        ctx.shadowBlur = r;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }
    icon(x, y, r, color, ch) {
        const ctx = this.ctx;
        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur = r * 0.8;
        ctx.fillStyle = 'rgba(10,8,24,0.85)';
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = color;
        ctx.font = `bold ${Math.max(10, r)}px Orbitron, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(ch, x, y + 1);
        ctx.restore();
    }
    roundRect(x, y, w, h, r) {
        const c = this.ctx;
        r = Math.min(r, w / 2, h / 2);
        c.beginPath();
        c.moveTo(x + r, y);
        c.arcTo(x + w, y, x + w, y + h, r);
        c.arcTo(x + w, y + h, x, y + h, r);
        c.arcTo(x, y + h, x, y, r);
        c.arcTo(x, y, x + w, y, r);
        c.closePath();
    }
}
