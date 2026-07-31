// ============================================================================
//  Pi Runner — Emscripten/embind bindings.
//  Exposes the deterministic core to the TypeScript shell as a JS class.
//  Built only for the WebAssembly target.
// ============================================================================
#include "pirun/pirun.hpp"

#include <emscripten/bind.h>
#include <emscripten/val.h>

using namespace emscripten;
using namespace pirun;

// A JS-friendly facade. It owns a Simulation and returns render data as a flat
// Float32Array — [count, then (kind,subtype,lane,dist) * count] — which is the
// cheapest way to hand the frame's entities to the canvas renderer.
class Runner {
public:
  Runner() { sim_.reset(0, false, 0); }

  void reset(double seed, bool unlockShield, int skin) {
    sim_.reset(static_cast<uint64_t>(seed), unlockShield, skin);
  }
  void start()  { sim_.start(); }
  void pause()  { sim_.pause(); }
  void resume() { sim_.resume(); }
  void input(int cmd) { sim_.queueInput(static_cast<InputCmd>(cmd)); }
  void advance(double dt) { sim_.advance(static_cast<float>(dt)); }

  int    state()       const { return sim_.state(); }
  int    playerLane()  const { return sim_.playerLane(); }
  int    playerAction()const { return sim_.playerAction(); }
  double actionPhase() const { return sim_.actionPhase(); }
  double score()       const { return static_cast<double>(sim_.score()); }
  double coins()       const { return static_cast<double>(sim_.coins()); }
  int    combo()       const { return static_cast<int>(sim_.combo()); }
  int    multiplier()  const { return sim_.multiplier(); }
  double distance()    const { return static_cast<double>(sim_.distance()); }
  double speed()       const { return sim_.speed(); }
  bool   hasShield()   const { return sim_.hasShield(); }
  double magnetLeft()  const { return sim_.magnetLeft(); }
  double boostLeft()   const { return sim_.boostLeft(); }
  double slowmoLeft()  const { return sim_.slowmoLeft(); }
  int    maxCombo()    const { return static_cast<int>(sim_.runStats().maxCombo); }
  double gems()        const { return static_cast<double>(sim_.runStats().gems); }
  int    powerups()    const { return static_cast<int>(sim_.runStats().powerups); }

  // Flat render buffer for the current frame.
  val renderBuffer() const {
    const auto& items = sim_.renderItems();
    std::vector<float> out;
    out.reserve(items.size() * 4);
    for (const auto& it : items) {
      out.push_back(static_cast<float>(it.kind));
      out.push_back(static_cast<float>(it.subtype));
      out.push_back(static_cast<float>(it.lane));
      out.push_back(it.dist);
    }
    return val(typed_memory_view(out.size(), out.data()));
  }

private:
  Simulation sim_;
};

// Save-profile helpers exposed as free functions operating on the opaque blob.
// The TS persistence layer never parses the blob itself — it just stores it.
val profileMake() {
  Profile p;
  val o = val::object();
  o.set("blob", p.serialize());
  o.set("valid", true);
  return o;
}

// Validate/normalize a stored blob; returns { valid, blob, bestScore, coins, ... }.
val profileRead(const std::string& blob) {
  Profile p;
  bool ok = p.deserialize(blob);
  val o = val::object();
  o.set("valid", ok);
  o.set("blob", ok ? p.serialize() : Profile{}.serialize());
  o.set("bestScore",    static_cast<double>(p.bestScore));
  o.set("totalCoins",   static_cast<double>(p.totalCoins));
  o.set("totalDistance",static_cast<double>(p.totalDistance));
  o.set("runsPlayed",   static_cast<double>(p.runsPlayed));
  o.set("skinsUnlocked",static_cast<double>(p.skinsUnlocked));
  o.set("achievements", static_cast<double>(p.achievements));
  o.set("selectedSkin", static_cast<double>(p.selectedSkin));
  o.set("goldUnlock",   static_cast<double>(p.goldUnlock));
  return o;
}

// Merge a finished run + meta changes into a profile blob, re-checksummed in C++.
std::string profileWrite(const std::string& blob, double bestScore, double totalCoins,
                         double totalDistance, double runsPlayed, double skinsUnlocked,
                         double achievements, double selectedSkin, double goldUnlock) {
  Profile p;
  p.deserialize(blob); // defaults on failure
  p.bestScore     = static_cast<uint64_t>(bestScore);
  p.totalCoins    = static_cast<uint64_t>(totalCoins);
  p.totalDistance = static_cast<uint64_t>(totalDistance);
  p.runsPlayed    = static_cast<uint32_t>(runsPlayed);
  p.skinsUnlocked = static_cast<uint32_t>(skinsUnlocked) | 1u;
  p.achievements  = static_cast<uint32_t>(achievements);
  p.selectedSkin  = static_cast<uint32_t>(selectedSkin);
  p.goldUnlock    = static_cast<uint32_t>(goldUnlock);
  return p.serialize();
}

// Server-side score verification: replays a run headlessly from its seed and
// command tape and returns the score the inputs actually produce. The backend
// compares this against the client's claim before trusting a leaderboard entry.
double verifyRun(double seed, bool unlockShield, int skin,
                 val stepsArr, val cmdsArr, double totalSteps) {
  const unsigned n = stepsArr["length"].as<unsigned>();
  std::vector<std::pair<uint32_t,int>> tape;
  tape.reserve(n);
  for (unsigned i = 0; i < n; ++i) {
    tape.emplace_back(stepsArr[i].as<uint32_t>(), cmdsArr[i].as<int>());
  }
  return static_cast<double>(Simulation::verifyRun(
      static_cast<uint64_t>(seed), unlockShield, skin, tape,
      static_cast<uint32_t>(totalSteps)));
}

EMSCRIPTEN_BINDINGS(pirun_module) {
  class_<Runner>("Runner")
      .constructor<>()
      .function("reset", &Runner::reset)
      .function("start", &Runner::start)
      .function("pause", &Runner::pause)
      .function("resume", &Runner::resume)
      .function("input", &Runner::input)
      .function("advance", &Runner::advance)
      .function("state", &Runner::state)
      .function("playerLane", &Runner::playerLane)
      .function("playerAction", &Runner::playerAction)
      .function("actionPhase", &Runner::actionPhase)
      .function("score", &Runner::score)
      .function("coins", &Runner::coins)
      .function("combo", &Runner::combo)
      .function("multiplier", &Runner::multiplier)
      .function("distance", &Runner::distance)
      .function("speed", &Runner::speed)
      .function("hasShield", &Runner::hasShield)
      .function("magnetLeft", &Runner::magnetLeft)
      .function("boostLeft", &Runner::boostLeft)
      .function("slowmoLeft", &Runner::slowmoLeft)
      .function("maxCombo", &Runner::maxCombo)
      .function("gems", &Runner::gems)
      .function("powerups", &Runner::powerups)
      .function("renderBuffer", &Runner::renderBuffer);

  function("profileMake", &profileMake);
  function("profileRead", &profileRead);
  function("profileWrite", &profileWrite);
  function("verifyRun", &verifyRun);
}
