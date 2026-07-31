// ============================================================================
//  Pi Runner — deterministic game core ("the model")
//  Pure C++17, zero external dependencies. Compiles to:
//    * native (for the test suite and server-side re-simulation), and
//    * WebAssembly (via Emscripten) for the browser.
//
//  Determinism contract:
//    Given the same (seed, ordered input commands, fixed timestep), the
//    Simulation produces byte-identical results on every platform. This is
//    what makes server-side score verification (anti-cheat) possible.
// ============================================================================
#ifndef PIRUN_PIRUN_HPP
#define PIRUN_PIRUN_HPP

#include <cstdint>
#include <string>
#include <vector>

namespace pirun {

// ------------------------------- Config ------------------------------------
// All tunable gameplay constants live here so balancing never touches logic.
namespace cfg {
constexpr int   LANE_COUNT      = 3;
constexpr float FIXED_DT        = 1.0f / 120.0f; // deterministic step (s)

constexpr float SPAWN_AHEAD     = 100.0f; // meters an entity spawns ahead of player
constexpr float PASS_BEHIND     = 6.0f;   // meters behind player before removal

constexpr float BASE_SPEED      = 18.0f;  // m/s at run start
constexpr float MAX_SPEED       = 46.0f;
constexpr float SPEED_RAMP      = 0.030f; // + m/s per meter travelled

constexpr float BASE_GAP        = 15.0f;  // meters between spawned rows at start
constexpr float MIN_GAP         = 7.5f;
constexpr float GAP_RAMP        = 0.010f; // gap shrink per meter travelled

constexpr float JUMP_TIME       = 0.62f;  // seconds airborne
constexpr float SLIDE_TIME      = 0.55f;  // seconds sliding
constexpr float HIT_WINDOW      = 1.2f;   // meters around player row = collision zone

constexpr float MAGNET_TIME     = 6.0f;
constexpr float BOOST_TIME      = 6.0f;
constexpr float SLOWMO_TIME     = 4.5f;
constexpr float SLOWMO_FACTOR   = 0.55f;
constexpr float MAGNET_RANGE    = 22.0f;  // meters ahead a magnet pulls pickups
constexpr int   POWERUP_MIN_GAP = 6;      // min rows between powerup spawns

constexpr int   DIST_POINTS     = 1;      // points per meter (x multiplier/boost)
constexpr int   COIN_POINTS     = 5;
constexpr int   GEM_POINTS      = 25;
constexpr int   COMBO_STEP      = 8;      // coins per +1.0 multiplier tier
constexpr int   MULT_CAP        = 5;      // max +tiers over base (so up to x6)
} // namespace cfg

// ------------------------------- Enums -------------------------------------
enum class GameState : int { Menu = 0, Tutorial = 1, Playing = 2, Paused = 3, GameOver = 4 };
enum class Action    : int { Ground = 0, Jumping = 1, Sliding = 2 };
enum class InputCmd  : int { None = 0, Left = 1, Right = 2, Jump = 3, Slide = 4 };

// Obstacles are cleared in different ways, which is what makes jump/slide matter.
enum class Obstacle  : int {
  Barrier  = 0, // full-height: must change lane
  Low      = 1, // low hurdle: jump over it
  Overhead = 2  // overhead bar: slide under it
};

enum class Pickup    : int {
  Coin   = 0,
  Gem    = 1,
  Shield = 2,
  Magnet = 3,
  Boost  = 4,
  SlowMo = 5
};

// Flat render record shared with the TypeScript renderer (kind: 0=obstacle,1=pickup).
struct RenderItem {
  int   kind;    // 0 obstacle, 1 pickup
  int   subtype; // Obstacle or Pickup value
  int   lane;    // 0..LANE_COUNT-1
  float dist;    // meters ahead of player (0 == player row)
};

// --------------------------- Deterministic RNG -----------------------------
// splitmix64 seeding -> xoshiro256** stream. Identical across all targets.
class Rng {
public:
  explicit Rng(uint64_t seed = 0) { reseed(seed); }
  void reseed(uint64_t seed);
  uint64_t next();
  // Uniform in [0,1)
  float nextFloat();
  // Uniform integer in [lo, hi] inclusive
  int   range(int lo, int hi);
private:
  uint64_t s_[4];
};

// ------------------------------ Save Profile -------------------------------
// The persistent player profile. Kept in the core (single source of truth) so
// its serialization and integrity check are covered by the C++ test suite and
// cannot be trivially hand-edited in localStorage (checksum-guarded).
struct Profile {
  uint32_t version      = 1;
  uint64_t bestScore    = 0;
  uint64_t totalCoins   = 0;
  uint64_t totalDistance= 0;   // meters, lifetime
  uint32_t runsPlayed   = 0;
  uint32_t skinsUnlocked= 1u;  // bitmask; bit0 = default skin always owned
  uint32_t achievements = 0u;  // bitmask
  uint32_t selectedSkin = 0u;  // index
  uint32_t goldUnlock   = 0u;  // 1 == owns the optional Pi "Gold Orb + Shield" cosmetic

  // Compact, self-describing, checksum-guarded string for localStorage/cloud.
  std::string serialize() const;
  // Returns false (and leaves *this at defaults) if the blob is malformed or
  // the checksum fails — i.e. tampered or corrupted saves are rejected safely.
  bool deserialize(const std::string& blob);
};

// ------------------------------ Run summary --------------------------------
struct RunStats {
  uint64_t score      = 0;
  uint64_t coins      = 0;
  uint64_t gems       = 0;
  uint64_t distance   = 0;  // meters (floored)
  uint32_t maxCombo   = 0;
  uint32_t powerups   = 0;  // powerups collected this run
  bool     shieldSaves= 0;  // whether a shield absorbed a hit this run
};

// ------------------------------ Simulation ---------------------------------
class Simulation {
public:
  Simulation() { reset(0, false, 0); }

  // Begin a fresh run. `unlockShield` grants one starting shield (the optional
  // Pi cosmetic). `skin` is cosmetic only and never affects gameplay balance.
  void reset(uint64_t seed, bool unlockShield, int skin);

  void start();          // Menu/GameOver -> Playing
  void pause();          // Playing -> Paused
  void resume();         // Paused -> Playing
  void queueInput(InputCmd cmd); // buffered, applied at next fixed step

  // Advance the simulation by `dt` real seconds using an internal fixed-step
  // accumulator. Safe to call with variable frame times; stays deterministic
  // as long as the same dt sequence is replayed.
  void advance(float dt);

  // ---- scalar accessors (used by renderer/UI and by the WASM bindings) ----
  int   state()      const { return static_cast<int>(state_); }
  int   playerLane() const { return player_.lane; }
  int   playerAction()const { return static_cast<int>(player_.action); }
  float actionPhase()const;  // 0..1 progress through current jump/slide
  uint64_t score()   const { return stats_.score; }
  uint64_t coins()   const { return stats_.coins; }
  uint32_t combo()   const { return combo_; }
  int   multiplier() const { return mult_; }
  float speed()      const { return speed_; }
  uint64_t distance()const { return static_cast<uint64_t>(dist_); }
  bool  hasShield()  const { return shield_; }
  float magnetLeft() const { return magnetT_; }
  float boostLeft()  const { return boostT_; }
  float slowmoLeft() const { return slowmoT_; }
  uint64_t seed()    const { return seed_; }

  RunStats runStats() const { return stats_; }

  // Flattened render list (obstacles + pickups currently on screen).
  const std::vector<RenderItem>& renderItems() const { return render_; }

  // ---------- headless replay verification (server-side anti-cheat) --------
  // Deterministically replays a run from a seed and a flat command tape, where
  // each entry is (stepIndex, cmd). Returns the resulting score. The server
  // compares this against the client-claimed score before trusting it.
  static uint64_t verifyRun(uint64_t seed, bool unlockShield, int skin,
                            const std::vector<std::pair<uint32_t,int>>& tape,
                            uint32_t totalSteps);

private:
  friend struct SimTestAccess; // white-box access for the native test suite only

  struct Ent {
    int   kind;     // 0 obstacle, 1 pickup
    int   subtype;
    int   lane;
    float dist;     // meters ahead of player
    bool  resolved; // already interacted with the player row
  };
  struct Player {
    int    lane   = 1;
    Action action = Action::Ground;
    float  actionT= 0.0f; // remaining time in jump/slide
  };

  void step();                 // one FIXED_DT tick
  void applyInput(InputCmd c);
  void spawnRow();
  void resolveAt(Ent& e);
  void rebuildRenderList();
  void grantPickup(int subtype);
  void recomputeMultiplier();

  GameState state_ = GameState::Menu;
  Rng       rng_;
  uint64_t  seed_ = 0;
  int       skin_ = 0;

  Player    player_;
  std::vector<Ent> ents_;
  std::vector<RenderItem> render_;
  std::vector<InputCmd>   inbox_;

  float dist_      = 0.0f;   // meters travelled this run
  float speed_     = cfg::BASE_SPEED;
  float spawnAcc_  = 0.0f;   // meters since last row
  float acc_       = 0.0f;   // fixed-step accumulator
  uint32_t stepIdx_= 0;      // fixed steps elapsed this run

  uint32_t combo_  = 0;
  int      mult_   = 1;
  bool     shield_ = false;
  float    magnetT_= 0.0f;
  float    boostT_ = 0.0f;
  float    slowmoT_= 0.0f;
  int      rowsSincePowerup_ = 99;

  RunStats stats_{};
};

} // namespace pirun
#endif // PIRUN_PIRUN_HPP
