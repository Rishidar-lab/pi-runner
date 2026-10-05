/**
 * Unified input: keyboard, touch gestures (swipe + tap zones), and on-screen
 * buttons for mobile. Emits abstract commands the game maps to core inputs.
 */
export type InputEvent = 'left' | 'right' | 'jump' | 'slide' | 'pause' | 'confirm';

export class Input {
  private handlers = new Set<(e: InputEvent) => void>();
  private touchStart: { x: number; y: number; t: number } | null = null;

  constructor(private surface: HTMLElement) {
    window.addEventListener('keydown', this.onKey);
    surface.addEventListener('touchstart', this.onTouchStart, { passive: true });
    surface.addEventListener('touchend', this.onTouchEnd, { passive: true });
    // Pointer taps split the surface into left/right (fallback for mice/trackpads).
    surface.addEventListener('pointerdown', this.onPointer);
  }

  on(fn: (e: InputEvent) => void): void { this.handlers.add(fn); }
  private emit(e: InputEvent): void { this.handlers.forEach((h) => h(e)); }

  /** Wire on-screen control buttons (mobile). */
  bindButton(el: HTMLElement | null, e: InputEvent): void {
    if (!el) return;
    const fire = (ev: Event) => { ev.preventDefault(); this.emit(e); };
    el.addEventListener('touchstart', fire, { passive: false });
    el.addEventListener('mousedown', fire);
  }

  private onKey = (ev: KeyboardEvent): void => {
    switch (ev.key) {
      case 'ArrowLeft': case 'a': case 'A': this.emit('left'); break;
      case 'ArrowRight': case 'd': case 'D': this.emit('right'); break;
      case 'ArrowUp': case 'w': case 'W': case ' ': this.emit('jump'); break;
      case 'ArrowDown': case 's': case 'S': this.emit('slide'); break;
      case 'Escape': case 'p': case 'P': this.emit('pause'); break;
      case 'Enter': this.emit('confirm'); break;
      default: return;
    }
    if (ev.key === ' ' || ev.key.startsWith('Arrow')) ev.preventDefault();
  };

  private onTouchStart = (ev: TouchEvent): void => {
    const t = ev.touches[0];
    this.touchStart = { x: t.clientX, y: t.clientY, t: performance.now() };
  };

  private onTouchEnd = (ev: TouchEvent): void => {
    if (!this.touchStart) return;
    const t = ev.changedTouches[0];
    const dx = t.clientX - this.touchStart.x;
    const dy = t.clientY - this.touchStart.y;
    const adx = Math.abs(dx), ady = Math.abs(dy);
    const THRESH = 26;
    if (adx < THRESH && ady < THRESH) {
      // Tap: left/right by screen half.
      const rect = this.surface.getBoundingClientRect();
      this.emit(t.clientX - rect.left < rect.width / 2 ? 'left' : 'right');
    } else if (adx > ady) {
      this.emit(dx < 0 ? 'left' : 'right');
    } else {
      this.emit(dy < 0 ? 'jump' : 'slide');
    }
    this.touchStart = null;
  };

  private onPointer = (ev: PointerEvent): void => {
    if (ev.pointerType === 'touch') return; // handled by touch events
    const rect = this.surface.getBoundingClientRect();
    this.emit(ev.clientX - rect.left < rect.width / 2 ? 'left' : 'right');
  };

  dispose(): void {
    window.removeEventListener('keydown', this.onKey);
    this.surface.removeEventListener('touchstart', this.onTouchStart);
    this.surface.removeEventListener('touchend', this.onTouchEnd);
    this.surface.removeEventListener('pointerdown', this.onPointer);
  }
}
