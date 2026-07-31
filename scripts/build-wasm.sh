#!/usr/bin/env bash
# Compile the C++ deterministic core -> WebAssembly.
#   * web target  -> web/src/core/pirun_core.{js,wasm}   (ES6 module for the app)
#   * node target -> server/pirun_core_node.js + .wasm    (CommonJS, for the
#                    server's leaderboard re-simulation / anti-cheat)
# Requires an activated Emscripten SDK on PATH (emcc).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC=("$ROOT/core/src/sim.cpp" "$ROOT/core/bindings/wasm.cpp")
INC="$ROOT/core/include"
COMMON=(-std=c++17 -O3 -flto --bind -s ALLOW_MEMORY_GROWTH=1 -s FILESYSTEM=0 -s ASSERTIONS=0)

WEB_OUT="$ROOT/web/src/core"; mkdir -p "$WEB_OUT"
emcc "${SRC[@]}" -I "$INC" "${COMMON[@]}" \
  -s MODULARIZE=1 -s EXPORT_ES6=1 -s EXPORT_NAME=createPirunCore \
  -s ENVIRONMENT=web -s INITIAL_MEMORY=16MB \
  -o "$WEB_OUT/pirun_core.js"

SRV_OUT="$ROOT/server"; mkdir -p "$SRV_OUT"
emcc "${SRC[@]}" -I "$INC" "${COMMON[@]}" \
  -s MODULARIZE=1 -s EXPORT_NAME=createPirunCore \
  -s ENVIRONMENT=node \
  -o "$SRV_OUT/pirun_core_node.js"

echo "WASM build complete:"
ls -la "$WEB_OUT"/pirun_core.js "$WEB_OUT"/pirun_core.wasm \
       "$SRV_OUT"/pirun_core_node.js "$SRV_OUT"/pirun_core_node.wasm
