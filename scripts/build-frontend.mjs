// Transpile the TypeScript shell (web/src) into public/ as native ES modules,
// WITHOUT touching the compiled C++ core. Use this when you have changed only
// the browser code and want to refresh the committed public/ artifacts on a
// host that has no Emscripten toolchain.
//
//   npm run build:frontend
//
// It reuses the already-committed self-contained core at public/core/
// (public/core/pirun_core.js — wasm embedded). If that file is missing, run the
// full `npm run build:dist` (needs emcc) once to generate it.
//
// Output parity: this produces byte-identical .js to scripts/build-dist.mjs step
// 3, so switching between the two never churns the diff.
import { stripTypeScriptTypes } from 'node:module';
import { readFile, writeFile, mkdir, cp, readdir, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, resolve, relative, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WEB = join(ROOT, 'web');
const SRC = join(WEB, 'src');
const PUBLIC = join(ROOT, 'public');

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

async function main() {
  const core = join(PUBLIC, 'core', 'pirun_core.js');
  if (!(await exists(core))) {
    console.error('Missing public/core/pirun_core.js — run `npm run build:dist` once (needs emcc) to generate the committed core.');
    process.exit(1);
  }

  let count = 0;
  for (const file of await walk(SRC)) {
    if (!file.endsWith('.ts')) continue;
    const js = stripTypeScriptTypes(await readFile(file, 'utf8'), { mode: 'transform', sourceMap: false });
    const outPath = join(PUBLIC, relative(SRC, file)).replace(/\.ts$/, '.js');
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, js);
    count++;
  }

  await cp(join(WEB, 'index.html'), join(PUBLIC, 'index.html'));
  await cp(join(WEB, 'style.css'), join(PUBLIC, 'style.css'));
  const vk = join(WEB, 'validation-key.txt');
  if (await exists(vk)) await cp(vk, join(PUBLIC, 'validation-key.txt'));

  console.log(`Frontend build complete -> public/  (${count} modules transpiled; core untouched)`);
}
main().catch((e) => { console.error(e); process.exit(1); });
