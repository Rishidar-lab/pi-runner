export class Input {
    surface;
    handlers = new Set();
    touchStart = null;
    constructor(surface){
        this.surface = surface;
        window.addEventListener('keydown', this.onKey);
        surface.addEventListener('touchstart', this.onTouchStart, {
            passive: true
        });
        surface.addEventListener('touchend', this.onTouchEnd, {
            passive: true
        });
        surface.addEventListener('pointerdown', this.onPointer);
    }
    on(fn) {
        this.handlers.add(fn);
    }
    emit(e) {
        this.handlers.forEach((h)=>h(e));
    }
    bindButton(el, e) {
        if (!el) return;
        const fire = (ev)=>{
            ev.preventDefault();
            this.emit(e);
        };
        el.addEventListener('touchstart', fire, {
            passive: false
        });
        el.addEventListener('mousedown', fire);
    }
    onKey = (ev)=>{
        switch(ev.key){
            case 'ArrowLeft':
            case 'a':
            case 'A':
                this.emit('left');
                break;
            case 'ArrowRight':
            case 'd':
            case 'D':
                this.emit('right');
                break;
            case 'ArrowUp':
            case 'w':
            case 'W':
            case ' ':
                this.emit('jump');
                break;
            case 'ArrowDown':
            case 's':
            case 'S':
                this.emit('slide');
                break;
            case 'Escape':
            case 'p':
            case 'P':
                this.emit('pause');
                break;
            case 'Enter':
                this.emit('confirm');
                break;
            default:
                return;
        }
        if (ev.key === ' ' || ev.key.startsWith('Arrow')) ev.preventDefault();
    };
    onTouchStart = (ev)=>{
        const t = ev.touches[0];
        this.touchStart = {
            x: t.clientX,
            y: t.clientY,
            t: performance.now()
        };
    };
    onTouchEnd = (ev)=>{
        if (!this.touchStart) return;
        const t = ev.changedTouches[0];
        const dx = t.clientX - this.touchStart.x;
        const dy = t.clientY - this.touchStart.y;
        const adx = Math.abs(dx), ady = Math.abs(dy);
        const THRESH = 26;
        if (adx < THRESH && ady < THRESH) {
            const rect = this.surface.getBoundingClientRect();
            this.emit(t.clientX - rect.left < rect.width / 2 ? 'left' : 'right');
        } else if (adx > ady) {
            this.emit(dx < 0 ? 'left' : 'right');
        } else {
            this.emit(dy < 0 ? 'jump' : 'slide');
        }
        this.touchStart = null;
    };
    onPointer = (ev)=>{
        if (ev.pointerType === 'touch') return;
        const rect = this.surface.getBoundingClientRect();
        this.emit(ev.clientX - rect.left < rect.width / 2 ? 'left' : 'right');
    };
    dispose() {
        window.removeEventListener('keydown', this.onKey);
        this.surface.removeEventListener('touchstart', this.onTouchStart);
        this.surface.removeEventListener('touchend', this.onTouchEnd);
        this.surface.removeEventListener('pointerdown', this.onPointer);
    }
}
