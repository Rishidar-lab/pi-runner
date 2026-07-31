// ============================================================================
//  Pi Runner — deterministic game core implementation
// ============================================================================
#include "pirun/pirun.hpp"

#include <algorithm>
#include <cmath>
#include <cstring>

namespace pirun {

// --------------------------- Deterministic RNG -----------------------------
static inline uint64_t rotl(uint64_t x, int k) { return (x << k) | (x >> (64 - k)); }

void Rng::reseed(uint64_t seed) {
  // splitmix64 to fill the xoshiro256** state.
  uint64_t z = seed + 0x9E3779B97F4A7C15ULL;
  auto sm = [&z]() {
    uint64_t x = (z += 0x9E3779B97F4A7C15ULL);
    x = (x ^ (x >> 30)) * 0xBF58476D1CE4E5B9ULL;
    x = (x ^ (x >> 27)) * 0x94D049BB133111EBULL;
    return x ^ (x >> 31);
  };
  s_[0] = sm(); s_[1] = sm(); s_[2] = sm(); s_[3] = sm();
  if ((s_[0] | s_[1] | s_[2] | s_[3]) == 0) s_[0] = 0x1234567ULL; // never all-zero
}

uint64_t Rng::next() {
  const uint64_t result = rotl(s_[1] * 5, 7) * 9;
  const uint64_t t = s_[1] << 17;
  s_[2] ^= s_[0];
  s_[3] ^= s_[1];
  s_[1] ^= s_[2];
  s_[0] ^= s_[3];
  s_[2] ^= t;
  s_[3] = rotl(s_[3], 45);
  return result;
}

float Rng::nextFloat() {
  // 53-bit mantissa -> [0,1)
  return static_cast<float>((next() >> 11) * (1.0 / 9007199254740992.0));
}

int Rng::range(int lo, int hi) {
  if (hi <= lo) return lo;
  const uint64_t span = static_cast<uint64_t>(hi - lo + 1);
  return lo + static_cast<int>(next() % span);
}

// ------------------------------ Save Profile -------------------------------
// Simple deterministic FNV-1a checksum over the payload.
static uint32_t fnv1a(const std::string& s) {
  uint32_t h = 2166136261u;
  for (unsigned char c : s) { h ^= c; h *= 16777619u; }
  return h;
}

std::string Profile::serialize() const {
  // v|best|coins|dist|runs|skins|ach|sel|gold  then |checksum
  std::string body =
      "PR1|" + std::to_string(version) + "|" + std::to_string(bestScore) + "|" +
      std::to_string(totalCoins) + "|" + std::to_string(totalDistance) + "|" +
      std::to_string(runsPlayed) + "|" + std::to_string(skinsUnlocked) + "|" +
      std::to_string(achievements) + "|" + std::to_string(selectedSkin) + "|" +
      std::to_string(goldUnlock);
  return body + "|" + std::to_string(fnv1a(body));
}

bool Profile::deserialize(const std::string& blob) {
  const auto fail = [&]() { *this = Profile{}; return false; };
  std::vector<std::string> parts;
  size_t start = 0;
  while (true) {
    size_t p = blob.find('|', start);
    if (p == std::string::npos) { parts.push_back(blob.substr(start)); break; }
    parts.push_back(blob.substr(start, p - start));
    start = p + 1;
  }
  // 11 fields: tag + 9 values + checksum
  if (parts.size() != 11 || parts[0] != "PR1") return fail();
  const std::string body = blob.substr(0, blob.rfind('|'));
  uint32_t expect;
  try { expect = static_cast<uint32_t>(std::stoul(parts[10])); }
  catch (...) { return fail(); }
  if (fnv1a(body) != expect) return fail(); // tampered / corrupted
  try {
    version       = static_cast<uint32_t>(std::stoul(parts[1]));
    bestScore     = std::stoull(parts[2]);
    totalCoins    = std::stoull(parts[3]);
    totalDistance = std::stoull(parts[4]);
    runsPlayed    = static_cast<uint32_t>(std::stoul(parts[5]));
    skinsUnlocked = static_cast<uint32_t>(std::stoul(parts[6]));
    achievements  = static_cast<uint32_t>(std::stoul(parts[7]));
    selectedSkin  = static_cast<uint32_t>(std::stoul(parts[8]));
    goldUnlock    = static_cast<uint32_t>(std::stoul(parts[9]));
  } catch (...) { return fail(); }
  skinsUnlocked |= 1u; // default skin is always owned
  return true;
}

// ------------------------------ Simulation ---------------------------------
void Simulation::reset(uint64_t seed, bool unlockShield, int skin) {
  state_   = GameState::Menu;
  seed_    = seed;
  skin_    = skin;
  rng_.reseed(seed);
  player_  = Player{};
  ents_.clear();
  render_.clear();
  inbox_.clear();
  dist_ = 0.0f;
  speed_ = cfg::BASE_SPEED;
  spawnAcc_ = 0.0f;
  acc_ = 0.0f;
  stepIdx_ = 0;
  combo_ = 0;
  mult_ = 1;
  shield_ = unlockShield;
  magnetT_ = boostT_ = slowmoT_ = 0.0f;
  rowsSincePowerup_ = 99;
  stats_ = RunStats{};
  rebuildRenderList();
}

void Simulation::start()  { if (state_ == GameState::Menu || state_ == GameState::GameOver) { state_ = GameState::Playing; } }
void Simulation::pause()  { if (state_ == GameState::Playing) state_ = GameState::Paused; }
void Simulation::resume() { if (state_ == GameState::Paused)  state_ = GameState::Playing; }

void Simulation::queueInput(InputCmd cmd) {
  if (cmd != InputCmd::None) inbox_.push_back(cmd);
}

float Simulation::actionPhase() const {
  if (player_.action == Action::Jumping) return 1.0f - (player_.actionT / cfg::JUMP_TIME);
  if (player_.action == Action::Sliding) return 1.0f - (player_.actionT / cfg::SLIDE_TIME);
  return 0.0f;
}

void Simulation::applyInput(InputCmd c) {
  switch (c) {
    case InputCmd::Left:  if (player_.lane > 0) player_.lane--; break;
    case InputCmd::Right: if (player_.lane < cfg::LANE_COUNT - 1) player_.lane++; break;
    case InputCmd::Jump:
      if (player_.action == Action::Ground) { player_.action = Action::Jumping; player_.actionT = cfg::JUMP_TIME; }
      break;
    case InputCmd::Slide:
      if (player_.action == Action::Ground) { player_.action = Action::Sliding; player_.actionT = cfg::SLIDE_TIME; }
      break;
    default: break;
  }
}

void Simulation::recomputeMultiplier() {
  int tier = static_cast<int>(combo_) / cfg::COMBO_STEP;
  if (tier > cfg::MULT_CAP) tier = cfg::MULT_CAP;
  mult_ = 1 + tier;
}

void Simulation::spawnRow() {
  // Guarantee solvability: at least one lane is always fully empty, so the run
  // is always completable by lane switching alone. Jump/slide obstacles add
  // skill expression without ever creating an impossible wall.
  const int safeLane = rng_.range(0, cfg::LANE_COUNT - 1);

  // Difficulty-scaled chance that a non-safe lane carries an obstacle.
  const float diff = std::min(1.0f, dist_ / 900.0f);
  const float blockChance = 0.45f + 0.45f * diff;

  for (int lane = 0; lane < cfg::LANE_COUNT; ++lane) {
    if (lane == safeLane) continue;
    if (rng_.nextFloat() < blockChance) {
      // Weighted obstacle type: more barriers early, more jump/slide later.
      const float r = rng_.nextFloat();
      Obstacle ob;
      if (r < 0.5f)       ob = Obstacle::Barrier;
      else if (r < 0.75f) ob = Obstacle::Low;
      else                ob = Obstacle::Overhead;
      ents_.push_back(Ent{0, static_cast<int>(ob), lane, cfg::SPAWN_AHEAD, false});
    }
  }

  // Coins: often a short arc in the safe lane (rewards the clean path).
  if (rng_.nextFloat() < 0.7f) {
    const int len = rng_.range(1, 3);
    for (int i = 0; i < len; ++i)
      ents_.push_back(Ent{1, static_cast<int>(Pickup::Coin), safeLane,
                          cfg::SPAWN_AHEAD + i * 4.0f, false});
  }
  // Rare gem in a random lane.
  if (rng_.nextFloat() < 0.12f) {
    ents_.push_back(Ent{1, static_cast<int>(Pickup::Gem), rng_.range(0, cfg::LANE_COUNT - 1),
                        cfg::SPAWN_AHEAD + 2.0f, false});
  }
  // Power-ups, rate-limited so they feel special.
  rowsSincePowerup_++;
  if (rowsSincePowerup_ >= cfg::POWERUP_MIN_GAP && rng_.nextFloat() < 0.22f) {
    rowsSincePowerup_ = 0;
    static const Pickup pool[] = {Pickup::Shield, Pickup::Magnet, Pickup::Boost, Pickup::SlowMo};
    const Pickup pu = pool[rng_.range(0, 3)];
    ents_.push_back(Ent{1, static_cast<int>(pu), safeLane, cfg::SPAWN_AHEAD + 1.0f, false});
  }
}

void Simulation::grantPickup(int subtype) {
  switch (static_cast<Pickup>(subtype)) {
    case Pickup::Coin: {
      combo_++;
      recomputeMultiplier();
      if (combo_ > stats_.maxCombo) stats_.maxCombo = combo_;
      const uint64_t gain = static_cast<uint64_t>(cfg::COIN_POINTS) * mult_ * (boostT_ > 0 ? 2 : 1);
      stats_.score += gain;
      stats_.coins += 1;
      break;
    }
    case Pickup::Gem: {
      const uint64_t gain = static_cast<uint64_t>(cfg::GEM_POINTS) * mult_ * (boostT_ > 0 ? 2 : 1);
      stats_.score += gain;
      stats_.gems += 1;
      break;
    }
    case Pickup::Shield: shield_  = true;              stats_.powerups++; break;
    case Pickup::Magnet: magnetT_ = cfg::MAGNET_TIME;  stats_.powerups++; break;
    case Pickup::Boost:  boostT_  = cfg::BOOST_TIME;   stats_.powerups++; break;
    case Pickup::SlowMo: slowmoT_ = cfg::SLOWMO_TIME;  stats_.powerups++; break;
  }
}

void Simulation::resolveAt(Ent& e) {
  e.resolved = true;
  const bool sameLane = (e.lane == player_.lane);

  if (e.kind == 1) { // pickup
    const bool magnetized = magnetT_ > 0 &&
        std::abs(e.lane - player_.lane) <= 1 &&
        (static_cast<Pickup>(e.subtype) == Pickup::Coin ||
         static_cast<Pickup>(e.subtype) == Pickup::Gem);
    if (sameLane || magnetized) grantPickup(e.subtype);
    return;
  }

  // obstacle
  if (!sameLane) return; // dodged by being in another lane
  const Obstacle ob = static_cast<Obstacle>(e.subtype);
  bool cleared = false;
  if (ob == Obstacle::Low      && player_.action == Action::Jumping) cleared = true;
  if (ob == Obstacle::Overhead && player_.action == Action::Sliding) cleared = true;
  if (cleared) return;

  // collision
  if (shield_) {
    shield_ = false;
    stats_.shieldSaves = true;
    combo_ = 0; recomputeMultiplier();
    return;
  }
  combo_ = 0; recomputeMultiplier();
  state_ = GameState::GameOver;
}

void Simulation::rebuildRenderList() {
  render_.clear();
  render_.reserve(ents_.size());
  for (const auto& e : ents_)
    render_.push_back(RenderItem{e.kind, e.subtype, e.lane, e.dist});
}

void Simulation::step() {
  // 1) apply buffered input
  for (InputCmd c : inbox_) applyInput(c);
  inbox_.clear();

  // 2) player action timer
  if (player_.action != Action::Ground) {
    player_.actionT -= cfg::FIXED_DT;
    if (player_.actionT <= 0.0f) { player_.action = Action::Ground; player_.actionT = 0.0f; }
  }

  // 3) speed + difficulty
  speed_ = std::min(cfg::MAX_SPEED, cfg::BASE_SPEED + dist_ * cfg::SPEED_RAMP);
  float effSpeed = speed_ * (slowmoT_ > 0 ? cfg::SLOWMO_FACTOR : 1.0f);

  // 4) power-up timers
  if (magnetT_ > 0) magnetT_ = std::max(0.0f, magnetT_ - cfg::FIXED_DT);
  if (boostT_  > 0) boostT_  = std::max(0.0f, boostT_  - cfg::FIXED_DT);
  if (slowmoT_ > 0) slowmoT_ = std::max(0.0f, slowmoT_ - cfg::FIXED_DT);

  // 5) advance distance (passive score is derived from integer-meter deltas)
  const float d = effSpeed * cfg::FIXED_DT;
  dist_ += d;

  // 6) move entities toward player; resolve at the hit window
  for (auto& e : ents_) {
    // magnet pull: accelerate nearby coins/gems toward the player row/lane
    if (magnetT_ > 0 && e.kind == 1 && !e.resolved && e.dist < cfg::MAGNET_RANGE &&
        std::abs(e.lane - player_.lane) <= 1 &&
        (static_cast<Pickup>(e.subtype) == Pickup::Coin ||
         static_cast<Pickup>(e.subtype) == Pickup::Gem)) {
      e.lane = player_.lane;
      e.dist -= effSpeed * cfg::FIXED_DT * 2.0f; // extra pull
    }
    e.dist -= effSpeed * cfg::FIXED_DT;
    if (!e.resolved && e.dist <= 0.0f && e.dist > -cfg::HIT_WINDOW) resolveAt(e);
    if (state_ == GameState::GameOver) break;
  }

  // 7) prune passed entities
  ents_.erase(std::remove_if(ents_.begin(), ents_.end(),
              [](const Ent& e){ return e.dist < -cfg::PASS_BEHIND; }), ents_.end());

  // 8) spawn new rows on a distance cadence
  const float gap = std::max(cfg::MIN_GAP, cfg::BASE_GAP - dist_ * cfg::GAP_RAMP);
  spawnAcc_ += d;
  while (spawnAcc_ >= gap) { spawnAcc_ -= gap; spawnRow(); }

  stepIdx_++;
}

void Simulation::advance(float dt) {
  if (state_ != GameState::Playing) { rebuildRenderList(); return; }
  if (dt < 0) dt = 0;
  if (dt > 0.25f) dt = 0.25f; // clamp huge stalls (tab switch) — bounded catch-up

  const float distBefore = dist_;

  acc_ += dt;
  while (acc_ >= cfg::FIXED_DT && state_ == GameState::Playing) {
    step();
    acc_ -= cfg::FIXED_DT;
  }

  // Passive distance score, applied once per advance from integer-meter deltas.
  const uint64_t mBefore = static_cast<uint64_t>(distBefore);
  const uint64_t mAfter  = static_cast<uint64_t>(dist_);
  if (mAfter > mBefore) {
    const uint64_t meters = mAfter - mBefore;
    stats_.score += meters * cfg::DIST_POINTS * static_cast<uint64_t>(mult_) * (boostT_ > 0 ? 2 : 1);
  }
  stats_.distance = static_cast<uint64_t>(dist_);

  rebuildRenderList();
}

uint64_t Simulation::verifyRun(uint64_t seed, bool unlockShield, int skin,
                               const std::vector<std::pair<uint32_t,int>>& tape,
                               uint32_t totalSteps) {
  Simulation s;
  s.reset(seed, unlockShield, skin);
  s.start();
  size_t ti = 0;
  for (uint32_t i = 0; i < totalSteps && s.state_ != GameState::GameOver; ++i) {
    while (ti < tape.size() && tape[ti].first == i) {
      s.queueInput(static_cast<InputCmd>(tape[ti].second));
      ti++;
    }
    // advance exactly one fixed step for reproducibility
    const float distBefore = s.dist_;
    s.step();
    const uint64_t mBefore = static_cast<uint64_t>(distBefore);
    const uint64_t mAfter  = static_cast<uint64_t>(s.dist_);
    if (mAfter > mBefore)
      s.stats_.score += (mAfter - mBefore) * cfg::DIST_POINTS *
                        static_cast<uint64_t>(s.mult_) * (s.boostT_ > 0 ? 2 : 1);
  }
  return s.stats_.score;
}

} // namespace pirun
