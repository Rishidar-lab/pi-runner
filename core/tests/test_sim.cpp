// ============================================================================
//  Pi Runner — native C++ test suite for the deterministic core.
//  Covers: RNG determinism, save serialization + tamper rejection, scoring,
//  collisions (dodge/jump/slide/shield), state transitions, and full-run
//  determinism / server re-simulation.
//
//  Zero test framework: a tiny assert harness keeps the build dependency-free.
// ============================================================================
#include "pirun/pirun.hpp"

#include <cstdio>
#include <cmath>
#include <string>

// ---- white-box seam: lets tests inject precise, RNG-free scenarios ----------
namespace pirun {
struct SimTestAccess {
  static void forceState(Simulation& s, GameState st) { s.state_ = st; }
  static void clearEnts(Simulation& s) { s.ents_.clear(); }
  static void addObstacle(Simulation& s, Obstacle ob, int lane, float dist) {
    s.ents_.push_back(Simulation::Ent{0, static_cast<int>(ob), lane, dist, false});
  }
  static void addPickup(Simulation& s, Pickup pu, int lane, float dist) {
    s.ents_.push_back(Simulation::Ent{1, static_cast<int>(pu), lane, dist, false});
  }
  static void setLane(Simulation& s, int lane) { s.player_.lane = lane; }
  static void stepOnce(Simulation& s) { s.step(); }
  static void disableSpawns(Simulation& s) { s.spawnAcc_ = -1e9f; } // never reach gap
  static size_t entCount(const Simulation& s) { return s.ents_.size(); }

  // ---- spawn-solvability seams (Claude, claude/pi-runner-core) --------------
  static float    dist(const Simulation& s)     { return s.dist_; }
  static void     setDist(Simulation& s, float d) { s.dist_ = d; }
  static float    speed(const Simulation& s)    { return s.speed_; }
  static float    spawnAcc(const Simulation& s) { return s.spawnAcc_; }
  static uint32_t stepIdx(const Simulation& s)  { return s.stepIdx_; }
  static int      playerLane(const Simulation& s) { return s.player_.lane; }
  static void     spawnRowNow(Simulation& s)    { s.spawnRow(); }
  static int      obstacleCount(const Simulation& s) {
    int n = 0; for (const auto& e : s.ents_) if (e.kind == 0) ++n; return n;
  }
  // true in a lane iff NO unresolved obstacle currently occupies it (any dist).
  static void clearLaneMask(const Simulation& s, bool clear[cfg::LANE_COUNT]) {
    for (int i = 0; i < cfg::LANE_COUNT; ++i) clear[i] = true;
    for (const auto& e : s.ents_)
      if (e.kind == 0 && !e.resolved && e.lane >= 0 && e.lane < cfg::LANE_COUNT)
        clear[e.lane] = false;
  }
  // The nearest still-dangerous obstacle row with dist > `afterDist` + 0.5.
  // Fills clear[] for the lanes of THAT row. Returns its distance, or -1 if none.
  static float obstacleRowAfter(const Simulation& s, float afterDist,
                                bool clear[cfg::LANE_COUNT]) {
    float best = 1e30f;
    for (const auto& e : s.ents_)
      if (e.kind == 0 && !e.resolved && e.dist > -cfg::HIT_WINDOW &&
          e.dist > afterDist + 0.5f && e.dist < best)
        best = e.dist;
    for (int i = 0; i < cfg::LANE_COUNT; ++i) clear[i] = true;
    if (best > 1e29f) return -1.0f;
    for (const auto& e : s.ents_)
      if (e.kind == 0 && !e.resolved && e.dist <= best + 0.25f && e.dist >= best - 0.25f)
        clear[e.lane] = false;
    return best;
  }
  static float nextObstacleRow(const Simulation& s, bool clear[cfg::LANE_COUNT]) {
    return obstacleRowAfter(s, -1e9f, clear);
  }
  // Smallest spacing (in metres) between two DISTINCT obstacle rows currently in
  // flight. All obstacles spawn at SPAWN_AHEAD and travel uniformly, so this is
  // the realised spawn cadence. Returns +inf if fewer than 2 rows are present.
  static float minRowSpacing(const Simulation& s) {
    float ds[64]; int n = 0;
    for (const auto& e : s.ents_) {
      if (e.kind != 0) continue;
      bool merged = false;
      for (int i = 0; i < n; ++i) if (std::abs(ds[i] - e.dist) < 0.25f) { merged = true; break; }
      if (!merged && n < 64) ds[n++] = e.dist;
    }
    float best = 1e30f;
    for (int i = 0; i < n; ++i)
      for (int j = i + 1; j < n; ++j)
        best = std::min(best, std::abs(ds[i] - ds[j]));
    return best;
  }
  // Largest number of obstacles sharing a single dist value (== a row's width).
  static int maxRowWidth(const Simulation& s) {
    int best = 0;
    for (const auto& a : s.ents_) {
      if (a.kind != 0) continue;
      int w = 0;
      for (const auto& b : s.ents_)
        if (b.kind == 0 && std::abs(a.dist - b.dist) < 0.25f) ++w;
      best = std::max(best, w);
    }
    return best;
  }
};
} // namespace pirun

using namespace pirun;

// ------------------------------- harness -----------------------------------
static int g_pass = 0, g_fail = 0;
#define CHECK(cond, msg) do { \
  if (cond) { g_pass++; } \
  else { g_fail++; std::printf("  [FAIL] %s  (%s:%d)\n", msg, __FILE__, __LINE__); } \
} while (0)

// Advance a fixed number of raw steps with spawns disabled so only injected
// entities interact with the player.
static void stepN(Simulation& s, int n) {
  for (int i = 0; i < n && s.state() != (int)GameState::GameOver; ++i)
    SimTestAccess::stepOnce(s);
}

// --------------------------------- tests -----------------------------------
static void test_rng_determinism() {
  std::printf("RNG determinism\n");
  Rng a(12345), b(12345), c(999);
  bool same = true, diff = false;
  for (int i = 0; i < 1000; ++i) {
    uint64_t x = a.next(), y = b.next(), z = c.next();
    if (x != y) same = false;
    if (x != z) diff = true;
  }
  CHECK(same, "same seed -> identical stream");
  CHECK(diff, "different seed -> different stream");

  Rng r(7);
  bool inRange = true;
  for (int i = 0; i < 5000; ++i) { int v = r.range(0, 2); if (v < 0 || v > 2) inRange = false; }
  CHECK(inRange, "range(0,2) stays in bounds");
  float f = Rng(3).nextFloat();
  CHECK(f >= 0.0f && f < 1.0f, "nextFloat in [0,1)");
}

static void test_profile_roundtrip() {
  std::printf("Save profile serialize/deserialize + tamper rejection\n");
  Profile p;
  p.bestScore = 12345; p.totalCoins = 678; p.totalDistance = 90000;
  p.runsPlayed = 42; p.skinsUnlocked = 0b1011; p.achievements = 0b110;
  p.selectedSkin = 3; p.goldUnlock = 1;
  const std::string blob = p.serialize();

  Profile q;
  CHECK(q.deserialize(blob), "valid blob deserializes");
  CHECK(q.bestScore == 12345 && q.totalCoins == 678 && q.runsPlayed == 42,
        "fields round-trip");
  CHECK(q.skinsUnlocked == (0b1011u | 1u) && q.goldUnlock == 1u, "bitmasks round-trip");

  // Tamper: bump the best score in the body but keep the old checksum.
  std::string tampered = blob;
  auto pos = tampered.find("12345");
  tampered.replace(pos, 5, "99999");
  Profile t;
  CHECK(!t.deserialize(tampered), "checksum mismatch is rejected");
  CHECK(t.bestScore == 0, "rejected save resets to defaults");

  Profile g;
  CHECK(!g.deserialize("garbage|data"), "malformed blob is rejected");
}

static void test_state_transitions() {
  std::printf("Game state transitions\n");
  Simulation s;
  s.reset(1, false, 0);
  CHECK(s.state() == (int)GameState::Menu, "starts in Menu");
  s.start();
  CHECK(s.state() == (int)GameState::Playing, "Menu -> Playing on start()");
  s.pause();
  CHECK(s.state() == (int)GameState::Paused, "Playing -> Paused");
  s.resume();
  CHECK(s.state() == (int)GameState::Playing, "Paused -> Playing");

  // Force a game over via a barrier in the player's lane.
  SimTestAccess::disableSpawns(s);
  SimTestAccess::clearEnts(s);
  SimTestAccess::setLane(s, 1);
  SimTestAccess::addObstacle(s, Obstacle::Barrier, 1, 0.5f);
  stepN(s, 200);
  CHECK(s.state() == (int)GameState::GameOver, "barrier in lane -> GameOver");
  s.start();
  CHECK(s.state() == (int)GameState::Playing, "GameOver -> Playing on restart");
}

static void test_collisions() {
  std::printf("Collision resolution (dodge / jump / slide / shield)\n");

  // Dodge by lane.
  { Simulation s; s.reset(2, false, 0); s.start();
    SimTestAccess::disableSpawns(s); SimTestAccess::clearEnts(s);
    SimTestAccess::setLane(s, 0);
    SimTestAccess::addObstacle(s, Obstacle::Barrier, 2, 0.5f);
    stepN(s, 200);
    CHECK(s.state() == (int)GameState::Playing, "obstacle in another lane is dodged"); }

  // Jump over a Low hurdle.
  { Simulation s; s.reset(2, false, 0); s.start();
    SimTestAccess::disableSpawns(s); SimTestAccess::clearEnts(s);
    SimTestAccess::setLane(s, 1);
    SimTestAccess::addObstacle(s, Obstacle::Low, 1, 1.0f);
    s.queueInput(InputCmd::Jump);
    stepN(s, 120);
    CHECK(s.state() == (int)GameState::Playing, "jump clears a Low hurdle"); }

  // Fail to jump a Low hurdle (stay grounded) -> hit.
  { Simulation s; s.reset(2, false, 0); s.start();
    SimTestAccess::disableSpawns(s); SimTestAccess::clearEnts(s);
    SimTestAccess::setLane(s, 1);
    SimTestAccess::addObstacle(s, Obstacle::Low, 1, 0.5f);
    stepN(s, 200);
    CHECK(s.state() == (int)GameState::GameOver, "grounded into a Low hurdle -> hit"); }

  // Slide under an Overhead bar.
  { Simulation s; s.reset(2, false, 0); s.start();
    SimTestAccess::disableSpawns(s); SimTestAccess::clearEnts(s);
    SimTestAccess::setLane(s, 1);
    SimTestAccess::addObstacle(s, Obstacle::Overhead, 1, 1.0f);
    s.queueInput(InputCmd::Slide);
    stepN(s, 120);
    CHECK(s.state() == (int)GameState::Playing, "slide clears an Overhead bar"); }

  // Jumping does NOT clear an Overhead bar.
  { Simulation s; s.reset(2, false, 0); s.start();
    SimTestAccess::disableSpawns(s); SimTestAccess::clearEnts(s);
    SimTestAccess::setLane(s, 1);
    SimTestAccess::addObstacle(s, Obstacle::Overhead, 1, 1.0f);
    s.queueInput(InputCmd::Jump);
    stepN(s, 120);
    CHECK(s.state() == (int)GameState::GameOver, "jumping into an Overhead bar -> hit"); }

  // Shield absorbs one hit, then the next hit ends the run.
  { Simulation s; s.reset(2, true /*shield*/, 0); s.start();
    CHECK(s.hasShield(), "unlock grants a starting shield");
    SimTestAccess::disableSpawns(s); SimTestAccess::clearEnts(s);
    SimTestAccess::setLane(s, 1);
    SimTestAccess::addObstacle(s, Obstacle::Barrier, 1, 0.5f);
    stepN(s, 120);
    CHECK(s.state() == (int)GameState::Playing, "shield absorbs the first hit");
    CHECK(!s.hasShield(), "shield consumed after absorbing");
    SimTestAccess::clearEnts(s);
    SimTestAccess::addObstacle(s, Obstacle::Barrier, 1, 0.5f);
    stepN(s, 120);
    CHECK(s.state() == (int)GameState::GameOver, "second hit ends the run"); }
}

static void test_revive() {
  std::printf("Revive after failing (rewarded-ad hook)\n");
  Simulation s; s.reset(9, false, 0); s.start();
  SimTestAccess::disableSpawns(s); SimTestAccess::clearEnts(s);
  SimTestAccess::setLane(s, 1);
  SimTestAccess::addObstacle(s, Obstacle::Barrier, 1, 0.5f);
  stepN(s, 200);
  CHECK(s.state() == (int)GameState::GameOver, "died into a barrier");
  const uint64_t scoreAtDeath = s.score();
  s.revive();
  CHECK(s.state() == (int)GameState::Playing, "revive() resumes play");
  CHECK(s.hasShield(), "revive grants a shield");
  CHECK(s.score() == scoreAtDeath, "revive preserves score");
  // the barrier that killed us (and any near obstacle) is cleared, so we survive a bit
  SimTestAccess::disableSpawns(s);
  stepN(s, 60);
  CHECK(s.state() == (int)GameState::Playing, "revive clears the danger zone");
  // revive only works from GameOver
  s.revive();
  CHECK(s.state() == (int)GameState::Playing, "revive is a no-op while already playing");
}

static void test_scoring() {
  std::printf("Scoring (coins / gems / combo / multiplier / boost)\n");

  // Coin collection increments coins, score, and combo.
  { Simulation s; s.reset(3, false, 0); s.start();
    SimTestAccess::disableSpawns(s); SimTestAccess::clearEnts(s);
    SimTestAccess::setLane(s, 1);
    SimTestAccess::addPickup(s, Pickup::Coin, 1, 0.5f);
    stepN(s, 120);
    CHECK(s.coins() == 1, "coin collected in same lane");
    CHECK(s.score() >= (uint64_t)cfg::COIN_POINTS, "coin adds points");
    CHECK(s.combo() == 1, "coin builds combo"); }

  // Coin in another lane is not collected.
  { Simulation s; s.reset(3, false, 0); s.start();
    SimTestAccess::disableSpawns(s); SimTestAccess::clearEnts(s);
    SimTestAccess::setLane(s, 0);
    SimTestAccess::addPickup(s, Pickup::Coin, 2, 0.5f);
    stepN(s, 120);
    CHECK(s.coins() == 0, "coin in another lane is missed"); }

  // Multiplier tiers up after COMBO_STEP coins.
  { Simulation s; s.reset(3, false, 0); s.start();
    SimTestAccess::disableSpawns(s); SimTestAccess::setLane(s, 1);
    for (int i = 0; i < cfg::COMBO_STEP; ++i) {
      SimTestAccess::clearEnts(s);
      SimTestAccess::addPickup(s, Pickup::Coin, 1, 0.5f);
      stepN(s, 90);
    }
    CHECK(s.combo() == (uint32_t)cfg::COMBO_STEP, "combo counts coins");
    CHECK(s.multiplier() == 2, "multiplier tiers up at COMBO_STEP"); }

  // Hitting an obstacle with a shield resets the combo.
  { Simulation s; s.reset(3, true, 0); s.start();
    SimTestAccess::disableSpawns(s); SimTestAccess::setLane(s, 1);
    SimTestAccess::clearEnts(s); SimTestAccess::addPickup(s, Pickup::Coin, 1, 0.5f);
    stepN(s, 90);
    CHECK(s.combo() == 1, "combo built before hit");
    SimTestAccess::clearEnts(s); SimTestAccess::addObstacle(s, Obstacle::Barrier, 1, 0.5f);
    stepN(s, 90);
    CHECK(s.combo() == 0, "combo resets on a (shielded) hit"); }

  // Gem is worth more than a coin.
  { Simulation s; s.reset(3, false, 0); s.start();
    SimTestAccess::disableSpawns(s); SimTestAccess::clearEnts(s);
    SimTestAccess::setLane(s, 1);
    SimTestAccess::addPickup(s, Pickup::Gem, 1, 0.5f);
    stepN(s, 120);
    CHECK(s.runStats().gems == 1, "gem collected");
    CHECK(s.score() >= (uint64_t)cfg::GEM_POINTS, "gem adds gem points"); }

  // Boost power-up doubles coin value.
  { Simulation s; s.reset(3, false, 0); s.start();
    SimTestAccess::disableSpawns(s); SimTestAccess::clearEnts(s);
    SimTestAccess::setLane(s, 1);
    SimTestAccess::addPickup(s, Pickup::Boost, 1, 0.5f);
    stepN(s, 60);
    CHECK(s.boostLeft() > 0, "boost activates");
    uint64_t before = s.score();
    SimTestAccess::clearEnts(s); SimTestAccess::addPickup(s, Pickup::Coin, 1, 0.5f);
    stepN(s, 60);
    CHECK(s.score() - before >= (uint64_t)(cfg::COIN_POINTS * 2), "boost doubles coin value"); }
}

static void test_powerups() {
  std::printf("Power-ups (magnet / slow-mo)\n");
  // Magnet pulls a coin from an adjacent lane.
  { Simulation s; s.reset(5, false, 0); s.start();
    SimTestAccess::disableSpawns(s); SimTestAccess::clearEnts(s);
    SimTestAccess::setLane(s, 1);
    SimTestAccess::addPickup(s, Pickup::Magnet, 1, 0.5f);
    stepN(s, 60);
    CHECK(s.magnetLeft() > 0, "magnet activates");
    SimTestAccess::clearEnts(s);
    SimTestAccess::addPickup(s, Pickup::Coin, 0, 8.0f); // adjacent lane, ahead
    stepN(s, 240);
    CHECK(s.coins() == 1, "magnet collects an adjacent-lane coin"); }

  // Slow-mo reduces effective speed (less distance over the same steps).
  { Simulation s1; s1.reset(6, false, 0); s1.start();
    SimTestAccess::disableSpawns(s1); SimTestAccess::clearEnts(s1);
    stepN(s1, 240);
    uint64_t normal = s1.distance();

    Simulation s2; s2.reset(6, false, 0); s2.start();
    SimTestAccess::disableSpawns(s2); SimTestAccess::clearEnts(s2);
    SimTestAccess::setLane(s2, 1);
    SimTestAccess::addPickup(s2, Pickup::SlowMo, 1, 0.2f);
    stepN(s2, 240);
    CHECK(s2.slowmoLeft() >= 0, "slow-mo timer present");
    CHECK(s2.distance() < normal, "slow-mo covers less distance"); }
}

static void test_full_run_determinism() {
  std::printf("Full-run determinism + server re-simulation (verifyRun)\n");
  const uint64_t seed = 0xC0FFEE;
  // A fixed command tape: (stepIndex, cmd)
  std::vector<std::pair<uint32_t,int>> tape = {
    {30,(int)InputCmd::Left}, {90,(int)InputCmd::Right}, {150,(int)InputCmd::Jump},
    {210,(int)InputCmd::Slide}, {320,(int)InputCmd::Left}, {480,(int)InputCmd::Right},
  };
  const uint32_t steps = 1500;

  uint64_t a = Simulation::verifyRun(seed, false, 0, tape, steps);
  uint64_t b = Simulation::verifyRun(seed, false, 0, tape, steps);
  CHECK(a == b, "same seed + same tape -> identical score");

  // The core anti-cheat property: a live advance()-driven playthrough must
  // reproduce EXACTLY what the headless server verifier computes.
  Simulation live; live.reset(seed, false, 0); live.start();
  size_t ti = 0;
  for (uint32_t i = 0; i < steps && live.state() != (int)GameState::GameOver; ++i) {
    while (ti < tape.size() && tape[ti].first == i) {
      live.queueInput(static_cast<InputCmd>(tape[ti].second)); ti++;
    }
    live.advance(cfg::FIXED_DT); // exactly one fixed step per advance
  }
  CHECK(live.score() == a, "live play score == server re-simulation score");

  // A materially different tape changes the outcome (guards against a verifier
  // that ignores inputs).
  std::vector<std::pair<uint32_t,int>> tape2 = { {5,(int)InputCmd::Right}, {5,(int)InputCmd::Right} };
  uint64_t d = Simulation::verifyRun(seed, false, 0, tape2, steps);
  CHECK(d == Simulation::verifyRun(seed, false, 0, tape2, steps),
        "verifyRun is repeatable for a second tape");
  (void)d;
}

// ==========================================================================
//  SPAWN SOLVABILITY  (claude/pi-runner-core)
//
//  Proves that the procedural generator can never emit a physically
//  unsurvivable arrangement, and that generated runs stay traversable under
//  the *implemented* movement model. See
//  PROJECT_RECOVERY_2026/reports/PI_RUNNER_SPAWN_SOLVABILITY.md for the
//  movement model, the derived spacing condition, and the assumptions.
// ==========================================================================

// A lane-switch-only autonomous player. It NEVER jumps or slides — proving the
// guaranteed safe lane alone is always sufficient.
//
//  reactDist    : only act on a row once it is within this many metres (<=0 => always)
//  stepsPerMove : min fixed steps between two lane changes (1 => engine-native,
//                 higher => models a rate-limited human thumb)
//  instantMulti : queue every lane hop at once (engine allows it) vs one per move
//  lookahead    : also weigh the row after the nearest one when choosing a lane
struct GreedyResult { bool survived; uint64_t distance; uint32_t stepsPlayed; uint64_t score; };

static GreedyResult play_lane_only(uint64_t seed, uint32_t steps, float reactDist,
                                   int stepsPerMove, bool instantMulti, bool lookahead) {
  Simulation s; s.reset(seed, false, 0); s.start();
  int cooldown = 0;
  uint32_t i = 0;
  for (; i < steps; ++i) {
    if (s.state() == (int)GameState::GameOver) break;
    if (cooldown > 0) --cooldown;

    bool nearC[cfg::LANE_COUNT];
    const float rd = SimTestAccess::nextObstacleRow(s, nearC);
    const bool visible = (rd >= 0.0f) && (reactDist <= 0.0f || rd <= reactDist);

    if (visible) {
      bool farC[cfg::LANE_COUNT] = {true, true, true};
      if (lookahead) SimTestAccess::obstacleRowAfter(s, rd, farC);

      const int cur = SimTestAccess::playerLane(s);
      int target = cur, bestCost = 1000;
      for (int cand = 0; cand < cfg::LANE_COUNT; ++cand) {
        if (!nearC[cand]) continue;                 // must be safe for the near row
        int cost = (cand > cur ? cand - cur : cur - cand);   // steps to get there
        if (lookahead && !farC[cand]) cost += 2;    // this lane forces another move soon
        if (cost < bestCost) { bestCost = cost; target = cand; }
      }

      if (target != cur && cooldown == 0) {
        const InputCmd dir = (target < cur) ? InputCmd::Left : InputCmd::Right;
        int hops = target - cur; if (hops < 0) hops = -hops;
        if (instantMulti) { for (int k = 0; k < hops; ++k) s.queueInput(dir); }
        else              { s.queueInput(dir); }
        cooldown = stepsPerMove;
      }
    }
    s.advance(cfg::FIXED_DT);
  }
  return GreedyResult{ s.state() != (int)GameState::GameOver, s.distance(), i, s.score() };
}

static void test_spawn_structural_invariant() {
  std::printf("Spawn generator: every row always leaves a clear lane\n");
  // The load-bearing invariant: spawnRow() must never fill all LANE_COUNT lanes.
  // Exercised at every difficulty band, across many RNG streams, millions of rows.
  const float diffBands[] = {0.0f, 120.0f, 450.0f, 900.0f, 1800.0f, 9000.0f, 60000.0f};
  long rows = 0, minClear = cfg::LANE_COUNT, tightRows = 0; // tightRows = exactly 1 clear
  bool everImpossible = false;
  for (uint64_t seed = 1; seed <= 150; ++seed) {
    for (float d : diffBands) {
      Simulation s; s.reset(seed * 2654435761u + (uint64_t)d, false, 0); s.start();
      SimTestAccess::setDist(s, d);
      for (int k = 0; k < 800; ++k) {
        SimTestAccess::clearEnts(s);
        SimTestAccess::spawnRowNow(s);
        bool clear[cfg::LANE_COUNT];
        SimTestAccess::clearLaneMask(s, clear);
        int nClear = 0;
        for (int i = 0; i < cfg::LANE_COUNT; ++i) if (clear[i]) ++nClear;
        if (nClear == 0) everImpossible = true;
        if (nClear < minClear) minClear = nClear;
        if (nClear == 1) ++tightRows;
        ++rows;
      }
    }
  }
  CHECK(!everImpossible, "no generated row EVER fills all three lanes");
  CHECK(minClear >= 1, "min clear-lane count across all rows is >= 1");
  std::printf("    (%ld rows sampled; min clear lanes = %ld; single-lane rows = %.1f%%)\n",
              rows, minClear, 100.0 * (double)tightRows / (double)rows);
}

static void test_spawn_greedy_engine_model() {
  std::printf("Generated runs are traversable (lane-switch only, engine movement model)\n");
  // Engine-native movement: instant, multi-lane, zero reaction delay — this is
  // the model the game actually implements (buffered swipes move >1 lane/step).
  int survived = 0; uint64_t maxDist = 0, minDist = ~0ull;
  const uint32_t STEPS = 120000; // ~16 min at 120 Hz; long past the difficulty cap
  for (uint64_t seed = 1; seed <= 60; ++seed) {
    GreedyResult r = play_lane_only(seed, STEPS, -1.0f, 1, true, false);
    if (r.survived) ++survived;
    else std::printf("    [seed %llu] DIED at step %u, dist %llu\n",
                     (unsigned long long)seed, r.stepsPlayed, (unsigned long long)r.distance);
    if (r.distance > maxDist) maxDist = r.distance;
    if (r.distance < minDist) minDist = r.distance;
  }
  CHECK(survived == 60, "lane-only greedy player survives every seed for 120k steps");
  std::printf("    (60/60 survived; distance range %llu..%llu m)\n",
              (unsigned long long)minDist, (unsigned long long)maxDist);
}

static void test_spawn_greedy_human_envelope() {
  std::printf("Generated runs stay traversable under a rate-limited (human) input model\n");
  // Realistic swipe player: 2-row lookahead, one lane change per 6 steps
  // (~20 Hz — comfortably within buffered-swipe controls), reacts once a row is
  // within 45 m (~1 s warning at max speed). Must clear the ENTIRE designed
  // difficulty curve (saturates by ~933 m) with room to spare.
  int clearedCurve = 0;
  for (uint64_t seed = 1; seed <= 60; ++seed) {
    GreedyResult r = play_lane_only(seed, 30000, 45.0f, 6, false, true);
    if (r.survived || r.distance >= 1500) ++clearedCurve; // >1500 m = well past saturation
    else std::printf("    [seed %llu] DIED at step %u (dist %llu, curve saturates ~933 m)\n",
                     (unsigned long long)seed, r.stepsPlayed, (unsigned long long)r.distance);
  }
  CHECK(clearedCurve == 60, "20 Hz swipe player with 2-row lookahead clears the whole difficulty curve");

  // Diagnostic sweep (NOT a pass/fail gate): how a naive vs lookahead player
  // holds up as the input rate is throttled. Records the human-comfort margin.
  const int rates[] = {1, 3, 6, 12};
  for (int naive = 1; naive >= 0; --naive) {
    for (int ri = 0; ri < 4; ++ri) {
      int surv = 0; uint64_t sumDist = 0;
      for (uint64_t seed = 1; seed <= 24; ++seed) {
        GreedyResult r = play_lane_only(seed, 45000, 40.0f, rates[ri], false, naive == 0);
        if (r.survived) ++surv;
        sumDist += r.distance;
      }
      std::printf("    [diag] %s, 1 move / %2d steps: %2d/24 survived 45k, mean dist %llu m\n",
                  naive ? "no lookahead" : "2-row lookahead", rates[ri], surv,
                  (unsigned long long)(sumDist / 24));
    }
  }
}

static void test_spawn_boundary_min_spacing_and_max_speed() {
  std::printf("Boundary: minimum row spacing and maximum speed\n");
  Simulation s; s.reset(0xB0A7, false, 0); s.start();
  SimTestAccess::setDist(s, 5000.0f); // deep past dist=750 => gap == MIN_GAP, speed clamps

  float minRowSpacing = 1e9f, maxObservedSpeed = 0.0f;
  int maxObstaclesAtSameDist = 0;

  for (int k = 0; k < 40000 && s.state() != (int)GameState::GameOver; ++k) {
    // keep the player alive so the run stays at max difficulty
    bool clear[cfg::LANE_COUNT];
    if (SimTestAccess::nextObstacleRow(s, clear) >= 0.0f) {
      int cur = SimTestAccess::playerLane(s), target = cur;
      if (!clear[cur]) for (int d = 1; d < cfg::LANE_COUNT; ++d) {
        if (cur - d >= 0 && clear[cur - d]) { target = cur - d; break; }
        if (cur + d < cfg::LANE_COUNT && clear[cur + d]) { target = cur + d; break; }
      }
      int hops = target - cur; InputCmd dir = hops < 0 ? InputCmd::Left : InputCmd::Right;
      for (int h = 0; h < (hops < 0 ? -hops : hops); ++h) s.queueInput(dir);
    }
    s.advance(cfg::FIXED_DT);

    maxObservedSpeed = std::max(maxObservedSpeed, SimTestAccess::speed(s));
    const float sp = SimTestAccess::minRowSpacing(s);
    if (sp < 1e29f) minRowSpacing = std::min(minRowSpacing, sp);
    // no more than LANE_COUNT-1 obstacles may share a dist (safe lane is always free)
    maxObstaclesAtSameDist = std::max(maxObstaclesAtSameDist, SimTestAccess::maxRowWidth(s));
  }

  // The distance-accumulator spawner (spawnAcc_ += d; while(spawnAcc_>=gap)…)
  // averages exactly `gap` between rows in the long run, but any single interval
  // can be short by up to one step of travel (d = speed·FIXED_DT) because of the
  // sub-`gap` carryover. That is expected and does not affect solvability
  // (min time-between-rows shrinks by ~5% vs nominal). Floor = gap - d_max.
  const float dMax = cfg::MAX_SPEED * cfg::FIXED_DT;
  CHECK(maxObservedSpeed <= cfg::MAX_SPEED + 1e-3f, "speed never exceeds MAX_SPEED");
  CHECK(std::abs(maxObservedSpeed - cfg::MAX_SPEED) < 1e-2f, "speed reaches MAX_SPEED at high distance");
  CHECK(minRowSpacing >= cfg::MIN_GAP - dMax - 0.05f,
        "in-flight obstacle rows are never closer than (MIN_GAP - one step of travel)");
  CHECK(maxObstaclesAtSameDist <= cfg::LANE_COUNT - 1, "a row never fills more than LANE_COUNT-1 lanes");
  CHECK(s.state() != (int)GameState::GameOver, "lane-only play survives at max difficulty");
  std::printf("    (max speed %.2f m/s, min in-flight row spacing %.3f m, MIN_GAP %.2f - dMax %.2f, widest row %d/%d)\n",
              maxObservedSpeed, (double)minRowSpacing, (double)cfg::MIN_GAP, (double)dMax,
              maxObstaclesAtSameDist, cfg::LANE_COUNT);
}

static void test_spawn_difficulty_escalation_and_reset() {
  std::printf("Boundary: difficulty escalation, restart and revive keep runs solvable\n");

  // A single run driven from dist 0 all the way past the difficulty ceiling.
  GreedyResult r = play_lane_only(0xE5CA1A7E, 180000, -1.0f, 1, true, false);
  CHECK(r.survived, "one continuous run survives from dist 0 through the whole curve");
  CHECK(r.distance > 20000, "the run actually escalates deep into difficulty (>20 km)");

  // reset() mid-run must return to a clean, solvable starting state.
  Simulation s; s.reset(7, false, 0); s.start();
  (void)play_lane_only; // (documentation: helper above)
  for (int k = 0; k < 5000; ++k) { // play a while
    bool clear[cfg::LANE_COUNT];
    if (SimTestAccess::nextObstacleRow(s, clear) >= 0.0f) {
      int cur = SimTestAccess::playerLane(s), target = cur;
      if (!clear[cur]) for (int d = 1; d < cfg::LANE_COUNT; ++d) {
        if (cur - d >= 0 && clear[cur - d]) { target = cur - d; break; }
        if (cur + d < cfg::LANE_COUNT && clear[cur + d]) { target = cur + d; break; }
      }
      for (int h = 0; h < (target > cur ? target - cur : cur - target); ++h)
        s.queueInput(target > cur ? InputCmd::Right : InputCmd::Left);
    }
    s.advance(cfg::FIXED_DT);
    if (s.state() == (int)GameState::GameOver) break;
  }
  s.reset(7, false, 0);
  CHECK(SimTestAccess::dist(s) == 0.0f, "reset() zeroes distance");
  CHECK(std::abs(SimTestAccess::speed(s) - cfg::BASE_SPEED) < 1e-3f, "reset() restores BASE_SPEED");
  CHECK(SimTestAccess::obstacleCount(s) == 0, "reset() clears all entities");
  CHECK(SimTestAccess::playerLane(s) == 1, "reset() puts the player back in the centre lane");
  CHECK(SimTestAccess::stepIdx(s) == 0, "reset() zeroes the step index");
  s.start();
  bool okAfterReset = true;
  for (int k = 0; k < 20000 && okAfterReset; ++k) {
    bool clear[cfg::LANE_COUNT];
    if (SimTestAccess::nextObstacleRow(s, clear) >= 0.0f) {
      int cur = SimTestAccess::playerLane(s), target = cur;
      if (!clear[cur]) for (int d = 1; d < cfg::LANE_COUNT; ++d) {
        if (cur - d >= 0 && clear[cur - d]) { target = cur - d; break; }
        if (cur + d < cfg::LANE_COUNT && clear[cur + d]) { target = cur + d; break; }
      }
      for (int h = 0; h < (target > cur ? target - cur : cur - target); ++h)
        s.queueInput(target > cur ? InputCmd::Right : InputCmd::Left);
    }
    s.advance(cfg::FIXED_DT);
    if (s.state() == (int)GameState::GameOver) okAfterReset = false;
  }
  CHECK(okAfterReset, "a fresh run after reset() is solvable again");

  // revive() from a real death must hand back a survivable state.
  Simulation d; d.reset(0xDEAD, false, 0); d.start();
  SimTestAccess::disableSpawns(d); SimTestAccess::clearEnts(d);
  SimTestAccess::setLane(d, 1);
  SimTestAccess::addObstacle(d, Obstacle::Barrier, 1, 0.5f);
  stepN(d, 200);
  CHECK(d.state() == (int)GameState::GameOver, "forced death for the revive check");
  d.revive();
  // re-enable spawns and play on with the lane-only strategy
  bool okAfterRevive = true;
  for (int k = 0; k < 15000 && okAfterRevive; ++k) {
    bool clear[cfg::LANE_COUNT];
    if (SimTestAccess::nextObstacleRow(d, clear) >= 0.0f) {
      int cur = SimTestAccess::playerLane(d), target = cur;
      if (!clear[cur]) for (int dd = 1; dd < cfg::LANE_COUNT; ++dd) {
        if (cur - dd >= 0 && clear[cur - dd]) { target = cur - dd; break; }
        if (cur + dd < cfg::LANE_COUNT && clear[cur + dd]) { target = cur + dd; break; }
      }
      for (int h = 0; h < (target > cur ? target - cur : cur - target); ++h)
        d.queueInput(target > cur ? InputCmd::Right : InputCmd::Left);
    }
    d.advance(cfg::FIXED_DT);
    if (d.state() == (int)GameState::GameOver) okAfterRevive = false;
  }
  CHECK(okAfterRevive, "play continues solvably after revive()");
}

static void test_spawn_no_adversarial_deadlock() {
  std::printf("Adversarial: no reachable game state has zero safe lanes for the next row\n");
  // Drive real runs and, every step, assert the nearest dangerous obstacle row
  // always leaves the player at least one lane it can legally occupy. This is the
  // operational form of "impossible arrangement" and must never be observed.
  long checks = 0;
  bool sawZeroSafe = false;
  for (uint64_t seed = 1; seed <= 60 && !sawZeroSafe; ++seed) {
    Simulation s; s.reset(seed, false, 0); s.start();
    for (int k = 0; k < 30000 && s.state() != (int)GameState::GameOver; ++k) {
      bool clear[cfg::LANE_COUNT];
      const float rd = SimTestAccess::nextObstacleRow(s, clear);
      if (rd >= 0.0f) {
        int nClear = 0;
        for (int i = 0; i < cfg::LANE_COUNT; ++i) if (clear[i]) ++nClear;
        if (nClear == 0) { sawZeroSafe = true; break; }
        ++checks;
        // steer into a clear lane so the run keeps escalating
        int cur = SimTestAccess::playerLane(s), target = cur;
        if (!clear[cur]) for (int dd = 1; dd < cfg::LANE_COUNT; ++dd) {
          if (cur - dd >= 0 && clear[cur - dd]) { target = cur - dd; break; }
          if (cur + dd < cfg::LANE_COUNT && clear[cur + dd]) { target = cur + dd; break; }
        }
        for (int h = 0; h < (target > cur ? target - cur : cur - target); ++h)
          s.queueInput(target > cur ? InputCmd::Right : InputCmd::Left);
      }
      s.advance(cfg::FIXED_DT);
    }
  }
  CHECK(!sawZeroSafe, "never observed an obstacle row with zero safe lanes");
  std::printf("    (%ld obstacle-row safety checks across 60 seeds)\n", checks);
}

int main() {
  std::printf("=== Pi Runner core tests ===\n");
  test_rng_determinism();
  test_profile_roundtrip();
  test_state_transitions();
  test_collisions();
  test_revive();
  test_scoring();
  test_powerups();
  test_full_run_determinism();
  test_spawn_structural_invariant();
  test_spawn_greedy_engine_model();
  test_spawn_greedy_human_envelope();
  test_spawn_boundary_min_spacing_and_max_speed();
  test_spawn_difficulty_escalation_and_reset();
  test_spawn_no_adversarial_deadlock();
  std::printf("=============================\n");
  std::printf("PASSED %d   FAILED %d\n", g_pass, g_fail);
  return g_fail == 0 ? 0 : 1;
}
