import { FLAGS, GOLD_UNLOCK } from '../config.js';
export class PiAdapter {
    available;
    user = null;
    accessToken = null;
    get token() {
        return this.accessToken;
    }
    constructor(){
        this.available = typeof window !== 'undefined' && typeof window.Pi !== 'undefined';
        if (this.available && FLAGS.PI_AUTH_ENABLED) {
            try {
                window.Pi.init({
                    version: '2.0',
                    sandbox: FLAGS.PI_SANDBOX
                });
            } catch (e) {
                console.error('Pi.init failed', e);
            }
        }
    }
    async login() {
        if (!this.available) return notInPi();
        if (!FLAGS.PI_AUTH_ENABLED) return disabled();
        try {
            const auth = await window.Pi.authenticate([
                'username',
                'payments'
            ], (p)=>this.recoverIncomplete(p));
            this.accessToken = auth.accessToken;
            const res = await fetch('/api/me', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    accessToken: this.accessToken
                })
            });
            if (!res.ok) throw new Error('Server could not verify the access token');
            this.user = {
                uid: auth.user.uid,
                username: auth.user.username
            };
            return {
                ok: true,
                value: this.user
            };
        } catch (e) {
            return {
                ok: false,
                reason: 'error',
                message: e.message || 'Login failed'
            };
        }
    }
    async ownsGoldUnlock() {
        if (!this.user) return false;
        try {
            const r = await fetch(`/api/unlock-status?uid=${encodeURIComponent(this.user.uid)}`);
            const j = await r.json();
            return Boolean(j?.unlocked);
        } catch  {
            return false;
        }
    }
    async buyGoldUnlock() {
        if (!this.available) return notInPi();
        if (!FLAGS.PI_PAYMENTS_ENABLED) return disabled();
        if (!this.user) {
            const login = await this.login();
            if (!login.ok) return login;
        }
        const uid = this.user.uid;
        return new Promise((resolve)=>{
            window.Pi.createPayment({
                amount: GOLD_UNLOCK.amount,
                memo: GOLD_UNLOCK.memo,
                metadata: {
                    item: GOLD_UNLOCK.id
                }
            }, {
                onReadyForServerApproval: (paymentId)=>{
                    fetch('/api/approve', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            paymentId,
                            uid
                        })
                    }).catch((e)=>console.error('approve failed', e));
                },
                onReadyForServerCompletion: (paymentId, txid)=>{
                    fetch('/api/complete', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            paymentId,
                            txid,
                            uid
                        })
                    }).then((r)=>r.json()).then((d)=>{
                        if (d?.ok && d?.granted) resolve({
                            ok: true,
                            value: true
                        });
                        else resolve({
                            ok: false,
                            reason: 'error',
                            message: 'Unlock not granted'
                        });
                    }).catch((e)=>resolve({
                            ok: false,
                            reason: 'error',
                            message: String(e)
                        }));
                },
                onCancel: ()=>resolve({
                        ok: false,
                        reason: 'cancelled',
                        message: 'Payment cancelled'
                    }),
                onError: (error)=>resolve({
                        ok: false,
                        reason: 'error',
                        message: error.message
                    })
            });
        });
    }
    async showRewardedAd() {
        if (!this.available || !window.Pi?.Ads) return notInPi();
        if (!FLAGS.PI_ADS_ENABLED) return disabled();
        try {
            const ads = window.Pi.Ads;
            const ready = await ads.isAdReady('rewarded');
            if (!ready.ready) {
                const req = await ads.requestAd('rewarded');
                if (req.result !== 'AD_LOADED') return {
                    ok: false,
                    reason: 'error',
                    message: 'No ad available right now.'
                };
            }
            const shown = await ads.showAd('rewarded');
            if (shown.result === 'AD_REWARDED' && shown.adId) return {
                ok: true,
                value: {
                    adId: shown.adId
                }
            };
            if (shown.result === 'AD_CLOSED') return {
                ok: false,
                reason: 'cancelled',
                message: 'Ad closed early — no reward.'
            };
            return {
                ok: false,
                reason: 'error',
                message: 'Ad could not be shown.'
            };
        } catch (e) {
            return {
                ok: false,
                reason: 'error',
                message: e.message || 'Ad error'
            };
        }
    }
    recoverIncomplete(p) {
        const paymentId = p?.identifier;
        if (!paymentId) return;
        fetch('/api/complete', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                paymentId,
                txid: p.transaction?.txid,
                uid: this.user?.uid
            })
        }).catch(()=>{});
    }
}
const notInPi = ()=>({
        ok: false,
        reason: 'not_in_pi_browser',
        message: 'Open Pi Runner in the Pi Browser to use Pi features.'
    });
const disabled = ()=>({
        ok: false,
        reason: 'disabled',
        message: 'This Pi feature is not enabled yet.'
    });
