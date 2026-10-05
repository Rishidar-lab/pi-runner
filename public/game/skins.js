export const SKINS = [
    {
        index: 0,
        id: 'classic',
        name: 'Classic Orb',
        inner: '#ffffff',
        outer: '#2bd6c0',
        trail: 'rgba(62,240,216,',
        glow: 'rgba(62,240,216,0.9)',
        unlock: 'Default',
        unlocked: ()=>true
    },
    {
        index: 1,
        id: 'gold',
        name: 'Gold Orb',
        inner: '#fff4cf',
        outer: '#ff9d2f',
        trail: 'rgba(255,207,74,',
        glow: 'rgba(255,188,74,0.95)',
        unlock: 'Pi unlock (optional) — includes a shield each run',
        unlocked: (_t, gold)=>gold
    },
    {
        index: 2,
        id: 'magenta',
        name: 'Nova',
        inner: '#ffe3ff',
        outer: '#ff3bd0',
        trail: 'rgba(255,90,210,',
        glow: 'rgba(255,80,205,0.9)',
        unlock: 'Collect 500 π tokens (lifetime)',
        unlocked: (t)=>t.coins >= 500
    },
    {
        index: 3,
        id: 'violet',
        name: 'Singularity',
        inner: '#efe6ff',
        outer: '#7b5cff',
        trail: 'rgba(140,110,255,',
        glow: 'rgba(140,110,255,0.9)',
        unlock: 'Run 10,000 m (lifetime)',
        unlocked: (t)=>t.distance >= 10000
    },
    {
        index: 4,
        id: 'ember',
        name: 'Ember',
        inner: '#fff0d6',
        outer: '#ff5a3c',
        trail: 'rgba(255,110,80,',
        glow: 'rgba(255,110,80,0.9)',
        unlock: 'Reach a 50,000 score in one run',
        unlocked: (t)=>t.best >= 50000
    }
];
export function skinByIndex(i) {
    return SKINS[i] ?? SKINS[0];
}
