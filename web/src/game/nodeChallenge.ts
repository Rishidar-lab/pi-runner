/**
 * Node Challenge — client controller.
 *
 * This module only talks to the local SoloHost node. It NEVER computes an
 * authoritative score: it asks the node for a deterministic seed, plays the run,
 * ships the input tape back, and reports whatever the node's own re-simulation
 * decided. The browser is not trusted and this file does not pretend otherwise.
 */

export interface ChallengeInfo {
  id: string;
  type: string;
  seed: number;
  startsAt: string;
  endsAt: string;
  rulesVersion: number;
  simulationVersion: string;
  seedNamespace: 'public' | 'node-private';
}

export interface RunTicket {
  runId: string;
  challengeId: string;
  seed: number;
  issuedAt: string;
  expiresAt: string;
  rulesVersion: number;
  simulationVersion: string;
  tapeVersion: number;
}

export interface SubmitPayload {
  ticket: RunTicket;
  steps: number;
  tapeSteps: number[];
  tapeCmds: number[];
  score: number;
  distance: number;
  coins: number;
  accessToken?: string | null;
  localName?: string | null;
}

export type VerifyResult =
  | {
      ok: true;
      verified: true;
      idempotent?: boolean;
      result: { score: number; distance: number; coins: number; challengeId: string; verifiedAt: string };
      rank: number | null;
      totalRanked: number | null;
      identityKind: 'pi' | 'local';
      nodeIdShort: string;
      latencyMs: number;
    }
  | { ok: false; verified: false; reason: string };

export interface LeaderboardRow {
  rank: number;
  username: string;
  identityKind: 'pi' | 'local';
  score: number;
  distance: number;
  coins: number;
  verified: true;
  nodeIdShort: string;
  verifiedAt: string;
}

export interface LeaderboardView {
  challengeId: string;
  scope: string;
  nodeIdShort: string;
  count: number;
  entries: LeaderboardRow[];
}

export interface NodeStatus {
  node: {
    id: string;
    idShort: string;
    label: string;
    status: string;
    appVersion: string;
    simulationVersion: string;
    rulesVersion: number;
    tapeVersion: number;
    uptimeSeconds: number;
    createdAt: string;
    persistentStorage: boolean;
    localIdentityAllowed: boolean;
  };
  challenge: ChallengeInfo;
  today: { day: string; verifiedRuns: number; rejectedRuns: number; bestVerifiedScore: number };
}

const REASON_TEXT: Record<string, string> = {
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
  AUTH_INVALID: 'Your Pi session could not be verified.',
};

export function reasonText(reason: string | undefined): string {
  return (reason && REASON_TEXT[reason]) || 'The node rejected this run.';
}

export class NodeChallengeClient {
  /** Base URL for the node API. Empty (default) => same origin, for the browser. */
  constructor(private base = '') {}

  private async getJson<T>(path: string): Promise<T> {
    const r = await fetch(this.base + path, { headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error(`${path} -> ${r.status}`);
    return r.json() as Promise<T>;
  }

  /** The live challenge (id + deterministic seed). */
  async current(): Promise<ChallengeInfo> {
    const j = await this.getJson<{ ok: boolean; challenge: ChallengeInfo }>('/api/challenge/current');
    return j.challenge;
  }

  /** Ask the node to issue a run session. The returned seed is authoritative. */
  async start(): Promise<RunTicket> {
    const r = await fetch(this.base + '/api/challenge/start', { method: 'POST', headers: { Accept: 'application/json' } });
    const j = await r.json();
    if (!j.ok) throw new Error('could not start challenge run');
    return j.run as RunTicket;
  }

  /** Submit the recorded tape for authoritative re-simulation on the node. */
  async submit(p: SubmitPayload): Promise<VerifyResult> {
    const r = await fetch(this.base + '/api/challenge/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        runId: p.ticket.runId,
        challengeId: p.ticket.challengeId,
        seed: p.ticket.seed,
        simulationVersion: p.ticket.simulationVersion,
        tapeVersion: p.ticket.tapeVersion,
        steps: p.steps,
        tapeSteps: p.tapeSteps,
        tapeCmds: p.tapeCmds,
        claimed: { score: p.score, distance: p.distance, coins: p.coins },
        accessToken: p.accessToken ?? undefined,
        localName: p.localName ?? undefined,
      }),
    });
    return (await r.json()) as VerifyResult;
  }

  async leaderboard(challengeId?: string): Promise<LeaderboardView> {
    const q = challengeId ? `?challengeId=${encodeURIComponent(challengeId)}` : '';
    return this.getJson<LeaderboardView>(`/api/challenge/leaderboard${q}`);
  }

  async nodeStatus(): Promise<NodeStatus> {
    const j = await this.getJson<{ ok: boolean } & NodeStatus>('/api/node/status');
    return { node: j.node, challenge: j.challenge, today: j.today };
  }
}

/** "2h 14m" style remaining-time label for a challenge end time. */
export function timeRemaining(endsAt: string, now = Date.now()): string {
  const ms = new Date(endsAt).getTime() - now;
  if (ms <= 0) return 'closed';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h >= 1) return `${h}h ${m}m`;
  const s = Math.floor((ms % 60_000) / 1000);
  return `${m}m ${s}s`;
}

/** Short "daily · Aug 31" style label from a challenge id. */
export function challengeLabel(id: string): string {
  const m = /^([a-z-]+):(\d{4})-(\d{2})-(\d{2}):v\d+$/.exec(id);
  if (!m) return id;
  const [, type, , mo, da] = m;
  const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(mo) - 1] || mo;
  return `${type} · ${month} ${Number(da)}`;
}
