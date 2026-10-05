# Pi Runner — Node Challenge demo script

**The one sentence:** *"Pi Runner does not trust the browser's score. The
SoloHost node reproduces the run itself."*

Runtime ≈ 4 minutes. No Pi credentials needed.

---

## Setup (before the demo)

```bash
git checkout solohost/pi-runner
NODE_CHALLENGE_DEMO=1 docker compose -f docker-compose.solohost.yml up -d --build
# or, without Docker:
NODE_CHALLENGE_DEMO=1 npm start
```

Open `http://127.0.0.1:3000`.

---

## 1. SoloHost is running Pi Runner  (20 s)

```bash
curl -s http://127.0.0.1:3000/api/health
```

> Point out `"nodeChallenge": true`, the `simulationVersion`, and that this is a
> plain local Node process — no cloud.

## 2. Open Pi Runner  (10 s)

Load the page. The arcade menu appears with a **NODE CHALLENGE** button.

## 3. Show the node  (20 s)

Click **Node status** (menu footer). Show: node id, app / simulation version,
uptime, today's challenge, verified / rejected counts, persistent storage ready.

## 4. Enter today's Node Challenge  (20 s)

Click **NODE CHALLENGE**. The screen shows:

- the challenge id — `daily:YYYY-MM-DD:v1`
- a live **time remaining** countdown
- the **deterministic seed** in hex, tagged `shared`
- *"Same course. Same rules. Verified by your Pi Runner Node."*

```bash
curl -s http://127.0.0.1:3000/api/challenge/current
```

> Same `id` and `seed` every time today, on every node — derived by HMAC, not
> random. Refresh to prove it doesn't change.

## 5. Play  (40 s)

Type a name, hit **START CHALLENGE**, play a run. A small `◆ NODE CHALLENGE`
badge is the only in-game change.

## 6. Submit → "VERIFYING RUN…"  (5 s)

On game over the client ships the **input tape** (seed + per-tick commands) and
shows *"Verifying run… your Pi Runner Node is independently re-simulating the run
from its seed and your input tape."*

## 7. The node replays the run itself  (15 s)

> The backend loads the same C++/WASM core, resets it to the issued seed, applies
> your recorded inputs one 120 Hz tick at a time, and computes the score from
> scratch. Server log line:

```
{"event":"challenge.verify_ok","score":...,"rank":...,"latencyMs":...}
```

## 8. "RUN VERIFIED"  (10 s)

A **VERIFIED BY NODE `<id>`** seal, your verified score, rank, distance, π, and
the replay latency (a few ms).

## 9. Leaderboard entry  (10 s)

Click **Leaderboard** — your verified run, your row highlighted.

```bash
curl -s http://127.0.0.1:3000/api/challenge/leaderboard
```

Every row is `"verified": true`.

## 10. A manipulated score is rejected  (30 s)

```bash
# start a run, then submit an inflated score for it
RUN=$(curl -s -XPOST http://127.0.0.1:3000/api/challenge/start)
RID=$(echo "$RUN" | grep -o '"runId":"[a-f0-9]*"' | cut -d'"' -f4)
SEED=$(echo "$RUN" | grep -o '"seed":[0-9]*' | cut -d: -f2)
curl -s -XPOST http://127.0.0.1:3000/api/challenge/submit \
  -H 'content-type: application/json' \
  -d "{\"runId\":\"$RID\",\"challengeId\":\"$(curl -s http://127.0.0.1:3000/api/challenge/current | grep -o 'daily:[0-9-]*:v1')\",\"seed\":$SEED,\"simulationVersion\":\"1.0.0\",\"tapeVersion\":1,\"steps\":600,\"tapeSteps\":[],\"tapeCmds\":[],\"claimed\":{\"score\":999999,\"distance\":1,\"coins\":0},\"localName\":\"cheater\"}"
```

> `{"ok":false,"verified":false,"reason":"SCORE_MISMATCH"}` — and nothing is
> added to the leaderboard. The node re-ran the tape and got a different number.

## 11. Local persistence  (15 s)

```bash
docker compose -f docker-compose.solohost.yml restart
curl -s http://127.0.0.1:3000/api/node/status   # same node id; leaderboard intact
```

## 12. The future  (15 s)

> Today this is **local** authoritative verification — one SoloHost node
> verifying its own runs. It is **not** consensus and **not** Pi blockchain
> validation. Because the seed is derived from a shared public namespace, every
> node already plays the identical course; `server/challenge/coordinator.js`
> defines the interfaces a future coordinator would implement to aggregate
> node-signed verified results across the network. Nothing here fakes that.

---

**Close on the one sentence again.**
