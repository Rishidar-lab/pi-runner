// Build a single self-contained HTML file that runs the whole game client-side
// (WASM embedded), for sharing a playable preview with no server. Not part of
// the production build — the real app ships as public/ served by the backend.
//
// It embeds every ES module as a source string and, at runtime, materialises
// them as Blob URLs in dependency order so native ESM resolves imports. The
// core is compiled with SINGLE_FILE=1 so the wasm is inlined as base64.
import { stripTypeScriptTypes } from 'node:module';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { dirname, resolve, relative, join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WEB = join(ROOT, 'web');
const SRC = join(WEB, 'src');
const SINGLE_CORE = process.argv[2] || '/tmp/pirun_core_single.js';
const OUT = process.argv[3] || join(ROOT, 'preview.html');

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...await walk(p));
    else out.push(p);
  }
  return out;
}

// key = path relative to web/src using posix separators, e.g. "core/coreLoader.js"
function keyOf(absPath) { return relative(SRC, absPath).split(/[\\/]/).join('/').replace(/\.ts$/, '.js'); }

function findDeps(code) {
  const specs = new Set();
  const re = /(?:from|import)\s*['"](\.[^'"]+)['"]/g;
  let m;
  while ((m = re.exec(code))) specs.add(m[1]);
  return [...specs];
}

async function main() {
  const modules = {}; // key -> { code, deps: [{spec, key}] }

  for (const file of await walk(SRC)) {
    if (!file.endsWith('.ts')) continue;
    const key = keyOf(file);
    const code = stripTypeScriptTypes(await readFile(file, 'utf8'), { mode: 'transform', sourceMap: false });
    const deps = findDeps(code).map((spec) => {
      const depKey = posix.normalize(posix.join(posix.dirname(key), spec));
      return { spec, key: depKey };
    });
    modules[key] = { code, deps };
  }

  // The Emscripten single-file core (already JS, wasm embedded).
  modules['core/pirun_core.js'] = { code: await readFile(SINGLE_CORE, 'utf8'), deps: [] };

  const html = await readFile(join(WEB, 'index.html'), 'utf8');
  const css = await readFile(join(WEB, 'style.css'), 'utf8');

  // Strip external <script> tags (Pi SDK) so the preview behaves as "not in Pi
  // Browser" and the module <script src> (we replace it with the loader).
  let body = html
    .replace(/<script src="https:\/\/sdk\.minepi\.com[^>]*><\/script>/g, '')
    .replace(/<link rel="stylesheet" href="\.\/style\.css"[^>]*>/g, `<style>${css}</style>`)
    .replace(/<script type="module" src="\.\/main\.js"><\/script>/g, '');

  const loader = `
<script>
  const MODULES = ${JSON.stringify(modules)};
  const urls = {};
  function build(key) {
    if (urls[key]) return urls[key];
    const m = MODULES[key];
    if (!m) throw new Error('missing module ' + key);
    let code = m.code;
    for (const d of m.deps) { const u = build(d.key); code = code.split(d.spec).join(u); }
    const blob = new Blob([code], { type: 'text/javascript' });
    return (urls[key] = URL.createObjectURL(blob));
  }
  import(build('main.js')).catch((e) => {
    document.body.insertAdjacentHTML('beforeend',
      '<pre style="color:#f88;position:fixed;bottom:0;left:0;right:0;padding:8px;font:12px monospace;background:#200">' + (e && e.stack || e) + '</pre>');
  });
</script>`;

  body = body.replace('</body>', loader + '\n</body>');
  await writeFile(OUT, body);
  console.log('Preview written ->', OUT, `(${Object.keys(modules).length} modules embedded)`);
}
main().catch((e) => { console.error(e); process.exit(1); });
