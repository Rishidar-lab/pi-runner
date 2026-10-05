import createPirunCore from './pirun_core.js';
export const Cmd = {
    None: 0,
    Left: 1,
    Right: 2,
    Jump: 3,
    Slide: 4
};
export const St = {
    Menu: 0,
    Tutorial: 1,
    Playing: 2,
    Paused: 3,
    GameOver: 4
};
export const Act = {
    Ground: 0,
    Jumping: 1,
    Sliding: 2
};
export const Kind = {
    Obstacle: 0,
    Pickup: 1
};
export const Obstacle = {
    Barrier: 0,
    Low: 1,
    Overhead: 2
};
export const Pickup = {
    Coin: 0,
    Gem: 1,
    Shield: 2,
    Magnet: 3,
    Boost: 4,
    SlowMo: 5
};
let cached = null;
export async function loadCore() {
    if (cached) return cached;
    cached = await createPirunCore();
    return cached;
}
export function decodeRender(buf) {
    const out = [];
    for(let i = 0; i + 3 < buf.length; i += 4){
        out.push({
            kind: buf[i],
            subtype: buf[i + 1],
            lane: buf[i + 2],
            dist: buf[i + 3]
        });
    }
    return out;
}
