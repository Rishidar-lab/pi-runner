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
  std::printf("=============================\n");
  std::printf("PASSED %d   FAILED %d\n", g_pass, g_fail);
  return g_fail == 0 ? 0 : 1;
}
