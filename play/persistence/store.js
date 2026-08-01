const PROFILE_KEY = 'pirunner.profile.v1';
const META_KEY = 'pirunner.meta.v1';
export class LocalSaveBackend {
    load(key) {
        try {
            return localStorage.getItem(key);
        } catch  {
            return null;
        }
    }
    save(key, value) {
        try {
            localStorage.setItem(key, value);
        } catch  {}
    }
}
const DEFAULT_META = {
    settings: {
        sound: true,
        music: true,
        reducedMotion: false,
        controls: 'auto'
    },
    missions: {
        day: '',
        items: []
    },
    daily: {
        day: '',
        best: 0
    }
};
export class Store {
    core;
    backend;
    profileBlob;
    view;
    meta;
    constructor(core, backend = new LocalSaveBackend()){
        this.core = core;
        this.backend = backend;
        const raw = backend.load(PROFILE_KEY);
        this.view = raw ? core.profileRead(raw) : core.profileMake();
        if (!this.view.valid || !raw) this.view = core.profileRead(core.profileMake().blob);
        this.profileBlob = this.view.blob;
        const metaRaw = backend.load(META_KEY);
        this.meta = metaRaw ? {
            ...DEFAULT_META,
            ...safeJson(metaRaw)
        } : structuredCloneSafe(DEFAULT_META);
    }
    flushProfile() {
        this.profileBlob = this.core.profileWrite(this.profileBlob, this.view.bestScore, this.view.totalCoins, this.view.totalDistance, this.view.runsPlayed, this.view.skinsUnlocked, this.view.achievements, this.view.selectedSkin, this.view.goldUnlock);
        this.view = this.core.profileRead(this.profileBlob);
        this.backend.save(PROFILE_KEY, this.profileBlob);
    }
    flushMeta() {
        this.backend.save(META_KEY, JSON.stringify(this.meta));
    }
    recordRun(run) {
        const newBest = run.score > this.view.bestScore;
        this.view.bestScore = Math.max(this.view.bestScore, run.score);
        this.view.totalCoins += run.coins;
        this.view.totalDistance += run.distance;
        this.view.runsPlayed += 1;
        this.flushProfile();
        return newBest;
    }
    unlockSkin(index) {
        this.view.skinsUnlocked |= 1 << index;
        this.flushProfile();
    }
    isSkinUnlocked(index) {
        return (this.view.skinsUnlocked & 1 << index) !== 0;
    }
    selectSkin(index) {
        this.view.selectedSkin = index;
        this.flushProfile();
    }
    setAchievements(mask) {
        this.view.achievements = mask;
        this.flushProfile();
    }
    setGoldUnlock(on) {
        this.view.goldUnlock = on ? 1 : 0;
        if (on) this.unlockSkin(1);
        this.flushProfile();
    }
    get best() {
        return this.view.bestScore;
    }
    get totalCoins() {
        return this.view.totalCoins;
    }
    get achievementsMask() {
        return this.view.achievements;
    }
    get selectedSkin() {
        return this.view.selectedSkin;
    }
    get goldUnlock() {
        return this.view.goldUnlock === 1;
    }
}
function safeJson(s) {
    try {
        return JSON.parse(s);
    } catch  {
        return {};
    }
}
function structuredCloneSafe(v) {
    return JSON.parse(JSON.stringify(v));
}
