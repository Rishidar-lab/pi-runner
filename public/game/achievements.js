export const ACHIEVEMENTS = [
    {
        bit: 0,
        id: 'first_run',
        name: 'First Steps',
        desc: 'Finish your first run',
        earned: (_r, t)=>t.runs >= 1
    },
    {
        bit: 1,
        id: 'combo_x3',
        name: 'On a Roll',
        desc: 'Reach a x3 multiplier',
        earned: (r)=>r.multiplier >= 3
    },
    {
        bit: 2,
        id: 'dist_1k',
        name: 'Marathoner',
        desc: 'Run 1,000 m in a single run',
        earned: (r)=>r.distance >= 1000
    },
    {
        bit: 3,
        id: 'coins_50',
        name: 'Collector',
        desc: 'Grab 50 π tokens in a run',
        earned: (r)=>r.coins >= 50
    },
    {
        bit: 4,
        id: 'score_10k',
        name: 'High Flyer',
        desc: 'Score 10,000 in a run',
        earned: (r)=>r.score >= 10000
    },
    {
        bit: 5,
        id: 'gem_hunter',
        name: 'Gem Hunter',
        desc: 'Collect a gem',
        earned: (r)=>r.gems >= 1
    },
    {
        bit: 6,
        id: 'power_user',
        name: 'Power User',
        desc: 'Use 3 power-ups in one run',
        earned: (r)=>r.powerups >= 3
    },
    {
        bit: 7,
        id: 'coins_500',
        name: 'Pi Whale',
        desc: 'Collect 500 π tokens (lifetime)',
        earned: (_r, t)=>t.coins >= 500
    },
    {
        bit: 8,
        id: 'combo_x6',
        name: 'Unstoppable',
        desc: 'Reach the max x6 multiplier',
        earned: (r)=>r.multiplier >= 6
    }
];
export function evaluate(prevMask, run, totals) {
    let mask = prevMask;
    const newly = [];
    for (const a of ACHIEVEMENTS){
        const has = (mask & 1 << a.bit) !== 0;
        if (!has && a.earned(run, totals)) {
            mask |= 1 << a.bit;
            newly.push(a);
        }
    }
    return {
        mask,
        newly
    };
}
