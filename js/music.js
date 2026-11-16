import { sound } from './audio.js';

const NOTE_INDEX = {
    C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5,
    'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11
};

function noteToFreq(note) {
    const match = /^([A-G](?:#|b)?)(-?\d)$/.exec(note);
    if (!match) return 440;
    const [, pitch, octStr] = match;
    const idx = NOTE_INDEX[pitch];
    if (idx === undefined) return 440;
    const midi = (parseInt(octStr, 10) + 1) * 12 + idx;
    return Math.max(20, 440 * Math.pow(2, (midi - 69) / 12));
}

/**
 * Multi-voice medieval-fantasy & dungeon-horror Web Audio soundtrack engine.
 * Combines RuneScape-inspired modal lute & horn melodies with
 * World of Warcraft-style orchestral strings, timpani, cathedral reverb,
 * deep Floor 1 crypt ambience, and dynamic horror stingers.
 */
export class MusicController {
    constructor({ audio = sound, ctx = null } = {}) {
        this.audio = audio;
        this._injectedCtx = ctx;

        this.ctx = null;
        this.masterGain = null;
        this.compressor = null;
        this.dryBus = null;
        this.wetBus = null;
        this.reverbNode = null;
        this.trackBus = null;
        this.trackDryBus = null;
        this.trackWetBus = null;
        this.stingerBus = null;
        this.analyser = null;
        this.freqData = null;

        this._muted = false;
        Object.defineProperties(this, {
            enabled: {
                enumerable: true,
                configurable: true,
                get: () => !this._muted,
                set: (val) => {
                    this.setMuted(!val);
                }
            },
            muted: {
                enumerable: true,
                configurable: true,
                get: () => this._muted,
                set: (val) => {
                    this.setMuted(val);
                }
            }
        });

        this.volume = 0.65;
        this.tension = 0;
        this.currentTrack = 'title';
        this.isPlaying = false;
        this.awaitingGesture = false;

        this.stepIndex = 0;
        this.nextNoteTime = 0;
        this.schedulerTimer = null;
        this.listeners = new Set();
        this.activeLoopSources = new Set();

        this._playToken = 0;
        this._wasPlayingBeforeMute = false;
        this._lastStingerTimes = new Map();
        this._windNoiseBuffer = null;
        this._windNoiseCtx = null;

        this.tracks = {
            title: this.buildTitleScore(),
            crypt: this.buildCryptScore()
        };
    }

    onChange(callback) {
        if (typeof callback !== 'function') return () => {};
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }

    notifyChange() {
        const snapshot = {
            enabled: this.enabled,
            muted: this.muted,
            isPlaying: this.isPlaying,
            awaitingGesture: this.awaitingGesture,
            track: this.currentTrack,
            trackTitle: this.currentTrack === 'title' ? 'Gates of Phusza' : 'Echoes of the Crypt',
            volume: this.volume
        };
        this.listeners.forEach((cb) => {
            try {
                cb(snapshot);
            } catch {
                // Keep listener dispatch resilient
            }
        });
    }

    _resolveAudioContext() {
        let ctx = this._injectedCtx || (this.audio && typeof this.audio.init === 'function' ? this.audio.init() : null);
        if (ctx && ctx.state === 'closed') {
            if (this._injectedCtx === ctx) {
                this._injectedCtx = null;
            }
            if (this.audio && this.audio.ctx === ctx) {
                this.audio.ctx = null;
            }
            ctx = this._injectedCtx || (this.audio && typeof this.audio.init === 'function' ? this.audio.init() : null);
            if (ctx && ctx.state === 'closed') {
                return null;
            }
        }
        return ctx || null;
    }

    ensureGraph() {
        const ctx = this._resolveAudioContext();
        if (!ctx || typeof ctx.createGain !== 'function') return null;

        if (this.ctx === ctx && this.masterGain && this.dryBus && this.wetBus && this.stingerBus) {
            this._ensureTrackBuses();
            return ctx;
        }

        // Reset cached graph state when binding to a new AudioContext
        this.activeLoopSources.clear();
        this._lastStingerTimes.clear();
        this._windNoiseBuffer = null;
        this._windNoiseCtx = null;
        this.trackBus = null;
        this.trackDryBus = null;
        this.trackWetBus = null;
        this.ctx = ctx;

        const now = Number(ctx.currentTime) || 0;
        this.nextNoteTime = now + 0.06;

        // Dynamics protection against layered brass + pads clipping
        let mixTarget = null;
        if (typeof ctx.createDynamicsCompressor === 'function') {
            const compressor = ctx.createDynamicsCompressor();
            if (compressor.threshold?.setValueAtTime) compressor.threshold.setValueAtTime(-16, now);
            if (compressor.knee?.setValueAtTime) compressor.knee.setValueAtTime(18, now);
            if (compressor.ratio?.setValueAtTime) compressor.ratio.setValueAtTime(4, now);
            if (compressor.attack?.setValueAtTime) compressor.attack.setValueAtTime(0.01, now);
            if (compressor.release?.setValueAtTime) compressor.release.setValueAtTime(0.2, now);
            this.compressor = compressor;
            mixTarget = compressor;
        } else {
            this.compressor = null;
        }

        this.masterGain = ctx.createGain();
        this.masterGain.gain.setValueAtTime(
            !this.muted && this.enabled ? Math.max(0.0001, this.volume * 0.72) : 0.0001,
            now
        );

        if (typeof ctx.createAnalyser === 'function') {
            this.analyser = ctx.createAnalyser();
            this.analyser.fftSize = 64;
            this.analyser.smoothingTimeConstant = 0.8;
            const binCount = Number.isFinite(this.analyser.frequencyBinCount) && this.analyser.frequencyBinCount > 0
                ? this.analyser.frequencyBinCount
                : 0;
            this.freqData = new Uint8Array(binCount);
        } else {
            this.analyser = null;
            this.freqData = null;
        }

        this.dryBus = ctx.createGain();
        this.dryBus.gain.setValueAtTime(0.85, now);

        this.wetBus = ctx.createGain();
        this.wetBus.gain.setValueAtTime(0.45 + this.tension * 0.12, now);

        const postCompressorDest = this.masterGain;
        const mixDest = mixTarget || postCompressorDest;

        this.dryBus.connect(mixDest);

        if (typeof ctx.createConvolver === 'function' && typeof ctx.createBuffer === 'function') {
            this.reverbNode = ctx.createConvolver();
            this.reverbNode.buffer = this.createCathedralImpulse(ctx, 2.4);
            this.wetBus.connect(this.reverbNode);
            this.reverbNode.connect(mixDest);
        } else {
            this.reverbNode = null;
            this.wetBus.connect(mixDest);
        }

        if (mixTarget) {
            mixTarget.connect(postCompressorDest);
        }

        if (this.analyser) {
            this.masterGain.connect(this.analyser);
            this.analyser.connect(ctx.destination);
        } else {
            this.masterGain.connect(ctx.destination);
        }

        this.stingerBus = ctx.createGain();
        this.stingerBus.gain.setValueAtTime(1.0, now);
        this.stingerBus.connect(this.dryBus);
        this.stingerBus.connect(this.wetBus);

        this._ensureTrackBuses();
        return ctx;
    }

    _ensureTrackBuses() {
        const ctx = this.ctx;
        if (!ctx || typeof ctx.createGain !== 'function' || !this.dryBus || !this.wetBus) return null;
        const now = Number(ctx.currentTime) || 0;

        if (!this.trackBus) {
            this.trackBus = ctx.createGain();
            this.trackBus.gain.setValueAtTime(1.0, now);
            this.trackBus.connect(this.dryBus);
            this.trackBus.connect(this.wetBus);
        }
        if (!this.trackDryBus) {
            this.trackDryBus = ctx.createGain();
            this.trackDryBus.gain.setValueAtTime(1.0, now);
            this.trackDryBus.connect(this.dryBus);
        }
        if (!this.trackWetBus) {
            this.trackWetBus = ctx.createGain();
            this.trackWetBus.gain.setValueAtTime(1.0, now);
            this.trackWetBus.connect(this.wetBus);
        }
        return this.trackBus;
    }

    _trackLoopSource(src, stopAt) {
        if (!src) return;
        this.activeLoopSources.add(src);
        if (typeof stopAt === 'number') {
            src.__musicStopAt = stopAt;
        }
        try {
            src.onended = () => {
                this.activeLoopSources.delete(src);
            };
        } catch {
            // Ignore read-only/frozen mock objects
        }
    }

    _pruneExpiredSources(currentTime) {
        if (this.activeLoopSources.size === 0) return;
        for (const src of this.activeLoopSources) {
            if (typeof src.__musicStopAt === 'number' && src.__musicStopAt <= currentTime) {
                this.activeLoopSources.delete(src);
            }
        }
    }

    _retireTrackLoop(fadeOutSec = 0.2) {
        const fade = Math.max(0, Number.isFinite(fadeOutSec) ? fadeOutSec : 0.2);
        const now = Number(this.ctx?.currentTime) || 0;

        for (const bus of [this.trackBus, this.trackDryBus, this.trackWetBus]) {
            if (bus && bus.gain) {
                try {
                    bus.gain.cancelScheduledValues(now);
                    const startVal = Math.max(0.0001, Number.isFinite(bus.gain.value) ? bus.gain.value : 1.0);
                    bus.gain.setValueAtTime(startVal, now);
                    if (fade > 0) {
                        bus.gain.linearRampToValueAtTime(0.0001, now + fade);
                    } else {
                        bus.gain.setValueAtTime(0.0001, now);
                    }
                } catch {
                    // Ignore closed/mock gain errors
                }
            }
        }

        this.trackBus = null;
        this.trackDryBus = null;
        this.trackWetBus = null;

        const stopAt = now + fade + 0.02;
        for (const src of this.activeLoopSources) {
            try {
                if (typeof src.stop === 'function') {
                    src.stop(stopAt);
                }
            } catch {
                // Ignore AlreadyStopped / InvalidStateError
            }
        }
        this.activeLoopSources.clear();
    }

    /** Synthesizes a warm dark stone hall impulse response with high-frequency damping. */
    createCathedralImpulse(ctx, durationSec) {
        const rate = Math.max(8000, Number(ctx.sampleRate) || 44100);
        const length = Math.max(1, Math.floor(rate * Math.max(0.1, durationSec)));
        const impulse = ctx.createBuffer(2, length, rate);

        for (let ch = 0; ch < 2; ch++) {
            const data = typeof impulse?.getChannelData === 'function' ? impulse.getChannelData(ch) : null;
            if (!data) continue;
            let lp = 0;
            for (let i = 0; i < length; i++) {
                const t = i / length;
                const env = Math.pow(1 - t, 2.6);
                const white = Math.random() * 2 - 1;
                // Gentle single-pole low-pass so hall tail feels like stone, not hiss
                lp = lp * 0.72 + white * 0.28;
                data[i] = lp * env;
            }
        }
        return impulse;
    }

    _getWindNoiseBuffer(ctx) {
        if (!ctx || typeof ctx.createBuffer !== 'function') return null;
        if (this._windNoiseBuffer && this._windNoiseCtx === ctx) {
            return this._windNoiseBuffer;
        }
        const rate = Math.max(8000, Number(ctx.sampleRate) || 44100);
        const length = Math.max(1, Math.floor(rate * 2.0));
        const buffer = ctx.createBuffer(1, length, rate);
        if (buffer && typeof buffer.getChannelData === 'function') {
            const data = buffer.getChannelData(0);
            if (data) {
                let lp = 0;
                for (let i = 0; i < data.length; i++) {
                    const white = Math.random() * 2 - 1;
                    lp = lp * 0.82 + white * 0.18;
                    data[i] = Math.max(-1, Math.min(1, lp * 2.0));
                }
            }
        }
        this._windNoiseBuffer = buffer;
        this._windNoiseCtx = ctx;
        return buffer;
    }

    async tryStart(trackName = this.currentTrack) {
        const targetTrack = this.tracks[trackName] ? trackName : 'title';
        this.currentTrack = targetTrack;

        if (this.muted || !this.enabled) {
            this.isPlaying = false;
            this.awaitingGesture = false;
            this.notifyChange();
            return false;
        }

        const token = ++this._playToken;
        const ctx = this.ensureGraph();
        if (!ctx) {
            this.awaitingGesture = true;
            this.isPlaying = false;
            this.notifyChange();
            return false;
        }

        if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
            try {
                await ctx.resume();
            } catch {
                // Autoplay blocked until user gesture
            }
        }

        if (token !== this._playToken || this.muted || !this.enabled) {
            return false;
        }

        if (ctx.state === 'closed' || (ctx.state !== undefined && ctx.state !== 'running')) {
            this.awaitingGesture = true;
            this.isPlaying = false;
            this.notifyChange();
            return false;
        }

        this.awaitingGesture = false;
        if (this.enabled && !this.muted && !this.isPlaying) {
            this.startLoop();
        } else {
            this.notifyChange();
        }
        return true;
    }

    async playTrack(trackName, opts = {}) {
        const { reset = true } = opts || {};
        const targetTrack = this.tracks[trackName] ? trackName : 'title';
        const changed = this.currentTrack !== targetTrack;
        this.currentTrack = targetTrack;

        if (changed || reset) {
            this.stepIndex = 0;
        }

        if (this.muted || !this.enabled) {
            this.isPlaying = false;
            this.notifyChange();
            return false;
        }

        if (this.isPlaying && (changed || reset)) {
            if (this.schedulerTimer) {
                clearInterval(this.schedulerTimer);
                this.schedulerTimer = null;
            }
            this._retireTrackLoop(0.08);
            this.isPlaying = false;
        }

        const ok = await this.tryStart(targetTrack);
        if (!ok || !this.enabled || this.muted) {
            return false;
        }
        return true;
    }

    startLoop() {
        if (!this.ctx || this.ctx.state === 'closed' || this.isPlaying || this.muted || !this.enabled) return;

        if (this.schedulerTimer) {
            clearInterval(this.schedulerTimer);
            this.schedulerTimer = null;
        }

        this._ensureTrackBuses();
        this.isPlaying = true;
        this.awaitingGesture = false;

        const now = Number(this.ctx.currentTime) || 0;
        if (this.masterGain) {
            const currentGain = Number.isFinite(this.masterGain.gain.value) ? this.masterGain.gain.value : 0.0001;
            const targetGain = Math.max(0.0001, this.volume * 0.72);
            this.masterGain.gain.cancelScheduledValues(now);
            this.masterGain.gain.setValueAtTime(Math.max(0.0001, currentGain), now);
            this.masterGain.gain.linearRampToValueAtTime(targetGain, now + 0.35);
        }

        this.nextNoteTime = now + 0.06;
        this.schedulerTick();
        this.schedulerTimer = setInterval(() => this.schedulerTick(), 50);
        this.notifyChange();
    }

    stopLoop(opts = {}) {
        const { fadeOutSec = 0.3 } = opts || {};
        this._playToken++;
        this._wasPlayingBeforeMute = false;
        if (this.schedulerTimer) {
            clearInterval(this.schedulerTimer);
            this.schedulerTimer = null;
        }
        this.isPlaying = false;
        this._lastStingerTimes.clear();
        this._retireTrackLoop(fadeOutSec);
        this.notifyChange();
    }

    stop(opts = {}) {
        return this.stopLoop(opts);
    }

    setMuted(muted) {
        const nextMuted = Boolean(muted);
        const prevMuted = this._muted;
        this._muted = nextMuted;

        if (nextMuted) {
            if (!prevMuted) {
                this._wasPlayingBeforeMute = this.isPlaying;
            }
            this._playToken++;
            if (this.schedulerTimer) {
                clearInterval(this.schedulerTimer);
                this.schedulerTimer = null;
            }
            this.isPlaying = false;
            this._retireTrackLoop(0.15);
            if (this.ctx && this.masterGain) {
                const now = Number(this.ctx.currentTime) || 0;
                const currentGain = Number.isFinite(this.masterGain.gain.value) ? this.masterGain.gain.value : 0.0001;
                this.masterGain.gain.cancelScheduledValues(now);
                this.masterGain.gain.setValueAtTime(Math.max(0.0001, currentGain), now);
                this.masterGain.gain.linearRampToValueAtTime(0.0001, now + 0.15);
            }
            this.notifyChange();
        } else {
            if (this.ctx && this.masterGain) {
                const now = Number(this.ctx.currentTime) || 0;
                const currentGain = Number.isFinite(this.masterGain.gain.value) ? this.masterGain.gain.value : 0.0001;
                this.masterGain.gain.cancelScheduledValues(now);
                this.masterGain.gain.setValueAtTime(Math.max(0.0001, currentGain), now);
                this.masterGain.gain.linearRampToValueAtTime(Math.max(0.0001, this.volume * 0.72), now + 0.25);
            }
            if (this._wasPlayingBeforeMute) {
                this._wasPlayingBeforeMute = false;
                this.tryStart(this.currentTrack);
            } else {
                this.notifyChange();
            }
        }
        return this._muted;
    }

    async toggle() {
        const nextEnabled = !this.enabled;
        this._muted = !nextEnabled;

        if (nextEnabled) {
            if (this.ctx && this.masterGain) {
                const now = Number(this.ctx.currentTime) || 0;
                const currentGain = Number.isFinite(this.masterGain.gain.value) ? this.masterGain.gain.value : 0.0001;
                this.masterGain.gain.cancelScheduledValues(now);
                this.masterGain.gain.setValueAtTime(Math.max(0.0001, currentGain), now);
                this.masterGain.gain.linearRampToValueAtTime(Math.max(0.0001, this.volume * 0.72), now + 0.25);
            }
            const ok = await this.tryStart(this.currentTrack);
            if (!ok) {
                this.notifyChange();
            }
            return ok;
        }

        this._playToken++;
        this._wasPlayingBeforeMute = false;
        if (this.schedulerTimer) {
            clearInterval(this.schedulerTimer);
            this.schedulerTimer = null;
        }
        this.isPlaying = false;
        this._retireTrackLoop(0.25);
        if (this.ctx && this.masterGain) {
            const now = Number(this.ctx.currentTime) || 0;
            const currentGain = Number.isFinite(this.masterGain.gain.value) ? this.masterGain.gain.value : 0.0001;
            this.masterGain.gain.cancelScheduledValues(now);
            this.masterGain.gain.setValueAtTime(Math.max(0.0001, currentGain), now);
            this.masterGain.gain.linearRampToValueAtTime(0.0001, now + 0.25);
        }
        this.notifyChange();
        return false;
    }

    setVolume(val) {
        const num = Number(val);
        if (!Number.isFinite(num)) return this.volume;
        this.volume = Math.max(0, Math.min(1, num));
        if (this.ctx && this.masterGain && this.enabled && !this.muted) {
            const now = Number(this.ctx.currentTime) || 0;
            const target = Math.max(0.0001, this.volume * 0.72);
            if (typeof this.masterGain.gain.setTargetAtTime === 'function') {
                this.masterGain.gain.setTargetAtTime(target, now, 0.05);
            } else {
                this.masterGain.gain.setValueAtTime(target, now);
            }
        }
        this.notifyChange();
        return this.volume;
    }

    setTension(level = 0) {
        const num = Number(level);
        this.tension = Number.isFinite(num) ? Math.max(0, Math.min(1, num)) : 0;
        if (this.ctx && this.wetBus && this.wetBus.gain) {
            const now = Number(this.ctx.currentTime) || 0;
            const targetWet = 0.45 + this.tension * 0.12;
            if (typeof this.wetBus.gain.setTargetAtTime === 'function') {
                this.wetBus.gain.setTargetAtTime(targetWet, now, 0.25);
            } else {
                this.wetBus.gain.setValueAtTime(targetWet, now);
            }
        }
        return this.tension;
    }

    /** Returns normalized 0..1 frequency band values for UI equalizer bars. */
    getSpectrumBars(count = 10) {
        const num = Number(count);
        const safeCount = Number.isFinite(num) ? Math.max(0, Math.min(1024, Math.floor(num))) : 0;
        if (safeCount === 0) return [];
        if (!this.analyser || !this.freqData || this.freqData.length === 0 || !this.isPlaying || !this.enabled || this.muted) {
            return new Array(safeCount).fill(0);
        }
        if (typeof this.analyser.getByteFrequencyData === 'function') {
            this.analyser.getByteFrequencyData(this.freqData);
        }
        const bars = [];
        const usableBins = Math.min(this.freqData.length, 20);
        if (usableBins === 0) {
            return new Array(safeCount).fill(0);
        }
        for (let i = 0; i < safeCount; i++) {
            const bin = Math.min(usableBins - 1, Math.floor((i / safeCount) * usableBins));
            const raw = Number(this.freqData[bin]) || 0;
            bars.push(Math.max(0, Math.min(1, raw / 255)));
        }
        return bars;
    }

    schedulerTick() {
        if (!this.ctx || this.ctx.state === 'closed' || !this.isPlaying || !this.enabled || this.muted) return;

        const now = Number(this.ctx.currentTime) || 0;
        this._pruneExpiredSources(now);

        // Guard against catching up in a burst after browser tab throttling
        if (this.nextNoteTime < now - 0.5) {
            this.nextNoteTime = now + 0.06;
        }

        const score = this.tracks[this.currentTrack] || this.tracks.title;
        const stepDur = 60 / score.bpm / 4; // 16th-note resolution

        while (this.nextNoteTime < now + 0.2) {
            this.scheduleStep(score, this.stepIndex, this.nextNoteTime, stepDur);
            this.nextNoteTime += stepDur;
            this.stepIndex = (this.stepIndex + 1) % score.totalSteps;
        }
    }

    scheduleStep(score, step, time, stepDur) {
        const events = score.eventsByStep.get(step);
        const tensionBoost = this.currentTrack === 'crypt' && this.tension > 0
            ? 1 + this.tension * 0.25
            : 1;

        let hasDrumOnStep = false;

        if (events) {
            for (const ev of events) {
                const dur = Math.max(0.05, (ev.steps || 4) * stepDur);
                const scaledGain = (val) => val * tensionBoost;
                switch (ev.inst) {
                    case 'pad':
                        this.playPad(ev.notes, time, dur, scaledGain(ev.gain ?? 0.12));
                        break;
                    case 'lute':
                        this.playLute(ev.note, time, dur, scaledGain(ev.gain ?? 0.16));
                        break;
                    case 'horn':
                        this.playHorn(ev.note, time, dur, ev.gain ?? 0.19, ev.octave);
                        break;
                    case 'bell':
                        this.playCrystalBell(ev.note, time, dur, scaledGain(ev.gain ?? 0.11));
                        break;
                    case 'drum':
                        hasDrumOnStep = true;
                        this.playTimpani(ev.note || 'D2', time, scaledGain(ev.gain ?? 0.28));
                        break;
                    case 'sub':
                        this.playSubDrone(ev.note || 'D1', time, dur, scaledGain(ev.gain ?? 0.10));
                        break;
                    case 'wind':
                        this.playCryptWind(time, dur, scaledGain(ev.gain ?? 0.045), ev.startFreq ?? 240, ev.peakFreq ?? 460);
                        break;
                    case 'hauntedBell':
                        this.playHauntedChime(ev.note || 'F5', time, dur, scaledGain(ev.gain ?? 0.065));
                        break;
                }
            }
        }

        if (this.currentTrack === 'crypt' && this.tension >= 0.55 && !hasDrumOnStep && step % 32 === 16) {
            this.playTimpani('D1', time, Math.min(0.16, 0.08 + this.tension * 0.06));
        }
    }

    /**
     * Triggers an atmospheric Floor 1 horror/gameplay cue routed through stingerBus,
     * allowing stingers to sound cleanly even after stop() when unmuted.
     */
    triggerStinger(kind = 'dread') {
        if (this.muted || !this.enabled) return false;
        const ctx = this.ensureGraph();
        if (!ctx || ctx.state === 'closed') return false;

        if (ctx.state === 'suspended') {
            if (typeof ctx.resume === 'function') {
                try {
                    const res = ctx.resume();
                    if (res && typeof res.catch === 'function') res.catch(() => {});
                } catch {
                    // Ignore synchronous resume errors
                }
            }
            if (ctx.state !== 'running') {
                return false;
            }
        }

        const rawKey = kind === undefined ? '__default__' : String(kind);
        const now = Number(ctx.currentTime) || 0;
        const prev = this._lastStingerTimes.get(rawKey);
        if (now > 0 && prev !== undefined && (now - prev) >= 0 && (now - prev) < 0.06) {
            return false;
        }
        this._lastStingerTimes.set(rawKey, now);

        // Keep masterGain audible while unmuted even if stop() faded trackBus out
        if (this.masterGain) {
            const target = Math.max(0.0001, this.volume * 0.72);
            if (this.masterGain.gain.value < target * 0.5) {
                this.masterGain.gain.cancelScheduledValues(now);
                this.masterGain.gain.setValueAtTime(Math.max(0.0001, this.masterGain.gain.value || 0.0001), now);
                this.masterGain.gain.linearRampToValueAtTime(target, now + 0.02);
            }
        }

        const bus = this.stingerBus || this.dryBus;
        if (!bus) return false;

        const normalized = typeof kind === 'string' ? kind.trim().toLowerCase() : 'dread';

        try {
            switch (normalized) {
                case 'trap': {
                    // Sharp noise snap + descending tritone + low sub thud
                    this.playCryptWind(now, 0.14, 0.13, 1800, 720, bus);
                    this._scheduleStingerVoice('sawtooth', noteToFreq('F#4'), noteToFreq('C4'), now, 0.28, 0.11, bus, {
                        type: 'bandpass',
                        freqStart: 1900,
                        freqEnd: 520,
                        q: 2.2
                    });
                    this.playTimpani('A1', now + 0.015, 0.15, bus);
                    break;
                }
                case 'combat': {
                    // Menacing brass/minor-2nd stab + timpani impact
                    ['D2', 'D3', 'Eb3', 'A3'].forEach((n) => {
                        this._scheduleStingerVoice('sawtooth', noteToFreq(n), noteToFreq(n) * 0.992, now, 0.48, 0.048, bus, {
                            type: 'lowpass',
                            freqStart: 1450,
                            freqEnd: 480,
                            q: 1.3
                        });
                    });
                    this.playTimpani('D2', now, 0.16, bus);
                    break;
                }
                case 'discover':
                case 'room': {
                    // Hollow bandpass whisper + echoing haunted chime arpeggio
                    this.playCryptWind(now, 0.85, 0.065, 350, 750, bus);
                    ['D5', 'F5', 'G#5'].forEach((n, idx) => {
                        this.playHauntedChime(n, now + idx * 0.075, 0.65, 0.055, bus);
                    });
                    break;
                }
                case 'victory':
                case 'exit': {
                    // Resonant D2 anchor + rising D major/Dorian relief chime
                    this.playSubDrone('D2', now, 1.1, 0.12, bus);
                    ['D4', 'F#4', 'A4', 'D5'].forEach((n, idx) => {
                        this._scheduleStingerVoice('sine', noteToFreq(n), noteToFreq(n), now + idx * 0.075, 0.75, 0.075, bus);
                    });
                    break;
                }
                case 'dread':
                default: {
                    // Low D2->C#2 sub drop + dissonant minor-2nd/tritone cluster + cold breath
                    this._scheduleStingerVoice('sine', noteToFreq('D2'), noteToFreq('C#2'), now, 0.95, 0.13, bus);
                    ['D4', 'Eb4', 'G#4'].forEach((n, idx) => {
                        const f = noteToFreq(n);
                        this._scheduleStingerVoice(idx === 1 ? 'sawtooth' : 'triangle', f, f * 0.985, now, 0.88, 0.052, bus, {
                            type: 'lowpass',
                            freqStart: 1400,
                            freqEnd: 360,
                            q: 2.0
                        });
                    });
                    this.playCryptWind(now, 0.55, 0.055, 920, 380, bus);
                    break;
                }
            }
            return true;
        } catch {
            return false;
        }
    }

    _scheduleStingerVoice(type, freqStart, freqEnd, time, dur, gainVal, bus, filterSpec = null) {
        const ctx = this.ctx;
        if (!ctx || typeof ctx.createOscillator !== 'function' || typeof ctx.createGain !== 'function') return;

        const safeDur = Math.max(0.05, dur);
        const f0 = Math.max(20, freqStart);
        const f1 = Math.max(20, freqEnd);
        const osc = ctx.createOscillator();
        osc.type = type;
        osc.frequency.setValueAtTime(f0, time);
        if (Math.abs(f1 - f0) > 0.05) {
            osc.frequency.exponentialRampToValueAtTime(f1, time + safeDur);
        }

        const env = ctx.createGain();
        env.gain.setValueAtTime(0.0001, time);
        env.gain.linearRampToValueAtTime(Math.max(0.0002, gainVal), time + Math.min(0.03, safeDur * 0.25));
        env.gain.exponentialRampToValueAtTime(0.0001, time + safeDur);

        if (filterSpec && typeof ctx.createBiquadFilter === 'function') {
            const filter = ctx.createBiquadFilter();
            filter.type = filterSpec.type || 'lowpass';
            if (filter.Q?.setValueAtTime) filter.Q.setValueAtTime(Math.max(0.1, filterSpec.q ?? 1.2), time);
            filter.frequency.setValueAtTime(Math.max(20, filterSpec.freqStart ?? 1000), time);
            if (Number.isFinite(filterSpec.freqEnd)) {
                filter.frequency.exponentialRampToValueAtTime(Math.max(20, filterSpec.freqEnd), time + safeDur);
            }
            osc.connect(filter);
            filter.connect(env);
        } else {
            osc.connect(env);
        }

        env.connect(bus);
        osc.start(time);
        osc.stop(time + safeDur + 0.03);
    }

    /* ============================================================== */
    /* ORCHESTRAL / MEDIEVAL & HORROR SYNTHESIS VOICES                */
    /* ============================================================== */

    playPad(notes, time, dur, gainVal) {
        const ctx = this.ctx;
        const outBus = this._ensureTrackBuses();
        if (!ctx || !outBus || typeof ctx.createOscillator !== 'function' || typeof ctx.createGain !== 'function') return;

        const env = ctx.createGain();
        const atk = Math.min(0.65, dur * 0.3);
        const rel = Math.min(0.9, dur * 0.35);
        const safeGain = Math.max(0.0002, gainVal / Math.max(1, notes.length * 0.7));
        env.gain.setValueAtTime(0.0001, time);
        env.gain.linearRampToValueAtTime(safeGain, time + atk);
        env.gain.setValueAtTime(safeGain, Math.max(time + atk, time + dur - rel));
        env.gain.exponentialRampToValueAtTime(0.0001, time + dur + 0.25);
        env.connect(outBus);

        let voiceDest = env;
        if (typeof ctx.createBiquadFilter === 'function') {
            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(520, time);
            filter.frequency.linearRampToValueAtTime(1050, time + Math.min(0.8, dur * 0.45));
            filter.frequency.linearRampToValueAtTime(620, time + dur);
            if (filter.Q?.setValueAtTime) filter.Q.setValueAtTime(0.6, time);
            filter.connect(env);
            voiceDest = filter;
        }

        const stopAt = time + dur + 0.3;
        notes.forEach((n) => {
            const freq = noteToFreq(n);
            [-6, 6].forEach((detune, idx) => {
                const osc = ctx.createOscillator();
                osc.type = idx === 0 ? 'sawtooth' : 'triangle';
                osc.frequency.setValueAtTime(freq, time);
                if (osc.detune?.setValueAtTime) osc.detune.setValueAtTime(detune, time);
                osc.connect(voiceDest);
                osc.start(time);
                osc.stop(stopAt);
                this._trackLoopSource(osc, stopAt);
            });
        });
    }

    playLute(note, time, dur, gainVal) {
        const ctx = this.ctx;
        const outBus = this._ensureTrackBuses();
        if (!ctx || !outBus || typeof ctx.createOscillator !== 'function' || typeof ctx.createGain !== 'function') return;

        const freq = noteToFreq(note);
        const env = ctx.createGain();
        env.gain.setValueAtTime(0.0001, time);
        env.gain.linearRampToValueAtTime(Math.max(0.0002, gainVal), time + 0.012);
        env.gain.exponentialRampToValueAtTime(0.0001, time + Math.max(0.32, dur + 0.2));
        env.connect(outBus);

        let voiceDest = env;
        if (typeof ctx.createBiquadFilter === 'function') {
            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(3200, time);
            filter.frequency.exponentialRampToValueAtTime(420, time + Math.min(0.45, dur + 0.18));
            if (filter.Q?.setValueAtTime) filter.Q.setValueAtTime(1.4, time);
            filter.connect(env);
            voiceDest = filter;
        }

        const osc1 = ctx.createOscillator();
        osc1.type = 'triangle';
        osc1.frequency.setValueAtTime(freq, time);

        const osc2 = ctx.createOscillator();
        osc2.type = 'sawtooth';
        osc2.frequency.setValueAtTime(freq, time);
        if (osc2.detune?.setValueAtTime) osc2.detune.setValueAtTime(4, time);

        const osc2Gain = ctx.createGain();
        osc2Gain.gain.setValueAtTime(0.32, time);

        osc1.connect(voiceDest);
        osc2.connect(osc2Gain);
        osc2Gain.connect(voiceDest);

        const stopAt = time + Math.max(0.38, dur + 0.25);
        osc1.start(time);
        osc2.start(time);
        osc1.stop(stopAt);
        osc2.stop(stopAt);
        this._trackLoopSource(osc1, stopAt);
        this._trackLoopSource(osc2, stopAt);
    }

    playHorn(note, time, dur, gainVal, withOctave = false) {
        const ctx = this.ctx;
        const outBus = this._ensureTrackBuses();
        if (!ctx || !outBus || typeof ctx.createOscillator !== 'function' || typeof ctx.createGain !== 'function') return;

        const freq = noteToFreq(note);
        const env = ctx.createGain();
        const atk = Math.min(0.085, dur * 0.18);
        const rel = Math.min(0.24, dur * 0.25);
        const peak = Math.max(0.0002, gainVal);
        env.gain.setValueAtTime(0.0001, time);
        env.gain.linearRampToValueAtTime(peak, time + atk);
        env.gain.setValueAtTime(Math.max(0.0002, peak * 0.88), Math.max(time + atk, time + dur - rel));
        env.gain.exponentialRampToValueAtTime(0.0001, time + dur + 0.12);
        env.connect(outBus);

        let voiceDest = env;
        if (typeof ctx.createBiquadFilter === 'function') {
            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            if (filter.Q?.setValueAtTime) filter.Q.setValueAtTime(1.1, time);
            filter.frequency.setValueAtTime(340, time);
            filter.frequency.linearRampToValueAtTime(1750, time + Math.min(0.14, dur * 0.25));
            filter.frequency.exponentialRampToValueAtTime(980, time + dur);
            filter.connect(env);
            voiceDest = filter;
        }

        // Gentle vibrato after the initial brass attack
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        lfo.frequency.setValueAtTime(5.2, time);
        lfoGain.gain.setValueAtTime(0, time);
        lfoGain.gain.linearRampToValueAtTime(3.2, time + Math.min(0.35, dur * 0.6));
        lfo.connect(lfoGain);

        const osc1 = ctx.createOscillator();
        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(freq, time);
        if (osc1.detune?.setValueAtTime) osc1.detune.setValueAtTime(-5, time);

        const osc2 = ctx.createOscillator();
        osc2.type = 'sawtooth';
        osc2.frequency.setValueAtTime(freq, time);
        if (osc2.detune?.setValueAtTime) osc2.detune.setValueAtTime(5, time);

        const sub = ctx.createOscillator();
        sub.type = 'triangle';
        sub.frequency.setValueAtTime(Math.max(20, freq * 0.5), time);
        const subGain = ctx.createGain();
        subGain.gain.setValueAtTime(0.34, time);

        lfoGain.connect(osc1.frequency);
        lfoGain.connect(osc2.frequency);

        osc1.connect(voiceDest);
        osc2.connect(voiceDest);
        sub.connect(subGain);
        subGain.connect(voiceDest);

        const stopAt = time + dur + 0.16;

        if (withOctave) {
            const high = ctx.createOscillator();
            high.type = 'sawtooth';
            high.frequency.setValueAtTime(Math.max(20, freq * 2), time);
            const highGain = ctx.createGain();
            highGain.gain.setValueAtTime(0.28, time);
            high.connect(highGain);
            highGain.connect(voiceDest);
            high.start(time);
            high.stop(stopAt);
            this._trackLoopSource(high, stopAt);
        }

        lfo.start(time);
        osc1.start(time);
        osc2.start(time);
        sub.start(time);

        lfo.stop(stopAt);
        osc1.stop(stopAt);
        osc2.stop(stopAt);
        sub.stop(stopAt);

        this._trackLoopSource(lfo, stopAt);
        this._trackLoopSource(osc1, stopAt);
        this._trackLoopSource(osc2, stopAt);
        this._trackLoopSource(sub, stopAt);
    }

    playCrystalBell(note, time, dur, gainVal) {
        const ctx = this.ctx;
        const outBus = this._ensureTrackBuses();
        if (!ctx || !outBus || typeof ctx.createOscillator !== 'function' || typeof ctx.createGain !== 'function') return;

        const freq = noteToFreq(note);
        const env = ctx.createGain();
        env.gain.setValueAtTime(0.0001, time);
        env.gain.linearRampToValueAtTime(Math.max(0.0002, gainVal), time + 0.01);
        env.gain.exponentialRampToValueAtTime(0.0001, time + Math.max(0.9, dur + 0.6));
        env.connect(outBus);

        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, time);

        const harmonic = ctx.createOscillator();
        harmonic.type = 'sine';
        harmonic.frequency.setValueAtTime(Math.max(20, freq * 2.0), time);
        const harmGain = ctx.createGain();
        harmGain.gain.setValueAtTime(0.25, time);

        osc.connect(env);
        harmonic.connect(harmGain);
        harmGain.connect(env);

        const stopAt = time + Math.max(1.0, dur + 0.7);
        osc.start(time);
        harmonic.start(time);
        osc.stop(stopAt);
        harmonic.stop(stopAt);
        this._trackLoopSource(osc, stopAt);
        this._trackLoopSource(harmonic, stopAt);
    }

    playTimpani(note, time, gainVal, targetBus = null) {
        const ctx = this.ctx;
        if (!ctx || typeof ctx.createOscillator !== 'function' || typeof ctx.createGain !== 'function') return;
        const isStinger = Boolean(targetBus && targetBus === this.stingerBus);
        if (!targetBus) {
            this._ensureTrackBuses();
        }
        const outBus = targetBus || this.trackDryBus || this.dryBus;
        if (!outBus) return;

        const freq = noteToFreq(note);
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(Math.max(20, freq * 1.55), time);
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq), time + 0.11);

        const env = ctx.createGain();
        env.gain.setValueAtTime(0.0001, time);
        env.gain.linearRampToValueAtTime(Math.max(0.0002, gainVal), time + 0.015);
        env.gain.exponentialRampToValueAtTime(0.0001, time + 0.65);

        osc.connect(env);
        env.connect(outBus);

        const stopAt = time + 0.7;
        osc.start(time);
        osc.stop(stopAt);
        if (!isStinger) {
            this._trackLoopSource(osc, stopAt);
        }
    }

    /** Deep Floor 1 sub-bass dread pedal with muffled triangle octave overtone. */
    playSubDrone(note, time, dur, gainVal, targetBus = null) {
        const ctx = this.ctx;
        if (!ctx || typeof ctx.createOscillator !== 'function' || typeof ctx.createGain !== 'function') return;
        const isStinger = Boolean(targetBus && targetBus === this.stingerBus);
        if (!targetBus) {
            this._ensureTrackBuses();
        }
        const outBus = targetBus || this.trackBus;
        if (!outBus) return;

        const freq = noteToFreq(note);
        const safeDur = Math.max(0.3, dur);
        const atk = Math.min(1.1, Math.max(0.15, safeDur * 0.35));
        const rel = Math.min(1.0, safeDur * 0.3);
        const peak = Math.max(0.0002, gainVal);

        const env = ctx.createGain();
        env.gain.setValueAtTime(0.0001, time);
        env.gain.linearRampToValueAtTime(peak, time + atk);
        env.gain.setValueAtTime(Math.max(0.0002, peak * 0.85), Math.max(time + atk, time + safeDur - rel));
        env.gain.exponentialRampToValueAtTime(0.0001, time + safeDur + 0.3);
        env.connect(outBus);

        let voiceDest = env;
        if (typeof ctx.createBiquadFilter === 'function') {
            const lp = ctx.createBiquadFilter();
            lp.type = 'lowpass';
            lp.frequency.setValueAtTime(180, time);
            if (lp.Q?.setValueAtTime) lp.Q.setValueAtTime(0.8, time);
            lp.connect(env);
            voiceDest = lp;
        }

        const subOsc = ctx.createOscillator();
        subOsc.type = 'sine';
        subOsc.frequency.setValueAtTime(Math.max(20, freq), time);
        subOsc.connect(voiceDest);

        const overOsc = ctx.createOscillator();
        overOsc.type = 'triangle';
        overOsc.frequency.setValueAtTime(Math.max(20, freq * 2), time);
        const overGain = ctx.createGain();
        overGain.gain.setValueAtTime(0.28, time);
        overOsc.connect(overGain);
        overGain.connect(voiceDest);

        const stopAt = time + safeDur + 0.35;
        subOsc.start(time);
        overOsc.start(time);
        subOsc.stop(stopAt);
        overOsc.stop(stopAt);

        if (!isStinger) {
            this._trackLoopSource(subOsc, stopAt);
            this._trackLoopSource(overOsc, stopAt);
        }
    }

    /** Eerie cold crypt wind draft using cached dark noise buffer & sweeping bandpass filter. */
    playCryptWind(time, dur, gainVal, startFreq = 240, peakFreq = 460, targetBus = null) {
        const ctx = this.ctx;
        if (
            !ctx ||
            typeof ctx.createBuffer !== 'function' ||
            typeof ctx.createBufferSource !== 'function' ||
            typeof ctx.createGain !== 'function'
        ) {
            return;
        }
        const isStinger = Boolean(targetBus && targetBus === this.stingerBus);
        if (!targetBus) {
            this._ensureTrackBuses();
        }
        const outBus = targetBus || this.trackBus;
        if (!outBus) return;

        const buffer = this._getWindNoiseBuffer(ctx);
        if (!buffer) return;

        const safeDur = Math.max(0.1, dur);
        const atk = Math.min(0.9, safeDur * 0.4);
        const peak = Math.max(0.0002, gainVal);

        const src = ctx.createBufferSource();
        src.buffer = buffer;
        src.loop = true;

        const env = ctx.createGain();
        env.gain.setValueAtTime(0.0001, time);
        env.gain.linearRampToValueAtTime(peak, time + atk);
        env.gain.exponentialRampToValueAtTime(0.0001, time + safeDur + 0.15);
        env.connect(outBus);

        if (typeof ctx.createBiquadFilter === 'function') {
            const filter = ctx.createBiquadFilter();
            filter.type = 'bandpass';
            if (filter.Q?.setValueAtTime) filter.Q.setValueAtTime(3.0, time);
            const fStart = Math.max(20, startFreq);
            const fPeak = Math.max(20, peakFreq);
            filter.frequency.setValueAtTime(fStart, time);
            filter.frequency.exponentialRampToValueAtTime(fPeak, time + safeDur * 0.45);
            filter.frequency.exponentialRampToValueAtTime(Math.max(20, fStart * 0.85), time + safeDur);
            src.connect(filter);
            filter.connect(env);
        } else {
            src.connect(env);
        }

        const stopAt = time + safeDur + 0.2;
        src.start(time);
        src.stop(stopAt);
        if (!isStinger) {
            this._trackLoopSource(src, stopAt);
        }
    }

    /** Haunted inharmonic metallic chime with ghost detune into cathedral reverb. */
    playHauntedChime(note, time, dur, gainVal, targetBus = null) {
        const ctx = this.ctx;
        if (!ctx || typeof ctx.createOscillator !== 'function' || typeof ctx.createGain !== 'function') return;
        const isStinger = Boolean(targetBus && targetBus === this.stingerBus);
        if (!targetBus) {
            this._ensureTrackBuses();
        }
        const outBus = targetBus || this.trackWetBus || this.trackBus;
        if (!outBus) return;

        const freq = noteToFreq(note);
        const safeDur = Math.max(1.1, dur + 0.7);
        const env = ctx.createGain();
        env.gain.setValueAtTime(0.0001, time);
        env.gain.linearRampToValueAtTime(Math.max(0.0002, gainVal), time + 0.015);
        env.gain.exponentialRampToValueAtTime(0.0001, time + safeDur);
        env.connect(outBus);

        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, time);
        osc.connect(env);

        const partial = ctx.createOscillator();
        partial.type = 'sine';
        partial.frequency.setValueAtTime(Math.max(20, freq * 2.756), time);
        const partGain = ctx.createGain();
        partGain.gain.setValueAtTime(0.18, time);
        partial.connect(partGain);
        partGain.connect(env);

        const ghost = ctx.createOscillator();
        ghost.type = 'sine';
        ghost.frequency.setValueAtTime(freq, time);
        if (ghost.detune?.setValueAtTime) ghost.detune.setValueAtTime(-18, time);
        const ghostGain = ctx.createGain();
        ghostGain.gain.setValueAtTime(0.35, time);
        ghost.connect(ghostGain);
        ghostGain.connect(env);

        const stopAt = time + safeDur + 0.1;
        osc.start(time);
        partial.start(time);
        ghost.start(time);
        osc.stop(stopAt);
        partial.stop(stopAt);
        ghost.stop(stopAt);

        if (!isStinger) {
            this._trackLoopSource(osc, stopAt);
            this._trackLoopSource(partial, stopAt);
            this._trackLoopSource(ghost, stopAt);
        }
    }

    /* ============================================================== */
    /* COMPOSITIONS                                                   */
    /* ============================================================== */

    /**
     * "Gates of Phusza" — 24-bar orchestral medieval theme (92 BPM, D Minor / Dorian).
     * 16 steps = 1 bar of 4/4 time.
     */
    buildTitleScore() {
        const bars = 24;
        const totalSteps = bars * 16;
        const eventsByStep = new Map();

        const add = (step, event) => {
            const s = ((step % totalSteps) + totalSteps) % totalSteps;
            if (!eventsByStep.has(s)) eventsByStep.set(s, []);
            eventsByStep.get(s).push(event);
        };

        const addArpBar = (bar, notes, gain = 0.13) => {
            const base = bar * 16;
            notes.forEach((n, idx) => {
                if (n) add(base + idx * 2, { inst: 'lute', note: n, steps: 3, gain });
            });
        };

        const addMelody = (bar, offsetStep, note, steps, gain = 0.18, octave = false) => {
            add(bar * 16 + offsetStep, { inst: 'horn', note, steps, gain, octave });
        };

        // --- SECTION 1 (Bars 0-3): Mysterious Runic Awakening ---
        add(0 * 16, { inst: 'pad', notes: ['D3', 'A3', 'F4'], steps: 32, gain: 0.12 });
        add(2 * 16, { inst: 'pad', notes: ['Bb2', 'F3', 'D4'], steps: 16, gain: 0.12 });
        add(3 * 16, { inst: 'pad', notes: ['A2', 'E3', 'C#4'], steps: 16, gain: 0.12 });

        addArpBar(0, ['D3', 'A3', 'D4', 'F4', 'A4', 'F4', 'D4', 'A3'], 0.13);
        addArpBar(1, ['C3', 'G3', 'C4', 'E4', 'G4', 'E4', 'C4', 'G3'], 0.13);
        addArpBar(2, ['Bb2', 'F3', 'Bb3', 'D4', 'F4', 'D4', 'Bb3', 'F3'], 0.13);
        addArpBar(3, ['A2', 'E3', 'A3', 'D4', 'E4', 'C#4', 'A3', 'E3'], 0.13);

        // Sparkling Phusza crystal chimes
        add(0 * 16 + 0, { inst: 'bell', note: 'A5', steps: 8, gain: 0.10 });
        add(1 * 16 + 8, { inst: 'bell', note: 'G5', steps: 8, gain: 0.09 });
        add(2 * 16 + 0, { inst: 'bell', note: 'F5', steps: 8, gain: 0.10 });
        add(3 * 16 + 8, { inst: 'bell', note: 'E5', steps: 8, gain: 0.11 });

        // Soft intro drum heartbeat on bars 2-3
        add(2 * 16, { inst: 'drum', note: 'Bb1', gain: 0.22 });
        add(3 * 16, { inst: 'drum', note: 'A1', gain: 0.24 });
        add(3 * 16 + 12, { inst: 'drum', note: 'A1', gain: 0.18 });

        // --- SECTION 2 (Bars 4-11): Noble RuneScape-inspired Horn Theme ---
        const sec2Chords = [
            ['D3', 'A3', 'F4'],
            ['C3', 'G3', 'E4'],
            ['Bb2', 'F3', 'D4'],
            ['A2', 'E3', 'C#4'],
            ['D3', 'A3', 'F4'],
            ['F3', 'C4', 'A4'],
            ['G2', 'D3', 'Bb3'],
            ['A2', 'E3', 'C#4']
        ];
        const sec2Arps = [
            ['D3', 'A3', 'D4', 'F4', 'A4', 'F4', 'D4', 'A3'],
            ['C3', 'G3', 'C4', 'E4', 'G4', 'E4', 'C4', 'G3'],
            ['Bb2', 'F3', 'Bb3', 'D4', 'F4', 'D4', 'Bb3', 'F3'],
            ['A2', 'E3', 'A3', 'C#4', 'E4', 'C#4', 'A3', 'E3'],
            ['D3', 'A3', 'D4', 'F4', 'A4', 'F4', 'D4', 'A3'],
            ['F3', 'C4', 'F4', 'A4', 'C5', 'A4', 'F4', 'C4'],
            ['G2', 'D3', 'G3', 'Bb3', 'D4', 'Bb3', 'G3', 'D3'],
            ['A2', 'E3', 'A3', 'D4', 'C#4', 'E4', 'A4', 'E4']
        ];
        const sec2Drums = ['D2', 'C2', 'Bb1', 'A1', 'D2', 'F2', 'G2', 'A1'];

        sec2Chords.forEach((ch, idx) => {
            const bar = 4 + idx;
            add(bar * 16, { inst: 'pad', notes: ch, steps: 16, gain: 0.14 });
            addArpBar(bar, sec2Arps[idx], 0.14);
            add(bar * 16, { inst: 'drum', note: sec2Drums[idx], gain: 0.26 });
            add(bar * 16 + 8, { inst: 'drum', note: sec2Drums[idx], gain: 0.17 });
        });

        // Lyrical French Horn melody (Bars 4-11)
        addMelody(4, 0, 'D4', 6, 0.19);
        addMelody(4, 6, 'E4', 2, 0.17);
        addMelody(4, 8, 'F4', 4, 0.19);
        addMelody(4, 12, 'A4', 4, 0.20);

        addMelody(5, 0, 'G4', 8, 0.19);
        addMelody(5, 8, 'E4', 4, 0.17);
        addMelody(5, 12, 'C4', 4, 0.17);

        addMelody(6, 0, 'D4', 4, 0.18);
        addMelody(6, 4, 'F4', 4, 0.19);
        addMelody(6, 8, 'Bb4', 6, 0.21);
        addMelody(6, 14, 'A4', 2, 0.18);

        addMelody(7, 0, 'E4', 8, 0.19);
        addMelody(7, 8, 'C#4', 4, 0.18);
        addMelody(7, 12, 'E4', 4, 0.19);

        addMelody(8, 0, 'F4', 6, 0.20);
        addMelody(8, 6, 'G4', 2, 0.18);
        addMelody(8, 8, 'A4', 4, 0.20);
        addMelody(8, 12, 'D5', 4, 0.22);

        addMelody(9, 0, 'C5', 8, 0.21);
        addMelody(9, 8, 'A4', 4, 0.19);
        addMelody(9, 12, 'F4', 4, 0.18);

        addMelody(10, 0, 'G4', 4, 0.19);
        addMelody(10, 4, 'A4', 4, 0.19);
        addMelody(10, 8, 'Bb4', 4, 0.20);
        addMelody(10, 12, 'G4', 4, 0.18);

        addMelody(11, 0, 'A4', 14, 0.21);
        add(11 * 16 + 4, { inst: 'bell', note: 'E5', steps: 4, gain: 0.10 });
        add(11 * 16 + 8, { inst: 'bell', note: 'A5', steps: 6, gain: 0.11 });
        add(11 * 16 + 12, { inst: 'drum', note: 'A1', gain: 0.20 });
        add(11 * 16 + 14, { inst: 'drum', note: 'A1', gain: 0.23 });

        // --- SECTION 3 (Bars 12-19): WoW-style Climactic Heroic Brass Chorus ---
        const sec3Chords = [
            ['D3', 'A3', 'F4'],
            ['Bb2', 'F3', 'D4'],
            ['C3', 'G3', 'E4'],
            ['D3', 'A3', 'F4'],
            ['Bb2', 'F3', 'D4'],
            ['A2', 'F3', 'C4'],
            ['G2', 'D3', 'Bb3'],
            ['A2', 'E3', 'C#4']
        ];
        const sec3Arps = [
            ['D3', 'A3', 'D4', 'F4', 'A4', 'F4', 'D4', 'A3'],
            ['Bb2', 'F3', 'Bb3', 'D4', 'F4', 'D4', 'Bb3', 'F3'],
            ['C3', 'G3', 'C4', 'E4', 'G4', 'E4', 'C4', 'G3'],
            ['D3', 'A3', 'D4', 'F4', 'A4', 'F4', 'D4', 'A3'],
            ['Bb2', 'F3', 'Bb3', 'D4', 'F4', 'D4', 'Bb3', 'F3'],
            ['A2', 'F3', 'C4', 'F4', 'A4', 'F4', 'C4', 'F3'],
            ['G2', 'D3', 'G3', 'Bb3', 'D4', 'Bb3', 'G3', 'D3'],
            ['A2', 'E3', 'A3', 'C#4', 'E4', 'A4', 'C#5', 'E5']
        ];
        const sec3Drums = ['D2', 'Bb1', 'C2', 'D2', 'Bb1', 'A1', 'G1', 'A1'];

        sec3Chords.forEach((ch, idx) => {
            const bar = 12 + idx;
            add(bar * 16, { inst: 'pad', notes: ch, steps: 16, gain: 0.17 });
            addArpBar(bar, sec3Arps[idx], 0.15);
            // Driving epic timpani pattern
            add(bar * 16 + 0, { inst: 'drum', note: sec3Drums[idx], gain: 0.30 });
            add(bar * 16 + 6, { inst: 'drum', note: sec3Drums[idx], gain: 0.19 });
            add(bar * 16 + 8, { inst: 'drum', note: sec3Drums[idx], gain: 0.26 });
            add(bar * 16 + 12, { inst: 'drum', note: sec3Drums[idx], gain: 0.21 });
        });

        // Octave brass chorus melody
        addMelody(12, 0, 'D5', 8, 0.21, true);
        addMelody(12, 8, 'A4', 4, 0.19, false);
        addMelody(12, 12, 'D5', 4, 0.21, true);

        addMelody(13, 0, 'F5', 6, 0.22, false);
        addMelody(13, 6, 'E5', 2, 0.19, false);
        addMelody(13, 8, 'D5', 4, 0.21, true);
        addMelody(13, 12, 'Bb4', 4, 0.19, false);

        addMelody(14, 0, 'C5', 8, 0.21, true);
        addMelody(14, 8, 'G4', 4, 0.18, false);
        addMelody(14, 12, 'C5', 4, 0.20, true);

        addMelody(15, 0, 'D5', 12, 0.22, true);
        addMelody(15, 12, 'A4', 4, 0.19, false);
        add(15 * 16 + 8, { inst: 'bell', note: 'A5', steps: 6, gain: 0.11 });

        addMelody(16, 0, 'Bb4', 4, 0.20, false);
        addMelody(16, 4, 'D5', 4, 0.21, true);
        addMelody(16, 8, 'F5', 8, 0.22, false);

        addMelody(17, 0, 'C5', 6, 0.21, true);
        addMelody(17, 6, 'D5', 2, 0.19, false);
        addMelody(17, 8, 'C5', 4, 0.20, true);
        addMelody(17, 12, 'A4', 4, 0.19, false);

        addMelody(18, 0, 'G4', 4, 0.19, false);
        addMelody(18, 4, 'Bb4', 4, 0.20, false);
        addMelody(18, 8, 'D5', 4, 0.21, true);
        addMelody(18, 12, 'Bb4', 4, 0.19, false);

        addMelody(19, 0, 'A4', 15, 0.22, true);
        // Dramatic timpani roll into resolving bridge
        add(19 * 16 + 10, { inst: 'drum', note: 'A1', gain: 0.18 });
        add(19 * 16 + 12, { inst: 'drum', note: 'A1', gain: 0.22 });
        add(19 * 16 + 14, { inst: 'drum', note: 'A1', gain: 0.27 });
        add(19 * 16 + 8, { inst: 'bell', note: 'E5', steps: 4, gain: 0.11 });
        add(19 * 16 + 12, { inst: 'bell', note: 'A5', steps: 6, gain: 0.12 });

        // --- SECTION 4 (Bars 20-23): Gentle Resolution & Loop Bridge ---
        add(20 * 16, { inst: 'pad', notes: ['D3', 'A3', 'F4'], steps: 16, gain: 0.15 });
        add(21 * 16, { inst: 'pad', notes: ['C3', 'G3', 'E4'], steps: 16, gain: 0.13 });
        add(22 * 16, { inst: 'pad', notes: ['Bb2', 'F3', 'D4'], steps: 16, gain: 0.12 });
        add(23 * 16, { inst: 'pad', notes: ['A2', 'E3', 'D4'], steps: 16, gain: 0.11 });

        addArpBar(20, ['D3', 'A3', 'D4', 'F4', 'A4', 'F4', 'D4', 'A3'], 0.13);
        addArpBar(21, ['C3', 'G3', 'C4', 'E4', 'G4', 'E4', 'C4', 'G3'], 0.12);
        addArpBar(22, ['Bb2', 'F3', 'Bb3', 'D4', 'F4', 'D4', 'Bb3', 'F3'], 0.11);
        addArpBar(23, ['A2', 'E3', 'A3', 'D4', 'E4', null, null, null], 0.10);

        addMelody(20, 0, 'D5', 8, 0.20);
        addMelody(20, 8, 'C5', 8, 0.18);
        addMelody(21, 0, 'Bb4', 8, 0.17);
        addMelody(21, 8, 'A4', 8, 0.16);
        addMelody(22, 0, 'F4', 12, 0.15);
        add(22 * 16 + 0, { inst: 'bell', note: 'D5', steps: 8, gain: 0.10 });
        add(23 * 16 + 0, { inst: 'bell', note: 'A4', steps: 10, gain: 0.09 });
        add(20 * 16, { inst: 'drum', note: 'D2', gain: 0.26 });

        return { bpm: 92, totalSteps, eventsByStep };
    }

    /**
     * "Echoes of the Crypt" — 16-bar eerie Floor 1 dungeon underscore (72 BPM, D Locrian / Phrygian shadow).
     */
    buildCryptScore() {
        const bars = 16;
        const totalSteps = bars * 16;
        const eventsByStep = new Map();

        const add = (step, event) => {
            const s = ((step % totalSteps) + totalSteps) % totalSteps;
            if (!eventsByStep.has(s)) eventsByStep.set(s, []);
            eventsByStep.get(s).push(event);
        };

        // Deep sub-bass dread drones & cold crypt wind drafts across 4-bar phrases
        add(0 * 16, { inst: 'sub', note: 'D1', steps: 64, gain: 0.10 });
        add(0 * 16, { inst: 'wind', steps: 48, gain: 0.045, startFreq: 210, peakFreq: 420 });
        add(4 * 16, { inst: 'sub', note: 'Eb1', steps: 64, gain: 0.10 });
        add(4 * 16, { inst: 'wind', steps: 48, gain: 0.050, startFreq: 250, peakFreq: 510 });
        add(8 * 16, { inst: 'sub', note: 'C#1', steps: 64, gain: 0.11 });
        add(8 * 16, { inst: 'wind', steps: 48, gain: 0.045, startFreq: 190, peakFreq: 440 });
        add(12 * 16, { inst: 'sub', note: 'A0', steps: 64, gain: 0.11 });
        add(12 * 16, { inst: 'wind', steps: 48, gain: 0.055, startFreq: 260, peakFreq: 540 });

        // Slow, shadowy harmonic pads (minor-second & tritone shadows, <= 0.11)
        add(0 * 16, { inst: 'pad', notes: ['D2', 'A2', 'Eb3'], steps: 32, gain: 0.10 });
        add(2 * 16, { inst: 'pad', notes: ['C2', 'G2', 'Ab3'], steps: 32, gain: 0.095 });
        add(4 * 16, { inst: 'pad', notes: ['Bb1', 'F2', 'D3'], steps: 32, gain: 0.10 });
        add(6 * 16, { inst: 'pad', notes: ['A1', 'Eb2', 'C#3'], steps: 32, gain: 0.095 });

        add(8 * 16, { inst: 'pad', notes: ['D2', 'G#2', 'F3'], steps: 32, gain: 0.10 });
        add(10 * 16, { inst: 'pad', notes: ['C2', 'F#2', 'Eb3'], steps: 32, gain: 0.095 });
        add(12 * 16, { inst: 'pad', notes: ['Bb1', 'E2', 'Db3'], steps: 32, gain: 0.10 });
        add(14 * 16, { inst: 'pad', notes: ['A1', 'E2', 'C#3'], steps: 32, gain: 0.105 });

        // Bars 0-7: Sparse cavern lute + haunted bell echoes
        add(0 * 16 + 2, { inst: 'lute', note: 'D3', steps: 6, gain: 0.09 });
        add(0 * 16 + 8, { inst: 'lute', note: 'Eb3', steps: 6, gain: 0.085 });
        add(1 * 16 + 4, { inst: 'hauntedBell', note: 'F5', steps: 10, gain: 0.065 });

        add(2 * 16 + 0, { inst: 'drum', note: 'D2', gain: 0.14 });
        add(2 * 16 + 6, { inst: 'lute', note: 'G3', steps: 6, gain: 0.085 });
        add(3 * 16 + 8, { inst: 'hauntedBell', note: 'Eb5', steps: 10, gain: 0.06 });

        add(4 * 16 + 0, { inst: 'lute', note: 'F3', steps: 6, gain: 0.09 });
        add(4 * 16 + 10, { inst: 'lute', note: 'D4', steps: 6, gain: 0.085 });
        add(5 * 16 + 6, { inst: 'bell', note: 'A4', steps: 10, gain: 0.07 });

        add(6 * 16 + 0, { inst: 'drum', note: 'A1', gain: 0.14 });
        add(6 * 16 + 8, { inst: 'lute', note: 'Eb3', steps: 6, gain: 0.085 });
        add(7 * 16 + 4, { inst: 'hauntedBell', note: 'C#5', steps: 10, gain: 0.065 });

        // Bars 8-15: Deeper dread motif (tritone leaps & distant tomb heartbeat)
        add(8 * 16 + 0, { inst: 'drum', note: 'D2', gain: 0.15 });
        add(8 * 16 + 4, { inst: 'lute', note: 'D3', steps: 6, gain: 0.09 });
        add(8 * 16 + 10, { inst: 'lute', note: 'G#3', steps: 6, gain: 0.085 });
        add(9 * 16 + 6, { inst: 'hauntedBell', note: 'G#5', steps: 10, gain: 0.06 });

        add(10 * 16 + 0, { inst: 'lute', note: 'Eb3', steps: 6, gain: 0.085 });
        add(10 * 16 + 8, { inst: 'lute', note: 'A3', steps: 6, gain: 0.09 });
        add(11 * 16 + 4, { inst: 'bell', note: 'Eb5', steps: 10, gain: 0.065 });

        add(12 * 16 + 0, { inst: 'drum', note: 'A1', gain: 0.15 });
        add(12 * 16 + 6, { inst: 'lute', note: 'E3', steps: 6, gain: 0.085 });
        add(13 * 16 + 4, { inst: 'hauntedBell', note: 'D5', steps: 10, gain: 0.065 });

        add(14 * 16 + 0, { inst: 'drum', note: 'A1', gain: 0.13 });
        add(14 * 16 + 6, { inst: 'drum', note: 'A1', gain: 0.10 });
        add(14 * 16 + 10, { inst: 'lute', note: 'C#4', steps: 6, gain: 0.08 });
        add(15 * 16 + 6, { inst: 'hauntedBell', note: 'A4', steps: 10, gain: 0.06 });

        return { bpm: 72, totalSteps, eventsByStep };
    }
}

export const music = new MusicController();
