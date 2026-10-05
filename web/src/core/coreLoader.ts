/**
 * Loads the C++ deterministic core compiled to WebAssembly and exposes a
 * typed, ergonomic wrapper. The rest of the app never touches Emscripten glue.
 */
// The Emscripten ES6 module. Types are declared locally since the generated
// glue ships without .d.ts.
// @ts-ignore - generated at build time by scripts/build-wasm.sh
import createPirunCore from './pirun_core.js';

/** Input commands — must match pirun::InputCmd. */
export const Cmd = { None: 0, Left: 1, Right: 2, Jump: 3, Slide: 4 } as const;
/** Game states — must match pirun::GameState. */
export const St = { Menu: 0, Tutorial: 1, Playing: 2, Paused: 3, GameOver: 4 } as const;
/** Player actions — must match pirun::Action. */
export const Act = { Ground: 0, Jumping: 1, Sliding: 2 } as const;
/** Render kinds / subtypes — must match pirun enums. */
export const Kind = { Obstacle: 0, Pickup: 1 } as const;
export const Obstacle = { Barrier: 0, Low: 1, Overhead: 2 } as const;
export const Pickup = { Coin: 0, Gem: 1, Shield: 2, Magnet: 3, Boost: 4, SlowMo: 5 } as const;

export interface RunnerHandle {
  reset(seed: number, unlockShield: boolean, skin: number): void;
  start(): void;
  pause(): void;
  resume(): void;
  revive(): void;
  input(cmd: number): void;
  advance(dt: number): void;
  state(): number;
  playerLane(): number;
  playerAction(): number;
  actionPhase(): number;
  score(): number;
  coins(): number;
  combo(): number;
  multiplier(): number;
  distance(): number;
  speed(): number;
  hasShield(): boolean;
  magnetLeft(): number;
  boostLeft(): number;
  slowmoLeft(): number;
  maxCombo(): number;
  gems(): number;
  powerups(): number;
  renderBuffer(): Float32Array;
  delete(): void;
}

export interface ProfileView {
  valid: boolean;
  blob: string;
  bestScore: number;
  totalCoins: number;
  totalDistance: number;
  runsPlayed: number;
  skinsUnlocked: number;
  achievements: number;
  selectedSkin: number;
  goldUnlock: number;
}

export interface CoreModule {
  Runner: new () => RunnerHandle;
  profileMake(): { blob: string; valid: boolean };
  profileRead(blob: string): ProfileView;
  profileWrite(
    blob: string, bestScore: number, totalCoins: number, totalDistance: number,
    runsPlayed: number, skinsUnlocked: number, achievements: number,
    selectedSkin: number, goldUnlock: number,
  ): string;
}

let cached: CoreModule | null = null;

/** Instantiate the WASM core exactly once. */
export async function loadCore(): Promise<CoreModule> {
  if (cached) return cached;
  cached = (await createPirunCore()) as CoreModule;
  return cached;
}

/** One render entity decoded from the flat WASM buffer. */
export interface RenderEntity { kind: number; subtype: number; lane: number; dist: number; }

/** Decode the packed [kind,subtype,lane,dist]* frame buffer into objects. */
export function decodeRender(buf: Float32Array): RenderEntity[] {
  const out: RenderEntity[] = [];
  for (let i = 0; i + 3 < buf.length; i += 4) {
    out.push({ kind: buf[i], subtype: buf[i + 1], lane: buf[i + 2], dist: buf[i + 3] });
  }
  return out;
}
