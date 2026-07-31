// Build the TypeScript shell -> public/ as native ES modules, using Node's
// built-in TypeScript transform (no external bundler required). Run
// scripts/build-wasm.sh first so the compiled core exists.
//
// Output layout (served by the backend from ../public):
//   public/index.html, style.css, validation-key.txt
//   public/*.js               (transpiled from web/src, structure mirrored)
//   public/core/pirun_core.js  + pirun_core.wasm   (Emscripten core)
import { stripTypeScriptTypes } from 'node:module';
import { readFile, writeFile, mkdir, cp, readdir, access, rm } from 'node:fs/promises';
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
  const wasm = join(SRC, 'core', 'pirun_core.wasm');
  const glue = join(SRC, 'core', 'pirun_core.js');
  if (!(await exists(wasm)) || !(await exists(glue))) {
    console.error('Missing compiled core — run scripts/build-wasm.sh first.');
    process.exit(1);
  }

  await rm(PUBLIC, { recursive: true, force: true });
  await mkdir(join(PUBLIC, 'core'), { recursive: true });

  // Transpile every .ts (except the generated glue) to a mirrored .js file.
  let count = 0;
  for (const file of await walk(SRC)) {
    if (!file.endsWith('.ts')) continue;
    const code = await readFile(file, 'utf8');
    const js = stripTypeScriptTypes(code, { mode: 'transform', sourceMap: false });
    const outPath = join(PUBLIC, relative(SRC, file)).replace(/\.ts$/, '.js');
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, js);
    count++;
  }

  // Copy the Emscripten core + static assets.
  await cp(glue, join(PUBLIC, 'core', 'pirun_core.js'));
  await cp(wasm, join(PUBLIC, 'core', 'pirun_core.wasm'));
  await cp(join(WEB, 'index.html'), join(PUBLIC, 'index.html'));
  await cp(join(WEB, 'style.css'), join(PUBLIC, 'style.css'));
  const vk = join(WEB, 'validation-key.txt');
  if (await exists(vk)) await cp(vk, join(PUBLIC, 'validation-key.txt'));

  console.log(`Web build complete -> public/  (${count} modules transpiled)`);
}
main().catch((e) => { console.error(e); process.exit(1); });
