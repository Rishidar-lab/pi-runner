/**
 * Persistence layer with a clean abstraction so a cloud backend can be dropped
 * in later without touching game code.
 *
 * The profile blob itself is produced and validated by the C++ core (checksum-
 * guarded), so this layer only moves opaque strings around. Meta collections
 * (missions / dailies) are small JSON documents kept alongside it.
 */
import type { CoreModule, ProfileView } from '../core/coreLoader.js';

const PROFILE_KEY = 'pirunner.profile.v1';
const META_KEY = 'pirunner.meta.v1';

/** Where saves live. Swap `LocalSaveBackend` for a cloud one in the future. */
export interface SaveBackend {
  load(key: string): string | null;
  save(key: string, value: string): void;
}

export class LocalSaveBackend implements SaveBackend {
  load(key: string): string | null {
    try { return localStorage.getItem(key); } catch { return null; }
  }
  save(key: string, value: string): void {
    try { localStorage.setItem(key, value); } catch { /* private mode: ignore */ }
  }
}

export interface MetaDoc {
  /** Persisted settings. */
  settings: { sound: boolean; music: boolean; reducedMotion: boolean; controls: 'auto' | 'buttons' };
  /** Session missions with progress. */
  missions: { day: string; items: Array<{ id: string; done: boolean; progress: number }> };
  /** Daily challenge best result, keyed by date. */
  daily: { day: string; best: number };
}

const DEFAULT_META: MetaDoc = {
  settings: { sound: true, music: true, reducedMotion: false, controls: 'auto' },
  missions: { day: '', items: [] },
  daily: { day: '', best: 0 },
};

export class Store {
  private profileBlob: string;
  view: ProfileView;
  meta: MetaDoc;

  constructor(private core: CoreModule, private backend: SaveBackend = new LocalSaveBackend()) {
    const raw = backend.load(PROFILE_KEY);
    // profileRead validates + normalizes; invalid/tampered => fresh defaults.
    this.view = raw ? core.profileRead(raw) : core.profileMake() as ProfileView;
    if (!this.view.valid || !raw) this.view = core.profileRead((core.profileMake()).blob);
    this.profileBlob = this.view.blob;

    const metaRaw = backend.load(META_KEY);
    this.meta = metaRaw ? { ...DEFAULT_META, ...safeJson(metaRaw) } : structuredCloneSafe(DEFAULT_META);
  }

  /** Persist the current profile view via the C++ writer (re-checksummed). */
  private flushProfile(): void {
    this.profileBlob = this.core.profileWrite(
      this.profileBlob,
      this.view.bestScore, this.view.totalCoins, this.view.totalDistance,
      this.view.runsPlayed, this.view.skinsUnlocked, this.view.achievements,
      this.view.selectedSkin, this.view.goldUnlock,
    );
    this.view = this.core.profileRead(this.profileBlob);
    this.backend.save(PROFILE_KEY, this.profileBlob);
  }

  flushMeta(): void { this.backend.save(META_KEY, JSON.stringify(this.meta)); }

  /** Fold a finished run into lifetime totals. Returns true if a new best. */
  recordRun(run: { score: number; coins: number; distance: number }): boolean {
    const newBest = run.score > this.view.bestScore;
    this.view.bestScore = Math.max(this.view.bestScore, run.score);
    this.view.totalCoins += run.coins;
    this.view.totalDistance += run.distance;
    this.view.runsPlayed += 1;
    this.flushProfile();
    return newBest;
  }

  unlockSkin(index: number): void { this.view.skinsUnlocked |= (1 << index); this.flushProfile(); }
  isSkinUnlocked(index: number): boolean { return (this.view.skinsUnlocked & (1 << index)) !== 0; }
  selectSkin(index: number): void { this.view.selectedSkin = index; this.flushProfile(); }
  setAchievements(mask: number): void { this.view.achievements = mask; this.flushProfile(); }
  setGoldUnlock(on: boolean): void { this.view.goldUnlock = on ? 1 : 0; if (on) this.unlockSkin(1); this.flushProfile(); }

  get best(): number { return this.view.bestScore; }
  get totalCoins(): number { return this.view.totalCoins; }
  get achievementsMask(): number { return this.view.achievements; }
  get selectedSkin(): number { return this.view.selectedSkin; }
  get goldUnlock(): boolean { return this.view.goldUnlock === 1; }
}

function safeJson(s: string): Partial<MetaDoc> {
  try { return JSON.parse(s); } catch { return {}; }
}
function structuredCloneSafe<T>(v: T): T { return JSON.parse(JSON.stringify(v)); }
