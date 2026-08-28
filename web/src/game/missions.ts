/**
 * Daily missions + the daily challenge seed.
 *
 * Missions refresh each calendar day and track progress across the day's runs.
 * The daily challenge is a deterministic seeded run (same layout for everyone
 * that day) so scores are directly comparable.
 */
import type { MetaDoc } from '../persistence/store.js';
import type { RunResult } from './achievements.js';

export interface MissionDef {
  id: string;
  label: string;
  target: number;
  /** how much this run contributes toward the mission. */
  progress(run: RunResult): number;
}

const POOL: MissionDef[] = [
  { id: 'coins_40', label: 'Collect 40 π tokens', target: 40, progress: (r) => r.coins },
  { id: 'dist_1500', label: 'Run 1,500 m', target: 1500, progress: (r) => r.distance },
  { id: 'combo_x4', label: 'Reach a x4 multiplier', target: 4, progress: (r) => r.multiplier },
  { id: 'score_8k', label: 'Score 8,000 in a run', target: 8000, progress: (r) => r.score },
  { id: 'gems_2', label: 'Collect 2 gems', target: 2, progress: (r) => r.gems },
  { id: 'power_2', label: 'Use 2 power-ups', target: 2, progress: (r) => r.powerups },
];

export function todayKey(d = new Date()): string {
  return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
}

/** Deterministic 3 missions for the day (seeded by the date). */
export function ensureDailyMissions(meta: MetaDoc): void {
  const day = todayKey();
  if (meta.missions.day === day && meta.missions.items.length) return;
  const seed = hashString(day);
  const idx = pickThree(seed, POOL.length);
  meta.missions = { day, items: idx.map((i) => ({ id: POOL[i].id, done: false, progress: 0 })) };
  if (meta.daily.day !== day) meta.daily = { day, best: 0 };
}

export function missionDef(id: string): MissionDef | undefined { return POOL.find((m) => m.id === id); }

/** Fold a run into today's missions; returns freshly-completed labels. */
export function applyRunToMissions(meta: MetaDoc, run: RunResult): string[] {
  ensureDailyMissions(meta);
  const completed: string[] = [];
  for (const item of meta.missions.items) {
    if (item.done) continue;
    const def = missionDef(item.id);
    if (!def) continue;
    item.progress = Math.max(item.progress, def.progress(run));
    if (item.progress >= def.target) { item.done = true; completed.push(def.label); }
  }
  return completed;
}

/** Deterministic seed for today's daily challenge run. */
export function dailySeed(d = new Date()): number { return hashString('daily-' + todayKey(d)) >>> 0; }

// --- tiny deterministic helpers ---
function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function pickThree(seed: number, n: number): number[] {
  const out: number[] = [];
  let s = seed || 1;
  while (out.length < Math.min(3, n)) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const i = s % n;
    if (!out.includes(i)) out.push(i);
  }
  return out;
}
