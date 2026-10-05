const POOL = [
    {
        id: 'coins_40',
        label: 'Collect 40 π tokens',
        target: 40,
        progress: (r)=>r.coins
    },
    {
        id: 'dist_1500',
        label: 'Run 1,500 m',
        target: 1500,
        progress: (r)=>r.distance
    },
    {
        id: 'combo_x4',
        label: 'Reach a x4 multiplier',
        target: 4,
        progress: (r)=>r.multiplier
    },
    {
        id: 'score_8k',
        label: 'Score 8,000 in a run',
        target: 8000,
        progress: (r)=>r.score
    },
    {
        id: 'gems_2',
        label: 'Collect 2 gems',
        target: 2,
        progress: (r)=>r.gems
    },
    {
        id: 'power_2',
        label: 'Use 2 power-ups',
        target: 2,
        progress: (r)=>r.powerups
    }
];
export function todayKey(d = new Date()) {
    return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
}
export function ensureDailyMissions(meta) {
    const day = todayKey();
    if (meta.missions.day === day && meta.missions.items.length) return;
    const seed = hashString(day);
    const idx = pickThree(seed, POOL.length);
    meta.missions = {
        day,
        items: idx.map((i)=>({
                id: POOL[i].id,
                done: false,
                progress: 0
            }))
    };
    if (meta.daily.day !== day) meta.daily = {
        day,
        best: 0
    };
}
export function missionDef(id) {
    return POOL.find((m)=>m.id === id);
}
export function applyRunToMissions(meta, run) {
    ensureDailyMissions(meta);
    const completed = [];
    for (const item of meta.missions.items){
        if (item.done) continue;
        const def = missionDef(item.id);
        if (!def) continue;
        item.progress = Math.max(item.progress, def.progress(run));
        if (item.progress >= def.target) {
            item.done = true;
            completed.push(def.label);
        }
    }
    return completed;
}
export function dailySeed(d = new Date()) {
    return hashString('daily-' + todayKey(d)) >>> 0;
}
function hashString(s) {
    let h = 2166136261 >>> 0;
    for(let i = 0; i < s.length; i++){
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}
function pickThree(seed, n) {
    const out = [];
    let s = seed || 1;
    while(out.length < Math.min(3, n)){
        s = Math.imul(s, 1664525) + 1013904223 >>> 0;
        const i = s % n;
        if (!out.includes(i)) out.push(i);
    }
    return out;
}
