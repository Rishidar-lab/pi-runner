const REASON_TEXT = {
    INVALID_RUN_ID: 'This run was not recognised by the node.',
    RUN_ALREADY_USED: 'This run has already been submitted.',
    RUN_IN_PROGRESS: 'This run is still being verified.',
    RUN_EXPIRED: 'This run session expired before it was submitted.',
    CHALLENGE_EXPIRED: "Today's challenge has closed.",
    SEED_MISMATCH: 'The run did not use the issued challenge seed.',
    CHALLENGE_MISMATCH: 'The run targeted a different challenge.',
    VERSION_MISMATCH: 'This run was recorded on an incompatible game version.',
    INVALID_INPUT_TAPE: 'The recorded input tape was malformed.',
    TAPE_TOO_LONG: 'The recorded input tape was too large.',
    RUN_TOO_LONG: 'The run exceeded the maximum length.',
    REPLAY_MISMATCH: 'The node could not reproduce this run.',
    SCORE_MISMATCH: 'The node re-simulated the run and the score did not match.',
    DISTANCE_MISMATCH: 'The node re-simulated the run and the distance did not match.',
    COINS_MISMATCH: 'The node re-simulated the run and the π count did not match.',
    REPLAY_INCOMPLETE: 'The recorded run did not play through to its end.',
    FINAL_TICK_MISMATCH: 'The recorded run length did not match the replay.',
    REPLAY_ERROR: 'The node hit an error while re-simulating the run.',
    AUTH_REQUIRED: 'Sign in with Pi to submit a verified run on this node.',
    AUTH_INVALID: 'Your Pi session could not be verified.'
};
export function reasonText(reason) {
    return reason && REASON_TEXT[reason] || 'The node rejected this run.';
}
export class NodeChallengeClient {
    base;
    constructor(base = ''){
        this.base = base;
    }
    async getJson(path) {
        const r = await fetch(this.base + path, {
            headers: {
                Accept: 'application/json'
            }
        });
        if (!r.ok) throw new Error(`${path} -> ${r.status}`);
        return r.json();
    }
    async current() {
        const j = await this.getJson('/api/challenge/current');
        return j.challenge;
    }
    async start() {
        const r = await fetch(this.base + '/api/challenge/start', {
            method: 'POST',
            headers: {
                Accept: 'application/json'
            }
        });
        const j = await r.json();
        if (!j.ok) throw new Error('could not start challenge run');
        return j.run;
    }
    async submit(p) {
        const r = await fetch(this.base + '/api/challenge/submit', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json'
            },
            body: JSON.stringify({
                runId: p.ticket.runId,
                challengeId: p.ticket.challengeId,
                seed: p.ticket.seed,
                simulationVersion: p.ticket.simulationVersion,
                tapeVersion: p.ticket.tapeVersion,
                steps: p.steps,
                tapeSteps: p.tapeSteps,
                tapeCmds: p.tapeCmds,
                claimed: {
                    score: p.score,
                    distance: p.distance,
                    coins: p.coins
                },
                accessToken: p.accessToken ?? undefined,
                localName: p.localName ?? undefined
            })
        });
        return await r.json();
    }
    async leaderboard(challengeId) {
        const q = challengeId ? `?challengeId=${encodeURIComponent(challengeId)}` : '';
        return this.getJson(`/api/challenge/leaderboard${q}`);
    }
    async nodeStatus() {
        const j = await this.getJson('/api/node/status');
        return {
            node: j.node,
            challenge: j.challenge,
            today: j.today
        };
    }
}
export function timeRemaining(endsAt, now = Date.now()) {
    const ms = new Date(endsAt).getTime() - now;
    if (ms <= 0) return 'closed';
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor(ms % 3_600_000 / 60_000);
    if (h >= 1) return `${h}h ${m}m`;
    const s = Math.floor(ms % 60_000 / 1000);
    return `${m}m ${s}s`;
}
export function challengeLabel(id) {
    const m = /^([a-z-]+):(\d{4})-(\d{2})-(\d{2}):v\d+$/.exec(id);
    if (!m) return id;
    const [, type, , mo, da] = m;
    const month = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec'
    ][Number(mo) - 1] || mo;
    return `${type} · ${month} ${Number(da)}`;
}
