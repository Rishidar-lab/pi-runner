// Build committable, self-contained artifacts so the app can be deployed on a
// host WITHOUT Emscripten — just `npm install && npm start`.
//
// It compiles the C++ core with Emscripten's SINGLE_FILE=1, which embeds the
// wasm as base64 INSIDE the JS (pure text — safe to commit and to push through
// the GitHub contents API; no binary .wasm files). Outputs:
//   public/                     fully self-contained web build (served as-is)
//   server/pirun_core_node.js   single-file node core for leaderboard re-sim
//
// RELEASE TOOLCHAIN IS PINNED. This build must run with Emscripten EXPECTED_EMCC
// (below). That exact version's output is byte-reproducible for this project, so
// the committed artifacts are gated in CI (`git diff --exit-code` after a fresh
// build:dist). To bump the toolchain: change EXPECTED_EMCC here, the version in
// .github/workflows/ci.yml (wasm-build), and the guard in scripts/build-wasm.sh
// together, in one commit, with the regenerated artifacts.
//
// The normal dev build (`npm run build`) still uses the smaller two-file
// (.js + .wasm) layout and is unaffected.
import { execFileSync } from 'node:child_process';
import { stripTypeScriptTypes } from 'node:module';
import { readFile, writeFile, mkdir, cp, readdir, access, rm } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, resolve, relative, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WEB = join(ROOT, 'web');
const SRC = join(WEB, 'src');
const PUBLIC = join(ROOT, 'public');
const SRV = join(ROOT, 'server');

const exists = async (p) => { try { await access(p, constants.F_OK); return true; } catch { return false; } };

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...await walk(p));
    else out.push(p);
  }
  return out;
}

// Pinned release toolchain. A fresh build:dist with this exact version is
// byte-identical to the committed artifacts; CI enforces it.
const EXPECTED_EMCC = '6.0.8';

const COMMON = ['-std=c++17', '-O3', '-flto', '--bind',
  '-sALLOW_MEMORY_GROWTH=1', '-sFILESYSTEM=0', '-sASSERTIONS=0', '-sSINGLE_FILE=1'];
const SOURCES = [join(ROOT, 'core/src/sim.cpp'), join(ROOT, 'core/bindings/wasm.cpp')];
const INC = join(ROOT, 'core/include');

function assertEmccVersion() {
  let out;
  try {
    out = execFileSync('em++', ['--version'], { encoding: 'utf8' });
  } catch {
    console.error('build:dist requires em++ on PATH (Emscripten ' + EXPECTED_EMCC + ').');
    process.exit(1);
  }
  const m = /\b(\d+\.\d+\.\d+)\b/.exec(out);
  const found = m ? m[1] : '(unparsed)';
  if (found !== EXPECTED_EMCC) {
    console.error(
      `build:dist is pinned to Emscripten ${EXPECTED_EMCC} but em++ reports ${found}.\n` +
      `The committed WASM artifacts are only reproducible with the pinned version.\n` +
      `Install it (emsdk install ${EXPECTED_EMCC} && emsdk activate ${EXPECTED_EMCC}) or, to ` +
      `deliberately move the toolchain, update EXPECTED_EMCC here + ci.yml + build-wasm.sh together.`,
    );
    process.exit(1);
  }
  console.log(`Emscripten ${found} (pinned) ✓`);
}

function emcc(args) {
  // em++ (not emcc): current emsdk doesn't auto-link libc++ under emcc+LTO+embind.
  execFileSync('em++', args, { stdio: 'inherit' });
}

async function main() {
  assertEmccVersion();

  // 1) single-file web core -> temp, then into public/core. A fixed temp name
  //    keeps the build reproducible (the -o basename is not embedded in the
  //    SINGLE_FILE output, but a stable name removes all doubt).
  const tmpWeb = join(tmpdir(), 'pirun_web_core.build-dist.js');
  emcc([...SOURCES, '-I', INC, ...COMMON,
    '-sMODULARIZE=1', '-sEXPORT_ES6=1', '-sEXPORT_NAME=createPirunCore', '-sENVIRONMENT=web',
    '-o', tmpWeb]);

  // 2) single-file node core -> server/ (committed; used by leaderboard.js)
  emcc([...SOURCES, '-I', INC, ...COMMON,
    '-sMODULARIZE=1', '-sEXPORT_NAME=createPirunCore', '-sENVIRONMENT=node',
    '-o', join(SRV, 'pirun_core_node.js')]);

  // 3) transpile the TS app into public/ (native ES modules)
  await rm(PUBLIC, { recursive: true, force: true });
  await mkdir(join(PUBLIC, 'core'), { recursive: true });
  let count = 0;
  for (const file of await walk(SRC)) {
    if (!file.endsWith('.ts')) continue;
    const js = stripTypeScriptTypes(await readFile(file, 'utf8'), { mode: 'transform', sourceMap: false });
    const outPath = join(PUBLIC, relative(SRC, file)).replace(/\.ts$/, '.js');
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, js);
    count++;
  }

  // 4) drop in the single-file core + static assets (no separate .wasm)
  await cp(tmpWeb, join(PUBLIC, 'core', 'pirun_core.js'));
  await rm(tmpWeb, { force: true });
  await cp(join(WEB, 'index.html'), join(PUBLIC, 'index.html'));
  await cp(join(WEB, 'style.css'), join(PUBLIC, 'style.css'));
  const vk = join(WEB, 'validation-key.txt');
  if (await exists(vk)) await cp(vk, join(PUBLIC, 'validation-key.txt'));

  console.log(`Dist build complete (self-contained, no Emscripten needed to run):`);
  console.log(`  public/            ${count} modules + single-file core (wasm embedded)`);
  console.log(`  server/pirun_core_node.js  single-file node core`);
}
main().catch((e) => { console.error(e); process.exit(1); });
