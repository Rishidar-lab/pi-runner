/**
 * Lightweight, dependency-free security middleware.
 *
 *   securityHeaders  — conservative response headers + a Content-Security-Policy
 *                      that allows exactly what the game needs (self, the Pi SDK,
 *                      Google Fonts). No `helmet` dependency — this is small and
 *                      auditable.
 *   rateLimit(opts)  — in-memory fixed-window limiter keyed by client ip. Enough
 *                      to blunt floods on a single-node SoloHost install; not a
 *                      distributed limiter.
 */
'use strict';

// Pi Runner's index.html loads the Pi SDK from sdk.minepi.com and fonts from
// Google. Inline styles are used by generated UI panels (style="width:..%").
const CSP = [
  "default-src 'self'",
  // 'wasm-unsafe-eval' lets the browser instantiate the deterministic C++ core
  // (compiled to WebAssembly). It does NOT permit JavaScript eval().
  "script-src 'self' 'wasm-unsafe-eval' https://sdk.minepi.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data:",
  "connect-src 'self' https://sdk.minepi.com",
  "worker-src 'self' blob:",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=()');
  if (process.env.DISABLE_CSP !== '1') res.setHeader('Content-Security-Policy', CSP);
  next();
}

function clientIp(req) {
  // SoloHost binds locally / behind one hop; trust the socket, fall back to XFF.
  return (
    req.socket?.remoteAddress ||
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    'unknown'
  );
}

/**
 * @param {{ windowMs?: number, max?: number, name?: string }} opts
 */
function rateLimit(opts = {}) {
  const windowMs = opts.windowMs || 60_000;
  const max = opts.max || 60;
  const buckets = new Map(); // ip -> { count, resetAt }

  // Opportunistic sweep so the map cannot grow unbounded.
  function sweep(now) {
    if (buckets.size < 2048) return;
    for (const [ip, b] of buckets) if (b.resetAt <= now) buckets.delete(ip);
  }

  return function limiter(req, res, next) {
    if (process.env.DISABLE_RATE_LIMIT === '1') return next();
    const now = Date.now();
    sweep(now);
    const ip = clientIp(req);
    let b = buckets.get(ip);
    if (!b || b.resetAt <= now) {
      b = { count: 0, resetAt: now + windowMs };
      buckets.set(ip, b);
    }
    b.count += 1;
    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - b.count)));
    if (b.count > max) {
      res.setHeader('Retry-After', String(Math.ceil((b.resetAt - now) / 1000)));
      return res.status(429).json({ ok: false, error: 'rate_limited' });
    }
    next();
  };
}

module.exports = { securityHeaders, rateLimit, clientIp, CSP };
