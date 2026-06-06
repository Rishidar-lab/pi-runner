/**
 * Pi Runner — backend
 *
 * Serves the static frontend and implements the three server routes required
 * for Pi Network: identity verification and the payment "double-check" flow
 * (server-side approval + completion).
 *
 * IMPORTANT auth header rule:
 *   - A USER access token  -> "Authorization: Bearer <accessToken>"   (from Pi.authenticate)
 *   - The SERVER API key    -> "Authorization: Key <PI_API_KEY>"       (from the Developer Portal)
 * Do not mix these up.
 */

const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const PI_API_BASE = "https://api.minepi.com/v2";
const PI_API_KEY = process.env.PI_API_KEY || "";

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

/**
 * In-memory store. No database on purpose (keeps the MVP tiny and free to run).
 * unlocks[uid] = true  means that Pioneer has paid for / been granted the unlock.
 * payments[paymentId] = { uid, status } lets us track an in-flight payment.
 * NOTE: this resets on server restart — fine for an MVP / sandbox. Swap for a
 * real datastore before you depend on it in production.
 */
const store = { unlocks: {}, payments: {} };

function requireApiKey(res) {
  if (!PI_API_KEY) {
    res.status(500).json({
      error:
        "PI_API_KEY is not set on the server. Register your app at pi://develop.pinet.com " +
        "in the Pi Browser, copy the API key, and set it as an environment variable.",
    });
    return false;
  }
  return true;
}

/**
 * POST /api/me
 * body: { accessToken }
 * Verifies the access token from Pi.authenticate by calling GET /me with a Bearer header.
 * Returns the Pi user object, or 401 if the token is invalid.
 */
app.post("/api/me", async (req, res) => {
  try {
    const { accessToken } = req.body || {};
    if (!accessToken) return res.status(400).json({ error: "Missing accessToken" });

    const r = await fetch(`${PI_API_BASE}/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!r.ok) return res.status(401).json({ error: "Invalid or expired access token" });

    const user = await r.json();
    return res.json({ ok: true, user });
  } catch (err) {
    console.error("/api/me error:", err);
    return res.status(500).json({ error: "Server error verifying user" });
  }
});

/**
 * POST /api/approve
 * body: { paymentId, uid }
 * Server-side approval: tells the Pi servers this payment is approved so the user
 * can submit the blockchain transaction.
 */
app.post("/api/approve", async (req, res) => {
  if (!requireApiKey(res)) return;
  try {
    const { paymentId, uid } = req.body || {};
    if (!paymentId) return res.status(400).json({ error: "Missing paymentId" });

    store.payments[paymentId] = { uid: uid || null, status: "approved" };

    const r = await fetch(`${PI_API_BASE}/payments/${paymentId}/approve`, {
      method: "POST",
      headers: { Authorization: `Key ${PI_API_KEY}` },
    });

    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.error("approve failed:", data);
      return res.status(r.status).json({ error: "Approve failed", detail: data });
    }
    return res.json({ ok: true, payment: data });
  } catch (err) {
    console.error("/api/approve error:", err);
    return res.status(500).json({ error: "Server error approving payment" });
  }
});

/**
 * POST /api/complete
 * body: { paymentId, txid, uid }
 * Server-side completion: proves to the Pi servers we have the txid so the payment
 * flow can close. On success we grant the unlock for that Pioneer.
 */
app.post("/api/complete", async (req, res) => {
  if (!requireApiKey(res)) return;
  try {
    const { paymentId, txid, uid } = req.body || {};
    if (!paymentId) return res.status(400).json({ error: "Missing paymentId" });

    const r = await fetch(`${PI_API_BASE}/payments/${paymentId}/complete`, {
      method: "POST",
      headers: {
        Authorization: `Key ${PI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ txid }),
    });

    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.error("complete failed:", data);
      return res.status(r.status).json({ error: "Complete failed", detail: data });
    }

    const owner = uid || (store.payments[paymentId] && store.payments[paymentId].uid);
    if (owner) store.unlocks[owner] = true;
    store.payments[paymentId] = { uid: owner, status: "completed" };

    return res.json({ ok: true, granted: Boolean(owner), payment: data });
  } catch (err) {
    console.error("/api/complete error:", err);
    return res.status(500).json({ error: "Server error completing payment" });
  }
});

/**
 * GET /api/unlock-status?uid=...
 * Convenience route so the client can re-check whether a returning Pioneer
 * already owns the unlock.
 */
app.get("/api/unlock-status", (req, res) => {
  const uid = req.query.uid;
  res.json({ unlocked: Boolean(uid && store.unlocks[uid]) });
});

app.listen(PORT, () => {
  console.log(`Pi Runner running on http://localhost:${PORT}`);
  if (!PI_API_KEY) {
    console.log("WARNING: PI_API_KEY is not set — payments will not work until you add it.");
  }
});
