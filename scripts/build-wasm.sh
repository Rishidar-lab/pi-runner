#!/usr/bin/env bash
# Compile the C++ deterministic core -> WebAssembly.
#   * web target  -> web/src/core/pirun_core.{js,wasm}   (ES6 module for the app)
#   * node target -> server/pirun_core_node.js + .wasm    (CommonJS, for the
#                    server's leaderboard re-simulation / anti-cheat)
# Requires an activated Emscripten SDK on PATH (em++ — the C++ compiler driver;
# current emsdk no longer links libc++ automatically when invoked as `emcc` with
# LTO + embind, which broke the link with "undefined symbol: std::__2::...").
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC=("$ROOT/core/src/sim.cpp" "$ROOT/core/bindings/wasm.cpp")
INC="$ROOT/core/include"

# Pinned release toolchain — keep in sync with scripts/build-dist.mjs
# (EXPECTED_EMCC) and .github/workflows/ci.yml (wasm-build). This dev build feeds
# the same sources to Emscripten as build:dist; only the committed self-contained
# artifacts (build:dist) are byte-gated in CI.
EXPECTED_EMCC="6.0.8"
EMCC_VER="$(em++ --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1 || true)"
if [ "$EMCC_VER" != "$EXPECTED_EMCC" ]; then
  echo "build:wasm is pinned to Emscripten $EXPECTED_EMCC but em++ reports '${EMCC_VER:-none}'." >&2
  echo "Install it: emsdk install $EXPECTED_EMCC && emsdk activate $EXPECTED_EMCC" >&2
  exit 1
fi
COMMON=(-std=c++17 -O3 -flto --bind -s ALLOW_MEMORY_GROWTH=1 -s FILESYSTEM=0 -s ASSERTIONS=0)

WEB_OUT="$ROOT/web/src/core"; mkdir -p "$WEB_OUT"
em++ "${SRC[@]}" -I "$INC" "${COMMON[@]}" \
  -s MODULARIZE=1 -s EXPORT_ES6=1 -s EXPORT_NAME=createPirunCore \
  -s ENVIRONMENT=web -s INITIAL_MEMORY=16MB \
  -o "$WEB_OUT/pirun_core.js"

SRV_OUT="$ROOT/server"; mkdir -p "$SRV_OUT"
em++ "${SRC[@]}" -I "$INC" "${COMMON[@]}" \
  -s MODULARIZE=1 -s EXPORT_NAME=createPirunCore \
  -s ENVIRONMENT=node \
  -o "$SRV_OUT/pirun_core_node.js"

echo "WASM build complete:"
ls -la "$WEB_OUT"/pirun_core.js "$WEB_OUT"/pirun_core.wasm \
       "$SRV_OUT"/pirun_core_node.js "$SRV_OUT"/pirun_core_node.wasm
