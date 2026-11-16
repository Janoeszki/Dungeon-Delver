// Retro & Horror Procedural Web Audio Synthesizer
export class SoundController {
    constructor() {
        this.ctx = null;
        this._muted = false;

        Object.defineProperties(this, {
            enabled: {
                enumerable: true,
                configurable: true,
                get: () => !this._muted,
                set: (val) => {
                    this._muted = !Boolean(val);
                }
            },
            muted: {
                enumerable: true,
                configurable: true,
                get: () => this._muted,
                set: (val) => {
                    this._muted = Boolean(val);
                }
            }
        });
    }

    setMuted(muted) {
        this._muted = Boolean(muted);
        return this._muted;
    }

    _resolveAudioContextConstructor() {
        if (typeof window !== 'undefined' && window !== null) {
            return window.AudioContext || window.webkitAudioContext || null;
        }
        if (typeof globalThis !== 'undefined' && globalThis !== null) {
            return globalThis.AudioContext || globalThis.webkitAudioContext || null;
        }
        return null;
    }

    init() {
        if (this.ctx && this.ctx.state === 'closed') {
            this.ctx = null;
        }

        if (!this.ctx) {
            const AudioCtx = this._resolveAudioContextConstructor();
            if (typeof AudioCtx === 'function') {
                try {
                    this.ctx = new AudioCtx();
                } catch {
                    this.ctx = null;
                }
            }
        }

        if (this.ctx && this.ctx.state === 'suspended' && typeof this.ctx.resume === 'function') {
            try {
                const res = this.ctx.resume();
                if (res && typeof res.catch === 'function') {
                    res.catch(() => {});
                }
            } catch {
                // Ignore synchronous resume failures in headless/restricted environments
            }
        }

        return this.ctx;
    }

    _getReadyContext() {
        if (this.muted || !this.enabled) return null;
        const ctx = this.init();
        if (!ctx || ctx.state === 'closed') return null;
        return ctx;
    }

    _createNoiseBuffer(ctx, durationSec, color = 'white') {
        if (!ctx || typeof ctx.createBuffer !== 'function') return null;
        const sampleRate = Math.max(8000, Number(ctx.sampleRate) || 44100);
        const length = Math.max(1, Math.floor(sampleRate * Math.max(0.01, durationSec)));
        const buffer = ctx.createBuffer(1, length, sampleRate);
        if (buffer && typeof buffer.getChannelData === 'function') {
            const data = buffer.getChannelData(0);
            if (data) {
                let lp = 0;
                for (let i = 0; i < data.length; i++) {
                    const white = Math.random() * 2 - 1;
                    if (color === 'dark' || color === 'pink') {
                        lp = lp * 0.78 + white * 0.22;
                        data[i] = Math.max(-1, Math.min(1, lp * 1.8));
                    } else {
                        data[i] = white;
                    }
                }
            }
        }
        return buffer;
    }

    _playNoiseBurst(ctx, {
        startTime,
        duration = 0.2,
        filterType = 'bandpass',
        freqStart = 800,
        freqEnd = null,
        q = 1.5,
        peakGain = 0.14,
        attack = 0.008,
        color = 'white',
        destination = ctx.destination
    } = {}) {
        if (
            !ctx ||
            typeof ctx.createBuffer !== 'function' ||
            typeof ctx.createBufferSource !== 'function' ||
            typeof ctx.createGain !== 'function'
        ) {
            return;
        }

        const t0 = Number.isFinite(startTime) ? startTime : (Number(ctx.currentTime) || 0);
        const dur = Math.max(0.015, Number.isFinite(duration) ? duration : 0.2);
        const atk = Math.min(dur * 0.45, Math.max(0.002, Number.isFinite(attack) ? attack : 0.008));
        const peak = Math.max(0.0002, Number.isFinite(peakGain) ? peakGain : 0.14);

        const buffer = this._createNoiseBuffer(ctx, dur + 0.04, color);
        if (!buffer) return;

        const src = ctx.createBufferSource();
        src.buffer = buffer;

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.linearRampToValueAtTime(peak, t0 + atk);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

        if (filterType && typeof ctx.createBiquadFilter === 'function') {
            const filter = ctx.createBiquadFilter();
            filter.type = filterType;
            if (filter.Q && typeof filter.Q.setValueAtTime === 'function') {
                filter.Q.setValueAtTime(Math.max(0.1, Number.isFinite(q) ? q : 1.5), t0);
            }
            const fStart = Math.max(20, Number.isFinite(freqStart) ? freqStart : 800);
            filter.frequency.setValueAtTime(fStart, t0);
            if (Number.isFinite(freqEnd)) {
                filter.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t0 + dur);
            }
            src.connect(filter);
            filter.connect(gain);
        } else {
            src.connect(gain);
        }

        gain.connect(destination || ctx.destination);
        src.start(t0);
        src.stop(t0 + dur + 0.02);
    }

    _playOscVoice(ctx, {
        type = 'sine',
        startTime,
        duration = 0.2,
        freqStart = 220,
        freqMid = null,
        freqEnd = null,
        rampMode = 'exp',
        attack = 0.005,
        peakGain = 0.15,
        sustainHold = null,
        filter = null,
        mod = null,
        destination = ctx.destination
    } = {}) {
        if (
            !ctx ||
            typeof ctx.createOscillator !== 'function' ||
            typeof ctx.createGain !== 'function'
        ) {
            return;
        }

        const t0 = Number.isFinite(startTime) ? startTime : (Number(ctx.currentTime) || 0);
        const dur = Math.max(0.015, Number.isFinite(duration) ? duration : 0.2);
        const atk = Math.min(dur * 0.45, Math.max(0.002, Number.isFinite(attack) ? attack : 0.005));
        const peak = Math.max(0.0002, Number.isFinite(peakGain) ? peakGain : 0.15);
        const f0 = Math.max(20, Number.isFinite(freqStart) ? freqStart : 220);

        const osc = ctx.createOscillator();
        osc.type = type;
        osc.frequency.setValueAtTime(f0, t0);

        if (freqMid && Number.isFinite(freqMid.freq) && Number.isFinite(freqMid.offset)) {
            const tMid = t0 + Math.max(0.005, Math.min(dur * 0.85, freqMid.offset));
            const fMid = Math.max(20, freqMid.freq);
            if (rampMode === 'linear') {
                osc.frequency.linearRampToValueAtTime(fMid, tMid);
            } else {
                osc.frequency.exponentialRampToValueAtTime(fMid, tMid);
            }
        }

        if (Number.isFinite(freqEnd)) {
            const fEnd = Math.max(20, freqEnd);
            if (rampMode === 'linear') {
                osc.frequency.linearRampToValueAtTime(fEnd, t0 + dur);
            } else {
                osc.frequency.exponentialRampToValueAtTime(fEnd, t0 + dur);
            }
        }

        let modOsc = null;
        if (mod && Number.isFinite(mod.freq) && Number.isFinite(mod.depthStart) && osc.frequency) {
            modOsc = ctx.createOscillator();
            modOsc.type = mod.type || 'sine';
            modOsc.frequency.setValueAtTime(Math.max(0.5, mod.freq), t0);

            const modGain = ctx.createGain();
            const d0 = Math.max(0.1, mod.depthStart);
            modGain.gain.setValueAtTime(d0, t0);
            if (Number.isFinite(mod.depthEnd)) {
                modGain.gain.exponentialRampToValueAtTime(Math.max(0.1, mod.depthEnd), t0 + dur);
            }

            modOsc.connect(modGain);
            modGain.connect(osc.frequency);
        }

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.linearRampToValueAtTime(peak, t0 + atk);
        if (sustainHold && Number.isFinite(sustainHold.gain) && Number.isFinite(sustainHold.offset)) {
            const tHold = Math.max(t0 + atk + 0.002, Math.min(t0 + dur - 0.01, t0 + sustainHold.offset));
            gain.gain.linearRampToValueAtTime(Math.max(0.0002, sustainHold.gain), tHold);
        }
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

        if (filter && filter.type && typeof ctx.createBiquadFilter === 'function') {
            const bq = ctx.createBiquadFilter();
            bq.type = filter.type;
            if (bq.Q && typeof bq.Q.setValueAtTime === 'function') {
                bq.Q.setValueAtTime(Math.max(0.1, Number.isFinite(filter.q) ? filter.q : 1.0), t0);
            }
            const ff0 = Math.max(20, Number.isFinite(filter.freqStart) ? filter.freqStart : 800);
            bq.frequency.setValueAtTime(ff0, t0);
            if (Number.isFinite(filter.freqEnd)) {
                bq.frequency.exponentialRampToValueAtTime(Math.max(20, filter.freqEnd), t0 + dur);
            }
            osc.connect(bq);
            bq.connect(gain);
        } else {
            osc.connect(gain);
        }

        gain.connect(destination || ctx.destination);

        const stopAt = t0 + dur + 0.02;
        if (modOsc) {
            modOsc.start(t0);
            modOsc.stop(stopAt);
        }
        osc.start(t0);
        osc.stop(stopAt);
    }

    playTone(freq, type = 'square', duration = 0.1, gainVal = 0.15, startTime = null) {
        const ctx = this._getReadyContext();
        if (!ctx) return;
        try {
            if (typeof ctx.createOscillator !== 'function' || typeof ctx.createGain !== 'function') return;
            const now = Number.isFinite(startTime) ? startTime : (Number(ctx.currentTime) || 0);
            const safeFreq = Math.max(20, Number.isFinite(freq) ? freq : 440);
            const safeDur = Math.max(0.005, Number.isFinite(duration) ? duration : 0.1);
            const safeGain = Math.max(0.0001, Number.isFinite(gainVal) ? gainVal : 0.15);

            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(safeFreq, now);

            gain.gain.setValueAtTime(safeGain, now);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + safeDur);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + safeDur + 0.01);
        } catch {
            // Fail-safe against partial/broken Web Audio environments
        }
    }

    playSelect() {
        this.playTone(520, 'square', 0.08, 0.12);
    }

    playStep() {
        this.playTone(160 + Math.random() * 40, 'triangle', 0.04, 0.06);
    }

    playRaceSwitch() {
        const ctx = this._getReadyContext();
        if (!ctx) return;
        try {
            const now = Number(ctx.currentTime) || 0;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(320, now);
            osc.frequency.exponentialRampToValueAtTime(640, now + 0.12);

            gain.gain.setValueAtTime(0.2, now);
            gain.gain.linearRampToValueAtTime(0.001, now + 0.12);

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.13);
        } catch {
            // Fail-safe
        }
    }

    playClassEquip(className) {
        const ctx = this._getReadyContext();
        if (!ctx) return;
        try {
            const now = Number(ctx.currentTime) || 0;

            if (className === 'warrior') {
                // Metallic clash
                [440, 660, 880].forEach((freq, idx) => {
                    const t0 = now + idx * 0.04;
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.type = 'sawtooth';
                    osc.frequency.setValueAtTime(freq + idx * 80, t0);

                    gain.gain.setValueAtTime(0.18, t0);
                    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.15);

                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.start(t0);
                    osc.stop(t0 + 0.16);
                });
            } else {
                // Magical shimmer
                [523.25, 659.25, 783.99, 1046.50].forEach((freq, idx) => {
                    const t0 = now + idx * 0.06;
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(freq, t0);

                    gain.gain.setValueAtTime(0.18, t0);
                    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.22);

                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.start(t0);
                    osc.stop(t0 + 0.25);
                });
            }
        } catch {
            // Fail-safe
        }
    }

    playFanfare() {
        const ctx = this._getReadyContext();
        if (!ctx) return;
        const now = Number(ctx.currentTime) || 0;
        const notes = [
            { f: 440, d: 0.1 },
            { f: 554.37, d: 0.1 },
            { f: 659.25, d: 0.12 },
            { f: 880, d: 0.35 }
        ];
        let delay = 0;
        notes.forEach((n) => {
            this.playTone(n.f, 'square', n.d, 0.2, now + delay);
            delay += n.d * 0.85;
        });
    }

    playDiceRoll() {
        const ctx = this._getReadyContext();
        if (!ctx) return;
        const now = Number(ctx.currentTime) || 0;
        for (let i = 0; i < 6; i++) {
            this.playTone(320 + Math.random() * 280, 'triangle', 0.04, 0.12, now + i * 0.05);
        }
    }

    playDiceLand(isCrit = false) {
        if (this.muted || !this.enabled) return;
        if (isCrit) {
            this.playFanfare();
        } else {
            this.playTone(587.33, 'square', 0.15, 0.2);
        }
    }

    playSuccess() {
        const ctx = this._getReadyContext();
        if (!ctx) return;
        const now = Number(ctx.currentTime) || 0;
        const chord = [523.25, 659.25, 783.99, 1046.50];
        chord.forEach((freq, idx) => {
            this.playTone(freq, 'sine', 0.18, 0.18, now + idx * 0.07);
        });
    }

    playFailure() {
        const ctx = this._getReadyContext();
        if (!ctx) return;
        const now = Number(ctx.currentTime) || 0;
        const drop = [320, 260, 200, 140];
        drop.forEach((freq, idx) => {
            this.playTone(freq, 'sawtooth', 0.15, 0.15, now + idx * 0.08);
        });
    }

    playChestOpen() {
        const ctx = this._getReadyContext();
        if (!ctx) return;
        const now = Number(ctx.currentTime) || 0;
        [440, 554, 659, 880, 1108].forEach((f, i) => {
            this.playTone(f, 'sine', 0.12, 0.15, now + i * 0.06);
        });
    }

    playHit() {
        this.playTone(120, 'sawtooth', 0.12, 0.25);
    }

    playRandomize() {
        const ctx = this._getReadyContext();
        if (!ctx) return;
        const now = Number(ctx.currentTime) || 0;
        for (let i = 0; i < 4; i++) {
            this.playTone(250 + Math.random() * 400, 'triangle', 0.06, 0.12, now + i * 0.04);
        }
    }

    /** Sword slash swing */
    playSlash() {
        const ctx = this._getReadyContext();
        if (!ctx) return;
        try {
            const now = Number(ctx.currentTime) || 0;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(600, now);
            osc.frequency.exponentialRampToValueAtTime(140, now + 0.14);
            gain.gain.setValueAtTime(0.22, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.15);
        } catch {
            // Fail-safe
        }
    }

    /** Heavy shield block sound */
    playShieldBlock() {
        const ctx = this._getReadyContext();
        if (!ctx) return;
        try {
            const now = Number(ctx.currentTime) || 0;
            [220, 180, 130].forEach((freq, idx) => {
                const t0 = now + idx * 0.02;
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq, t0);
                gain.gain.setValueAtTime(0.25, t0);
                gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.16);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(t0);
                osc.stop(t0 + 0.17);
            });
        } catch {
            // Fail-safe
        }
    }

    /** Spell fire/arcane blast */
    playSpellCast() {
        const ctx = this._getReadyContext();
        if (!ctx) return;
        try {
            const now = Number(ctx.currentTime) || 0;
            [400, 600, 900, 1200].forEach((freq, idx) => {
                const t0 = now + idx * 0.035;
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, t0);
                gain.gain.setValueAtTime(0.18, t0);
                gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.2);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(t0);
                osc.stop(t0 + 0.22);
            });
        } catch {
            // Fail-safe
        }
    }

    /** Drinking potion / elixir */
    playPotionDrink() {
        const ctx = this._getReadyContext();
        if (!ctx) return;
        try {
            const now = Number(ctx.currentTime) || 0;
            [440, 523.25, 659.25, 880].forEach((freq, idx) => {
                const t0 = now + idx * 0.05;
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, t0);
                gain.gain.setValueAtTime(0.15, t0);
                gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.15);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(t0);
                osc.stop(t0 + 0.16);
            });
        } catch {
            // Fail-safe
        }
    }

    /** Escape / flee whoosh */
    playFlee() {
        const ctx = this._getReadyContext();
        if (!ctx) return;
        try {
            const now = Number(ctx.currentTime) || 0;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(200, now);
            osc.frequency.exponentialRampToValueAtTime(600, now + 0.16);
            gain.gain.setValueAtTime(0.18, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.17);
        } catch {
            // Fail-safe
        }
    }

    /** Deep fantasy brass/bell swell when entering the realm from the title screen. */
    playTitleEnter() {
        const ctx = this._getReadyContext();
        if (!ctx) return;
        try {
            const now = Number(ctx.currentTime) || 0;
            // Resonant low D gong + fifth + bright shimmer
            const voices = [
                { freq: 146.83, type: 'triangle', gain: 0.24, dur: 1.4, delay: 0 },
                { freq: 220.0, type: 'sine', gain: 0.16, dur: 1.2, delay: 0.04 },
                { freq: 293.66, type: 'triangle', gain: 0.14, dur: 1.1, delay: 0.08 },
                { freq: 440.0, type: 'sine', gain: 0.11, dur: 0.95, delay: 0.14 },
                { freq: 587.33, type: 'sine', gain: 0.09, dur: 0.9, delay: 0.2 }
            ];

            voices.forEach((v) => {
                const t0 = now + v.delay;
                const osc = ctx.createOscillator();
                const g = ctx.createGain();
                osc.type = v.type;
                osc.frequency.setValueAtTime(v.freq, t0);

                g.gain.setValueAtTime(0.0001, t0);
                g.gain.linearRampToValueAtTime(v.gain, t0 + 0.03);
                g.gain.exponentialRampToValueAtTime(0.0001, t0 + v.dur);

                osc.connect(g);
                g.connect(ctx.destination);
                osc.start(t0);
                osc.stop(t0 + v.dur + 0.02);
            });
        } catch {
            // Fail-safe
        }
    }

    /** Sparkling arcane crystal chord when interacting with the Phusza rune emblem. */
    playCrystalChime() {
        const ctx = this._getReadyContext();
        if (!ctx) return;
        try {
            const now = Number(ctx.currentTime) || 0;
            [587.33, 880.0, 1046.5, 1318.51].forEach((freq, i) => {
                const t0 = now + i * 0.055;
                const osc = ctx.createOscillator();
                const g = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, t0);
                g.gain.setValueAtTime(0.0001, t0);
                g.gain.linearRampToValueAtTime(0.1, t0 + 0.015);
                g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.8);
                osc.connect(g);
                g.connect(ctx.destination);
                osc.start(t0);
                osc.stop(t0 + 0.85);
            });
        } catch {
            // Fail-safe
        }
    }

    /* ============================================================== */
    /* M3 HORROR & DUNGEON INTERACTION SFX                            */
    /* ============================================================== */

    /** Sharp metallic snap + ominous impact thud when a dungeon trap triggers. */
    playTrapTrigger() {
        const ctx = this._getReadyContext();
        if (!ctx) return;
        try {
            const now = Number(ctx.currentTime) || 0;

            // Layer A: metallic jaw/spring snap
            this._playNoiseBurst(ctx, {
                startTime: now,
                duration: 0.09,
                filterType: 'bandpass',
                freqStart: 3600,
                freqEnd: 1100,
                q: 3.2,
                peakGain: 0.20,
                attack: 0.002,
                color: 'white'
            });
            this._playOscVoice(ctx, {
                type: 'square',
                startTime: now,
                duration: 0.08,
                freqStart: 1180,
                freqEnd: 420,
                attack: 0.002,
                peakGain: 0.12
            });
            this._playOscVoice(ctx, {
                type: 'triangle',
                startTime: now,
                duration: 0.10,
                freqStart: 1740,
                freqEnd: 610,
                attack: 0.002,
                peakGain: 0.10
            });

            // Layer B: ominous impact thud + pit rumble
            this._playOscVoice(ctx, {
                type: 'sine',
                startTime: now + 0.025,
                duration: 0.42,
                freqStart: 145,
                freqEnd: 38,
                attack: 0.004,
                peakGain: 0.24
            });
            this._playNoiseBurst(ctx, {
                startTime: now + 0.025,
                duration: 0.50,
                filterType: 'lowpass',
                freqStart: 320,
                freqEnd: 75,
                q: 1.4,
                peakGain: 0.16,
                attack: 0.01,
                color: 'dark'
            });
        } catch {
            // Fail-safe
        }
    }

    /** Crisp mechanical pin clicks + tension release chime on trap disarm. */
    playTrapDisarm() {
        const ctx = this._getReadyContext();
        if (!ctx) return;
        try {
            const now = Number(ctx.currentTime) || 0;

            // Layer A: double mechanical ratchet/pin clicks
            this._playNoiseBurst(ctx, {
                startTime: now,
                duration: 0.032,
                filterType: 'bandpass',
                freqStart: 2400,
                freqEnd: 1600,
                q: 4.5,
                peakGain: 0.14,
                attack: 0.002,
                color: 'white'
            });
            this._playOscVoice(ctx, {
                type: 'triangle',
                startTime: now,
                duration: 0.025,
                freqStart: 1450,
                freqEnd: 820,
                attack: 0.002,
                peakGain: 0.10
            });

            this._playNoiseBurst(ctx, {
                startTime: now + 0.065,
                duration: 0.038,
                filterType: 'bandpass',
                freqStart: 3100,
                freqEnd: 2100,
                q: 5.0,
                peakGain: 0.15,
                attack: 0.002,
                color: 'white'
            });
            this._playOscVoice(ctx, {
                type: 'triangle',
                startTime: now + 0.065,
                duration: 0.03,
                freqStart: 1880,
                freqEnd: 1120,
                attack: 0.002,
                peakGain: 0.11
            });

            // Layer B: tension release chime
            [
                { freq: 440.0, delay: 0.13, dur: 0.28, gain: 0.10 },
                { freq: 587.33, delay: 0.21, dur: 0.32, gain: 0.11 },
                { freq: 880.0, delay: 0.21, dur: 0.30, gain: 0.05 }
            ].forEach((n) => {
                this._playOscVoice(ctx, {
                    type: 'sine',
                    startTime: now + n.delay,
                    duration: n.dur,
                    freqStart: n.freq,
                    attack: 0.012,
                    peakGain: n.gain
                });
            });
        } catch {
            // Fail-safe
        }
    }

    /** Heavy grating stone drag + rusted iron hinge creak when opening a dungeon door. */
    playDoorOpen() {
        const ctx = this._getReadyContext();
        if (!ctx) return;
        try {
            const now = Number(ctx.currentTime) || 0;

            // Layer A: heavy stone slab drag
            this._playNoiseBurst(ctx, {
                startTime: now,
                duration: 0.72,
                filterType: 'bandpass',
                freqStart: 190,
                freqEnd: 460,
                q: 2.2,
                peakGain: 0.19,
                attack: 0.05,
                color: 'dark'
            });
            this._playOscVoice(ctx, {
                type: 'sawtooth',
                startTime: now,
                duration: 0.72,
                freqStart: 68,
                freqEnd: 54,
                attack: 0.06,
                peakGain: 0.12,
                filter: { type: 'lowpass', freqStart: 240, freqEnd: 130, q: 1.8 }
            });

            // Layer B: FM rusted iron hinge creak
            this._playOscVoice(ctx, {
                type: 'sawtooth',
                startTime: now + 0.08,
                duration: 0.56,
                freqStart: 290,
                freqMid: { freq: 410, offset: 0.28 },
                freqEnd: 340,
                attack: 0.08,
                peakGain: 0.11,
                filter: { type: 'bandpass', freqStart: 780, freqEnd: 1150, q: 6.0 },
                mod: { type: 'sine', freq: 14, depthStart: 22, depthEnd: 14 }
            });

            // Layer C: settling stop thump
            this._playOscVoice(ctx, {
                type: 'triangle',
                startTime: now + 0.68,
                duration: 0.14,
                freqStart: 110,
                freqEnd: 58,
                attack: 0.004,
                peakGain: 0.12
            });
        } catch {
            // Fail-safe
        }
    }

    /** Dull heavy iron clunk + latch rattle when trying a locked door. */
    playDoorLocked() {
        const ctx = this._getReadyContext();
        if (!ctx) return;
        try {
            const now = Number(ctx.currentTime) || 0;

            // Layer A: heavy dead iron clunk
            this._playOscVoice(ctx, {
                type: 'triangle',
                startTime: now,
                duration: 0.13,
                freqStart: 155,
                freqEnd: 58,
                attack: 0.003,
                peakGain: 0.20
            });
            this._playOscVoice(ctx, {
                type: 'square',
                startTime: now,
                duration: 0.10,
                freqStart: 192,
                freqEnd: 135,
                attack: 0.002,
                peakGain: 0.09,
                filter: { type: 'lowpass', freqStart: 380, freqEnd: 260, q: 2.5 }
            });
            this._playNoiseBurst(ctx, {
                startTime: now,
                duration: 0.06,
                filterType: 'lowpass',
                freqStart: 520,
                freqEnd: 160,
                q: 1.5,
                peakGain: 0.12,
                attack: 0.002,
                color: 'dark'
            });

            // Layer B: iron latch double rattle
            this._playOscVoice(ctx, {
                type: 'triangle',
                startTime: now + 0.095,
                duration: 0.08,
                freqStart: 135,
                freqEnd: 72,
                attack: 0.002,
                peakGain: 0.13
            });
            this._playNoiseBurst(ctx, {
                startTime: now + 0.095,
                duration: 0.05,
                filterType: 'bandpass',
                freqStart: 1250,
                freqEnd: 780,
                q: 3.5,
                peakGain: 0.10,
                attack: 0.002,
                color: 'white'
            });

            this._playOscVoice(ctx, {
                type: 'triangle',
                startTime: now + 0.185,
                duration: 0.06,
                freqStart: 118,
                freqEnd: 68,
                attack: 0.002,
                peakGain: 0.07
            });
            this._playNoiseBurst(ctx, {
                startTime: now + 0.185,
                duration: 0.035,
                filterType: 'bandpass',
                freqStart: 1400,
                freqEnd: 900,
                q: 3.5,
                peakGain: 0.06,
                attack: 0.002,
                color: 'white'
            });
        } catch {
            // Fail-safe
        }
    }

    /** Low guttural FM throat growl + breathy filtered rasp for dungeon monsters. */
    playMonsterGrowl() {
        const ctx = this._getReadyContext();
        if (!ctx) return;
        try {
            const now = Number(ctx.currentTime) || 0;

            // Layer A: FM guttural throat growl
            this._playOscVoice(ctx, {
                type: 'sawtooth',
                startTime: now,
                duration: 0.72,
                freqStart: 98,
                freqMid: { freq: 84, offset: 0.22 },
                freqEnd: 56,
                attack: 0.055,
                peakGain: 0.19,
                sustainHold: { gain: 0.15, offset: 0.38 },
                filter: { type: 'lowpass', freqStart: 640, freqEnd: 250, q: 3.8 },
                mod: { type: 'sine', freq: 29, depthStart: 55, depthEnd: 30 }
            });

            // Layer B: chest sub-bass resonance
            this._playOscVoice(ctx, {
                type: 'triangle',
                startTime: now,
                duration: 0.68,
                freqStart: 52,
                freqEnd: 39,
                attack: 0.06,
                peakGain: 0.11
            });

            // Layer C: breathy throat rasp
            this._playNoiseBurst(ctx, {
                startTime: now + 0.04,
                duration: 0.58,
                filterType: 'bandpass',
                freqStart: 720,
                freqEnd: 340,
                q: 3.0,
                peakGain: 0.11,
                attack: 0.06,
                color: 'white'
            });
        } catch {
            // Fail-safe
        }
    }

    /** Creepy dissonant minor-second / tritone horror sting. */
    playDreadStinger() {
        const ctx = this._getReadyContext();
        if (!ctx) return;
        try {
            const now = Number(ctx.currentTime) || 0;

            // Layer A: sub-dread anchor
            this._playOscVoice(ctx, {
                type: 'sawtooth',
                startTime: now,
                duration: 1.22,
                freqStart: 73.42,
                freqEnd: 69.5,
                attack: 0.025,
                peakGain: 0.12,
                filter: { type: 'lowpass', freqStart: 380, freqEnd: 140, q: 1.5 }
            });

            // Layer B: shared eerie lowpass over minor-second + tritone cluster
            let clusterDest = ctx.destination;
            if (typeof ctx.createBiquadFilter === 'function' && typeof ctx.createGain === 'function') {
                const clusterFilter = ctx.createBiquadFilter();
                clusterFilter.type = 'lowpass';
                if (clusterFilter.Q && typeof clusterFilter.Q.setValueAtTime === 'function') {
                    clusterFilter.Q.setValueAtTime(2.2, now);
                }
                clusterFilter.frequency.setValueAtTime(1600, now);
                clusterFilter.frequency.exponentialRampToValueAtTime(420, now + 1.18);
                clusterFilter.connect(ctx.destination);
                clusterDest = clusterFilter;
            }

            [
                { type: 'triangle', f0: 293.66, f1: 288.0, gain: 0.065 }, // D4
                { type: 'sawtooth', f0: 311.13, f1: 305.0, gain: 0.055 }, // Eb4 (minor 2nd clash)
                { type: 'sine', f0: 415.30, f1: 407.0, gain: 0.070 },     // G#4 (tritone)
                { type: 'sine', f0: 622.25, f1: 608.0, gain: 0.045 }      // Eb5
            ].forEach((v) => {
                this._playOscVoice(ctx, {
                    type: v.type,
                    startTime: now,
                    duration: 1.18,
                    freqStart: v.f0,
                    freqEnd: v.f1,
                    attack: 0.02,
                    peakGain: v.gain,
                    destination: clusterDest
                });
            });

            // Layer C: cold breath shiver
            this._playNoiseBurst(ctx, {
                startTime: now,
                duration: 0.60,
                filterType: 'bandpass',
                freqStart: 1800,
                freqEnd: 750,
                q: 2.5,
                peakGain: 0.07,
                attack: 0.02,
                color: 'dark'
            });
        } catch {
            // Fail-safe
        }
    }

    /** Hollow echoing breath/whisper swell when stepping into an unexplored room. */
    playRoomDiscover() {
        const ctx = this._getReadyContext();
        if (!ctx) return;
        try {
            const now = Number(ctx.currentTime) || 0;

            // Layer A: hollow chamber draft & echoing whisper
            this._playNoiseBurst(ctx, {
                startTime: now,
                duration: 1.10,
                filterType: 'bandpass',
                freqStart: 420,
                freqEnd: 920,
                q: 4.5,
                peakGain: 0.13,
                attack: 0.26,
                color: 'dark'
            });
            this._playNoiseBurst(ctx, {
                startTime: now + 0.22,
                duration: 0.92,
                filterType: 'bandpass',
                freqStart: 1150,
                freqEnd: 580,
                q: 5.5,
                peakGain: 0.07,
                attack: 0.18,
                color: 'dark'
            });

            // Layer B: cavernous ghostly resonance
            [
                { freq: 293.66, delay: 0.05, gain: 0.055 },
                { freq: 440.00, delay: 0.16, gain: 0.04 },
                { freq: 698.46, delay: 0.32, gain: 0.03 }
            ].forEach((v) => {
                this._playOscVoice(ctx, {
                    type: 'sine',
                    startTime: now + v.delay,
                    duration: 1.03,
                    freqStart: v.freq,
                    attack: 0.18,
                    peakGain: v.gain
                });
            });
        } catch {
            // Fail-safe
        }
    }
}

export const sound = new SoundController();
