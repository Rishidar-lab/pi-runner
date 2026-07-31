/**
 * Pi Network integration — isolated adapter.
 *
 * Nothing else in the game imports the Pi SDK directly. This module:
 *   - detects the Pi Browser and initialises the SDK (sandbox in dev),
 *   - authenticates the Pioneer and verifies the token server-side,
 *   - runs the optional U2A payment for the cosmetic unlock with the full
 *     server approve -> complete flow, plus cancel/error handling,
 *   - degrades gracefully everywhere else (returns a clear "not available").
 *
 * Payments are additionally gated by FLAGS.PI_PAYMENTS_ENABLED so the flow can
 * be shipped dark until it is verified end-to-end in the Pi sandbox.
 */
import { FLAGS, GOLD_UNLOCK } from '../config.js';

// Minimal shape of the Pi SDK we rely on (the SDK ships no types).
interface PiSDK {
  init(opts: { version: string; sandbox?: boolean }): void;
  authenticate(
    scopes: string[],
    onIncompletePaymentFound: (p: PiPayment) => void,
  ): Promise<{ accessToken: string; user: { uid: string; username: string } }>;
  createPayment(
    data: { amount: number; memo: string; metadata: Record<string, unknown> },
    callbacks: PiPaymentCallbacks,
  ): void;
}
interface PiPayment { identifier?: string; transaction?: { txid?: string }; }
interface PiPaymentCallbacks {
  onReadyForServerApproval(paymentId: string): void;
  onReadyForServerCompletion(paymentId: string, txid: string): void;
  onCancel(paymentId: string): void;
  onError(error: Error, payment?: PiPayment): void;
}
declare global { interface Window { Pi?: PiSDK; } }

export interface PiUser { uid: string; username: string; }
export type PiResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: 'not_in_pi_browser' | 'disabled' | 'cancelled' | 'error'; message: string };

export class PiAdapter {
  readonly available: boolean;
  user: PiUser | null = null;
  private accessToken: string | null = null;

  constructor() {
    this.available = typeof window !== 'undefined' && typeof window.Pi !== 'undefined';
    if (this.available && FLAGS.PI_AUTH_ENABLED) {
      try { window.Pi!.init({ version: '2.0', sandbox: FLAGS.PI_SANDBOX }); }
      catch (e) { console.error('Pi.init failed', e); }
    }
  }

  /** Sign in with Pi and verify the token on our server. */
  async login(): Promise<PiResult<PiUser>> {
    if (!this.available) return notInPi();
    if (!FLAGS.PI_AUTH_ENABLED) return disabled();
    try {
      const auth = await window.Pi!.authenticate(
        ['username', 'payments'],
        (p) => this.recoverIncomplete(p),
      );
      this.accessToken = auth.accessToken;
      const res = await fetch('/api/me', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: this.accessToken }),
      });
      if (!res.ok) throw new Error('Server could not verify the access token');
      this.user = { uid: auth.user.uid, username: auth.user.username };
      return { ok: true, value: this.user };
    } catch (e) {
      return { ok: false, reason: 'error', message: (e as Error).message || 'Login failed' };
    }
  }

  /** Check whether this Pioneer already owns the cosmetic unlock. */
  async ownsGoldUnlock(): Promise<boolean> {
    if (!this.user) return false;
    try {
      const r = await fetch(`/api/unlock-status?uid=${encodeURIComponent(this.user.uid)}`);
      const j = await r.json();
      return Boolean(j?.unlocked);
    } catch { return false; }
  }

  /**
   * Buy the optional cosmetic unlock. Resolves ok:true only after the server
   * has completed the payment. Requires FLAGS.PI_PAYMENTS_ENABLED.
   */
  async buyGoldUnlock(): Promise<PiResult<true>> {
    if (!this.available) return notInPi();
    if (!FLAGS.PI_PAYMENTS_ENABLED) return disabled();
    if (!this.user) {
      const login = await this.login();
      if (!login.ok) return login;
    }
    const uid = this.user!.uid;

    return new Promise<PiResult<true>>((resolve) => {
      window.Pi!.createPayment(
        { amount: GOLD_UNLOCK.amount, memo: GOLD_UNLOCK.memo, metadata: { item: GOLD_UNLOCK.id } },
        {
          onReadyForServerApproval: (paymentId) => {
            fetch('/api/approve', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ paymentId, uid }),
            }).catch((e) => console.error('approve failed', e));
          },
          onReadyForServerCompletion: (paymentId, txid) => {
            fetch('/api/complete', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ paymentId, txid, uid }),
            })
              .then((r) => r.json())
              .then((d) => {
                if (d?.ok && d?.granted) resolve({ ok: true, value: true });
                else resolve({ ok: false, reason: 'error', message: 'Unlock not granted' });
              })
              .catch((e) => resolve({ ok: false, reason: 'error', message: String(e) }));
          },
          onCancel: () => resolve({ ok: false, reason: 'cancelled', message: 'Payment cancelled' }),
          onError: (error) => resolve({ ok: false, reason: 'error', message: error.message }),
        },
      );
    });
  }

  /** SDK callback: finish a payment that was interrupted on a prior visit. */
  private recoverIncomplete(p: PiPayment): void {
    const paymentId = p?.identifier;
    if (!paymentId) return;
    fetch('/api/complete', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentId, txid: p.transaction?.txid, uid: this.user?.uid }),
    }).catch(() => { /* best effort */ });
  }
}

const notInPi = (): PiResult<never> =>
  ({ ok: false, reason: 'not_in_pi_browser', message: 'Open Pi Runner in the Pi Browser to use Pi features.' });
const disabled = (): PiResult<never> =>
  ({ ok: false, reason: 'disabled', message: 'This Pi feature is not enabled yet.' });
